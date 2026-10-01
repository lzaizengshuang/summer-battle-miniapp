import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Image } from '@tarojs/components';
import Taro, { useLoad, usePullDownRefresh, useShareAppMessage } from '@tarojs/taro';
import { Flame, Zap } from 'lucide-react-taro';
import { useTheme } from '@/utils/theme';
import { useGlobalStore } from '@/stores/global';
import { callCloud, showError, showSuccess } from '@/utils/cloud';
import { getTodayISO, clampDate } from '@/utils/date';
import { DateNavigator } from '@/components/DateNavigator';
import { TaskCard } from '@/components/TaskCard';
import { RankBadge } from '@/components/RankBadge';
import { CelebrationOverlay } from '@/components/CelebrationOverlay';
import type { DaySchedule, DayRecord, UserProgress } from '@/types';

export default function IndexPage() {
  const { colors, text, rankNames } = useTheme();
  const profile = useGlobalStore((s) => s.profile);
  const plan = useGlobalStore((s) => s.plan);
  const progress = useGlobalStore((s) => s.progress);
  const setProgress = useGlobalStore((s) => s.setProgress);
  const [date, setDate] = useState<string>(getTodayISO());
  const [schedule, setSchedule] = useState<DaySchedule | null>(null);
  const [loading, setLoading] = useState(false);
  const [celebration, setCelebration] = useState(false);
  const [celebrationMsg, setCelebrationMsg] = useState('');
  const [startTime, setStartTime] = useState<Date | null>(null);

  useLoad(() => {
    // 冷启动等全局数据就绪再决定去向，避免慢网络下误跳引导页
    let attempts = 0;
    const check = () => {
      const s = useGlobalStore.getState();
      if (s.profile && s.plan) return; // 数据就绪，由 useEffect 加载日程
      if (s.profile && !s.plan) {
        Taro.redirectTo({ url: '/pages/onboarding/index' });
        return;
      }
      if (attempts < 20) {
        attempts += 1;
        setTimeout(check, 250);
        return;
      }
      Taro.redirectTo({ url: '/pages/onboarding/index' });
    };
    check();
  });

  useShareAppMessage(() => ({
    title: profile
      ? `${profile.name}的${plan?.name || '假期作战'}：已连续打卡 ${progress?.currentConsecutiveDays || 0} 天，快来一起坚持！`
      : '孩子假期打卡神器，坚持就有勋章',
    path: '/pages/index/index',
  }));

  useEffect(() => {
    if (plan && profile) loadSchedule();
  }, [date, plan, profile]);

  usePullDownRefresh(() => {
    loadSchedule().finally(() => Taro.stopPullDownRefresh());
  });

  const loadSchedule = async () => {
    if (!profile || !plan) return;
    setLoading(true);
    try {
      const data = await callCloud<DaySchedule>('getDaySchedule', {
        childId: profile._id,
        planId: plan._id,
        date,
      });
      setSchedule(data);
      setProgress(data.progress);
    } catch (err) {
      showError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (taskId: string, completed: boolean) => {
    if (!profile || !plan) return;
    try {
      const { record, progress: updatedProgress } = await callCloud<{
        record: DayRecord;
        progress: UserProgress;
      }>('toggleTask', {
        childId: profile._id,
        planId: plan._id,
        date,
        taskId,
        completed,
        startTime: completed && startTime ? startTime.toISOString() : null,
        endTime: completed ? new Date().toISOString() : null,
      });
      setProgress(updatedProgress);
      setSchedule((prev) =>
        prev
          ? {
              ...prev,
              record,
              tasks: prev.tasks.map((t) =>
                t.id === taskId
                  ? { ...t, record: { ...(t.record || { taskId: t.id, completed: false }), completed } }
                  : t,
              ),
            }
          : prev,
      );
    } catch (err) {
      showError(err);
    }
  };

  const handleStart = async () => {
    if (!profile || !plan) return;
    try {
      const data = await callCloud<{ record: DayRecord }>('startBattle', {
        childId: profile._id,
        planId: plan._id,
        date,
      });
      setStartTime(new Date());
      setSchedule((prev) => (prev ? { ...prev, record: data.record } : prev));
      Taro.vibrateShort({ type: 'light' });
      showSuccess('作战开始！');
    } catch (err) {
      showError(err);
    }
  };

  const handleReport = async () => {
    if (!profile || !plan) return;
    try {
      const result = await callCloud<{
        record: DayRecord;
        progress: UserProgress;
        unlockedMedals: string[];
        rankUp?: boolean;
      }>('reportDay', {
        childId: profile._id,
        planId: plan._id,
        date,
      });
      setProgress(result.progress);
      setSchedule((prev) => (prev ? { ...prev, record: result.record, progress: result.progress } : prev));
      Taro.vibrateShort({ type: 'heavy' });
      setCelebrationMsg(
        `${text.points} +${result.record.totalPoints}${result.rankUp ? '，升级啦！' : ''}`,
      );
      setCelebration(true);
    } catch (err) {
      showError(err);
    }
  };

  const openParent = () => {
    Taro.navigateTo({ url: '/pages/parent/index' });
  };

  const allCompleted =
    schedule &&
    schedule.tasks.length > 0 &&
    schedule.tasks.every((t) => t.record?.completed);

  const completedCount = schedule?.tasks.filter((t) => t.record?.completed).length || 0;
  const totalCount = schedule?.tasks.length || 0;

  const rank = progress?.currentRank || 1;
  const rankProgress =
    plan && progress
      ? ((progress.totalPoints - (plan.rankThresholds[rank - 1] || 0)) /
          Math.max(1, (plan.rankThresholds[rank] || plan.rankThresholds[rank - 1] + 1000) -
            (plan.rankThresholds[rank - 1] || 0))) *
        100
      : 0;

  const cardBg = colors.glass || colors.card;

  return (
    <View className="relative w-full min-h-full overflow-hidden" style={{ backgroundColor: colors.bg }}>
      {colors.bgImage ? (
        <Image
          src={colors.bgImage}
          mode="aspectFill"
          style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0, opacity: 0.5 }}
        />
      ) : null}

      <ScrollView
        className="relative z-10 w-full min-h-full px-4 py-4"
        scrollY
      >
        <DateNavigator
          date={date}
          onChange={(d) => setDate(clampDate(d, plan?.startDate, plan?.endDate))}
          minDate={plan?.startDate}
          maxDate={plan?.endDate}
        />

        <View
          className="rounded-3xl p-5 mb-4"
          style={{ backgroundColor: cardBg, borderWidth: '2rpx', borderColor: colors.border }}
        >
          <View className="flex flex-row items-center justify-between">
            <RankBadge rank={rank} current onLongPress={openParent} />
            <View className="flex-1 mx-4">
              <Text className="text-sm" style={{ color: colors.textMuted }}>
                {rankNames[rank - 1]}
              </Text>
              <View
                className="h-3 rounded-full mt-2 overflow-hidden"
                style={{ backgroundColor: 'rgba(255,255,255,0.10)' }}
              >
                <View
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, Math.max(0, rankProgress))}%`,
                    backgroundColor: colors.gold,
                  }}
                />
              </View>
              <Text className="text-xs mt-1" style={{ color: colors.textMuted }}>
                升级进度 {Math.round(rankProgress)}%
              </Text>
            </View>
          </View>

          <View className="flex flex-row mt-5">
            <View className="flex-1 flex flex-row items-center justify-center">
              <View
                className="w-12 h-12 rounded-2xl flex items-center justify-center mr-3"
                style={{ backgroundColor: 'rgba(251,191,36,0.15)' }}
              >
                <Flame size={28} color={colors.gold} />
              </View>
              <View>
                <Text className="text-2xl font-bold" style={{ color: colors.text }}>
                  {progress?.currentConsecutiveDays || 0}
                </Text>
                <Text className="text-xs" style={{ color: colors.textMuted }}>
                  连续打卡
                </Text>
              </View>
            </View>
            <View className="flex-1 flex flex-row items-center justify-center">
              <View
                className="w-12 h-12 rounded-2xl flex items-center justify-center mr-3"
                style={{ backgroundColor: 'rgba(56,189,248,0.15)' }}
              >
                <Zap size={28} color={colors.accent} />
              </View>
              <View>
                <Text className="text-2xl font-bold" style={{ color: colors.text }}>
                  {progress?.totalPoints || 0}
                </Text>
                <Text className="text-xs" style={{ color: colors.textMuted }}>
                  {text.points}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {loading && !schedule ? (
          <Text className="text-center py-10" style={{ color: colors.textMuted }}>
            加载中…
          </Text>
        ) : null}

        {schedule?.dayType === 'rest' ? (
          <View
            className="rounded-3xl p-10 flex flex-col items-center justify-center"
            style={{ backgroundColor: cardBg, borderWidth: '2rpx', borderColor: colors.border }}
          >
            <View
              className="w-24 h-24 rounded-full flex items-center justify-center mb-4"
              style={{ backgroundColor: 'rgba(163,230,53,0.12)' }}
            >
              <Text className="text-5xl">🏖️</Text>
            </View>
            <Text className="text-2xl font-bold" style={{ color: colors.text }}>
              {text.rest}
            </Text>
            <Text className="text-sm mt-2" style={{ color: colors.textMuted }}>
              今天没有任务，好好休息吧
            </Text>
          </View>
        ) : null}

        {schedule?.dayType === 'trip' ? (
          <View
            className="rounded-3xl p-10 flex flex-col items-center justify-center"
            style={{ backgroundColor: cardBg, borderWidth: '2rpx', borderColor: colors.border }}
          >
            <View
              className="w-24 h-24 rounded-full flex items-center justify-center mb-4"
              style={{ backgroundColor: 'rgba(56,189,248,0.12)' }}
            >
              <Text className="text-5xl">✈️</Text>
            </View>
            <Text className="text-2xl font-bold" style={{ color: colors.text }}>
              {text.trip}
            </Text>
            <Text className="text-sm mt-2" style={{ color: colors.textMuted }}>
              出游不中断连续打卡
            </Text>
          </View>
        ) : null}

        {schedule?.dayType === 'learn' ? (
          <>
            {schedule.tasks.length === 0 ? (
              <View
                className="rounded-3xl p-10 flex flex-col items-center justify-center"
                style={{ backgroundColor: cardBg, borderWidth: '2rpx', borderColor: colors.border }}
              >
                <Text className="text-2xl font-bold" style={{ color: colors.text }}>
                  今日暂无任务
                </Text>
              </View>
            ) : (
              <>
                {schedule.tasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onToggle={(completed) => handleToggle(task.id, completed)}
                    disabled={schedule.record?.isReported}
                  />
                ))}

                <View className="flex flex-row items-center justify-between mb-4">
                  <Text style={{ color: colors.textMuted }}>
                    进度 {completedCount}/{totalCount}
                  </Text>
                  {!schedule.record?.isReported ? (
                    <View
                      className="px-5 py-2 rounded-full active:scale-95 transition-transform"
                      style={{
                        backgroundColor: 'rgba(56,189,248,0.15)',
                        borderWidth: '2rpx',
                        borderColor: colors.accent,
                      }}
                      onClick={handleStart}
                    >
                      <Text className="text-sm font-bold" style={{ color: colors.accent }}>
                        {startTime ? '进行中…' : text.start}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {allCompleted && !schedule.record?.isReported ? (
                  <View
                    className="mt-2 rounded-full py-4 px-6 flex items-center justify-center active:scale-95 transition-transform"
                    style={{
                      backgroundColor: colors.primary,
                      boxShadow: `0 8rpx 32rpx ${colors.primary}59`,
                    }}
                    onClick={handleReport}
                  >
                    <Text
                      className="text-xl font-bold"
                      style={{ color: colors.bg }}
                    >
                      {text.report}
                    </Text>
                  </View>
                ) : schedule.record?.isReported ? (
                  <View
                    className="mt-2 rounded-full py-4 px-6 flex items-center justify-center"
                    style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
                  >
                    <Text className="text-xl font-bold" style={{ color: colors.textMuted }}>
                      今日已汇报
                    </Text>
                  </View>
                ) : null}
              </>
            )}
          </>
        ) : null}

        <CelebrationOverlay
          visible={celebration}
          onClose={() => setCelebration(false)}
          message={celebrationMsg}
          subMessage={startTime ? `用时 ${Math.round((Date.now() - startTime.getTime()) / 60000)} 分钟` : undefined}
        />
      </ScrollView>
    </View>
  );
}
