/**
 * 端到端集成测试：模拟完整业务流跑全部云函数。
 * 覆盖：档案 → 建计划(带排程) → 每日任务查询 → 作战 → 打卡 → 汇报 → 勋章/积分/等级
 *      → 连击 → 弹性任务 → 按月查记录 → 删计划
 */
require('./mock-sdk');
const { resetTables } = require('./mock-sdk');

const CF = (name) => require(`../cloudfunctions/${name}/index.js`);
const fn = {
  getOrCreateDefaultChildProfile: CF('getOrCreateDefaultChildProfile'),
  updateChildProfile: CF('updateChildProfile'),
  createPlan: CF('createPlan'),
  getCurrentPlan: CF('getCurrentPlan'),
  getDaySchedule: CF('getDaySchedule'),
  startBattle: CF('startBattle'),
  toggleTask: CF('toggleTask'),
  reportDay: CF('reportDay'),
  getProgress: CF('getProgress'),
  getRecords: CF('getRecords'),
  bumpFlexCount: CF('bumpFlexCount'),
  deletePlan: CF('deletePlan'),
};

let passed = 0;
let failed = 0;
const ok = (cond, label) => {
  if (cond) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ FAIL: ${label}`); }
};

const run = async (name, event) => {
  const res = await fn[name].main(event);
  if (!res || res.success !== true) {
    throw new Error(`${name} 调用失败: ${JSON.stringify(res)}`);
  }
  return res.data;
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  console.log('== 1. 档案 ==');
  resetTables();
  const { profile } = await run('getOrCreateDefaultChildProfile', { theme: 'prince' });
  ok(!!profile._id, '创建默认档案');
  const upd = await run('updateChildProfile', { childId: profile._id, name: '小战士', avatarUrl: '/assets/prince/avatars/a1.webp' });
  ok(upd.profile.name === '小战士', '保存昵称');

  console.log('== 2. 建计划（模拟排程引擎输出：10 天，3 任务，2 敞耍 1 出游，提前 1 天完成）==');
  // 假期 07-01 ~ 07-10。敞耍 07-05,07-06；出游 07-07。提前 1 天 → 07-10 机动。
  const dayTypes = {};
  for (const d of ['07-01','07-02','07-03','07-04','07-05','07-06','07-07','07-08','07-09','07-10']) {
    dayTypes[`2026-${d}`] = 'learn';
  }
  dayTypes['2026-07-05'] = 'rest';
  dayTypes['2026-07-06'] = 'rest';
  dayTypes['2026-07-07'] = 'trip';
  const dailyTasks = {
    '2026-07-01': ['t1', 't2'],
    '2026-07-02': ['t1', 't2'],
    '2026-07-03': ['t1', 't2'],
    '2026-07-04': ['t1', 't2'],
    '2026-07-05': [],
    '2026-07-06': [],
    '2026-07-07': [],
    '2026-07-08': ['t1', 't2'],
    '2026-07-09': ['t1', 't2'],
    '2026-07-10': [], // 机动日
  };
  const tasks = [
    { id: 't1', name: '语文·阅读', detail: '完成当天页数', icon: '📖', color: '#4A90E2', isOral: false,
      schedule: { kind: 'daily', totalAmount: null, unit: '', intervalN: 3, cycleOn: 2, cycleOff: 1 } },
    { id: 't2', name: '数学·口算', detail: '12 道', icon: '🔢', color: '#F5A623', isOral: true,
      schedule: { kind: 'daily', totalAmount: null, unit: '道', intervalN: 3, cycleOn: 2, cycleOff: 1 } },
    { id: 't3', name: '作文', detail: '自行安排', icon: '📝', color: '#9B59B6', isOral: false,
      schedule: { kind: 'flex', totalAmount: 3, unit: '篇', intervalN: 3, cycleOn: 2, cycleOff: 1 } },
  ];
  const created = await run('createPlan', {
    childId: profile._id,
    name: '暑假作战计划',
    startDate: '2026-07-01',
    endDate: '2026-07-10',
    tasks,
    dayTypes,
    weekTemplates: {},
    dailyTasks,
    taskPlanCounts: { t1: 6, t2: 6 },
    difficulty: 0.8,
  });
  ok(!!created.plan._id, '计划创建成功');
  ok(Object.keys(created.plan.dailyTasks).length === 10, 'dailyTasks 全期 10 天落库');
  ok(created.plan.taskPlanCounts.t1 === 6, 'taskPlanCounts 落库');

  console.log('== 3. 每日任务查询 ==');
  const base = { childId: profile._id, planId: created.plan._id };
  const d1 = await run('getDaySchedule', { ...base, date: '2026-07-02' });
  ok(d1.dayType === 'learn' && d1.tasks.length === 2, '学习日返回 2 个任务');
  const dRest = await run('getDaySchedule', { ...base, date: '2026-07-05' });
  ok(dRest.dayType === 'rest' && dRest.tasks.length === 0, '敞耍日无任务');
  const dTrip = await run('getDaySchedule', { ...base, date: '2026-07-07' });
  ok(dTrip.dayType === 'trip' && dTrip.tasks.length === 0, '出游日无任务');
  const dBuffer = await run('getDaySchedule', { ...base, date: '2026-07-10' });
  ok(dBuffer.dayType === 'learn' && dBuffer.tasks.length === 0, '机动日无任务');

  console.log('== 4. 作战 → 打卡 → 汇报（7/1）==');
  await run('startBattle', { ...base, date: '2026-07-01' });
  const t1 = await run('toggleTask', { ...base, date: '2026-07-01', taskId: 't1', completed: true,
    startTime: '2026-07-01T01:00:00.000Z', endTime: '2026-07-01T01:25:00.000Z' });
  ok(t1.record.taskRecords.find((r) => r.taskId === 't1').completed === true, '任务勾选完成');
  ok(t1.record.taskRecords.find((r) => r.taskId === 't1').endTime === '2026-07-01T01:25:00.000Z', '用时数据落库');
  await run('toggleTask', { ...base, date: '2026-07-01', taskId: 't2', completed: true,
    startTime: '2026-07-01T01:00:00.000Z', endTime: '2026-07-01T01:30:00.000Z' });
  const rep = await run('reportDay', { ...base, date: '2026-07-01' });
  ok(rep.record.isReported === true, '汇报成功');
  ok(rep.record.totalPoints === 20, '积分 = 2任务×5 + 全勤奖励10 = 20');
  ok(rep.unlockedMedals.includes('first'), '解锁初出茅庐勋章');
  ok(rep.unlockedMedals.includes('all6'), '解锁全能战士勋章');
  ok(rep.unlockedMedals.includes('fast'), '解锁速战速决勋章（25分钟）');

  console.log('== 5. 连续学习日全勤（7/2-7/9 跨敞耍出游，7/1 已汇报过）==');
  const learnDays = ['2026-07-02','2026-07-03','2026-07-04','2026-07-08','2026-07-09'];
  for (const d of learnDays) {
    await run('startBattle', { ...base, date: d });
    await sleep(5); // 保证 reportedAt 与 startTime 不同毫秒，速战速决勋章需 minutes>0
    await run('toggleTask', { ...base, date: d, taskId: 't1', completed: true,
      startTime: `${d}T01:00:00.000Z`, endTime: `${d}T02:00:00.000Z` });
    await run('toggleTask', { ...base, date: d, taskId: 't2', completed: true,
      startTime: `${d}T01:00:00.000Z`, endTime: `${d}T02:10:00.000Z` });
    await run('reportDay', { ...base, date: d });
  }
  const prog = await run('getProgress', { ...base });
  ok(prog.progress.currentConsecutiveDays === 6, `连续学习日 = 6（实际 ${prog.progress.currentConsecutiveDays}）`);
  ok(prog.progress.medals.includes('streak7') === false, '6 天全勤不解锁铁人（<7）');
  ok(prog.progress.medals.includes('earlybird') === false, '本地晚上跑不会解锁早起标兵（时区原因，真机验证）');
  ok(prog.progress.medals.includes('days7') === false, '累计 6 个学习日不解锁坚持不懈（<7）');

  console.log('== 6. 弹性任务累计 ==');
  await run('bumpFlexCount', { ...base, taskId: 't3', delta: 1 });
  const b2 = await run('bumpFlexCount', { ...base, taskId: 't3', delta: 1 });
  ok(b2.progress.flexDone.t3 === 2, '弹性任务 +2');
  const b3 = await run('bumpFlexCount', { ...base, taskId: 't3', delta: -1 });
  ok(b3.progress.flexDone.t3 === 1, '弹性任务 -1');
  const b4 = await run('bumpFlexCount', { ...base, taskId: 't3', delta: -1 });
  ok(b4.progress.flexDone.t3 === 0, '弹性任务不为负（下限 0）');

  console.log('== 7. 按月查记录 ==');
  const recs = await run('getRecords', { ...base, year: 2026, month: 7 });
  console.log('   记录日期:', recs.records.map((r) => r.date).join(', '));
  ok(recs.records.length === 7, `7 月 7 条记录（实际 ${recs.records.length}）`);
  ok(recs.records.every((r) => r.date.startsWith('2026-07')), '记录月份正确');
  const autoRec = recs.records.find((r) => r.date === '2026-07-10');
  ok(autoRec && (autoRec.taskRecords || []).length === 0 && autoRec.isReported === false,
    '第 7 条是查看机动日自动创建的空记录（未作战，属于产品行为）');

  console.log('== 8. 重复建计划防护 + 删计划 ==');
  const dup = await fn.createPlan.main({
    childId: profile._id, name: 'x', startDate: '2026-07-01', endDate: '2026-07-10',
    tasks, dayTypes, weekTemplates: {}, dailyTasks, taskPlanCounts: {}, difficulty: 0.8,
  });
  ok(dup.success === true, 'createPlan 本身不拦重复（由前端 getCurrentPlan 拦截）');
  const dupPlanId = dup.data.plan._id;
  const cur = await run('getCurrentPlan', { childId: profile._id });
  ok(!!cur.plan, 'getCurrentPlan 能查到计划');
  const del = await run('deletePlan', { childId: profile._id, planId: created.plan._id });
  ok(del.removedRecords === 7, `删计划连带删 7 条记录（实际 ${del.removedRecords}）`);
  ok(del.removedProgress === 1, '删计划连带删 1 条进度');
  const cur2 = await run('getCurrentPlan', { childId: profile._id });
  ok(cur2.plan && cur2.plan._id === dupPlanId, '删旧计划后当前计划自动指向新计划');
  await run('deletePlan', { childId: profile._id, planId: dupPlanId });
  const after = await run('getCurrentPlan', { childId: profile._id });
  ok(after.plan === null, '删计划后 getCurrentPlan 返回 null');

  console.log(`\n结果：${passed} 通过, ${failed} 失败`);
  process.exit(failed > 0 ? 1 : 0);
})().catch((e) => {
  console.error('测试异常中断:', e.message);
  process.exit(1);
});
