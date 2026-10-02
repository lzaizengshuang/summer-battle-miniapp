import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Image } from '@tarojs/components';
import Taro, { useLoad, useDidShow, useShareAppMessage } from '@tarojs/taro';
import { ChevronLeft, ChevronRight, CircleCheck, Circle } from 'lucide-react-taro';
import { useTheme } from '@/utils/theme';
import { useGlobalStore } from '@/stores/global';
import { Calendar } from '@/components/Calendar';
import { CelebrationOverlay } from '@/components/CelebrationOverlay';
import { callCloud, showError } from '@/utils/cloud';
import { formatDateCN, getTodayISO, clampDate } from '@/utils/date';
import type { DayRecord, DayType } from '@/types';

// 每次启动小程序只撒一次花，切换月份不重复弹
let confettiShown = false;

export default function RecordsPage() {
  const { colors, theme } = useTheme();
  const profile = useGlobalStore((s) => s.profile);
  const plan = useGlobalStore((s) => s.plan);

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState<string>(getTodayISO());
  const [records, setRecords] = useState<DayRecord[]>([]);
  const [celebration, setCelebration] = useState(false);

  useLoad(() => {
    // 冷启动等全局数据就绪再判断，避免慢网络下误跳引导页
    let attempts = 0;
    const check = () => {
      const s = useGlobalStore.getState();
      if (s.profile && s.plan) return; // 数据就绪，由 useEffect 加载记录
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
      ? `${profile.name}的假期打卡战绩，坚持就是胜利！`
      : '孩子假期打卡神器，坚持就有勋章',
    path: '/pages/index/index',
  }));

  useEffect(() => {
    if (!profile || !plan) return;
    loadRecords();
  }, [year, month, profile, plan]);

  // tabBar 页面不卸载：每次切回记录页都重新拉取，保证刚汇报的数据及时同步
  useDidShow(() => {
    const s = useGlobalStore.getState();
    if (!s.profile || !s.plan) return;
    loadRecords();
  });

  const loadRecords = async () => {
    if (!profile || !plan) return;
    try {
      const data = await callCloud<{ records: DayRecord[] }>('getRecords', {
        childId: profile._id,
        planId: plan._id,
        year,
        month,
      });
      setRecords(data.records);
      // 今天已汇报且全部完成：撒花庆祝一次
      if (!confettiShown) {
        const today = getTodayISO();
        const todayRecord = data.records.find((r) => r.date === today);
        if (
          todayRecord &&
          todayRecord.isReported &&
          todayRecord.taskRecords.length > 0 &&
          todayRecord.taskRecords.every((t) => t.completed)
        ) {
          confettiShown = true;
          setCelebration(true);
        }
      }
    } catch (err) {
      showError(err);
    }
  };

  const prevMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
  };

  const nextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
  };

  if (!plan) {
    return (
      <View
        className="w-full min-h-full flex items-center justify-center px-4"
        style={{ backgroundColor: colors.bg }}
      >
        <Text style={{ color: colors.textMuted }}>加载中…</Text>
      </View>
    );
  }

  const selectedRecord = records.find((r) => r.date === selectedDate);
  const dayType: DayType = plan.dayTypes[selectedDate] || 'learn';

  const reportedDays = records.filter((r) => r.isReported);
  const fullDays = reportedDays.filter(
    (r) => r.taskRecords.length > 0 && r.taskRecords.every((t) => t.completed),
  ).length;
  const monthPoints = reportedDays.reduce((sum, r) => sum + (r.totalPoints || 0), 0);

  const fmtDuration = (tr: DayRecord['taskRecords'][number]) => {
    if (!tr.startTime || !tr.endTime) return null;
    const mins = Math.max(
      1,
      Math.round((new Date(tr.endTime).getTime() - new Date(tr.startTime).getTime()) / 60000),
    );
    return mins < 60 ? `${mins} 分钟` : `${Math.floor(mins / 60)} 小时 ${mins % 60} 分`;
  };

  const legend = [
    { color: colors.success, label: '已完成' },
    { color: colors.gold, label: '部分完成' },
    { color: '#87CEEB', label: '出游日' },
    { color: `${colors.success}40`, label: '敞耍日' },
    { color: '#9E9E9E', label: '已过未完成' },
  ];

  return (
    <View className="w-full min-h-full overflow-hidden" style={{ backgroundColor: colors.bg }}>
      {colors.bgImage ? (
        <Image
          src={colors.bgImage}
          mode="aspectFill"
          style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0, opacity: 0.5 }}
        />
      ) : null}
      <ScrollView
        className="w-full min-h-full px-4 py-4 box-border"
        style={{ position: 'relative', zIndex: 1 }}
        scrollY
        showScrollbar={false}
      >
      <View
        className="flex flex-row items-center justify-between rounded-3xl px-4 py-4 mb-4"
        style={{ backgroundColor: colors.card, borderWidth: '2rpx', borderColor: colors.border }}
      >
        <View
          className="w-12 h-12 rounded-2xl flex items-center justify-center active:scale-95 transition-transform"
          style={{ backgroundColor: colors.glass || colors.card, borderWidth: '2rpx', borderColor: colors.border }}
          onClick={prevMonth}
        >
          <ChevronLeft size={30} color={colors.text} />
        </View>
        <Text className="text-xl font-bold" style={{ color: colors.text }}>
          {year}年{month.toString().padStart(2, '0')}月
        </Text>
        <View
          className="w-12 h-12 rounded-2xl flex items-center justify-center active:scale-95 transition-transform"
          style={{ backgroundColor: colors.glass || colors.card, borderWidth: '2rpx', borderColor: colors.border }}
          onClick={nextMonth}
        >
          <ChevronRight size={30} color={colors.text} />
        </View>
      </View>

      <Calendar
        year={year}
        month={month}
        plan={plan}
        records={records}
        selectedDate={selectedDate}
        onSelect={(d) => setSelectedDate(clampDate(d, plan.startDate, plan.endDate))}
      />

      <View
        className="flex flex-row items-center justify-between rounded-3xl px-4 py-3 mt-4"
        style={{ backgroundColor: colors.card, borderWidth: '2rpx', borderColor: colors.border }}
      >
        <View className="flex flex-col items-center flex-1">
          <Text className="text-lg font-bold" style={{ color: colors.gold }}>
            {reportedDays.length}
          </Text>
          <Text className="text-xs" style={{ color: colors.textMuted }}>
            已打卡
          </Text>
        </View>
        <View
          className="w-0 h-8 mx-2"
          style={{ borderLeftWidth: '2rpx', borderColor: colors.border }}
        />
        <View className="flex flex-col items-center flex-1">
          <Text className="text-lg font-bold" style={{ color: colors.gold }}>
            {fullDays}
          </Text>
          <Text className="text-xs" style={{ color: colors.textMuted }}>
            全勤
          </Text>
        </View>
        <View
          className="w-0 h-8 mx-2"
          style={{ borderLeftWidth: '2rpx', borderColor: colors.border }}
        />
        <View className="flex flex-col items-center flex-1">
          <Text className="text-lg font-bold" style={{ color: colors.gold }}>
            {monthPoints}
          </Text>
          <Text className="text-xs" style={{ color: colors.textMuted }}>
            获得{theme === 'prince' ? '军功' : '爱心值'}
          </Text>
        </View>
      </View>

      <View
        className="rounded-3xl p-4 mt-4"
        style={{ backgroundColor: colors.card, borderWidth: '2rpx', borderColor: colors.border }}
      >
        <Text className="text-lg font-bold mb-3" style={{ color: colors.text }}>
          {formatDateCN(selectedDate)} · {dayType === 'learn' ? '学习日' : dayType === 'rest' ? '敞耍日' : '出游日'}
        </Text>

        {selectedRecord ? (
          <>
            {selectedRecord.taskRecords.map((tr) => {
              const task = plan.tasks.find((t) => t.id === tr.taskId);
              const duration = fmtDuration(tr);
              return (
                <View key={tr.taskId} className="flex flex-row items-center justify-between py-2">
                  <View className="flex flex-row items-center">
                    <View
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-lg mr-3"
                      style={{ backgroundColor: `${task?.color || '#888888'}26` }}
                    >
                      <Text>{task?.icon || '📝'}</Text>
                    </View>
                    <View>
                      <Text style={{ color: colors.text }}>{task?.name || tr.taskId}</Text>
                      {duration ? (
                        <Text className="text-xs mt-1" style={{ color: colors.textMuted }}>
                          用时 {duration}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  {tr.completed ? (
                    <CircleCheck size={26} color={colors.success} />
                  ) : (
                    <Circle size={26} color={colors.textMuted} />
                  )}
                </View>
              );
            })}
            <View
              className="mt-3 pt-3 border-t-2"
              style={{ borderColor: colors.border }}
            >
              <Text style={{ color: colors.textMuted }}>
                获得{theme === 'prince' ? '军功' : '爱心值'}：{selectedRecord.totalPoints}
              </Text>
              <Text style={{ color: colors.textMuted }}>
                状态：{selectedRecord.isReported ? '已汇报' : '未汇报'}
              </Text>
            </View>
          </>
        ) : (
          <Text style={{ color: colors.textMuted }}>当天暂无打卡记录</Text>
        )}
      </View>

      <View
        className="flex flex-row flex-wrap mt-4 rounded-3xl p-3"
        style={{ backgroundColor: colors.card, borderWidth: '2rpx', borderColor: colors.border }}
      >
        {legend.map((item) => (
          <View key={item.label} className="flex flex-row items-center mr-4 mb-2">
            <View
              className="w-5 h-5 rounded-full mr-2"
              style={{ backgroundColor: item.color }}
            />
            <Text className="text-xs" style={{ color: colors.textMuted }}>
              {item.label}
            </Text>
          </View>
        ))}
      </View>
      </ScrollView>
      <CelebrationOverlay
        visible={celebration}
        onClose={() => setCelebration(false)}
        message="今日任务全部完成！"
        subMessage="去记录页看看你的战绩吧"
      />
    </View>
  );
}
