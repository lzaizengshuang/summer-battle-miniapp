const cloud = require('wx-server-sdk');
const {
  success, fail, getOpenId, isValidDate, generateRankThresholds, recalculateProgress
} = require('./utils');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  try {
    const openid = getOpenId();
    if (!openid) return fail('UNAUTHORIZED', '无法获取用户 openid');

    const {
      childId, name, startDate, endDate, tasks, dayTypes, weekTemplates, difficulty
    } = event;

    if (!childId) return fail('INVALID_PARAMS', 'childId 不能为空');
    if (!name || typeof name !== 'string') return fail('INVALID_PARAMS', 'name 不能为空');
    if (!isValidDate(startDate) || !isValidDate(endDate)) {
      return fail('INVALID_PARAMS', 'startDate 和 endDate 格式必须为 YYYY-MM-DD');
    }
    if (startDate > endDate) return fail('INVALID_PARAMS', 'startDate 不能晚于 endDate');
    if (!Array.isArray(tasks) || tasks.length === 0) {
      return fail('INVALID_PARAMS', 'tasks 必须是非空数组');
    }
    if (!dayTypes || typeof dayTypes !== 'object') {
      return fail('INVALID_PARAMS', 'dayTypes 不能为空');
    }
    if (!weekTemplates || typeof weekTemplates !== 'object') {
      return fail('INVALID_PARAMS', 'weekTemplates 不能为空');
    }

    const profile = await db.collection('childProfiles')
      .where({ _openid: openid, _id: childId })
      .limit(1)
      .get();
    if (profile.data.length === 0) {
      return fail('NOT_FOUND', '找不到指定的孩子档案');
    }

    const now = new Date().toISOString();
    const rankThresholds = generateRankThresholds(startDate, endDate, tasks, difficulty);

    const planDoc = {
      _openid: openid,
      childId,
      name: name.trim(),
      startDate,
      endDate,
      tasks,
      dayTypes,
      weekTemplates,
      dailyTasks: {},
      rankThresholds,
      createdAt: now,
      updatedAt: now
    };

    const addRes = await db.collection('plans').add({ data: planDoc });
    const plan = { _id: addRes._id, ...planDoc };

    const { progress } = await recalculateProgress(db, openid, childId, plan);

    return success({ plan, progress });
  } catch (err) {
    return fail('INTERNAL_ERROR', err.message);
  }
};
