import { useState, useMemo } from 'react';
import { View, Text, Image, Picker, ScrollView } from '@tarojs/components';
import { Input } from '@/components/ui/input';
import Taro, { useLoad } from '@tarojs/taro';
import { useTheme } from '@/utils/theme';
import { useGlobalStore } from '@/stores/global';
import { callCloud, showError, showSuccess } from '@/utils/cloud';
import { getTodayISO, addISODays, eachISODay, getCalendarDays, formatMonthCN } from '@/utils/date';
import { buildSchedule, suggestRestDates } from '@/utils/scheduler';
import { avatarOptions } from '@/config/theme';
import type {
  ThemeType, TaskTemplate, TaskSchedule, TaskPace, Plan, UserProgress, ChildProfile, DayType,
} from '@/types';

const dayTypeLabels: Record<DayType, string> = { learn: '学习', rest: '敞耍', trip: '出游' };
const weekdayLabels = ['日', '一', '二', '三', '四', '五', '六'];

const paceOptions: Array<{ kind: TaskPace; label: string; hint: string }> = [
  { kind: 'daily', label: '每天必做', hint: '每个学习日都要做（如口算、朗读）' },
  { kind: 'interval', label: '每N天一次', hint: '如每 3 天一课练习册' },
  { kind: 'cycle', label: '做N休M', hint: '如 RAZ 读 2 天休 1 天' },
  { kind: 'quota', label: '按总量平均', hint: '填总量，系统自动摊到每个学习日（如 30 篇阅读理解）' },
  { kind: 'flex', label: '弹性备忘', hint: '不进每日打卡，只在家长页立目标、手动记完成' },
];

const examples = [
  { icon: '✍️', title: '字帖练写 60 页', desc: '选「按总量平均」，总量填 60、单位填「页」，系统摊到每个学习日，孩子每天写几页清清楚楚' },
  { icon: '🔢', title: '口算每天 12 道', desc: '选「每天必做」，每个学习日都出现' },
  { icon: '📚', title: 'RAZ 阅读读 2 休 1', desc: '选「做 N 休 M」，填做 2 休 1，按学习日自动循环' },
  { icon: '📝', title: '作文 3 篇（自行安排）', desc: '选「弹性备忘」，不进每日打卡，家长页有目标卡，写完一篇记一篇' },
];

const mkSchedule = (kind: TaskPace): TaskSchedule => ({
  kind, totalAmount: kind === 'quota' ? 30 : null, unit: kind === 'quota' ? '页' : '',
  intervalN: 3, cycleOn: 2, cycleOff: 1,
});

const defaultTasks: TaskTemplate[] = [
  {
    id: 'task_1', name: '语文·阅读', detail: '完成当天阅读页数', icon: '📖', color: '#4A90E2', isOral: false,
    schedule: { ...mkSchedule('quota'), totalAmount: 150 },
  },
  {
    id: 'task_2', name: '数学·口算', detail: '每天 12 道（全对）', icon: '🔢', color: '#F5A623', isOral: true,
    schedule: mkSchedule('daily'),
  },
  {
    id: 'task_3', name: '英语·听力', detail: '听读 15 分钟', icon: '🎧', color: '#7ED321', isOral: false,
    schedule: mkSchedule('daily'),
  },
];

const themeAccent: Record<ThemeType, string> = { prince: '#A3E635', princess: '#F472B6' };

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
  const [restCount, setRestCount] = useState('8');
  const [bufferDays, setBufferDays] = useState('3');
  const [dayTypes, setDayTypes] = useState<Record<string, DayType>>({});
  const [tasks, setTasks] = useState<TaskTemplate[]>(defaultTasks);
  const [showExamples, setShowExamples] = useState(false);
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

  const totalDays = useMemo(
    () => (endDate >= startDate ? eachISODay(startDate, endDate).length : 0),
    [startDate, endDate],
  );
  const restSuggestLow = Math.max(3, Math.round(totalDays * 0.1));
  const restSuggestHigh = Math.min(15, Math.max(restSuggestLow + 2, Math.round(totalDays * 0.18)));

  /** step1 完成时用敞耍日总数生成建议分布（出游日此时还没有） */
  const initCalendar = () => {
    const rests = suggestRestDates(startDate, endDate, [], Number(restCount) || 0);
    const next: Record<string, DayType> = {};
    for (const d of eachISODay(startDate, endDate)) next[d] = 'learn';
    for (const d of rests) next[d] = 'rest';
    setDayTypes(next);
  };

  const cycleType = (date: string) => {
    const order: DayType[] = ['learn', 'rest', 'trip'];
    setDayTypes((prev) => {
      const cur = prev[date] || 'learn';
      const nextType = order[(order.indexOf(cur) + 1) % order.length];
      // 敞耍/出游总数变了不用同步回输入框，输入框只是“生成器”
      return { ...prev, [date]: nextType };
    });
  };

  const restDates = useMemo(
    () => Object.keys(dayTypes).filter((d) => dayTypes[d] === 'rest'),
    [dayTypes],
  );
  const tripDates = useMemo(
    () => Object.keys(dayTypes).filter((d) => dayTypes[d] === 'trip'),
    [dayTypes],
  );

  const schedule = useMemo(
    () =>
      endDate >= startDate && Object.keys(dayTypes).length > 0
        ? buildSchedule({
            startDate,
            endDate,
            finishBufferDays: Number(bufferDays) || 0,
            restDates,
            tripDates,
            tasks,
          })
        : null,
    [startDate, endDate, bufferDays, restDates, tripDates, tasks],
  );

  const updateTask = (idx: number, patch: Partial<TaskTemplate>) => {
    setTasks((prev) => prev.map((t, i) => (i === idx ? { ...t, ...patch } : t)));
  };

  const updateSchedule = (idx: number, patch: Partial<TaskSchedule>) => {
    setTasks((prev) =>
      prev.map((t, i) => (i === idx ? { ...t, schedule: { ...(t.schedule || mkSchedule('daily')), ...patch } } : t)),
    );
  };

  const addTask = () => {
    const id = `task_${Date.now()}`;
    setTasks((prev) => [
      ...prev,
      {
        id, name: '', detail: '', icon: '✏️', color: '#9B59B6', isOral: false,
        schedule: mkSchedule('daily'),
      },
    ]);
  };

  const removeTask = (idx: number) => {
    setTasks((prev) => prev.filter((_, i) => i !== idx));
  };

  const validateStep = (s: number): string | null => {
    if (s === 1) {
      if (endDate < startDate) return '结束日期不能早于开始日期';
      if (totalDays < 7) return '假期至少 7 天';
    }
    if (s === 3) {
      if (tasks.length === 0) return '请至少添加一个任务';
      if (tasks.some((t) => !t.name.trim())) return '请给每个任务填写名称';
      if (!tasks.some((t) => (t.schedule?.kind || 'daily') !== 'flex')) {
        return '至少保留一个「每天/每N天/做N休M/按总量」类型的任务（弹性备忘不进每日打卡）';
      }
    }
    return null;
  };

  const handleNext = () => {
    const err = validateStep(step);
    if (err) {
      showError(new Error(err));
      return;
    }
    if (step === 1) initCalendar();
    setStep(step + 1);
  };

  const generatePlanPayload = () => {
    if (!schedule) throw new Error('排程未生成');
    const month = Number(startDate.slice(5, 7));
    const season = month === 1 || month === 2 ? '寒假' : month >= 7 && month <= 8 ? '暑假' : '假期';

    return {
      childId: profile?._id || '',
      name: `${season}作战计划`,
      startDate,
      endDate,
      tasks,
      dayTypes: schedule.dayTypes,
      weekTemplates: {},
      dailyTasks: schedule.dailyTasks,
      taskPlanCounts: schedule.taskPlanCounts,
      difficulty: 0.8,
    };
  };

  const handleCreate = async () => {
    let currentProfile = profile;
    if (!currentProfile) {
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

  /** 日历网格（step2 编辑 / step4 预览共用） */
  const renderCalendar = (readOnly: boolean) => {
    if (!schedule) return null;
    const months: Array<{ key: string; year: number; month: number }> = [];
    const seen = new Set<string>();
    for (const d of eachISODay(startDate, endDate)) {
      const key = d.slice(0, 7);
      if (!seen.has(key)) {
        seen.add(key);
        months.push({ key, year: Number(d.slice(0, 4)), month: Number(d.slice(5, 7)) });
      }
    }

    return months.map((m) => {
      const days = getCalendarDays(m.year, m.month).filter((d) => d >= startDate && d <= endDate);
      const firstWeekday = new Date(`${days[0]}T00:00:00`).getDay();
      return (
        <View key={m.key} className="mb-4">
          <Text className="text-sm font-bold mb-2" style={{ color: colors.textMuted }}>
            {formatMonthCN(m.year, m.month)}
          </Text>
          <View className="flex flex-row mb-1">
            {weekdayLabels.map((w, i) => (
              <View key={i} className="flex-1 text-center">
                <Text className="text-xs" style={{ color: colors.textMuted }}>{w}</Text>
              </View>
            ))}
          </View>
          <View className="flex flex-row flex-wrap">
            {Array.from({ length: firstWeekday }).map((_, i) => (
              <View key={`pad${i}`} className="w-[14.28%] p-1" />
            ))}
            {days.map((d) => {
              const type = schedule.dayTypes[d] || 'learn';
              const count = (schedule.dailyTasks[d] || []).length;
              const isCutoff = readOnly && schedule.learnDates.length > 0 &&
                type === 'learn' && d > schedule.learnDates[schedule.learnDates.length - 1];
              const bg = type === 'trip' ? 'rgba(56,189,248,0.25)' : type === 'rest' ? 'rgba(255,255,255,0.10)' : 'rgba(163,230,53,0.12)';
              const bd = type === 'trip' ? '#38BDF8' : type === 'rest' ? colors.border : themeAccent[theme];
              return (
                <View key={d} className="w-[14.28%] p-1">
                  <View
                    className="rounded-lg py-1 flex flex-col items-center active:scale-95"
                    style={{ backgroundColor: isCutoff ? 'transparent' : bg, borderWidth: '2rpx', borderColor: isCutoff ? colors.border : bd, opacity: isCutoff ? 0.45 : 1 }}
                    onClick={readOnly ? undefined : () => cycleType(d)}
                  >
                    <Text className="text-xs font-bold" style={{ color: colors.text }}>
                      {Number(d.slice(8, 10))}
                    </Text>
                    <Text className="text-[9px]" style={{ color: colors.textMuted }}>
                      {isCutoff ? '机动' : type === 'trip' ? '出游' : type === 'rest' ? '敞耍' : readOnly ? `${count}项` : '学习'}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      );
    });
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
              className="flex-1 mr-2 rounded-3xl p-6 flex flex-col items-center active:scale-95 transition-transform"
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
              className="flex-1 ml-2 rounded-3xl p-6 flex flex-col items-center active:scale-95 transition-transform"
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
          <Text className="text-2xl font-bold mb-2 text-center" style={{ color: colors.text }}>
            设定假期
          </Text>
          <Text className="text-xs text-center mb-6" style={{ color: colors.textMuted }}>
            系统会根据假期长短和下面的设置，自动生成每天的打卡任务
          </Text>
          <View className="mb-4">
            <Text className="text-sm mb-2" style={{ color: colors.textMuted }}>
              假期开始
            </Text>
            <Picker mode="date" value={startDate} onChange={(e) => setStartDate(e.detail.value)}>
              <View
                className="rounded-2xl px-4 py-3"
                style={{ backgroundColor: colors.card, borderWidth: '2rpx', borderColor: colors.border }}
              >
                <Text style={{ color: colors.text }}>{startDate}</Text>
              </View>
            </Picker>
          </View>
          <View className="mb-4">
            <Text className="text-sm mb-2" style={{ color: colors.textMuted }}>
              假期结束
            </Text>
            <Picker mode="date" value={endDate} onChange={(e) => setEndDate(e.detail.value)}>
              <View
                className="rounded-2xl px-4 py-3"
                style={{ backgroundColor: colors.card, borderWidth: '2rpx', borderColor: colors.border }}
              >
                <Text style={{ color: colors.text }}>{endDate}</Text>
              </View>
            </Picker>
          </View>
          <View
            className="rounded-2xl p-4 mb-4"
            style={{ backgroundColor: colors.card, borderWidth: '2rpx', borderColor: colors.border }}
          >
            <View className="flex flex-row items-center justify-between mb-2">
              <Text className="text-sm font-bold" style={{ color: colors.text }}>
                敞耍日总数
              </Text>
              <View
                className="rounded-xl px-3 w-20"
                style={{ backgroundColor: colors.bg, borderWidth: '2rpx', borderColor: colors.border }}
              >
                <Input
                  className="w-full bg-transparent px-0 text-center"
                  style={{ color: colors.text }}
                  value={restCount}
                  type="number"
                  onInput={(e) => setRestCount(e.detail.value)}
                />
              </View>
            </View>
            <Text className="text-xs" style={{ color: colors.textMuted }}>
              共 {totalDays} 天假期，建议 {restSuggestLow}-{restSuggestHigh} 天。敞耍日 = 完全不写作业的自由玩耍日，具体哪天放在下一步调整
            </Text>
          </View>
          <View
            className="rounded-2xl p-4"
            style={{ backgroundColor: colors.card, borderWidth: '2rpx', borderColor: colors.border }}
          >
            <View className="flex flex-row items-center justify-between mb-2">
              <Text className="text-sm font-bold" style={{ color: colors.text }}>
                提前完成天数
              </Text>
              <View
                className="rounded-xl px-3 w-20"
                style={{ backgroundColor: colors.bg, borderWidth: '2rpx', borderColor: colors.border }}
              >
                <Input
                  className="w-full bg-transparent px-0 text-center"
                  style={{ color: colors.text }}
                  value={bufferDays}
                  type="number"
                  onInput={(e) => setBufferDays(e.detail.value)}
                />
              </View>
            </View>
            <Text className="text-xs" style={{ color: colors.textMuted }}>
              任务会在假期结束前第 N 天摊派完，最后几天留作机动（补漏、复习、应对突发），建议 2-5 天
            </Text>
          </View>
        </View>
      );
    }

    if (step === 2) {
      const learn = Object.values(dayTypes).filter((t) => t === 'learn').length;
      return (
        <View>
          <Text className="text-2xl font-bold mb-2 text-center" style={{ color: colors.text }}>
            安排日历
          </Text>
          <Text className="text-xs text-center mb-3" style={{ color: colors.textMuted }}>
            点击日期可切换：学习 → 敞耍 → 出游
          </Text>
          <View className="flex flex-row justify-center mb-3">
            {(['learn', 'rest', 'trip'] as DayType[]).map((t) => (
              <View key={t} className="flex flex-row items-center mx-3">
                <View
                  className="w-3 h-3 rounded-full mr-1"
                  style={{
                    backgroundColor: t === 'trip' ? '#38BDF8' : t === 'rest' ? 'rgba(255,255,255,0.35)' : themeAccent[theme],
                  }}
                />
                <Text className="text-xs" style={{ color: colors.textMuted }}>
                  {dayTypeLabels[t]}
                </Text>
              </View>
            ))}
          </View>
          <View className="flex flex-row justify-center mb-4">
            <Text className="text-xs mr-4" style={{ color: colors.text }}>
              共 {Object.keys(dayTypes).length} 天 · 学习 {learn} 天 · 敞耍 {restDates.length} 天 · 出游 {tripDates.length} 天
            </Text>
          </View>
          {renderCalendar(false)}
        </View>
      );
    }

    if (step === 3) {
      return (
        <View>
          <Text className="text-2xl font-bold mb-2 text-center" style={{ color: colors.text }}>
            作业任务清单
          </Text>
          <Text className="text-xs text-center mb-4" style={{ color: colors.textMuted }}>
            按科目逐项添加，每行一个任务；「详情」是孩子每天看到的任务说明
          </Text>

          <View
            className="rounded-2xl p-3 mb-4 active:scale-95 transition-transform"
            style={{ backgroundColor: colors.glass || colors.card, borderWidth: '2rpx', borderColor: colors.border }}
            onClick={() => setShowExamples(!showExamples)}
          >
            <Text className="text-sm font-bold text-center" style={{ color: colors.accent }}>
              {showExamples ? '收起示例 ▲' : '不知道怎么填？看看 4 个典型示例 ▼'}
            </Text>
          </View>
          {showExamples ? (
            <View className="mb-4">
              {examples.map((ex) => (
                <View
                  key={ex.title}
                  className="rounded-2xl p-3 mb-2"
                  style={{ backgroundColor: colors.card, borderWidth: '2rpx', borderColor: colors.border }}
                >
                  <Text className="text-sm font-bold" style={{ color: colors.text }}>
                    {ex.icon} {ex.title}
                  </Text>
                  <Text className="text-xs mt-1 leading-5" style={{ color: colors.textMuted }}>
                    {ex.desc}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {tasks.map((task, idx) => {
            const sch = task.schedule || mkSchedule('daily');
            return (
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
                      placeholder="任务名称（如 语文·阅读理解）"
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
                    placeholder="任务详情（孩子每天看到的说明）"
                    placeholderStyle={`color:${colors.textMuted}`}
                  />
                </View>

                <View className="flex flex-row flex-wrap mb-2">
                  {paceOptions.map((p) => (
                    <View
                      key={p.kind}
                      className="px-3 py-1 rounded-full mr-2 mb-2 active:scale-95"
                      style={{
                        backgroundColor: sch.kind === p.kind ? colors.primary : colors.bg,
                        borderWidth: '2rpx',
                        borderColor: sch.kind === p.kind ? colors.primary : colors.border,
                      }}
                      onClick={() => updateSchedule(idx, { kind: p.kind })}
                    >
                      <Text
                        className="text-xs font-bold"
                        style={{ color: sch.kind === p.kind ? colors.bg : colors.textMuted }}
                      >
                        {p.label}
                      </Text>
                    </View>
                  ))}
                </View>
                <Text className="text-xs mb-2" style={{ color: colors.textMuted }}>
                  {paceOptions.find((p) => p.kind === sch.kind)?.hint}
                </Text>

                {sch.kind === 'interval' ? (
                  <View className="flex flex-row items-center mb-2">
                    <Text className="text-sm mr-2" style={{ color: colors.text }}>每</Text>
                    <View
                      className="rounded-xl px-3 w-16"
                      style={{ backgroundColor: colors.bg, borderWidth: '2rpx', borderColor: colors.border }}
                    >
                      <Input
                        className="w-full bg-transparent px-0 text-center"
                        style={{ color: colors.text }}
                        value={String(sch.intervalN)}
                        type="number"
                        onInput={(e) => updateSchedule(idx, { intervalN: Number(e.detail.value) || 1 })}
                      />
                    </View>
                    <Text className="text-sm ml-2" style={{ color: colors.text }}>个学习日一次</Text>
                  </View>
                ) : null}

                {sch.kind === 'cycle' ? (
                  <View className="flex flex-row items-center mb-2">
                    <Text className="text-sm mr-2" style={{ color: colors.text }}>做</Text>
                    <View
                      className="rounded-xl px-3 w-14"
                      style={{ backgroundColor: colors.bg, borderWidth: '2rpx', borderColor: colors.border }}
                    >
                      <Input
                        className="w-full bg-transparent px-0 text-center"
                        style={{ color: colors.text }}
                        value={String(sch.cycleOn)}
                        type="number"
                        onInput={(e) => updateSchedule(idx, { cycleOn: Number(e.detail.value) || 1 })}
                      />
                    </View>
                    <Text className="text-sm mx-2" style={{ color: colors.text }}>休</Text>
                    <View
                      className="rounded-xl px-3 w-14"
                      style={{ backgroundColor: colors.bg, borderWidth: '2rpx', borderColor: colors.border }}
                    >
                      <Input
                        className="w-full bg-transparent px-0 text-center"
                        style={{ color: colors.text }}
                        value={String(sch.cycleOff)}
                        type="number"
                        onInput={(e) => updateSchedule(idx, { cycleOff: Number(e.detail.value) || 0 })}
                      />
                    </View>
                    <Text className="text-sm ml-2" style={{ color: colors.text }}>个学习日</Text>
                  </View>
                ) : null}

                {sch.kind === 'quota' ? (
                  <View className="flex flex-row items-center mb-2">
                    <Text className="text-sm mr-2" style={{ color: colors.text }}>总量</Text>
                    <View
                      className="rounded-xl px-3 w-20"
                      style={{ backgroundColor: colors.bg, borderWidth: '2rpx', borderColor: colors.border }}
                    >
                      <Input
                        className="w-full bg-transparent px-0 text-center"
                        style={{ color: colors.text }}
                        value={sch.totalAmount === null ? '' : String(sch.totalAmount)}
                        type="number"
                        onInput={(e) => updateSchedule(idx, { totalAmount: Number(e.detail.value) || null })}
                      />
                    </View>
                    <View
                      className="rounded-xl px-3 w-20 ml-2"
                      style={{ backgroundColor: colors.bg, borderWidth: '2rpx', borderColor: colors.border }}
                    >
                      <Input
                        className="w-full bg-transparent px-0 text-center"
                        style={{ color: colors.text }}
                        value={sch.unit}
                        onInput={(e) => updateSchedule(idx, { unit: e.detail.value })}
                        placeholder="单位"
                        placeholderStyle={`color:${colors.textMuted}`}
                      />
                    </View>
                    <Text className="text-xs ml-2 flex-1" style={{ color: colors.textMuted }}>
                      {schedule && schedule.learnDates.length > 0 && sch.totalAmount
                        ? `约 ${Math.ceil(sch.totalAmount / schedule.learnDates.length)} ${sch.unit || '份'}/天`
                        : ''}
                    </Text>
                  </View>
                ) : null}

                <View
                  className="rounded-xl px-3 py-2"
                  style={{ backgroundColor: colors.bg }}
                >
                  <Input
                    className="w-full bg-transparent px-0"
                    style={{ color: colors.text }}
                    value={task.note || ''}
                    onInput={(e) => updateTask(idx, { note: e.detail.value })}
                    placeholder="备注：特殊要求（仅家长可见，如 按章节分配、讲义+练习）"
                    placeholderStyle={`color:${colors.textMuted}`}
                  />
                </View>

                <View className="flex flex-row items-center mt-2">
                  <View
                    className="w-12 rounded-xl px-2 py-2 mr-2"
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
            );
          })}

          <View
            className="rounded-full py-3 px-6 flex items-center justify-center active:scale-95 transition-transform"
            style={{ backgroundColor: colors.accent }}
            onClick={addTask}
          >
            <Text className="font-bold" style={{ color: '#FFFFFF' }}>
              + 添加任务
            </Text>
          </View>
        </View>
      );
    }

    // step 4：预览确认
    const learn = Object.values(schedule?.dayTypes || {}).filter((t) => t === 'learn').length;
    return (
      <View>
        <Text className="text-2xl font-bold mb-2 text-center" style={{ color: colors.text }}>
          预览作战计划
        </Text>
        <Text className="text-xs text-center mb-4" style={{ color: colors.textMuted }}>
          {theme === 'prince' ? '王子主题' : '公主主题'} · {name} · {startDate} 至 {endDate}
        </Text>
        <View
          className="rounded-2xl p-4 mb-4"
          style={{ backgroundColor: colors.card, borderWidth: '2rpx', borderColor: colors.border }}
        >
          <Text className="text-sm" style={{ color: colors.text }}>
            学习 {schedule?.learnDates.length ?? 0} 天（另有 {Math.max(0, learn - (schedule?.learnDates.length ?? 0))} 天机动）· 敞耍 {restDates.length} 天 · 出游 {tripDates.length} 天
          </Text>
          <Text className="text-xs mt-1" style={{ color: colors.textMuted }}>
            任务出勤：{tasks.map((t) => `${t.name} ${schedule?.taskPlanCounts[t.id] ?? 0} 次`).join(' · ')}
          </Text>
        </View>
        <Text className="text-xs mb-2" style={{ color: colors.textMuted }}>
          每天的任务数已标在日历上，确认后生成
        </Text>
        {renderCalendar(true)}
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
            onClick={handleNext}
          >
            <Text className="font-bold" style={{ color: colors.bg }}>
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
            <Text className="font-bold" style={{ color: colors.bg }}>
              {submitting ? '生成中…' : '确认生成计划'}
            </Text>
          </View>
        )}
      </View>
      <View className="h-8" />
    </ScrollView>
  );
}
