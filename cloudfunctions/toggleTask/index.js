const cloud = require('wx-server-sdk');
const {
  success, fail, getOpenId, isValidDate, getDayTasks, getDayType, calculateDayPoints
} = require('./utils');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  try {
    const openid = getOpenId();
    if (!openid) return fail('UNAUTHORIZED', '无法获取用户 openid');

    const {
      childId, planId, date, taskId, completed, startTime, endTime, correctRate
    } = event;

    if (!childId || !planId || !date || !taskId) {
      return fail('INVALID_PARAMS', 'childId、planId、date、taskId 不能为空');
    }
    if (!isValidDate(date)) return fail('INVALID_PARAMS', 'date 格式必须为 YYYY-MM-DD');
    if (typeof completed !== 'boolean') return fail('INVALID_PARAMS', 'completed 必须为布尔值');

    const planRes = await db.collection('plans')
      .where({ _openid: openid, _id: planId, childId })
      .limit(1)
      .get();

    if (planRes.data.length === 0) return fail('NOT_FOUND', '找不到指定的计划');

    const plan = planRes.data[0];
    if (date < plan.startDate || date > plan.endDate) {
      return fail('PLAN_EXPIRED', '日期不在计划范围内');
    }

    const dayType = getDayType(plan, date);
    if (dayType !== 'learn') {
      return fail('INVALID_PARAMS', '非学习日不能打卡');
    }

    const tasks = getDayTasks(plan, date);
    const taskIds = tasks.map(t => t.id);
    if (!taskIds.includes(taskId)) {
      return fail('INVALID_PARAMS', '任务不在当日安排中');
    }

    let record;
    const recordRes = await db.collection('records')
      .where({ _openid: openid, childId, planId, date })
      .limit(1)
      .get();

    const now = new Date().toISOString();
    if (recordRes.data.length > 0) {
      record = recordRes.data[0];
    } else {
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

    if (record.isReported) {
      return fail('ALREADY_REPORTED', '当日已汇报，不能修改任务状态');
    }

    let taskRecords = record.taskRecords || [];
    const idx = taskRecords.findIndex(r => r.taskId === taskId);
    const taskRecord = {
      taskId,
      completed,
      startTime: startTime || null,
      endTime: endTime || null,
      correctRate: typeof correctRate === 'number' ? correctRate : null
    };

    if (idx >= 0) {
      taskRecords[idx] = taskRecord;
    } else {
      taskRecords.push(taskRecord);
    }

    const allCompleted = taskIds.length > 0 && taskIds.every(id => {
      const tr = taskRecords.find(r => r.taskId === id);
      return tr && tr.completed;
    });

    const totalPoints = calculateDayPoints(taskRecords, allCompleted);

    await db.collection('records').doc(record._id).update({
      data: {
        taskRecords,
        allCompleted,
        totalPoints,
        updatedAt: now
      }
    });

    record.taskRecords = taskRecords;
    record.allCompleted = allCompleted;
    record.totalPoints = totalPoints;
    record.updatedAt = now;

    const progressRes = await db.collection('progress')
      .where({ _openid: openid, childId, planId })
      .limit(1)
      .get();
    const progress = progressRes.data[0] || null;

    return success({
      record,
      progress,
      canReport: allCompleted && !record.isReported
    });
  } catch (err) {
    return fail('INTERNAL_ERROR', err.message);
  }
};
