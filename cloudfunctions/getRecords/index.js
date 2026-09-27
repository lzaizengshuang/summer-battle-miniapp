const cloud = require('wx-server-sdk');
const { success, fail, getOpenId } = require('./utils');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  try {
    const openid = getOpenId();
    if (!openid) return fail('UNAUTHORIZED', '无法获取用户 openid');

    const { childId, planId, year, month } = event;
    if (!childId || !planId || typeof year !== 'number' || typeof month !== 'number') {
      return fail('INVALID_PARAMS', 'childId、planId、year、month 不能为空');
    }

    const monthStr = String(month).padStart(2, '0');
    const prefix = `${year}-${monthStr}`;
    const records = await db.collection('records')
      .where({
        _openid: openid,
        childId,
        planId,
        date: _.regex({ regexp: `^${prefix}` })
      })
      .orderBy('date', 'asc')
      .get();

    return success({ records: records.data || [] });
  } catch (err) {
    return fail('INTERNAL_ERROR', err.message);
  }
};
