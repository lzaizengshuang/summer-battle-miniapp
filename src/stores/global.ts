import { create } from 'zustand';
import type { ChildProfile, Plan, UserProgress, ThemeType } from '@/types';

interface GlobalState {
  profile: ChildProfile | null;
  plan: Plan | null;
  progress: UserProgress | null;
  theme: ThemeType;
  loading: boolean;
  error: string | null;
  setProfile: (profile: ChildProfile | null) => void;
  setPlan: (plan: Plan | null) => void;
  setProgress: (progress: UserProgress | null) => void;
  setTheme: (theme: ThemeType) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  profile: null as ChildProfile | null,
  plan: null as Plan | null,
  progress: null as UserProgress | null,
  theme: 'prince' as ThemeType,
  loading: false,
  error: null as string | null,
};

export const useGlobalStore = create<GlobalState>((set) => ({
  ...initialState,
  setProfile: (profile) => set({ profile }),
  setPlan: (plan) => set({ plan }),
  setProgress: (progress) => set({ progress }),
  setTheme: (theme) => set({ theme }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  reset: () => set(initialState),
}));
