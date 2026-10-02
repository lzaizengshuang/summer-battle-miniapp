import { useState } from 'react';
import { View, Text, Image, Picker, ScrollView } from '@tarojs/components';
import { Textarea } from '@/components/ui/textarea';
import Taro, { useLoad } from '@tarojs/taro';
import { useTheme } from '@/utils/theme';
import { useGlobalStore } from '@/stores/global';
import { callCloud, showError, showSuccess } from '@/utils/cloud';
import { TaskCard } from '@/components/TaskCard';
import { clampDate, getTodayISO } from '@/utils/date';
import { avatarOptions } from '@/config/theme';
import type {
  ChildProfile,
  Plan,
  UserProgress,
  DaySchedule,
  DayRecord,
} from '@/types';

const tabs = [
  { id: 'profile', name: '档案' },
  { id: 'stats', name: '统计' },
  { id: 'makeup', name: '补卡' },
  { id: 'backup', name: '备份' },
  { id: 'plan', name: '计划' },
];

export default function ParentPage() {
  const { colors } = useTheme();
  const profile = useGlobalStore((s) => s.profile);
  const plan = useGlobalStore((s) => s.plan);
  const progress = useGlobalStore((s) => s.progress);
  const setProfile = useGlobalStore((s) => s.setProfile);
  const setPlan = useGlobalStore((s) => s.setPlan);
  const setProgress = useGlobalStore((s) => s.setProgress);
  const setTheme = useGlobalStore((s) => s.setTheme);

  const [activeTab, setActiveTab] = useState('profile');
  const [profiles, setProfiles] = useState<ChildProfile[]>([]);
  const [records, setRecords] = useState<DayRecord[]>([]);
  const [makeupDate, setMakeupDate] = useState<string>(getTodayISO());
  const [makeupSchedule, setMakeupSchedule] = useState<DaySchedule | null>(null);
  const [backupJson, setBackupJson] = useState('');
  const [restoreJson, setRestoreJson] = useState('');
  const [restoreMode, setRestoreMode] = useState<'merge' | 'overwrite'>('merge');

  useLoad(() => {
    if (!profile || !plan) {
      Taro.redirectTo({ url: '/pages/onboarding/index' });
      return;
    }
    loadProfiles();
    loadRecords();
  });

  const loadProfiles = async () => {
    try {
      const data = await callCloud<{ profiles: ChildProfile[] }>('listChildProfiles', {});
      setProfiles(data.profiles);
    } catch (err) {
      showError(err);
    }
  };

  const loadRecords = async () => {
    if (!profile || !plan) return;
    try {
      // 拉取整个计划期的记录（跨月逐月查询后合并）
      const months: Array<{ year: number; month: number }> = [];
      const seen = new Set<string>();
      const start = new Date(`${plan.startDate}T00:00:00`);
      const end = new Date(`${plan.endDate}T00:00:00`);
      const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
      while (cursor <= end) {
        const key = `${cursor.getFullYear()}-${cursor.getMonth()}`;
        if (!seen.has(key)) {
          seen.add(key);
          months.push({ year: cursor.getFullYear(), month: cursor.getMonth() + 1 });
        }
        cursor.setMonth(cursor.getMonth() + 1);
      }
      const all: DayRecord[] = [];
      for (const m of months) {
        const data = await callCloud<{ records: DayRecord[] }>('getRecords', {
          childId: profile._id,
          planId: plan._id,
          year: m.year,
          month: m.month,
        });
        all.push(...data.records);
      }
      setRecords(all);
    } catch (err) {
      showError(err);
    }
  };

  const handleBumpFlex = async (taskId: string, delta: number) => {
    if (!profile || !plan) return;
    try {
      const data = await callCloud<{ progress: UserProgress }>('bumpFlexCount', {
        childId: profile._id,
        planId: plan._id,
        taskId,
        delta,
      });
      setProgress(data.progress);
    } catch (err) {
      showError(err);
    }
  };

  const handleSwitchProfile = async (childId: string) => {
    try {
      const data = await callCloud<{ profile: ChildProfile }>('switchDefaultChildProfile', {
        childId,
      });
      setProfile(data.profile);
      setTheme(data.profile.theme);
      // reload plan for the new profile
      const planData = await callCloud<{ plan: Plan | null; progress: UserProgress | null }>(
        'getCurrentPlan',
        { childId: data.profile._id },
      );
      setPlan(planData.plan);
      setProgress(planData.progress);
      showSuccess('已切换档案');
    } catch (err) {
      showError(err);
    }
  };

  const handleCreateProfile = async () => {
    try {
      const data = await callCloud<{ profile: ChildProfile }>('createChildProfile', {
        name: '新孩子',
        theme: 'prince',
      });
      setProfiles((prev) => [...prev, data.profile]);
      showSuccess('创建成功');
    } catch (err) {
      showError(err);
    }
  };

  const loadMakeup = async () => {
    if (!profile || !plan) return;
    try {
      const data = await callCloud<DaySchedule>('getDaySchedule', {
        childId: profile._id,
        planId: plan._id,
        date: makeupDate,
      });
      setMakeupSchedule(data);
    } catch (err) {
      showError(err);
    }
  };

  const toggleMakeupTask = async (taskId: string, completed: boolean) => {
    if (!profile || !plan) return;
    try {
      const { record, progress: updated } = await callCloud<{
        record: DayRecord;
        progress: UserProgress;
      }>('toggleTask', {
        childId: profile._id,
        planId: plan._id,
        date: makeupDate,
        taskId,
        completed,
      });
      setProgress(updated);
      setMakeupSchedule((prev) =>
        prev
          ? {
              ...prev,
              record,
              tasks: prev.tasks.map((t) =>
                t.id === taskId
                  ? { ...t, record: { ...(t.record || { taskId: t.id, completed: false }), completed } }
                  : t,
              ),
            }
          : prev,
      );
    } catch (err) {
      showError(err);
    }
  };

  const handleMakeupReport = async () => {
    if (!profile || !plan) return;
    try {
      const { record, progress: updated } = await callCloud<{
        record: DayRecord;
        progress: UserProgress;
      }>('reportDay', {
        childId: profile._id,
        planId: plan._id,
        date: makeupDate,
      });
      setProgress(updated);
      setMakeupSchedule((prev) => (prev ? { ...prev, record, progress: updated } : prev));
      showSuccess('补卡成功');
    } catch (err) {
      showError(err);
    }
  };

  const handleBackup = async () => {
    if (!profile) return;
    try {
      const data = await callCloud<{ json: string }>('backupData', { childId: profile._id });
      setBackupJson(data.json);
      Taro.setClipboardData({ data: data.json });
    } catch (err) {
      showError(err);
    }
  };

  const handleRestore = async () => {
    if (!profile || !restoreJson) return;
    try {
      const data = await callCloud<{ success: boolean; plan: Plan; progress: UserProgress }>(
        'restoreData',
        { childId: profile._id, json: restoreJson, mode: restoreMode },
      );
      setPlan(data.plan);
      setProgress(data.progress);
      showSuccess('恢复成功');
    } catch (err) {
      showError(err);
    }
  };

  const handleReset = async () => {
    if (!plan) return;
    const res = await Taro.showModal({
      title: '确认重置',
      content: '将清空当前档案的打卡记录和进度，任务模板可选择保留。',
      confirmColor: colors.danger,
    });
    if (!res.confirm) return;
    try {
      await callCloud('deletePlan', { planId: plan._id });
      setPlan(null);
      setProgress(null);
      Taro.redirectTo({ url: '/pages/onboarding/index' });
    } catch (err) {
      showError(err);
    }
  };

  const [showAvatarPicker, setShowAvatarPicker] = useState(false);

  const handleAvatarChange = async (avatarUrl: string) => {
    if (!profile) return;
    try {
      const data = await callCloud<{ profile: ChildProfile }>('updateChildProfile', {
        childId: profile._id,
        avatarUrl,
      });
      setProfile(data.profile);
      setShowAvatarPicker(false);
      showSuccess('头像已更新');
    } catch (err) {
      showError(err);
    }
  };

  const renderProfile = () => (
    <View>
      <Text className="text-lg font-bold mb-3" style={{ color: colors.text }}>
        当前档案
      </Text>
      <View
        className="rounded-3xl p-4 mb-4"
        style={{ backgroundColor: colors.card, borderWidth: '2rpx', borderColor: colors.border }}
      >
        <View
          className="flex flex-row items-center mb-3 active:scale-95 transition-transform"
          onClick={() => setShowAvatarPicker(!showAvatarPicker)}
        >
          {profile?.avatarUrl ? (
            <Image
              src={profile.avatarUrl}
              mode="aspectFill"
              className="mr-3"
              style={{ width: '96rpx', height: '96rpx', borderRadius: '24rpx' }}
            />
          ) : null}
          <View>
            <Text style={{ color: colors.text }}>昵称：{profile?.name}</Text>
            <Text style={{ color: colors.textMuted }}>主题：{profile?.theme === 'prince' ? '王子' : '公主'}</Text>
          </View>
        </View>
        <View
          className="rounded-full py-2 flex items-center justify-center active:scale-95"
          style={{ backgroundColor: colors.accent }}
          onClick={() => setShowAvatarPicker(!showAvatarPicker)}
        >
          <Text className="text-sm font-bold" style={{ color: colors.text }}>
            {showAvatarPicker ? '收起头像选择' : '更换头像'}
          </Text>
        </View>
        {showAvatarPicker ? (
          <View className="flex flex-row flex-wrap mt-3">
            {avatarOptions[colors.theme].map((option) => (
              <View key={option} className="w-1/3 p-1" onClick={() => handleAvatarChange(option)}>
                <View
                  className="rounded-2xl p-1"
                  style={{
                    borderWidth: profile?.avatarUrl === option ? '4rpx' : '2rpx',
                    borderColor: profile?.avatarUrl === option ? colors.primary : colors.border,
                  }}
                >
                  <Image
                    src={option}
                    mode="aspectFill"
                    style={{ width: '100%', height: '120rpx', borderRadius: '16rpx' }}
                  />
                </View>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      <Text className="text-lg font-bold mb-3" style={{ color: colors.text }}>
        所有档案
      </Text>
      {profiles.map((p) => (
        <View
          key={p._id}
          className="rounded-2xl p-3 mb-2 flex flex-row items-center justify-between"
          style={{ backgroundColor: colors.card }}
        >
          <Text style={{ color: colors.text }}>
            {p.name} {p.isDefault ? '（默认）' : ''}
          </Text>
          {!p.isDefault ? (
            <View
              className="px-3 py-1 rounded-xl active:scale-95"
              style={{ backgroundColor: colors.primary }}
              onClick={() => handleSwitchProfile(p._id)}
            >
              <Text style={{ color: colors.bg }}>切换</Text>
            </View>
          ) : null}
        </View>
      ))}
      <View
        className="rounded-full py-3 flex items-center justify-center active:scale-95 transition-transform mt-2"
        style={{ backgroundColor: colors.accent }}
        onClick={handleCreateProfile}
      >
        <Text style={{ color: colors.text }}>+ 新建档案</Text>
      </View>
    </View>
  );

  const renderStats = () => {
    const completedDays = records.filter((r) => r.isReported).length;
    const totalTasksCompleted = records.reduce(
      (sum, r) => sum + r.taskRecords.filter((t) => t.completed).length,
      0,
    );
    return (
      <View>
        <View className="flex flex-row mb-4">
          <View
            className="flex-1 mr-2 rounded-3xl p-4 flex flex-col items-center"
            style={{ backgroundColor: colors.card, borderWidth: '2rpx', borderColor: colors.border }}
          >
            <Text className="text-2xl font-bold" style={{ color: colors.gold }}>
              {completedDays}
            </Text>
            <Text className="text-xs" style={{ color: colors.textMuted }}>
              完成天数
            </Text>
          </View>
          <View
            className="flex-1 mx-2 rounded-3xl p-4 flex flex-col items-center"
            style={{ backgroundColor: colors.card, borderWidth: '2rpx', borderColor: colors.border }}
          >
            <Text className="text-2xl font-bold" style={{ color: colors.gold }}>
              {progress?.totalPoints || 0}
            </Text>
            <Text className="text-xs" style={{ color: colors.textMuted }}>
              总积分
            </Text>
          </View>
          <View
            className="flex-1 ml-2 rounded-3xl p-4 flex flex-col items-center"
            style={{ backgroundColor: colors.card, borderWidth: '2rpx', borderColor: colors.border }}
          >
            <Text className="text-2xl font-bold" style={{ color: colors.gold }}>
              {totalTasksCompleted}
            </Text>
            <Text className="text-xs" style={{ color: colors.textMuted }}>
              完成任务
            </Text>
          </View>
        </View>

        <Text className="text-lg font-bold mb-3" style={{ color: colors.text }}>
          任务总量进度
        </Text>
        {(plan?.tasks || []).map((task) => {
          const sch = task.schedule;
          if (!sch || sch.kind === 'flex') {
            // 弹性任务目标卡：不进每日打卡，手动累计
            const total = sch?.totalAmount || 0;
            const done = progress?.flexDone?.[task.id] || 0;
            const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
            return (
              <View
                key={task.id}
                className="rounded-2xl p-4 mb-3"
                style={{ backgroundColor: colors.card, borderWidth: '2rpx', borderColor: colors.border }}
              >
                <View className="flex flex-row items-center justify-between mb-2">
                  <Text className="text-sm font-bold" style={{ color: colors.text }}>
                    {task.icon} {task.name}（弹性备忘）
                  </Text>
                  <Text className="text-sm font-bold" style={{ color: colors.gold }}>
                    {done}/{total} {sch?.unit || ''}
                  </Text>
                </View>
                {task.note ? (
                  <Text className="text-xs mb-2" style={{ color: colors.textMuted }}>
                    备注：{task.note}
                  </Text>
                ) : null}
                <View className="flex flex-row items-center">
                  <View
                    className="flex-1 h-3 rounded-full mr-3 overflow-hidden"
                    style={{ backgroundColor: colors.glass || colors.border }}
                  >
                    <View
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: colors.gold }}
                    />
                  </View>
                  <View
                    className="w-9 h-9 rounded-full flex items-center justify-center active:scale-95"
                    style={{ backgroundColor: colors.border }}
                    onClick={() => handleBumpFlex(task.id, -1)}
                  >
                    <Text className="text-lg font-bold" style={{ color: colors.text }}>−</Text>
                  </View>
                  <View
                    className="w-9 h-9 rounded-full flex items-center justify-center ml-2 active:scale-95"
                    style={{ backgroundColor: colors.primary }}
                    onClick={() => handleBumpFlex(task.id, 1)}
                  >
                    <Text className="text-lg font-bold" style={{ color: colors.bg }}>＋</Text>
                  </View>
                </View>
              </View>
            );
          }
          const planned = plan?.taskPlanCounts?.[task.id];
          if (!planned) return null; // 旧计划没有排程数据，不显示
          const done = records.reduce(
            (sum, r) => sum + (r.taskRecords.find((t) => t.taskId === task.id)?.completed ? 1 : 0),
            0,
          );
          const pct = Math.min(100, Math.round((done / planned) * 100));
          return (
            <View
              key={task.id}
              className="rounded-2xl p-4 mb-3"
              style={{ backgroundColor: colors.card, borderWidth: '2rpx', borderColor: colors.border }}
            >
              <View className="flex flex-row items-center justify-between mb-2">
                <Text className="text-sm font-bold" style={{ color: colors.text }}>
                  {task.icon} {task.name}
                </Text>
                <Text className="text-sm font-bold" style={{ color: colors.gold }}>
                  {done}/{planned} 次
                </Text>
              </View>
              {task.note ? (
                <Text className="text-xs mb-2" style={{ color: colors.textMuted }}>
                  备注：{task.note}
                </Text>
              ) : null}
              <View className="h-3 rounded-full overflow-hidden" style={{ backgroundColor: colors.glass || colors.border }}>
                <View className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: colors.primary }} />
              </View>
            </View>
          );
        })}

        <Text className="text-lg font-bold mb-3 mt-4" style={{ color: colors.text }}>
          最近打卡
        </Text>
        {records.slice(-14).map((r) => (
          <View
            key={r._id}
            className="rounded-2xl p-3 mb-2 flex flex-row items-center justify-between"
            style={{ backgroundColor: colors.card }}
          >
            <Text style={{ color: colors.text }}>{r.date}</Text>
            <Text style={{ color: r.isReported ? colors.success : colors.textMuted }}>
              {r.isReported ? `+${r.totalPoints}` : '未汇报'}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  const renderMakeup = () => {
    const allDone =
      makeupSchedule &&
      makeupSchedule.tasks.length > 0 &&
      makeupSchedule.tasks.every((t) => t.record?.completed);
    return (
      <View>
        <View className="mb-4">
          <Text className="text-sm mb-2" style={{ color: colors.textMuted }}>
            选择补卡日期
          </Text>
          <Picker
            mode="date"
            value={makeupDate}
            onChange={(e) => {
              setMakeupDate(clampDate(e.detail.value, plan?.startDate, plan?.endDate));
              setMakeupSchedule(null);
            }}
          >
            <View
              className="rounded-2xl px-4 py-3"
              style={{ backgroundColor: colors.card }}
            >
              <Text style={{ color: colors.text }}>{makeupDate}</Text>
            </View>
          </Picker>
        </View>
        <View
          className="rounded-full py-3 flex items-center justify-center mb-4 active:scale-95 transition-transform"
          style={{ backgroundColor: colors.accent }}
          onClick={loadMakeup}
        >
          <Text style={{ color: colors.text }}>加载当日任务</Text>
        </View>

        {makeupSchedule?.dayType !== 'learn' ? (
          <Text className="text-center" style={{ color: colors.textMuted }}>
            所选日期为非学习日，无需补卡
          </Text>
        ) : (
          <>
            {makeupSchedule.tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onToggle={(completed) => toggleMakeupTask(task.id, completed)}
                disabled={makeupSchedule.record?.isReported}
              />
            ))}
            {allDone && !makeupSchedule.record?.isReported ? (
              <View
                className="rounded-full py-4 flex items-center justify-center active:scale-95 transition-transform"
                style={{ backgroundColor: colors.primary }}
                onClick={handleMakeupReport}
              >
                <Text
                  className="text-lg font-bold"
                  style={{ color: colors.bg }}
                >
                  确认补卡并发放积分
                </Text>
              </View>
            ) : makeupSchedule.record?.isReported ? (
              <Text className="text-center" style={{ color: colors.textMuted }}>
                该日期已汇报
              </Text>
            ) : null}
          </>
        )}
      </View>
    );
  };

  const renderBackup = () => (
    <View>
      <Text className="text-xs mb-3 leading-relaxed" style={{ color: colors.textMuted }}>
        数据绑定当前登录的微信，换微信登录前请先在旧微信上导出备份。
      </Text>
      <View
        className="rounded-full py-4 flex items-center justify-center mb-4 active:scale-95 transition-transform"
        style={{ backgroundColor: colors.primary }}
        onClick={handleBackup}
      >
        <Text
          className="text-lg font-bold"
          style={{ color: colors.bg }}
        >
          导出备份并复制
        </Text>
      </View>
      {backupJson ? (
        <View
          className="rounded-2xl p-3 mb-6"
          style={{ backgroundColor: colors.card, borderWidth: '2rpx', borderColor: colors.border, height: '240rpx' }}
        >
          <Textarea
            className="w-full h-full bg-transparent text-xs"
            style={{ color: colors.text }}
            value={backupJson}
            disabled
          />
        </View>
      ) : null}

      <Text className="text-lg font-bold mb-2" style={{ color: colors.text }}>
        导入备份
      </Text>
      <View
        className="rounded-2xl p-3 mb-3"
        style={{ backgroundColor: colors.card, borderWidth: '2rpx', borderColor: colors.border, height: '240rpx' }}
      >
        <Textarea
          className="w-full h-full bg-transparent text-xs"
          style={{ color: colors.text }}
          value={restoreJson}
          onInput={(e) => setRestoreJson(e.detail.value)}
          placeholder="粘贴备份 JSON"
          placeholderStyle={`color:${colors.textMuted}`}
        />
      </View>
      <Picker
        mode="selector"
        range={['合并', '覆盖']}
        value={restoreMode === 'merge' ? 0 : 1}
        onChange={(e) => setRestoreMode(e.detail.value === 0 ? 'merge' : 'overwrite')}
      >
        <View
          className="rounded-2xl px-4 py-3 mb-3"
          style={{ backgroundColor: colors.card }}
        >
          <Text style={{ color: colors.text }}>
            模式：{restoreMode === 'merge' ? '合并' : '覆盖'}
          </Text>
        </View>
      </Picker>
      <View
        className="rounded-full py-4 flex items-center justify-center active:scale-95 transition-transform"
        style={{ backgroundColor: colors.accent }}
        onClick={handleRestore}
      >
        <Text className="text-lg font-bold" style={{ color: colors.text }}>
          恢复数据
        </Text>
      </View>
    </View>
  );

  const renderPlan = () => (
    <View>
      <View
        className="rounded-3xl p-4 mb-4"
        style={{ backgroundColor: colors.card, borderWidth: '2rpx', borderColor: colors.border }}
      >
        <Text className="text-lg font-bold mb-2" style={{ color: colors.text }}>
          计划信息
        </Text>
        <Text style={{ color: colors.textMuted }}>名称：{plan?.name}</Text>
        <Text style={{ color: colors.textMuted }}>
          日期：{plan?.startDate} 至 {plan?.endDate}
        </Text>
        <Text style={{ color: colors.textMuted }}>任务模板数：{plan?.tasks.length}</Text>
      </View>

      <Text className="text-lg font-bold mb-3" style={{ color: colors.text }}>
        任务模板
      </Text>
      {plan?.tasks.map((t) => (
        <View
          key={t.id}
          className="rounded-2xl p-3 mb-2 flex flex-row items-center"
          style={{ backgroundColor: colors.card }}
        >
          <Text className="text-2xl mr-3">{t.icon}</Text>
          <View className="flex-1">
            <Text style={{ color: colors.text }}>{t.name}</Text>
            <Text className="text-xs" style={{ color: colors.textMuted }}>
              {t.detail}
            </Text>
          </View>
        </View>
      ))}

      <View
        className="rounded-full py-4 flex items-center justify-center mt-6 active:scale-95 transition-transform"
        style={{ backgroundColor: colors.danger }}
        onClick={handleReset}
      >
        <Text className="text-lg font-bold" style={{ color: '#FFFFFF' }}>
          重置当前计划
        </Text>
      </View>
    </View>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'profile':
        return renderProfile();
      case 'stats':
        return renderStats();
      case 'makeup':
        return renderMakeup();
      case 'backup':
        return renderBackup();
      case 'plan':
        return renderPlan();
      default:
        return null;
    }
  };

  return (
    <View className="w-full min-h-full overflow-hidden" style={{ backgroundColor: colors.bg }}>
      <ScrollView className="w-full min-h-full" scrollY showScrollbar={false}>
      <View
        className="flex flex-row items-center justify-around px-2 py-3 sticky top-0 z-10"
        style={{ backgroundColor: colors.card, borderBottomWidth: '2rpx', borderColor: colors.border }}
      >
        {tabs.map((tab) => (
          <View
            key={tab.id}
            className="px-3 py-2 rounded-full active:scale-95"
            style={{
              backgroundColor: activeTab === tab.id ? colors.primary : 'transparent',
            }}
            onClick={() => setActiveTab(tab.id)}
          >
            <Text
              className="text-sm font-bold"
              style={{
                color: activeTab === tab.id ? colors.bg : colors.text,
              }}
            >
              {tab.name}
            </Text>
          </View>
        ))}
      </View>

      <View className="px-4 py-4">{renderContent()}</View>
      </ScrollView>
    </View>
  );
}
