import { useState, useEffect } from 'react';
import { View, Text } from '@tarojs/components';
import { Check } from 'lucide-react-taro';
import { useTheme } from '@/utils/theme';
import type { TaskTemplate, TaskRecord } from '@/types';

interface TaskCardProps {
  task: TaskTemplate & { record?: TaskRecord };
  onToggle: (completed: boolean) => void;
  disabled?: boolean;
}

export const TaskCard = ({ task, onToggle, disabled }: TaskCardProps) => {
  const { colors } = useTheme();
  const completed = !!task.record?.completed;
  const [pop, setPop] = useState(false);

  useEffect(() => {
    if (completed) {
      setPop(true);
      const t = setTimeout(() => setPop(false), 300);
      return () => clearTimeout(t);
    }
  }, [completed]);

  const handleClick = () => {
    if (disabled) return;
    if (!completed) setPop(true);
    onToggle(!completed);
    setTimeout(() => setPop(false), 300);
  };

  return (
    <View
      className="flex flex-row items-center rounded-3xl p-5 mb-4 transition-transform duration-200 active:scale-95"
      style={{
        backgroundColor: colors.glass || colors.card,
        borderWidth: '2rpx',
        borderColor: completed ? colors.primary : colors.border,
      }}
      onClick={handleClick}
    >
      <View
        className="w-14 h-14 rounded-2xl flex items-center justify-center text-4xl mr-4"
        style={{ backgroundColor: `${task.color}26` }}
      >
        <Text>{task.icon || '📝'}</Text>
      </View>

      <View className="flex-1">
        <Text
          className="text-lg font-bold"
          style={{
            color: completed ? colors.textMuted : colors.text,
            textDecoration: completed ? 'line-through' : 'none',
          }}
        >
          {task.name}
        </Text>
        {task.detail ? (
          <Text
            className="text-sm mt-1"
            style={{ color: colors.textMuted }}
          >
            {task.detail}
          </Text>
        ) : null}
      </View>

      <View
        className={`w-12 h-12 rounded-full flex items-center justify-center border-4 transition-transform duration-200 ${
          pop ? 'scale-125' : 'scale-100'
        }`}
        style={{
          borderColor: completed ? colors.primary : colors.border,
          backgroundColor: completed ? colors.primary : 'transparent',
        }}
      >
        {completed ? (
          <Check size={26} strokeWidth={3} color={colors.bg} />
        ) : null}
      </View>
    </View>
  );
};
