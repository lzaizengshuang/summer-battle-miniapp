const cloud = require('wx-server-sdk');
const { success, fail, getOpenId, recalculateProgress } = require('../utils');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

function stripInternalFields(doc) {
  const { _id, _openid, ...rest } = doc;
  return rest;
}

exports.main = async (event, context) => {
  try {
    const openid = getOpenId();
    if (!openid) return fail('UNAUTHORIZED', '无法获取用户 openid');

    const { childId, json, mode } = event;
    if (!childId) return fail('INVALID_PARAMS', 'childId 不能为空');
    if (!json || typeof json !== 'string') return fail('INVALID_PARAMS', 'json 不能为空');
    if (mode !== 'merge' && mode !== 'overwrite') {
      return fail('INVALID_PARAMS', 'mode 必须为 merge 或 overwrite');
    }

    const profileRes = await db.collection('childProfiles')
      .where({ _openid: openid, _id: childId })
      .limit(1)
      .get();

    if (profileRes.data.length === 0) return fail('NOT_FOUND', '找不到指定的孩子档案');

    let backup;
    try {
      backup = JSON.parse(json);
    } catch (e) {
      return fail('INVALID_PARAMS', 'json 格式错误');
    }

    if (!backup.plans || !Array.isArray(backup.plans)) {
      return fail('INVALID_PARAMS', '备份数据缺少 plans');
    }

    // overwrite：删除当前档案下的 plans、records、progress
    if (mode === 'overwrite') {
      const [oldPlans, oldRecords, oldProgress] = await Promise.all([
        db.collection('plans').where({ _openid: openid, childId }).get(),
        db.collection('records').where({ _openid: openid, childId }).get(),
        db.collection('progress').where({ _openid: openid, childId }).get()
      ]);

      for (const p of oldPlans.data) await db.collection('plans').doc(p._id).remove();
      for (const r of oldRecords.data) await db.collection('records').doc(r._id).remove();
      for (const p of oldProgress.data) await db.collection('progress').doc(p._id).remove();
    }

    // 导入 plans
    const planIdMap = new Map(); // oldId -> newId
    let restoredPlan = null;
    for (const plan of backup.plans) {
      const oldId = plan._id;
      const planDoc = {
        ...stripInternalFields(plan),
        _openid: openid,
        childId,
        updatedAt: new Date().toISOString()
      };
      const addRes = await db.collection('plans').add({ data: planDoc });
      planIdMap.set(oldId, addRes._id);
      if (!restoredPlan) restoredPlan = { _id: addRes._id, ...planDoc };
    }

    // 导入 records（合并时跳过已存在的日期）
    const existingDates = new Set();
    if (mode === 'merge') {
      const existingRecords = await db.collection('records')
        .where({ _openid: openid, childId })
        .get();
      for (const r of existingRecords.data) {
        existingDates.add(`${r.planId}_${r.date}`);
      }
    }

    for (const record of backup.records || []) {
      const newPlanId = planIdMap.get(record.planId);
      if (!newPlanId) continue;
      const key = `${newPlanId}_${record.date}`;
      if (existingDates.has(key)) continue;

      const recordDoc = {
        ...stripInternalFields(record),
        _openid: openid,
        childId,
        planId: newPlanId,
        updatedAt: new Date().toISOString()
      };
      await db.collection('records').add({ data: recordDoc });
      existingDates.add(key);
    }

    // 导入 progress（overwrite 已删，merge 时替换同 plan 的 progress）
    for (const progress of backup.progress || []) {
      const newPlanId = planIdMap.get(progress.planId);
      if (!newPlanId) continue;

      const existingProgress = await db.collection('progress')
        .where({ _openid: openid, childId, planId: newPlanId })
        .limit(1)
        .get();

      const progressDoc = {
        ...stripInternalFields(progress),
        _openid: openid,
        childId,
        planId: newPlanId,
        updatedAt: new Date().toISOString()
      };

      if (existingProgress.data.length > 0) {
        await db.collection('progress').doc(existingProgress.data[0]._id).update({
          data: progressDoc
        });
      } else {
        await db.collection('progress').add({ data: progressDoc });
      }
    }

    if (!restoredPlan) return fail('INVALID_PARAMS', '备份中无有效计划');

    // 重新计算首个导入计划的进度，确保一致性
    const { progress } = await recalculateProgress(db, openid, childId, restoredPlan);

    return success({ success: true, plan: restoredPlan, progress });
  } catch (err) {
    return fail('INTERNAL_ERROR', err.message);
  }
};
