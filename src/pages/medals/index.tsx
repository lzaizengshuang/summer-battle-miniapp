import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useLoad, useShareAppMessage } from '@tarojs/taro';
import { useTheme } from '@/utils/theme';
import { useGlobalStore } from '@/stores/global';
import { MedalGrid } from '@/components/MedalGrid';
import { callCloud, showError } from '@/utils/cloud';
import type { MedalDef, UserProgress } from '@/types';

export default function MedalsPage() {
  const { colors, medals } = useTheme();
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
        loadProgress();
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

  const loadProgress = async () => {
    if (!profile || !plan) return;
    try {
      const data = await callCloud<{ progress: UserProgress; medals: MedalDef[] }>('getProgress', {
        childId: profile._id,
        planId: plan._id,
      });
      setProgress(data.progress);
    } catch (err) {
      showError(err);
    }
  };

  useShareAppMessage(() => ({
    title: profile
      ? `${profile.name}已解锁 ${progress?.medals.length || 0} 枚勋章，快来围观！`
      : '孩子假期打卡神器，坚持就有勋章',
    path: '/pages/index/index',
  }));

  if (!progress) {
    return (
      <View
        className="min-h-full flex items-center justify-center px-4"
        style={{ backgroundColor: colors.bg }}
      >
        <Text style={{ color: colors.textMuted }}>加载中…</Text>
      </View>
    );
  }

  return (
    <ScrollView
      className="min-h-full px-4 py-4"
      style={{ backgroundColor: colors.bg }}
      scrollY
    >
      <Text className="text-2xl font-bold mb-2 text-center" style={{ color: colors.text }}>
        荣誉墙
      </Text>
      <Text className="text-sm text-center mb-6" style={{ color: colors.textMuted }}>
        已解锁 {progress.medals.length} / {medals.length} 枚勋章
      </Text>

      <MedalGrid unlockedIds={progress.medals} />
    </ScrollView>
  );
}
