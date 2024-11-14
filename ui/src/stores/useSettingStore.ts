import { create } from 'zustand';
import { combine, persist } from 'zustand/middleware';
import useExtensionStore from './useExtensionStore';
import { persistSecretStorage } from './lib';
import { settingMap } from '../views/setting/config';

export type ChatModelSetting = {
  provider: string;
  model: string;
  apiKey: string;
  baseUrl: string;
};

export async function apiSetting(setting: ChatModelSetting) {
  const { serverUrl } = useExtensionStore.getState();

  const m = settingMap[setting.provider].model;
  let model = setting.model;
  if (typeof m === 'function') {
    model = m(model);
  }

  return fetch(`${serverUrl}/api/chat/setting`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      provider: setting.provider,
      model,
      api_key: setting.apiKey,
      base_url: setting.baseUrl,
    }),
  });
}

let hydratedResolve: () => void;
export const settingHydratedPromise = new Promise<void>((resolve) => {
  hydratedResolve = resolve;
});

const useSettingStore = create(
  persist(
    combine(
      {
        model: {
          provider: 'openai',
          model: '',
          apiKey: '',
          baseUrl: '',
        } as ChatModelSetting,
      },
      (set) => ({
        async setSetting(setting: ChatModelSetting) {
          await apiSetting(setting);
          set({ model: setting });
        },
      }),
    ),
    {
      name: 'setting',
      storage: persistSecretStorage,
      onRehydrateStorage: () => {
        return (_state, error) => {
          if (error) {
            console.error('hydrate error', error);
          }
          hydratedResolve();
        };
      },
    },
  ),
);

export default useSettingStore;
