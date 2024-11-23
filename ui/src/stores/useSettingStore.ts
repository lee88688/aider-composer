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
  const { serverUrl, setErrorMessage } = useExtensionStore.getState();
  if (!serverUrl) {
    throw new Error('Server URL not set');
  }

  const m = settingMap[setting.provider].model;
  let model = setting.model;
  if (typeof m === 'function') {
    model = m(model);
  }

  try {
    const response = await fetch(`${serverUrl}/api/chat/setting`, {
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

    if (!response.ok) {
      throw new Error(`Failed to update settings: ${response.statusText}`);
    }

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update settings';
    setErrorMessage(message);
    throw error;
  }
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
