import { useState } from 'react';
import { View, Text, Input, Picker, ScrollView } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';
import { useTheme } from '@/utils/theme';
import { useGlobalStore } from '@/stores/global';
import { callCloud, showError, showSuccess } from '@/utils/cloud';
import { getTodayISO, addISODays, eachISODay } from '@/utils/date';
import type { ThemeType, TaskTemplate, Plan, UserProgress, ChildProfile, DayType } from '@/types';

const dayTypeOptions: DayType[] = ['learn', 'rest', 'trip'];
const dayTypeLabels: Record<DayType, string> = {
  learn: '学习',
  rest: '敞耍',
  trip: '出游',
};

const weekdayLabels = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

const defaultTasks: TaskTemplate[] = [
  { id: 'task_1', name: '语文·阅读', detail: '阅读 20 分钟', icon: '📖', color: '#4A90E2', isOral: false },
  { id: 'task_2', name: '数学·口算', detail: '完成 1 页口算', icon: '🔢', color: '#F5A623', isOral: true },
  { id: 'task_3', name: '英语·听力', detail: '听读 15 分钟', icon: '🎧', color: '#7ED321', isOral: false },
];

export default function OnboardingPage() {
  const { colors, setTheme } = useTheme();
  const profile = useGlobalStore((s) => s.profile);
  const setProfile = useGlobalStore((s) => s.setProfile);
  const setPlan = useGlobalStore((s) => s.setPlan);
  const setProgress = useGlobalStore((s) => s.setProgress);

  const [step, setStep] = useState(0);
  const [theme, setThemeLocal] = useState<ThemeType>('prince');
  const [name, setName] = useState(profile?.name || '小战士');
  const [startDate, setStartDate] = useState(getTodayISO());
  const [endDate, setEndDate] = useState(addISODays(getTodayISO(), 60));
  const [tasks, setTasks] = useState<TaskTemplate[]>(defaultTasks);
  const [weekDefaults, setWeekDefaults] = useState<DayType[]>([
    'rest',
    'learn',
    'learn',
    'learn',
    'learn',
    'learn',
    'trip',
  ]);
  const [submitting, setSubmitting] = useState(false);

  useLoad(() => {
    // onboarding is the fallback entry
  });

  const updateTask = (idx: number, patch: Partial<TaskTemplate>) => {
    setTasks((prev) => prev.map((t, i) => (i === idx ? { ...t, ...patch } : t)));
  };

  const addTask = () => {
    const id = `task_${Date.now()}`;
    setTasks((prev) => [
      ...prev,
      { id, name: '', detail: '', icon: '✏️', color: '#9B59B6', isOral: false },
    ]);
  };

  const removeTask = (idx: number) => {
    setTasks((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateWeekDefault = (idx: number, type: DayType) => {
    setWeekDefaults((prev) => {
      const next = [...prev];
      next[idx] = type;
      return next;
    });
  };

  const generatePlanPayload = () => {
    const allDates = eachISODay(startDate, endDate);
    const dayTypes: Record<string, DayType> = {};
    const weekTemplates: Record<number, string[]> = {};

    for (let i = 0; i < 7; i++) {
      weekTemplates[i] = weekDefaults[i] === 'learn' ? tasks.map((t) => t.id) : [];
    }

    allDates.forEach((date) => {
      const d = new Date(date);
      const type = weekDefaults[d.getDay()];
      dayTypes[date] = type;
    });

    return {
      childId: profile?._id || '',
      name: `${startDate.slice(0, 4)} 暑假作战`,
      startDate,
      endDate,
      tasks,
      dayTypes,
      weekTemplates,
      difficulty: 0.8,
    };
  };

  const handleCreate = async () => {
    if (!profile) {
      // ensure default profile with selected theme
      try {
        const data = await callCloud<{ profile: ChildProfile }>('getOrCreateDefaultChildProfile', {
          theme,
        });
        setProfile(data.profile);
      } catch (err) {
        showError(err);
        return;
      }
    }

    const childId = profile?._id || '';
    if (!childId) {
      showError(new Error('缺少孩子档案'));
      return;
    }
    if (tasks.length === 0) {
      showError(new Error('请至少添加一个任务'));
      return;
    }
    if (endDate < startDate) {
      showError(new Error('结束日期不能早于开始日期'));
      return;
    }

    setSubmitting(true);
    try {
      const payload = generatePlanPayload();
      payload.childId = childId;
      const result = await callCloud<{ plan: Plan; progress: UserProgress }>('createPlan', payload);
      setPlan(result.plan);
      setProgress(result.progress);
      setTheme(theme);
      showSuccess('作战计划生成成功');
      Taro.switchTab({ url: '/pages/index/index' });
    } catch (err) {
      showError(err);
    } finally {
      setSubmitting(false);
    }
  };

  const renderStep = () => {
    if (step === 0) {
      return (
        <View>
          <Text className="text-2xl font-bold mb-6 text-center" style={{ color: colors.text }}>
            选择主题
          </Text>
          <View className="flex flex-row justify-between mb-6">
            <View
              className={`flex-1 mr-2 rounded-3xl p-6 flex flex-col items-center active:scale-95 transition-transform ${
                theme === 'prince' ? 'border-4' : ''
              }`}
              style={{
                backgroundColor: '#141414',
                borderColor: theme === 'prince' ? '#39FF14' : 'transparent',
              }}
              onClick={() => setThemeLocal('prince')}
            >
              <Text className="text-6xl mb-4">🚁</Text>
              <Text className="text-xl font-bold" style={{ color: '#39FF14' }}>
                王子
              </Text>
              <Text className="text-xs mt-2 text-center" style={{ color: '#888888' }}>
                军事 HUD 风格
              </Text>
            </View>
            <View
              className={`flex-1 ml-2 rounded-3xl p-6 flex flex-col items-center active:scale-95 transition-transform ${
                theme === 'princess' ? 'border-4' : ''
              }`}
              style={{
                backgroundColor: '#F5DEB3',
                borderColor: theme === 'princess' ? '#7ED321' : 'transparent',
              }}
              onClick={() => setThemeLocal('princess')}
            >
              <Text className="text-6xl mb-4">🏰</Text>
              <Text className="text-xl font-bold" style={{ color: '#9B59B6' }}>
                公主
              </Text>
              <Text className="text-xs mt-2 text-center" style={{ color: '#5D4037' }}>
                梦幻庄园风格
              </Text>
            </View>
          </View>
          <View className="mb-4">
            <Text className="text-sm mb-2" style={{ color: colors.textMuted }}>
              孩子昵称
            </Text>
            <Input
              className="rounded-2xl px-4 py-3"
              style={{ backgroundColor: colors.card, color: colors.text }}
              value={name}
              onInput={(e) => setName(e.detail.value)}
              placeholder="请输入昵称"
              placeholderStyle={`color:${colors.textMuted}`}
            />
          </View>
        </View>
      );
    }

    if (step === 1) {
      return (
        <View>
          <Text className="text-2xl font-bold mb-6 text-center" style={{ color: colors.text }}>
            设定假期范围
          </Text>
          <View className="mb-4">
            <Text className="text-sm mb-2" style={{ color: colors.textMuted }}>
              开始日期
            </Text>
            <Picker mode="date" value={startDate} onChange={(e) => setStartDate(e.detail.value)}>
              <View
                className="rounded-2xl px-4 py-3"
                style={{ backgroundColor: colors.card }}
              >
                <Text style={{ color: colors.text }}>{startDate}</Text>
              </View>
            </Picker>
          </View>
          <View className="mb-4">
            <Text className="text-sm mb-2" style={{ color: colors.textMuted }}>
              结束日期
            </Text>
            <Picker mode="date" value={endDate} onChange={(e) => setEndDate(e.detail.value)}>
              <View
                className="rounded-2xl px-4 py-3"
                style={{ backgroundColor: colors.card }}
              >
                <Text style={{ color: colors.text }}>{endDate}</Text>
              </View>
            </Picker>
          </View>
        </View>
      );
    }

    if (step === 2) {
      return (
        <View>
          <Text className="text-2xl font-bold mb-4 text-center" style={{ color: colors.text }}>
            添加任务模板
          </Text>
          {tasks.map((task, idx) => (
            <View
              key={task.id}
              className="rounded-3xl p-4 mb-4"
              style={{ backgroundColor: colors.card, borderWidth: '2rpx', borderColor: colors.border }}
            >
              <View className="flex flex-row items-center mb-2">
                <Input
                  className="flex-1 rounded-xl px-3 py-2 mr-2"
                  style={{ backgroundColor: colors.bg, color: colors.text }}
                  value={task.name}
                  onInput={(e) => updateTask(idx, { name: e.detail.value })}
                  placeholder="任务名称"
                  placeholderStyle={`color:${colors.textMuted}`}
                />
                <View
                  className="px-3 py-2 rounded-xl active:scale-95"
                  style={{ backgroundColor: colors.danger }}
                  onClick={() => removeTask(idx)}
                >
                  <Text className="text-sm font-bold" style={{ color: '#FFFFFF' }}>
                    删除
                  </Text>
                </View>
              </View>
              <Input
                className="rounded-xl px-3 py-2 mb-2"
                style={{ backgroundColor: colors.bg, color: colors.text }}
                value={task.detail}
                onInput={(e) => updateTask(idx, { detail: e.detail.value })}
                placeholder="默认详情"
                placeholderStyle={`color:${colors.textMuted}`}
              />
              <View className="flex flex-row items-center">
                <Input
                  className="w-16 rounded-xl px-3 py-2 mr-2 text-center"
                  style={{ backgroundColor: colors.bg, color: colors.text }}
                  value={task.icon}
                  onInput={(e) => updateTask(idx, { icon: e.detail.value })}
                />
                <Input
                  className="flex-1 rounded-xl px-3 py-2 mr-2"
                  style={{ backgroundColor: colors.bg, color: colors.text }}
                  value={task.color}
                  onInput={(e) => updateTask(idx, { color: e.detail.value })}
                  placeholder="颜色 #HEX"
                  placeholderStyle={`color:${colors.textMuted}`}
                />
                <View
                  className="w-10 h-10 rounded-xl"
                  style={{ backgroundColor: task.color }}
                />
              </View>
            </View>
          ))}
          <View
            className="rounded-full py-3 px-6 flex items-center justify-center active:scale-95 transition-transform"
            style={{ backgroundColor: colors.accent }}
            onClick={addTask}
          >
            <Text className="font-bold" style={{ color: colors.text }}>
              + 添加任务
            </Text>
          </View>
        </View>
      );
    }

    if (step === 3) {
      return (
        <View>
          <Text className="text-2xl font-bold mb-4 text-center" style={{ color: colors.text }}>
            批量设置日期类型
          </Text>
          {weekDefaults.map((type, idx) => (
            <View
              key={idx}
              className="flex flex-row items-center justify-between rounded-2xl px-4 py-3 mb-3"
              style={{ backgroundColor: colors.card }}
            >
              <Text style={{ color: colors.text }}>{weekdayLabels[idx]}</Text>
              <Picker
                mode="selector"
                range={dayTypeOptions.map((t) => dayTypeLabels[t])}
                value={dayTypeOptions.indexOf(type)}
                onChange={(e) => updateWeekDefault(idx, dayTypeOptions[e.detail.value])}
              >
                <View
                  className="px-4 py-2 rounded-xl"
                  style={{ backgroundColor: colors.bg }}
                >
                  <Text style={{ color: colors.text }}>{dayTypeLabels[type]}</Text>
                </View>
              </Picker>
            </View>
          ))}
        </View>
      );
    }

    return (
      <View>
        <Text className="text-2xl font-bold mb-4 text-center" style={{ color: colors.text }}>
          确认作战计划
        </Text>
        <View
          className="rounded-3xl p-5 mb-4"
          style={{ backgroundColor: colors.card, borderWidth: '2rpx', borderColor: colors.border }}
        >
          <Text className="text-lg font-bold mb-2" style={{ color: colors.text }}>
            {theme === 'prince' ? '王子主题' : '公主主题'}
          </Text>
          <Text style={{ color: colors.textMuted }}>
            昵称：{name}
          </Text>
          <Text style={{ color: colors.textMuted }}>
            假期：{startDate} 至 {endDate}
          </Text>
          <Text style={{ color: colors.textMuted }}>
            任务数：{tasks.length} 项
          </Text>
        </View>
        <Text className="text-sm mb-4 text-center" style={{ color: colors.textMuted }}>
          确认后将生成每日任务表和等级目标
        </Text>
      </View>
    );
  };

  return (
    <ScrollView
      className="min-h-full px-4 py-6"
      style={{ backgroundColor: colors.bg }}
      scrollY
    >
      <View className="flex flex-row items-center justify-center mb-6">
        {[0, 1, 2, 3, 4].map((i) => (
          <View
            key={i}
            className="w-8 h-2 rounded-full mx-1"
            style={{ backgroundColor: i <= step ? colors.primary : colors.border }}
          />
        ))}
      </View>

      {renderStep()}

      <View className="flex flex-row mt-6">
        {step > 0 ? (
          <View
            className="flex-1 mr-2 rounded-full py-4 flex items-center justify-center active:scale-95 transition-transform"
            style={{ backgroundColor: colors.border }}
            onClick={() => setStep(step - 1)}
          >
            <Text className="font-bold" style={{ color: colors.text }}>
              上一步
            </Text>
          </View>
        ) : null}
        {step < 4 ? (
          <View
            className="flex-1 ml-2 rounded-full py-4 flex items-center justify-center active:scale-95 transition-transform"
            style={{ backgroundColor: colors.primary }}
            onClick={() => setStep(step + 1)}
          >
            <Text
              className="font-bold"
              style={{ color: colors.theme === 'prince' ? colors.bg : '#FFFFFF' }}
            >
              下一步
            </Text>
          </View>
        ) : (
          <View
            className="flex-1 ml-2 rounded-full py-4 flex items-center justify-center active:scale-95 transition-transform"
            style={{
              backgroundColor: colors.primary,
              opacity: submitting ? 0.6 : 1,
            }}
            onClick={!submitting ? handleCreate : undefined}
          >
            <Text
              className="font-bold"
              style={{ color: colors.theme === 'prince' ? colors.bg : '#FFFFFF' }}
            >
              {submitting ? '生成中…' : '生成计划'}
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
