const cloud = require('wx-server-sdk');
const { success, fail, getOpenId } = require('../utils');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  try {
    const openid = getOpenId();
    if (!openid) return fail('UNAUTHORIZED', '无法获取用户 openid');

    const theme = event.theme === 'princess' ? 'princess' : 'prince';

    const existing = await db.collection('childProfiles')
      .where({ _openid: openid, isDefault: true })
      .limit(1)
      .get();

    if (existing.data.length > 0) {
      return success({ profile: existing.data[0] });
    }

    const countRes = await db.collection('childProfiles')
      .where({ _openid: openid })
      .count();
    const isDefault = countRes.total === 0;
    const now = new Date().toISOString();
    const defaultName = theme === 'princess' ? '小公主' : '小特种兵';

    const addRes = await db.collection('childProfiles').add({
      data: {
        _openid: openid,
        name: defaultName,
        avatarUrl: '',
        theme,
        isDefault,
        createdAt: now,
        updatedAt: now
      }
    });

    const profile = {
      _id: addRes._id,
      _openid: openid,
      name: defaultName,
      avatarUrl: '',
      theme,
      isDefault,
      createdAt: now,
      updatedAt: now
    };

    return success({ profile });
  } catch (err) {
    return fail('INTERNAL_ERROR', err.message);
  }
};
