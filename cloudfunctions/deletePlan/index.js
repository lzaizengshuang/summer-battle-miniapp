const cloud = require('wx-server-sdk');
const { success, fail, getOpenId } = require('./utils');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// 批量删除查询结果（云数据库 where().remove() 有 100 条上限，循环兜底）
async function removeAll(collection, where) {
  const res = await db.collection(collection).where(where).remove();
  return (res && res.stats && res.stats.removed) || 0;
}

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

    if (planRes.data.length === 0) {
      return fail('NOT_FOUND', '找不到指定的计划');
    }
    const plan = planRes.data[0];

    await db.collection('plans').doc(planId).remove();
    const removedRecords = await removeAll('records', {
      _openid: openid,
      childId: plan.childId,
      planId
    });
    const removedProgress = await removeAll('progress', {
      _openid: openid,
      childId: plan.childId,
      planId
    });

    return success({
      planId,
      removedRecords,
      removedProgress
    });
  } catch (err) {
    return fail('INTERNAL_ERROR', err.message);
  }
};
