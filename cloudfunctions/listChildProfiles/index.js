const cloud = require('wx-server-sdk');
const { success, fail, getOpenId } = require('./utils');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  try {
    const openid = getOpenId();
    if (!openid) return fail('UNAUTHORIZED', '无法获取用户 openid');

    const profiles = await db.collection('childProfiles')
      .where({ _openid: openid })
      .orderBy('createdAt', 'asc')
      .get();

    return success({ profiles: profiles.data || [] });
  } catch (err) {
    return fail('INTERNAL_ERROR', err.message);
  }
};
