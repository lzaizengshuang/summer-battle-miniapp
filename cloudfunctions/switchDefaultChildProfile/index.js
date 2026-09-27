const cloud = require('wx-server-sdk');
const { success, fail, getOpenId } = require('./utils');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  try {
    const openid = getOpenId();
    if (!openid) return fail('UNAUTHORIZED', '无法获取用户 openid');

    const { childId } = event;
    if (!childId) return fail('INVALID_PARAMS', 'childId 不能为空');

    const target = await db.collection('childProfiles')
      .where({ _openid: openid, _id: childId })
      .limit(1)
      .get();

    if (target.data.length === 0) {
      return fail('NOT_FOUND', '找不到指定的孩子档案');
    }

    const allProfiles = await db.collection('childProfiles')
      .where({ _openid: openid })
      .get();

    const now = new Date().toISOString();
    for (const profile of allProfiles.data) {
      const shouldBeDefault = profile._id === childId;
      if (profile.isDefault !== shouldBeDefault) {
        await db.collection('childProfiles').doc(profile._id).update({
          data: { isDefault: shouldBeDefault, updatedAt: now }
        });
      }
    }

    const updated = { ...target.data[0], isDefault: true, updatedAt: now };
    return success({ profile: updated });
  } catch (err) {
    return fail('INTERNAL_ERROR', err.message);
  }
};
