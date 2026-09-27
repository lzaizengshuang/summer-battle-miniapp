import { View, Text } from '@tarojs/components';
import { useTheme } from '@/utils/theme';
import { getCalendarDays, parseDate, isToday, isPastDay } from '@/utils/date';
import type { Plan, DayRecord, DayType } from '@/types';

interface CalendarProps {
  year: number;
  month: number;
  plan: Plan;
  records: DayRecord[];
  selectedDate?: string;
  onSelect: (date: string) => void;
}

const weekHeaders = ['日', '一', '二', '三', '四', '五', '六'];

export const Calendar = ({
  year,
  month,
  plan,
  records,
  selectedDate,
  onSelect,
}: CalendarProps) => {
  const { colors } = useTheme();
  const days = getCalendarDays(year, month);
  const recordMap = new Map(records.map((r) => [r.date, r]));

  const getDayColor = (date: string): string | null => {
    const inRange = date >= plan.startDate && date <= plan.endDate;
    if (!inRange) return null;
    const type: DayType = plan.dayTypes[date] || 'learn';
    const record = recordMap.get(date);
    const completedCount = record?.taskRecords.filter((t) => t.completed).length || 0;
    const totalCount = record?.taskRecords.length || 0;

    if (type === 'rest') return `${colors.success}40`;
    if (type === 'trip') return '#87CEEB';
    if (record?.isReported) return colors.success;
    if (completedCount > 0 && completedCount < totalCount) return colors.gold;
    if (isPastDay(date) && completedCount === 0) return '#9E9E9E';
    return null;
  };

  return (
    <View
      className="rounded-3xl p-4"
      style={{ backgroundColor: colors.card, borderWidth: '2rpx', borderColor: colors.border }}
    >
      <View className="flex flex-row justify-between mb-4">
        {weekHeaders.map((h) => (
          <Text
            key={h}
            className="w-14 text-center text-sm font-bold"
            style={{ color: colors.textMuted }}
          >
            {h}
          </Text>
        ))}
      </View>

      <View className="flex flex-row flex-wrap">
        {days.map((date) => {
          const d = parseDate(date);
          const inMonth = d.getMonth() + 1 === month;
          const inRange = date >= plan.startDate && date <= plan.endDate;
          const color = inMonth ? getDayColor(date) : null;
          const selected = selectedDate === date;
          const today = isToday(date);

          return (
            <View key={date} className="p-1" style={{ width: '14.2857%' }}>
              <View
                className="h-20 rounded-2xl flex items-center justify-center relative active:scale-95 transition-transform"
                style={{
                  backgroundColor: selected ? colors.primary : colors.bg,
                  opacity: inMonth ? 1 : 0.3,
                }}
                onClick={() => inRange && onSelect(date)}
              >
                <Text
                  className="text-base font-bold z-10"
                  style={{
                    color: selected ? colors.bg : today ? colors.primary : colors.text,
                  }}
                >
                  {d.getDate()}
                </Text>
                {color ? (
                  <View
                    className="absolute bottom-2 w-4 h-4 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                ) : null}
                {today ? (
                  <View
                    className="absolute top-1 right-1 w-3 h-3 rounded-full"
                    style={{ backgroundColor: colors.primary }}
                  />
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
};
