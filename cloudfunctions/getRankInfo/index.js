const cloud = require('wx-server-sdk');
const { success, fail, getOpenId } = require('../utils');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  try {
    const openid = getOpenId();
    if (!openid) return fail('UNAUTHORIZED', '无法获取用户 openid');

    const { planId } = event;
    if (!planId) return fail('INVALID_PARAMS', 'planId 不能为空');

    const planRes = await db.collection('plans')
      .where({ _openid: openid, _id: planId })
      .limit(1)
      .get();

    if (planRes.data.length === 0) return fail('NOT_FOUND', '找不到指定的计划');

    const plan = planRes.data[0];
    const thresholds = plan.rankThresholds || [0];

    const progressRes = await db.collection('progress')
      .where({ _openid: openid, planId })
      .limit(1)
      .get();

    const currentRank = progressRes.data[0] ? (progressRes.data[0].currentRank || 1) : 1;
    const nextRankPoints = thresholds[currentRank] || thresholds[thresholds.length - 1];

    return success({ thresholds, currentRank, nextRankPoints });
  } catch (err) {
    return fail('INTERNAL_ERROR', err.message);
  }
};
