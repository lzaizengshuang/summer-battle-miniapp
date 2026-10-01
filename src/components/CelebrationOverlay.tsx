import { useEffect, useMemo, useState } from 'react';
import { View, Text, Image } from '@tarojs/components';
import { useTheme } from '@/utils/theme';

interface CelebrationOverlayProps {
  visible: boolean;
  onClose: () => void;
  message?: string;
  subMessage?: string;
}

const CONFETTI_COLORS = ['#F472B6', '#FBBF24', '#C084FC', '#38BDF8', '#F5F3FF'];

export const CelebrationOverlay = ({
  visible,
  onClose,
  message,
  subMessage,
}: CelebrationOverlayProps) => {
  const { colors, theme } = useTheme();
  const [scale, setScale] = useState(0);

  const confetti = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        left: `${(i * 37 + 13) % 100}%`,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        delay: `${(i % 10) * 0.18}s`,
        duration: `${2.2 + (i % 5) * 0.35}s`,
        size: `${10 + (i % 3) * 6}rpx`,
      })),
    [],
  );

  useEffect(() => {
    if (visible) {
      setScale(0);
      const t = setTimeout(() => setScale(1), 50);
      const auto = setTimeout(() => onClose(), 2800);
      return () => {
        clearTimeout(t);
        clearTimeout(auto);
      };
    }
  }, [visible, onClose]);

  if (!visible) return null;

  const medalImg =
    theme === 'prince'
      ? '/assets/prince/celebrate-medal.png'
      : '/assets/princess/celebrate-medal.png';
  const btnTextColor = theme === 'prince' ? '#0B1026' : '#150A2E';

  return (
    <View
      className="fixed inset-0 z-50 flex flex-col items-center justify-center px-8 overflow-hidden"
      style={{ backgroundColor: 'rgba(6,10,25,0.9)' }}
    >
      <View className="absolute inset-0">
        {confetti.map((c, i) => (
          <View
            key={i}
            className="confetti-piece rounded-sm"
            style={{
              left: c.left,
              width: c.size,
              height: c.size,
              backgroundColor: c.color,
              animationDelay: c.delay,
              animationDuration: c.duration,
            }}
          />
        ))}
      </View>

      <View
        className="rounded-full w-44 h-44 flex items-center justify-center mb-6 transition-transform duration-500"
        style={{
          backgroundColor: 'rgba(251,191,36,0.12)',
          transform: `scale(${scale})`,
          boxShadow: `0 0 80rpx ${colors.gold}`,
        }}
      >
        <Image src={medalImg} mode="aspectFit" className="w-36 h-36" />
      </View>

      <Text
        className="text-3xl font-bold text-center mb-2"
        style={{ color: colors.gold }}
      >
        {message || '汇报成功！'}
      </Text>
      {subMessage ? (
        <Text className="text-lg text-center mb-8" style={{ color: colors.text }}>
          {subMessage}
        </Text>
      ) : null}

      <View
        className="px-10 py-4 rounded-full active:scale-95 transition-transform"
        style={{ backgroundColor: colors.primary }}
        onClick={onClose}
      >
        <Text className="text-lg font-bold" style={{ color: btnTextColor }}>
          太棒了！
        </Text>
      </View>
    </View>
  );
};
