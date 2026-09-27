const cloud = require('wx-server-sdk');
const { success, fail, getOpenId } = require('./utils');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  try {
    const openid = getOpenId();
    if (!openid) return fail('UNAUTHORIZED', '无法获取用户 openid');

    const { childId } = event;
    if (!childId) return fail('INVALID_PARAMS', 'childId 不能为空');

    const profileRes = await db.collection('childProfiles')
      .where({ _openid: openid, _id: childId })
      .limit(1)
      .get();

    if (profileRes.data.length === 0) return fail('NOT_FOUND', '找不到指定的孩子档案');

    const [plans, records, progressList] = await Promise.all([
      db.collection('plans').where({ _openid: openid, childId }).get(),
      db.collection('records').where({ _openid: openid, childId }).get(),
      db.collection('progress').where({ _openid: openid, childId }).get()
    ]);

    const backup = {
      version: 1,
      backupAt: new Date().toISOString(),
      childProfile: profileRes.data[0],
      plans: plans.data || [],
      records: records.data || [],
      progress: progressList.data || []
    };

    return success({ json: JSON.stringify(backup) });
  } catch (err) {
    return fail('INTERNAL_ERROR', err.message);
  }
};
