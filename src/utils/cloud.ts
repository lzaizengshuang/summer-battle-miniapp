import Taro from '@tarojs/taro';

export interface CloudResult<T = any> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

let cloudInited = false;

export function initCloud(): void {
  if (cloudInited) return;
  try {
    Taro.cloud.init({
      env: (Taro.cloud as any).DYNAMIC_CURRENT_ENV || '',
      traceUser: true,
    });
    cloudInited = true;
  } catch (err) {
    console.error('cloud init failed', err);
  }
}

export async function callCloud<T = any>(name: string, data?: any): Promise<T> {
  initCloud();
  try {
    const res = await Taro.cloud.callFunction({ name, data });
    const result = res.result as CloudResult<T>;
    if (!result.success) {
      const message = result.error?.message || '未知错误';
      throw new Error(message);
    }
    return result.data as T;
  } catch (err) {
    console.error(`callCloud ${name} error`, err);
    throw err;
  }
}

export function showError(err: unknown): string {
  const message = err instanceof Error ? err.message : '请求失败，请稍后重试';
  Taro.showToast({ title: message, icon: 'none', duration: 2500 });
  return message;
}

export function showSuccess(title = '操作成功'): void {
  Taro.showToast({ title, icon: 'success', duration: 1500 });
}
