import { useEffect, useState } from 'react';
import { View, Text } from '@tarojs/components';
import { useTheme } from '@/utils/theme';

interface CelebrationOverlayProps {
  visible: boolean;
  onClose: () => void;
  message?: string;
  subMessage?: string;
}

export const CelebrationOverlay = ({
  visible,
  onClose,
  message,
  subMessage,
}: CelebrationOverlayProps) => {
  const { colors, theme } = useTheme();
  const [scale, setScale] = useState(0);

  useEffect(() => {
    if (visible) {
      setScale(0);
      const t = setTimeout(() => setScale(1), 50);
      const auto = setTimeout(() => onClose(), 2500);
      return () => {
        clearTimeout(t);
        clearTimeout(auto);
      };
    }
  }, [visible, onClose]);

  if (!visible) return null;

  const isPrince = theme === 'prince';

  return (
    <View
      className="fixed inset-0 z-50 flex flex-col items-center justify-center px-8"
      style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}
    >
      <View
        className="rounded-full w-40 h-40 flex items-center justify-center mb-6 transition-transform duration-500"
        style={{
          backgroundColor: colors.gold,
          transform: `scale(${scale})`,
          boxShadow: `0 0 60rpx ${colors.gold}`,
        }}
      >
        <Text className="text-7xl">{isPrince ? '🎖️' : '👑'}</Text>
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
        <Text
          className="text-lg font-bold"
          style={{ color: isPrince ? colors.bg : '#FFFFFF' }}
        >
          太棒了！
        </Text>
      </View>
    </View>
  );
};
