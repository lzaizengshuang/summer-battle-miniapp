import { useState } from 'react';
import { View, Text, Image, Picker, ScrollView } from '@tarojs/components';
import { Input } from '@/components/ui/input';
import Taro, { useLoad } from '@tarojs/taro';
import { useTheme } from '@/utils/theme';
import { useGlobalStore } from '@/stores/global';
import { callCloud, showError, showSuccess } from '@/utils/cloud';
import { getTodayISO, addISODays, eachISODay } from '@/utils/date';
import { avatarOptions } from '@/config/theme';
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
  const [avatar, setAvatar] = useState<string>(profile?.avatarUrl || avatarOptions.prince[0]);
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
    // 冷启动时全局数据可能未就绪：若已有计划则返回首页，防止老用户被误带进来重复建计划
    let attempts = 0;
    const check = () => {
      const s = useGlobalStore.getState();
      if (s.profile && s.plan) {
        Taro.switchTab({ url: '/pages/index/index' });
        return;
      }
      if (attempts < 16) {
        attempts += 1;
        setTimeout(check, 250);
      }
    };
    check();
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

    const year = startDate.slice(0, 4);
    const month = Number(startDate.slice(5, 7));
    const season = month === 1 || month === 2 ? '寒假' : month >= 7 && month <= 8 ? '暑假' : '假期';

    return {
      childId: profile?._id || '',
      name: `${year} ${season}作战`,
      startDate,
      endDate,
      tasks,
      dayTypes,
      weekTemplates,
      difficulty: 0.8,
    };
  };

  const handleCreate = async () => {
    let currentProfile = profile;
    if (!currentProfile) {
      // ensure default profile with selected theme
      try {
        const data = await callCloud<{ profile: ChildProfile }>('getOrCreateDefaultChildProfile', {
          theme,
        });
        currentProfile = data.profile;
        setProfile(data.profile);
      } catch (err) {
        showError(err);
        return;
      }
    }

    const childId = currentProfile._id;
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

    // 保存孩子在引导页输入的昵称和头像（云端档案可能还是默认值）
    if (
      (name.trim() && name.trim() !== currentProfile.name) ||
      (avatar && avatar !== currentProfile.avatarUrl)
    ) {
      try {
        const data = await callCloud<{ profile: ChildProfile }>('updateChildProfile', {
          childId,
          name: name.trim() || undefined,
          avatarUrl: avatar || undefined,
        });
        currentProfile = data.profile;
        setProfile(data.profile);
      } catch (err) {
        showError(err);
        return;
      }
    }

    setSubmitting(true);
    try {
      // 网络慢被误带进引导页时，已有计划则直接返回首页，避免重复建计划
      const existing = await callCloud<{ plan: Plan | null; progress: UserProgress | null }>(
        'getCurrentPlan',
        { childId },
      );
      if (existing.plan) {
        setPlan(existing.plan);
        if (existing.progress) setProgress(existing.progress);
        showSuccess('已有进行中的计划');
        Taro.switchTab({ url: '/pages/index/index' });
        return;
      }

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
                backgroundColor: '#0B1026',
                borderColor: theme === 'prince' ? '#A3E635' : 'transparent',
                borderWidth: '4rpx',
              }}
              onClick={() => {
                setThemeLocal('prince');
                setAvatar(avatarOptions.prince[0]);
              }}
            >
              <Text className="text-6xl mb-4">🚁</Text>
              <Text className="text-xl font-bold" style={{ color: '#A3E635' }}>
                王子
              </Text>
              <Text className="text-xs mt-2 text-center" style={{ color: '#8B94B3' }}>
                特种兵军事基地
              </Text>
            </View>
            <View
              className={`flex-1 ml-2 rounded-3xl p-6 flex flex-col items-center active:scale-95 transition-transform ${
                theme === 'princess' ? 'border-4' : ''
              }`}
              style={{
                backgroundColor: '#150A2E',
                borderColor: theme === 'princess' ? '#F472B6' : 'transparent',
                borderWidth: '4rpx',
              }}
              onClick={() => {
                setThemeLocal('princess');
                setAvatar(avatarOptions.princess[0]);
              }}
            >
              <Text className="text-6xl mb-4">🏰</Text>
              <Text className="text-xl font-bold" style={{ color: '#F472B6' }}>
                公主
              </Text>
              <Text className="text-xs mt-2 text-center" style={{ color: '#A78BFA' }}>
                梦幻城堡花园
              </Text>
            </View>
          </View>
          <View className="mb-4">
            <Text className="text-sm mb-2" style={{ color: colors.textMuted }}>
              孩子昵称
            </Text>
            <View
              className="rounded-2xl px-4"
              style={{ backgroundColor: colors.card, borderWidth: '2rpx', borderColor: colors.border }}
            >
              <Input
                className="w-full bg-transparent px-0"
                style={{ color: colors.text }}
                value={name}
                onInput={(e) => setName(e.detail.value)}
                placeholder="请输入昵称"
                placeholderStyle={`color:${colors.textMuted}`}
              />
            </View>
          </View>
          <View className="mb-2">
            <Text className="text-sm mb-2" style={{ color: colors.textMuted }}>
              选择头像
            </Text>
            <View className="flex flex-row flex-wrap">
              {avatarOptions[theme].map((option) => {
                const selected = avatar === option;
                return (
                  <View
                    key={option}
                    className="w-1/3 p-1"
                    onClick={() => setAvatar(option)}
                  >
                    <View
                      className="rounded-3xl p-1"
                      style={{
                        borderWidth: selected ? '4rpx' : '2rpx',
                        borderColor: selected ? colors.primary : colors.border,
                        backgroundColor: colors.card,
                      }}
                    >
                      <Image
                        src={option}
                        mode="aspectFill"
                        style={{ width: '100%', height: '140rpx', borderRadius: '20rpx' }}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
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
                <View
                  className="flex-1 rounded-xl px-3 py-2 mr-2"
                  style={{ backgroundColor: colors.bg }}
                >
                  <Input
                    className="w-full bg-transparent px-0"
                    style={{ color: colors.text }}
                    value={task.name}
                    onInput={(e) => updateTask(idx, { name: e.detail.value })}
                    placeholder="任务名称"
                    placeholderStyle={`color:${colors.textMuted}`}
                  />
                </View>
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
              <View
                className="rounded-xl px-3 py-2 mb-2"
                style={{ backgroundColor: colors.bg }}
              >
                <Input
                  className="w-full bg-transparent px-0"
                  style={{ color: colors.text }}
                  value={task.detail}
                  onInput={(e) => updateTask(idx, { detail: e.detail.value })}
                  placeholder="默认详情"
                  placeholderStyle={`color:${colors.textMuted}`}
                />
              </View>
              <View className="flex flex-row items-center">
                <View
                  className="w-16 rounded-xl px-3 py-2 mr-2"
                  style={{ backgroundColor: colors.bg }}
                >
                  <Input
                    className="w-full bg-transparent px-0 text-center"
                    style={{ color: colors.text }}
                    value={task.icon}
                    onInput={(e) => updateTask(idx, { icon: e.detail.value })}
                  />
                </View>
                <View
                  className="flex-1 rounded-xl px-3 py-2 mr-2"
                  style={{ backgroundColor: colors.bg }}
                >
                  <Input
                    className="w-full bg-transparent px-0"
                    style={{ color: colors.text }}
                    value={task.color}
                    onInput={(e) => updateTask(idx, { color: e.detail.value })}
                    placeholder="颜色 #HEX"
                    placeholderStyle={`color:${colors.textMuted}`}
                  />
                </View>
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
              style={{ color: colors.bg }}
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
              style={{ color: colors.bg }}
            >
              {submitting ? '生成中…' : '生成计划'}
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
