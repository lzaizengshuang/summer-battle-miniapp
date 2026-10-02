import { PropsWithChildren, useEffect } from 'react';
import { useLaunch } from '@tarojs/taro';
import '@/app.css';
import { Toaster } from '@/components/ui/toast';
import { ThemeProvider } from '@/utils/theme';
import { useGlobalStore } from '@/stores/global';
import { callCloud, initCloud, showError } from '@/utils/cloud';
import type { ChildProfile, Plan, UserProgress } from '@/types';
import { Preset } from './presets';

const Bootstrap = ({ children }: PropsWithChildren) => {
  const setProfile = useGlobalStore((s) => s.setProfile);
  const setPlan = useGlobalStore((s) => s.setPlan);
  const setProgress = useGlobalStore((s) => s.setProgress);
  const setTheme = useGlobalStore((s) => s.setTheme);

  useEffect(() => {
    initCloud();
    callCloud<{ profile: ChildProfile }>('getOrCreateDefaultChildProfile', {})
      .then(({ profile }) => {
        setProfile(profile);
        setTheme(profile.theme);
        return callCloud<{ plan: Plan | null; progress: UserProgress | null }>(
          'getCurrentPlan',
          { childId: profile._id },
        );
      })
      .then(({ plan, progress }) => {
        setPlan(plan);
        setProgress(progress);
      })
      .catch((err) => {
        console.error('bootstrap error', err);
        showError(err);
      });
  }, [setProfile, setPlan, setProgress, setTheme]);

  useLaunch(() => {
    // lifecycle hook preserved
  });

  return <>{children}</>;
};

const App = ({ children }: PropsWithChildren) => {
  return (
    <ThemeProvider>
      <Bootstrap>
        <Preset>{children}</Preset>
      </Bootstrap>
      <Toaster />
    </ThemeProvider>
  );
};

export default App;
