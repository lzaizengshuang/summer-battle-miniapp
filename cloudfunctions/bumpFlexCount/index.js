const cloud = require('wx-server-sdk');
const { success, fail, getOpenId } = require('./utils');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  try {
    const openid = getOpenId();
    if (!openid) return fail('UNAUTHORIZED', '无法获取用户 openid');

    const { childId, planId, taskId, delta } = event;
    if (!childId || !planId || !taskId) {
      return fail('INVALID_PARAMS', 'childId/planId/taskId 不能为空');
    }
    const d = Math.sign(Number(delta) || 0);
    if (d === 0) return fail('INVALID_PARAMS', 'delta 必须为 ±1');

    const now = new Date().toISOString();
    const res = await db.collection('progress')
      .where({ _openid: openid, childId, planId })
      .limit(1)
      .get();

    if (res.data.length === 0) {
      const addRes = await db.collection('progress').add({
        data: {
          _openid: openid,
          childId,
          planId,
          totalPoints: 0,
          currentRank: 1,
          currentConsecutiveDays: 0,
          maxConsecutiveDays: 0,
          medals: [],
          flexDone: { [taskId]: Math.max(0, d) },
          createdAt: now,
          updatedAt: now,
        },
      });
      const doc = {
        _id: addRes._id, _openid: openid, childId, planId,
        totalPoints: 0, currentRank: 1, currentConsecutiveDays: 0, maxConsecutiveDays: 0,
        medals: [], flexDone: { [taskId]: Math.max(0, d) }, createdAt: now, updatedAt: now,
      };
      return success({ progress: doc });
    }

    const doc = res.data[0];
    const cur = (doc.flexDone && doc.flexDone[taskId]) || 0;
    const next = Math.max(0, cur + d);
    await db.collection('progress').doc(doc._id).update({
      data: {
        [`flexDone.${taskId}`]: next,
        updatedAt: now,
      },
    });
    doc.flexDone = { ...(doc.flexDone || {}), [taskId]: next };
    doc.updatedAt = now;
    return success({ progress: doc });
  } catch (err) {
    return fail('INTERNAL_ERROR', err.message);
  }
};
