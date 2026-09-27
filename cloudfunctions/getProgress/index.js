const cloud = require('wx-server-sdk');
const { success, fail, getOpenId, getRankFromPoints } = require('../utils');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const MEDAL_DEFS = {
  first: { name: '初出茅庐', description: '完成第 1 天打卡', icon: 'bronze' },
  streak7: { name: '铁人勋章', description: '历史最大连续打卡 ≥ 7 天', icon: 'silver' },
  streak14: { name: '坚持不懈', description: '历史最大连续打卡 ≥ 14 天', icon: 'silver' },
  streak21: { name: '钢铁意志', description: '历史最大连续打卡 ≥ 21 天', icon: 'gold' },
  streak30: { name: '战神勋章', description: '历史最大连续打卡 ≥ 30 天', icon: 'diamond' },
  all6: { name: '全能战士', description: '单日完成全部已配置任务', icon: 'swords' },
  fast: { name: '速战速决', description: '任意记录完成用时 ≤ 30 分钟', icon: 'timer' },
  perfect: { name: '零失误', description: '口算类任务连续 10 天完成', icon: 'target' }
};

exports.main = async (event, context) => {
  try {
    const openid = getOpenId();
    if (!openid) return fail('UNAUTHORIZED', '无法获取用户 openid');

    const { childId, planId } = event;
    if (!childId || !planId) return fail('INVALID_PARAMS', 'childId、planId 不能为空');

    const planRes = await db.collection('plans')
      .where({ _openid: openid, _id: planId, childId })
      .limit(1)
      .get();

    if (planRes.data.length === 0) return fail('NOT_FOUND', '找不到指定的计划');

    const plan = planRes.data[0];
    const thresholds = plan.rankThresholds || [0];

    const progressRes = await db.collection('progress')
      .where({ _openid: openid, childId, planId })
      .limit(1)
      .get();

    const progress = progressRes.data[0] || {
      _openid: openid,
      childId,
      planId,
      totalPoints: 0,
      currentRank: 1,
      maxConsecutiveDays: 0,
      currentConsecutiveDays: 0,
      medals: []
    };

    const currentRank = progress.currentRank || 1;
    const currentPoints = progress.totalPoints || 0;
    const currentThreshold = thresholds[currentRank - 1] || 0;
    const nextThreshold = thresholds[currentRank] || thresholds[thresholds.length - 1];
    const progressPercent = nextThreshold > currentThreshold
      ? Math.min(100, Math.max(0, Math.round(((currentPoints - currentThreshold) / (nextThreshold - currentThreshold)) * 100)))
      : 100;

    const rankInfo = {
      thresholds,
      currentRank,
      currentPoints,
      currentThreshold,
      nextRank: Math.min(currentRank + 1, 15),
      nextRankPoints: nextThreshold,
      progressPercent
    };

    const unlocked = new Set(progress.medals || []);
    const medals = Object.keys(MEDAL_DEFS).map(id => ({
      id,
      ...MEDAL_DEFS[id],
      unlocked: unlocked.has(id)
    }));

    return success({ progress, rankInfo, medals });
  } catch (err) {
    return fail('INTERNAL_ERROR', err.message);
  }
};
