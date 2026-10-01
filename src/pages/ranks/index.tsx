import { View, Text, Image, ScrollView } from '@tarojs/components';
import Taro, { useLoad, useShareAppMessage } from '@tarojs/taro';
import { useTheme } from '@/utils/theme';
import { useGlobalStore } from '@/stores/global';
import { rankEmblems } from '@/config/theme';
import type { RankInfo } from '@/types';
import { callCloud, showError } from '@/utils/cloud';

export default function RanksPage() {
  const { colors, rankNames } = useTheme();
  const profile = useGlobalStore((s) => s.profile);
  const plan = useGlobalStore((s) => s.plan);
  const progress = useGlobalStore((s) => s.progress);
  const setProgress = useGlobalStore((s) => s.setProgress);

  useLoad(() => {
    // 冷启动等全局数据就绪再加载，避免慢网络下误跳引导页
    let attempts = 0;
    const check = () => {
      const s = useGlobalStore.getState();
      if (s.profile && s.plan) {
        loadRankInfo();
        return;
      }
      if (s.profile && !s.plan) {
        Taro.redirectTo({ url: '/pages/onboarding/index' });
        return;
      }
      if (attempts < 16) {
        attempts += 1;
        setTimeout(check, 250);
      }
    };
    check();
  });

  useShareAppMessage(() => ({
    title: profile
      ? `${profile.name}已升到「${rankNames[(progress?.currentRank || 1) - 1] || ''}」，快来一起升级！`
      : '孩子假期打卡神器，坚持就有勋章',
    path: '/pages/index/index',
  }));

  const loadRankInfo = async () => {
    if (!plan || !profile) return;
    try {
      const data = await callCloud<RankInfo>('getRankInfo', { planId: plan._id });
      // progress may be stale; keep current rank aligned if needed
      if (progress && data.currentRank !== progress.currentRank) {
        setProgress({ ...progress, currentRank: data.currentRank });
      }
    } catch (err) {
      showError(err);
    }
  };

  if (!plan || !progress) {
    return (
      <View
        className="w-full min-h-full flex items-center justify-center px-4"
        style={{ backgroundColor: colors.bg }}
      >
        <Text style={{ color: colors.textMuted }}>加载中…</Text>
      </View>
    );
  }

  const currentRank = progress.currentRank || 1;
  const thresholds = plan.rankThresholds;

  return (
    <View className="w-full min-h-full overflow-hidden" style={{ backgroundColor: colors.bg }}>
      <ScrollView className="w-full min-h-full px-4 py-4" scrollY>
      <Text className="text-2xl font-bold mb-4 text-center" style={{ color: colors.text }}>
        {colors.theme === 'prince' ? '军衔阶梯' : '公主成长阶梯'}
      </Text>

      <View className="relative py-2">
        {rankNames.map((name, idx) => {
          const rank = idx + 1;
          const threshold = thresholds[idx] ?? 0;
          const isUnlocked = rank <= currentRank;
          const isCurrent = rank === currentRank;
          const isEven = rank % 2 === 0;
          const nextThreshold = thresholds[rank] ?? threshold + 100;
          const segmentProgress = isCurrent
            ? Math.min(
                100,
                Math.max(
                  0,
                  ((progress.totalPoints - threshold) / Math.max(1, nextThreshold - threshold)) * 100,
                ),
              )
            : 0;

          return (
            <View
              key={rank}
              className={`flex flex-row items-center mb-4 ${isEven ? 'flex-row-reverse' : ''}`}
            >
              <View
                className="w-20 h-20 rounded-full flex items-center justify-center z-10"
                style={{
                  backgroundColor: 'transparent',
                  borderWidth: '4rpx',
                  borderColor: isCurrent ? colors.gold : colors.border,
                  boxShadow: isCurrent ? `0 0 30rpx ${colors.gold}` : 'none',
                  overflow: 'hidden',
                }}
              >
                {rankEmblems[colors.theme][idx] ? (
                  <Image
                    src={rankEmblems[colors.theme][idx]}
                    mode="aspectFill"
                    style={{ width: '100%', height: '100%' }}
                  />
                ) : (
                  <Text
                    className="text-2xl font-bold"
                    style={{ color: isCurrent ? colors.bg : colors.text }}
                  >
                    {rank}
                  </Text>
                )}
              </View>

              <View
                className="flex-1 mx-4 rounded-3xl p-4"
                style={{
                  backgroundColor: colors.card,
                  borderWidth: '4rpx',
                  borderColor: isCurrent ? colors.gold : colors.border,
                  opacity: isUnlocked ? 1 : 0.55,
                }}
              >
                <View className="flex flex-row items-center justify-between">
                  <Text
                    className="text-lg font-bold"
                    style={{ color: isCurrent ? colors.gold : colors.text }}
                  >
                    {name}
                  </Text>
                  {rank >= 15 ? <Text>👑</Text> : null}
                  {rank >= 12 && rank < 15 ? <Text>🪽</Text> : null}
                </View>
                <Text className="text-sm mt-1" style={{ color: colors.textMuted }}>
                  需要 {threshold} {colors.theme === 'prince' ? '军功' : '爱心值'}
                </Text>
                {isCurrent ? (
                  <View
                    className="h-3 rounded-full mt-2 overflow-hidden"
                    style={{ backgroundColor: colors.bg }}
                  >
                    <View
                      className="h-full rounded-full"
                      style={{ width: `${segmentProgress}%`, backgroundColor: colors.gold }}
                    />
                  </View>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
      </ScrollView>
    </View>
  );
}
