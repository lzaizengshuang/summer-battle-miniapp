import { useState, useEffect } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useLoad, usePullDownRefresh } from '@tarojs/taro';
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
    if (!profile || !plan) {
      Taro.redirectTo({ url: '/pages/onboarding/index' });
      return;
    }
    loadSchedule();
  });

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

  return (
    <ScrollView
      className="min-h-full px-4 py-4"
      style={{ backgroundColor: colors.bg }}
      scrollY
      refresherEnabled
      onRefresherRefresh={loadSchedule}
    >
      <DateNavigator
        date={date}
        onChange={(d) => setDate(clampDate(d, plan?.startDate, plan?.endDate))}
        minDate={plan?.startDate}
        maxDate={plan?.endDate}
      />

      <View
        className="rounded-3xl p-5 mb-4"
        style={{ backgroundColor: colors.card, borderWidth: '2rpx', borderColor: colors.border }}
      >
        <View className="flex flex-row items-center justify-between">
          <RankBadge rank={rank} current onLongPress={openParent} />
          <View className="flex-1 mx-4">
            <Text className="text-sm" style={{ color: colors.textMuted }}>
              {rankNames[rank - 1]}
            </Text>
            <View
              className="h-4 rounded-full mt-2 overflow-hidden"
              style={{ backgroundColor: colors.bg }}
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
          <View className="flex-1 flex flex-col items-center">
            <Text className="text-3xl">🔥</Text>
            <Text className="text-xl font-bold" style={{ color: colors.text }}>
              {progress?.currentConsecutiveDays || 0}
            </Text>
            <Text className="text-xs" style={{ color: colors.textMuted }}>
              连续打卡
            </Text>
          </View>
          <View className="flex-1 flex flex-col items-center">
            <Text className="text-3xl">⚡</Text>
            <Text className="text-xl font-bold" style={{ color: colors.text }}>
              {progress?.totalPoints || 0}
            </Text>
            <Text className="text-xs" style={{ color: colors.textMuted }}>
              {text.points}
            </Text>
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
          style={{ backgroundColor: colors.card, borderWidth: '2rpx', borderColor: colors.border }}
        >
          <Text className="text-6xl mb-4">🏖️</Text>
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
          style={{ backgroundColor: colors.card, borderWidth: '2rpx', borderColor: colors.border }}
        >
          <Text className="text-6xl mb-4">✈️</Text>
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
              style={{ backgroundColor: colors.card, borderWidth: '2rpx', borderColor: colors.border }}
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
                    style={{ backgroundColor: colors.accent }}
                    onClick={handleStart}
                  >
                    <Text className="text-sm font-bold" style={{ color: colors.text }}>
                      {startTime ? '进行中…' : text.start}
                    </Text>
                  </View>
                ) : null}
              </View>

              {allCompleted && !schedule.record?.isReported ? (
                <View
                  className="mt-2 rounded-full py-4 px-6 flex items-center justify-center active:scale-95 transition-transform"
                  style={{ backgroundColor: colors.primary }}
                  onClick={handleReport}
                >
                  <Text
                    className="text-xl font-bold"
                    style={{ color: colors.theme === 'prince' ? colors.bg : '#FFFFFF' }}
                  >
                    {text.report}
                  </Text>
                </View>
              ) : schedule.record?.isReported ? (
                <View
                  className="mt-2 rounded-full py-4 px-6 flex items-center justify-center"
                  style={{ backgroundColor: colors.border }}
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
  );
}
