import { create } from 'zustand';
import { combine, persist } from 'zustand/middleware';
import useExtensionStore from './useExtensionStore';
import { persistSecretStorage } from './lib';
import { settingMap } from '../views/setting/config';
import { showErrorMessage } from '../commandApi';

export type ChatModelSetting = {
  name: string;
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
        current: '',
        models: [] as ChatModelSetting[],
      },
      (set, get) => ({
        async setSetting(name: string, models: ChatModelSetting[]) {
          const setting = models.find((item) => item.name === name);
          if (!setting || !name) {
            throw new Error('Setting not found');
          }

          set((state) => ({
            ...state,
            current: name,
            models,
          }));

          await apiSetting(setting);
        },
        addSetting(setting: ChatModelSetting) {
          set((state) => ({
            ...state,
            models: [...state.models, setting],
          }));
        },
        deleteSetting(name: string) {
          set((state) => ({
            ...state,
            models: state.models.filter((item) => item.name !== name),
          }));
        },
        getCurrentSetting() {
          return get().models.find((item) => item.name === get().current);
        },
      }),
    ),
    {
      name: 'setting',
      version: 1,
      storage: persistSecretStorage,
      onRehydrateStorage: () => {
        return (_state, error) => {
          if (error) {
            console.error('hydrate error', error);
          }
          hydratedResolve();
        };
      },
      migrate: (state, version) => {
        console.log('migrate', state, version);
        if (version === 0) {
          return {
            current: 'default',
            models: [
              {
                name: 'default',
                ...(state as any).model,
              },
            ],
          };
        }
        return state;
      },
    },
  ),
);

export default useSettingStore;
