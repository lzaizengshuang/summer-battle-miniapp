import { View, Text } from '@tarojs/components';
import { ChevronLeft, ChevronRight } from 'lucide-react-taro';
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
      className="flex flex-row items-center justify-between rounded-3xl px-3 py-3 mb-4"
      style={{
        backgroundColor: colors.glass || colors.card,
        borderWidth: '2rpx',
        borderColor: colors.border,
      }}
    >
      <View
        className="w-12 h-12 rounded-2xl flex items-center justify-center active:scale-90 transition-transform"
        style={{ borderWidth: '2rpx', borderColor: colors.border }}
        onClick={goPrev}
      >
        <ChevronLeft size={28} color={colors.text} />
      </View>

      <View className="flex flex-col items-center" onClick={goToday}>
        <Text className="text-lg font-bold" style={{ color: colors.text }}>
          {formatDateCN(date)}
        </Text>
        {isToday(date) ? (
          <Text className="text-xs mt-1" style={{ color: colors.primary }}>
            今日
          </Text>
        ) : (
          <Text className="text-xs mt-1" style={{ color: colors.textMuted }}>
            点击回到今天
          </Text>
        )}
      </View>

      <View
        className="w-12 h-12 rounded-2xl flex items-center justify-center active:scale-90 transition-transform"
        style={{ borderWidth: '2rpx', borderColor: colors.border }}
        onClick={goNext}
      >
        <ChevronRight size={28} color={colors.text} />
      </View>
    </View>
  );
};
