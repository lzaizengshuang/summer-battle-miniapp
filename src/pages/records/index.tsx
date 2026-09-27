import { useState, useEffect } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';
import { useTheme } from '@/utils/theme';
import { useGlobalStore } from '@/stores/global';
import { Calendar } from '@/components/Calendar';
import { callCloud, showError } from '@/utils/cloud';
import { formatDateCN, getTodayISO, clampDate } from '@/utils/date';
import type { DayRecord, DayType } from '@/types';

export default function RecordsPage() {
  const { colors, theme } = useTheme();
  const profile = useGlobalStore((s) => s.profile);
  const plan = useGlobalStore((s) => s.plan);

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState<string>(getTodayISO());
  const [records, setRecords] = useState<DayRecord[]>([]);

  useLoad(() => {
    if (!profile || !plan) {
      Taro.redirectTo({ url: '/pages/onboarding/index' });
    }
  });

  useEffect(() => {
    if (!profile || !plan) return;
    loadRecords();
  }, [year, month, profile, plan]);

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
        className="min-h-full flex items-center justify-center px-4"
        style={{ backgroundColor: colors.bg }}
      >
        <Text style={{ color: colors.textMuted }}>加载中…</Text>
      </View>
    );
  }

  const selectedRecord = records.find((r) => r.date === selectedDate);
  const dayType: DayType = plan.dayTypes[selectedDate] || 'learn';

  const legend = [
    { color: colors.success, label: '已完成' },
    { color: colors.gold, label: '部分完成' },
    { color: '#87CEEB', label: '出游日' },
    { color: `${colors.success}40`, label: '敞耍日' },
    { color: '#9E9E9E', label: '已过未完成' },
  ];

  return (
    <ScrollView
      className="min-h-full px-4 py-4"
      style={{ backgroundColor: colors.bg }}
      scrollY
    >
      <View
        className="flex flex-row items-center justify-between rounded-3xl px-4 py-4 mb-4"
        style={{ backgroundColor: colors.card, borderWidth: '2rpx', borderColor: colors.border }}
      >
        <View
          className="w-14 h-14 rounded-2xl flex items-center justify-center active:scale-95 transition-transform"
          style={{ backgroundColor: colors.primary }}
          onClick={prevMonth}
        >
          <Text className="text-2xl font-bold" style={{ color: colors.bg }}>
            ◀
          </Text>
        </View>
        <Text className="text-xl font-bold" style={{ color: colors.text }}>
          {year}年{month.toString().padStart(2, '0')}月
        </Text>
        <View
          className="w-14 h-14 rounded-2xl flex items-center justify-center active:scale-95 transition-transform"
          style={{ backgroundColor: colors.primary }}
          onClick={nextMonth}
        >
          <Text className="text-2xl font-bold" style={{ color: colors.bg }}>
            ▶
          </Text>
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
              return (
                <View key={tr.taskId} className="flex flex-row items-center justify-between py-2">
                  <Text style={{ color: colors.text }}>{task?.name || tr.taskId}</Text>
                  <Text
                    className="text-sm font-bold"
                    style={{ color: tr.completed ? colors.success : colors.textMuted }}
                  >
                    {tr.completed ? '✓ 完成' : '○ 未完成'}
                  </Text>
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
  );
}
