import { create } from 'zustand';
import { combine, persist } from 'zustand/middleware';
import useExtensionStore from './useExtensionStore';
import { persistSecretStorage } from './lib';
import { settingMap } from '../views/setting/config';

export type ChatModelSetting = {
  name: string;
  provider: string;
  model: string;
  apiKey: string;
  baseUrl: string;
};

export async function apiSetting(
  setting: ChatModelSetting,
  editorModel: ChatModelSetting,
) {
  const { serverUrl } = useExtensionStore.getState();

  const convertToApiModel = (s: ChatModelSetting) => {
    const m = settingMap[s.provider].model;
    let model = s.model;
    if (typeof m === 'function') {
      model = m(model);
    }

    return {
      provider: s.provider,
      model,
      api_key: s.apiKey,
      base_url: s.baseUrl,
    };
  };

  return fetch(`${serverUrl}/api/chat/setting`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      main_model: convertToApiModel(setting),
      editor_model: editorModel ? convertToApiModel(editorModel) : null,
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
        editorModel: '',
        models: [] as ChatModelSetting[],
      },
      (set, get) => ({
        async setSetting(
          name: string,
          editorModel: string,
          models: ChatModelSetting[],
        ) {
          const setting = models.find((item) => item.name === name);
          const editorSetting = models.find(
            (item) => item.name === editorModel,
          );
          if (!setting || !name || !editorSetting) {
            throw new Error('Setting not found');
          }

          set((state) => ({
            ...state,
            current: name,
            editorModel,
            models,
          }));

          await apiSetting(setting, editorSetting);
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
        getCurrentEditorSetting() {
          return get().models.find((item) => item.name === get().editorModel);
        },
      }),
    ),
    {
      name: 'setting',
      version: 2,
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
        } else if (version === 1) {
          const v0State = state as any;
          return {
            ...v0State,
            editorModel: v0State.current,
          };
        }
        return state;
      },
    },
  ),
);

export default useSettingStore;
