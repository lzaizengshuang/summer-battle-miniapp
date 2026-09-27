import type { ThemeType, MedalDef, DayType } from '@/types';

export interface ThemeColors {
  theme: ThemeType;
  primary: string;
  bg: string;
  card: string;
  border: string;
  text: string;
  textMuted: string;
  gold: string;
  accent: string;
  success: string;
  danger: string;
  /** 首页背景图（本地资源路径），无则用纯色 bg */
  bgImage?: string;
  /** 半透明玻璃卡片底色 */
  glass?: string;
}

export const themeColors: Record<ThemeType, ThemeColors> = {
  prince: {
    theme: 'prince',
    primary: '#A3E635',
    bg: '#0B1026',
    card: 'rgba(255,255,255,0.06)',
    glass: 'rgba(255,255,255,0.05)',
    border: 'rgba(255,255,255,0.12)',
    text: '#F1F5F9',
    textMuted: '#8B94B3',
    gold: '#FBBF24',
    accent: '#38BDF8',
    success: '#A3E635',
    danger: '#F87171',
    bgImage: '/assets/prince/bg-night.webp',
  },
  princess: {
    theme: 'princess',
    primary: '#F472B6',
    bg: '#150A2E',
    card: 'rgba(255,255,255,0.06)',
    glass: 'rgba(255,255,255,0.05)',
    border: 'rgba(255,255,255,0.12)',
    text: '#F5F3FF',
    textMuted: '#A78BFA',
    gold: '#FBBF24',
    accent: '#C084FC',
    success: '#34D399',
    danger: '#F87171',
    bgImage: '/assets/princess/bg-night.webp',
  },
};

export const rankNames: Record<ThemeType, string[]> = {
  prince: [
    '列兵',
    '上等兵',
    '下士',
    '中士',
    '上士',
    '少尉',
    '中尉',
    '上尉',
    '少校',
    '中校',
    '上校',
    '少将',
    '中将',
    '上将',
    '元帅',
  ],
  princess: [
    '花苞',
    '露珠精灵',
    '嫩芽仙子',
    '花间舞者',
    '蝴蝶使者',
    '花园园丁',
    '花冠少女',
    '森林歌者',
    '花之祭司',
    '精灵公主',
    '自然守护者',
    '花海女王候选人',
    '花之公主',
    '百花女王预备',
    '花之女王',
  ],
};

const medalMeta: Array<{ id: string; name: string; desc: string; icon: string }> = [
  { id: 'first', name: '初出茅庐', desc: '完成第1天打卡', icon: '🥉' },
  { id: 'streak7', name: '铁人勋章', desc: '历史最大连续打卡≥7天', icon: '🥈' },
  { id: 'streak14', name: '钢铁意志', desc: '历史最大连续打卡≥14天', icon: '🥇' },
  { id: 'streak30', name: '战神勋章', desc: '历史最大连续打卡≥30天', icon: '💎' },
  { id: 'all6', name: '全能战士', desc: '单日完成全部已配置任务', icon: '⚔️' },
  { id: 'fast', name: '速战速决', desc: '任意记录完成用时≤30分钟', icon: '⏱️' },
  { id: 'perfect', name: '零失误', desc: '口算类任务连续10天完成', icon: '🎯' },
  { id: 'earlybird', name: '早起标兵', desc: '累计5天在中午前汇报', icon: '🌅' },
  { id: 'days7', name: '坚持不懈', desc: '累计完成7个学习日', icon: '🧗' },
  { id: 'days30', name: '月度尖兵', desc: '累计完成30个学习日', icon: '📅' },
  { id: 'halfway', name: '半程冲锋', desc: '完成计划一半学习日', icon: '⛰️' },
  { id: 'finisher', name: '完美收官', desc: '完成计划最后一个学习日', icon: '🏁' },
  { id: 'comeback', name: '卷土重来', desc: '中断后重新坚持3天', icon: '🔥' },
  { id: 'oral50', name: '口算之星', desc: '口算任务累计完成50次', icon: '🧮' },
  { id: 'rich500', name: '军功显赫', desc: '总军功达到500', icon: '💰' },
];

/** 各主题勋章图：老 7 枚王子为透明底，其余为不透明瓦片（tile） */
const medalImages: Record<ThemeType, Record<string, { src: string; tile: boolean }>> = {
  prince: {
    first: { src: '/assets/prince/medals/first.webp', tile: false },
    streak7: { src: '/assets/prince/medals/streak7.webp', tile: false },
    streak14: { src: '/assets/prince/medals/streak14.webp', tile: false },
    streak30: { src: '/assets/prince/medals/streak30.webp', tile: false },
    all6: { src: '/assets/prince/medals/all6.webp', tile: false },
    fast: { src: '/assets/prince/medals/fast.webp', tile: false },
    perfect: { src: '/assets/prince/medals/perfect.webp', tile: false },
    earlybird: { src: '/assets/prince/medals/earlybird.webp', tile: true },
    days7: { src: '/assets/prince/medals/days7.webp', tile: true },
    days30: { src: '/assets/prince/medals/days30.webp', tile: true },
    halfway: { src: '/assets/prince/medals/halfway.webp', tile: true },
    finisher: { src: '/assets/prince/medals/finisher.webp', tile: true },
    comeback: { src: '/assets/prince/medals/comeback.webp', tile: true },
    oral50: { src: '/assets/prince/medals/oral50.webp', tile: true },
    rich500: { src: '/assets/prince/medals/rich500.webp', tile: true },
  },
  princess: Object.fromEntries(
    ['first', 'streak7', 'streak14', 'streak30', 'all6', 'fast', 'perfect',
     'earlybird', 'days7', 'days30', 'halfway', 'finisher', 'comeback', 'oral50', 'rich500']
      .map((id) => [id, { src: `/assets/princess/medals/${id}.webp`, tile: true }]),
  ) as Record<string, { src: string; tile: boolean }>,
};

export const medalDefs: Record<ThemeType, MedalDef[]> = {
  prince: medalMeta.map((m) => ({ ...m, image: medalImages.prince[m.id].src, tile: medalImages.prince[m.id].tile })),
  princess: medalMeta.map((m) => ({ ...m, image: medalImages.princess[m.id].src, tile: medalImages.princess[m.id].tile })),
};

/** 15 级军衔徽章（随等级递进：青铜→白银→黄金→元帅） */
export const rankEmblems: Record<ThemeType, string[]> = {
  prince: Array.from({ length: 15 }, (_, i) => `/assets/prince/ranks/r${String(i + 1).padStart(2, '0')}.webp`),
  princess: Array.from({ length: 15 }, (_, i) => `/assets/princess/ranks/r${String(i + 1).padStart(2, '0')}.webp`),
};

/** 孩子头像候选（创建档案时选择） */
export const avatarOptions: Record<ThemeType, string[]> = {
  prince: Array.from({ length: 6 }, (_, i) => `/assets/prince/avatars/a${i + 1}.webp`),
  princess: Array.from({ length: 6 }, (_, i) => `/assets/princess/avatars/a${i + 1}.webp`),
};

export const themeText: Record<
  ThemeType,
  {
    points: string;
    rank: string;
    report: string;
    start: string;
    rest: string;
    trip: string;
    restLabel: string;
    tripLabel: string;
  }
> = {
  prince: {
    points: '军功',
    rank: '军衔',
    report: '任务完成，向总部汇报！',
    start: '开始作战',
    rest: '尽情玩耍',
    trip: '任务暂停',
    restLabel: '敞耍日',
    tripLabel: '出游日',
  },
  princess: {
    points: '爱心值',
    rank: '公主等级',
    report: '任务完成，向公主汇报！',
    start: '开始魔法任务',
    rest: '尽情玩耍',
    trip: '任务暂停',
    restLabel: '敞耍日',
    tripLabel: '出游日',
  },
};

export const dayTypeLabel: Record<DayType, string> = {
  learn: '学习日',
  rest: '敞耍日',
  trip: '出游日',
};
