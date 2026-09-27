const cloud = require('wx-server-sdk');
const {
  success, fail, getOpenId, isValidDate, getDayTasks, getDayType
} = require('../utils');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  try {
    const openid = getOpenId();
    if (!openid) return fail('UNAUTHORIZED', '无法获取用户 openid');

    const { childId, planId, date } = event;
    if (!childId || !planId || !date) {
      return fail('INVALID_PARAMS', 'childId、planId、date 不能为空');
    }
    if (!isValidDate(date)) return fail('INVALID_PARAMS', 'date 格式必须为 YYYY-MM-DD');

    const planRes = await db.collection('plans')
      .where({ _openid: openid, _id: planId, childId })
      .limit(1)
      .get();

    if (planRes.data.length === 0) {
      return fail('NOT_FOUND', '找不到指定的计划');
    }

    const plan = planRes.data[0];
    if (date < plan.startDate || date > plan.endDate) {
      return fail('PLAN_EXPIRED', '日期不在计划范围内');
    }

    const dayType = getDayType(plan, date);
    const tasks = getDayTasks(plan, date);

    let record = null;
    const recordRes = await db.collection('records')
      .where({ _openid: openid, childId, planId, date })
      .limit(1)
      .get();

    if (recordRes.data.length > 0) {
      record = recordRes.data[0];
    } else if (dayType === 'learn') {
      const now = new Date().toISOString();
      const addRes = await db.collection('records').add({
        data: {
          _openid: openid,
          childId,
          planId,
          date,
          taskRecords: [],
          isReported: false,
          totalPoints: 0,
          createdAt: now,
          updatedAt: now
        }
      });
      record = {
        _id: addRes._id,
        _openid: openid,
        childId,
        planId,
        date,
        taskRecords: [],
        isReported: false,
        totalPoints: 0,
        createdAt: now,
        updatedAt: now
      };
    }

    const taskRecordMap = new Map((record && record.taskRecords || []).map(r => [r.taskId, r]));
    const tasksWithRecord = tasks.map(task => ({
      ...task,
      record: taskRecordMap.get(task.id)
    }));

    const progressRes = await db.collection('progress')
      .where({ _openid: openid, childId, planId })
      .limit(1)
      .get();
    const progress = progressRes.data[0] || null;

    return success({
      date,
      dayType,
      tasks: tasksWithRecord,
      record,
      progress
    });
  } catch (err) {
    return fail('INTERNAL_ERROR', err.message);
  }
};
