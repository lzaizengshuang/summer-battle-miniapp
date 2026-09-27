const cloud = require('wx-server-sdk');
const { initCloud, getOpenId, success, fail, sanitizeRecordForOutput } = require('../utils');

exports.main = async (event, context) => {
  const db = initCloud();
  const openid = getOpenId();
  const { childId, name, avatarUrl, theme } = event;

  if (!childId) {
    return fail('INVALID_PARAMS', '缺少 childId');
  }

  if (theme && theme !== 'prince' && theme !== 'princess') {
    return fail('INVALID_PARAMS', 'theme 必须是 prince 或 princess');
  }

  try {
    const profileRes = await db.collection('childProfiles')
      .where({ _id: childId, _openid: openid })
      .get();

    if (profileRes.data.length === 0) {
      return fail('NOT_FOUND', '档案不存在或无权限');
    }

    const updateData = { updatedAt: new Date().toISOString() };
    if (typeof name === 'string' && name.trim()) updateData.name = name.trim();
    if (typeof avatarUrl === 'string') updateData.avatarUrl = avatarUrl;
    if (theme) updateData.theme = theme;

    await db.collection('childProfiles').doc(childId).update({ data: updateData });

    const updated = await db.collection('childProfiles').doc(childId).get();
    return success({ profile: sanitizeRecordForOutput(updated.data) });
  } catch (err) {
    console.error('updateChildProfile error', err);
    return fail('INTERNAL_ERROR', err.message || '更新档案失败');
  }
};
