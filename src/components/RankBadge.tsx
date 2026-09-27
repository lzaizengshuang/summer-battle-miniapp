import { View, Text } from '@tarojs/components';
import { useTheme } from '@/utils/theme';

interface RankBadgeProps {
  rank: number;
  current?: boolean;
  small?: boolean;
  onLongPress?: () => void;
}

export const RankBadge = ({ rank, current, small, onLongPress }: RankBadgeProps) => {
  const { colors, rankNames } = useTheme();
  const name = rankNames[Math.max(0, Math.min(rank - 1, 14))] || '?';

  return (
    <View
      className={`flex flex-col items-center justify-center rounded-3xl ${
        small ? 'px-3 py-2' : 'px-5 py-3'
      }`}
      style={{
        backgroundColor: colors.card,
        borderWidth: '4rpx',
        borderColor: current ? colors.gold : colors.border,
        boxShadow: current ? `0 0 20rpx ${colors.gold}` : 'none',
      }}
      onLongPress={onLongPress}
    >
      <Text
        className={`font-bold ${small ? 'text-sm' : 'text-xl'}`}
        style={{ color: current ? colors.gold : colors.text }}
      >
        {name}
      </Text>
      {rank >= 15 ? (
        <Text className="text-xs mt-1">👑</Text>
      ) : null}
    </View>
  );
};
