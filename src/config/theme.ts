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
}

export const themeColors: Record<ThemeType, ThemeColors> = {
  prince: {
    theme: 'prince',
    primary: '#39FF14',
    bg: '#0A0A0A',
    card: '#141414',
    border: 'rgba(57,255,20,0.25)',
    text: '#E8E8E8',
    textMuted: '#888888',
    gold: '#FFD700',
    accent: '#39FF14',
    success: '#39FF14',
    danger: '#FF4D4D',
  },
  princess: {
    theme: 'princess',
    primary: '#7ED321',
    bg: '#C47F3F',
    card: '#F5DEB3',
    border: 'rgba(93,64,55,0.25)',
    text: '#5D4037',
    textMuted: '#8D6E63',
    gold: '#FFD54F',
    accent: '#9B59B6',
    success: '#7ED321',
    danger: '#EF5350',
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

export const medalDefs: MedalDef[] = [
  { id: 'first', name: '初出茅庐', desc: '完成第1天打卡', icon: '🥉' },
  { id: 'streak7', name: '铁人勋章', desc: '历史最大连续打卡≥7天', icon: '🥈' },
  { id: 'streak14', name: '钢铁意志', desc: '历史最大连续打卡≥14天', icon: '🥇' },
  { id: 'streak30', name: '战神勋章', desc: '历史最大连续打卡≥30天', icon: '💎' },
  { id: 'all6', name: '全能战士', desc: '单日完成全部已配置任务', icon: '⚔️' },
  { id: 'fast', name: '速战速决', desc: '任意记录完成用时≤30分钟', icon: '⏱️' },
  { id: 'perfect', name: '零失误', desc: '口算类任务连续10天完成', icon: '🎯' },
];

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
