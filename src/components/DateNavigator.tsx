import { View, Text } from '@tarojs/components';
import { useTheme } from '@/utils/theme';
import { formatDateCN, isToday, addISODays, getTodayISO } from '@/utils/date';

interface DateNavigatorProps {
  date: string;
  onChange: (date: string) => void;
  minDate?: string;
  maxDate?: string;
}

export const DateNavigator = ({
  date,
  onChange,
  minDate,
  maxDate,
}: DateNavigatorProps) => {
  const { colors } = useTheme();

  const goPrev = () => {
    const next = addISODays(date, -1);
    if (minDate && next < minDate) return;
    onChange(next);
  };

  const goNext = () => {
    const next = addISODays(date, 1);
    if (maxDate && next > maxDate) return;
    onChange(next);
  };

  const goToday = () => onChange(getTodayISO());

  return (
    <View
      className="flex flex-row items-center justify-between rounded-3xl px-4 py-4 mb-4"
      style={{ backgroundColor: colors.card, borderWidth: '2rpx', borderColor: colors.border }}
    >
      <View
        className="w-14 h-14 rounded-2xl flex items-center justify-center active:scale-95 transition-transform"
        style={{ backgroundColor: colors.primary }}
        onClick={goPrev}
      >
        <Text className="text-2xl font-bold" style={{ color: colors.bg }}>
          ◀
        </Text>
      </View>

      <View className="flex flex-col items-center" onClick={goToday}>
        <Text className="text-xl font-bold" style={{ color: colors.text }}>
          {formatDateCN(date)}
        </Text>
        {isToday(date) ? (
          <Text className="text-xs mt-1" style={{ color: colors.primary }}>
            · 今日
          </Text>
        ) : (
          <Text className="text-xs mt-1" style={{ color: colors.textMuted }}>
            点击回到今天
          </Text>
        )}
      </View>

      <View
        className="w-14 h-14 rounded-2xl flex items-center justify-center active:scale-95 transition-transform"
        style={{ backgroundColor: colors.primary }}
        onClick={goNext}
      >
        <Text className="text-2xl font-bold" style={{ color: colors.bg }}>
          ▶
        </Text>
      </View>
    </View>
  );
};
