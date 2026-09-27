const cloud = require('wx-server-sdk');
const { success, fail, getOpenId } = require('../utils');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  try {
    const openid = getOpenId();
    if (!openid) return fail('UNAUTHORIZED', '无法获取用户 openid');

    const { childId } = event;
    if (!childId) return fail('INVALID_PARAMS', 'childId 不能为空');

    const plans = await db.collection('plans')
      .where({ _openid: openid, childId })
      .orderBy('startDate', 'desc')
      .limit(1)
      .get();

    const plan = plans.data[0] || null;

    let progress = null;
    if (plan) {
      const progressRes = await db.collection('progress')
        .where({ _openid: openid, childId, planId: plan._id })
        .limit(1)
        .get();
      progress = progressRes.data[0] || null;
    }

    return success({ plan, progress });
  } catch (err) {
    return fail('INTERNAL_ERROR', err.message);
  }
};
