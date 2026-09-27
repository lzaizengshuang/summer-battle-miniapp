import { View, Text, Image } from '@tarojs/components';
import { useTheme } from '@/utils/theme';
import { rankEmblems } from '@/config/theme';

interface RankBadgeProps {
  rank: number;
  current?: boolean;
  small?: boolean;
  onLongPress?: () => void;
}

export const RankBadge = ({ rank, current, small, onLongPress }: RankBadgeProps) => {
  const { colors, rankNames } = useTheme();
  const idx = Math.max(0, Math.min(rank - 1, 14));
  const name = rankNames[idx] || '?';
  const emblem = rankEmblems[colors.theme][idx];

  if (emblem) {
    const size = small ? 88 : 112;
    return (
      <View className="flex flex-col items-center" onLongPress={onLongPress}>
        <View
          style={{
            width: `${size}rpx`,
            height: `${size}rpx`,
            borderRadius: '24rpx',
            borderWidth: current ? '4rpx' : '2rpx',
            borderColor: current ? colors.gold : colors.border,
            overflow: 'hidden',
            boxShadow: current ? `0 0 24rpx ${colors.gold}` : 'none',
          }}
        >
          <Image src={emblem} mode="aspectFill" style={{ width: '100%', height: '100%' }} />
        </View>
        <Text
          className={`mt-1 font-bold ${small ? 'text-xs' : 'text-sm'}`}
          style={{ color: current ? colors.gold : colors.text }}
        >
          {name}
        </Text>
      </View>
    );
  }

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
