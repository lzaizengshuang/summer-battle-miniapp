const cloud = require('wx-server-sdk');
const { initCloud, getOpenId, success, fail, isValidDate, sanitizeRecordForOutput } = require('./utils');

exports.main = async (event, context) => {
  const db = initCloud();
  const openid = getOpenId();
  const { childId, planId, date } = event;

  if (!childId || !planId || !isValidDate(date)) {
    return fail('INVALID_PARAMS', '参数错误');
  }

  const now = new Date().toISOString();

  try {
    const planRes = await db.collection('plans')
      .where({ _id: planId, _openid: openid, childId })
      .get();

    if (planRes.data.length === 0) {
      return fail('NOT_FOUND', '计划不存在或无权限');
    }

    const plan = planRes.data[0];
    if (date < plan.startDate || date > plan.endDate) {
      return fail('PLAN_EXPIRED', '日期不在计划范围内');
    }

    const recordRes = await db.collection('records')
      .where({ _openid: openid, childId, planId, date })
      .get();

    let record;
    if (recordRes.data.length === 0) {
      const dayTasks = plan.tasks || [];
      const addRes = await db.collection('records').add({
        data: {
          _openid: openid,
          childId,
          planId,
          date,
          taskRecords: dayTasks.map(t => ({
            taskId: t.id,
            completed: false
          })),
          isReported: false,
          startTime: now,
          totalPoints: 0,
          createdAt: now,
          updatedAt: now
        }
      });
      record = await db.collection('records').doc(addRes._id).get();
      record = record.data;
    } else {
      record = recordRes.data[0];
      if (!record.isReported) {
        await db.collection('records').doc(record._id).update({
          data: {
            startTime: record.startTime || now,
            updatedAt: now
          }
        });
        record = await db.collection('records').doc(record._id).get();
        record = record.data;
      }
    }

    return success({ record: sanitizeRecordForOutput(record) });
  } catch (err) {
    console.error('startBattle error', err);
    return fail('INTERNAL_ERROR', err.message || '开始作战失败');
  }
};
