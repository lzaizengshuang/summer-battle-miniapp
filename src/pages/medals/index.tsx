import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';
import { useTheme } from '@/utils/theme';
import { useGlobalStore } from '@/stores/global';
import { MedalGrid } from '@/components/MedalGrid';
import { callCloud, showError } from '@/utils/cloud';
import type { MedalDef, UserProgress } from '@/types';

export default function MedalsPage() {
  const { colors } = useTheme();
  const profile = useGlobalStore((s) => s.profile);
  const plan = useGlobalStore((s) => s.plan);
  const progress = useGlobalStore((s) => s.progress);
  const setProgress = useGlobalStore((s) => s.setProgress);

  useLoad(() => {
    if (!profile || !plan) {
      Taro.redirectTo({ url: '/pages/onboarding/index' });
      return;
    }
    loadProgress();
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
        已解锁 {progress.medals.length} / 7 枚勋章
      </Text>

      <MedalGrid unlockedIds={progress.medals} />
    </ScrollView>
  );
}
