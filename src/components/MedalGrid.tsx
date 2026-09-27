import { View, Text, Image } from '@tarojs/components';
import { useTheme } from '@/utils/theme';

interface MedalGridProps {
  unlockedIds: string[];
  onPress?: (id: string) => void;
}

export const MedalGrid = ({ unlockedIds, onPress }: MedalGridProps) => {
  const { colors, medals } = useTheme();

  return (
    <View className="flex flex-row flex-wrap">
      {medals.map((medal) => {
        const unlocked = unlockedIds.includes(medal.id);
        return (
          <View
            key={medal.id}
            className="w-1/3 p-2"
            onClick={() => onPress?.(medal.id)}
          >
            <View
              className="rounded-3xl p-4 flex flex-col items-center justify-center transition-transform active:scale-95"
              style={{
                backgroundColor: colors.card,
                borderWidth: '4rpx',
                borderColor: unlocked ? colors.gold : colors.border,
                opacity: unlocked ? 1 : 0.5,
              }}
            >
              {medal.image ? (
                medal.tile ? (
                  <Image
                    src={medal.image}
                    mode="aspectFill"
                    className="w-full h-28 mb-2"
                    style={{ borderRadius: '16rpx', opacity: unlocked ? 1 : 0.4 }}
                  />
                ) : (
                  <Image
                    src={medal.image}
                    mode="aspectFit"
                    className="w-20 h-20 mb-2"
                    style={{ opacity: unlocked ? 1 : 0.35, filter: unlocked ? 'none' : 'grayscale(90%)' }}
                  />
                )
              ) : (
                <Text className="text-5xl mb-2">{medal.icon}</Text>
              )}
              <Text
                className="text-sm font-bold text-center"
                style={{ color: unlocked ? colors.gold : colors.text }}
              >
                {medal.name}
              </Text>
              <Text
                className="text-xs text-center mt-1"
                style={{ color: colors.textMuted }}
              >
                {medal.desc}
              </Text>
              {!unlocked ? (
                <Text className="text-lg mt-1">🔒</Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
};
