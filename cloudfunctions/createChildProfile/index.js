const cloud = require('wx-server-sdk');
const { success, fail, getOpenId } = require('../utils');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  try {
    const openid = getOpenId();
    if (!openid) return fail('UNAUTHORIZED', '无法获取用户 openid');

    const { name, theme, avatarUrl } = event;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return fail('INVALID_PARAMS', 'name 不能为空');
    }
    if (!theme || (theme !== 'prince' && theme !== 'princess')) {
      return fail('INVALID_PARAMS', 'theme 必须为 prince 或 princess');
    }

    const countRes = await db.collection('childProfiles')
      .where({ _openid: openid })
      .count();
    const isDefault = countRes.total === 0;
    const now = new Date().toISOString();

    const addRes = await db.collection('childProfiles').add({
      data: {
        _openid: openid,
        name: name.trim(),
        avatarUrl: avatarUrl || '',
        theme,
        isDefault,
        createdAt: now,
        updatedAt: now
      }
    });

    const profile = {
      _id: addRes._id,
      _openid: openid,
      name: name.trim(),
      avatarUrl: avatarUrl || '',
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
