import { create } from 'zustand';
import { combine, persist } from 'zustand/middleware';
import { persistSecretStorage } from './lib';
import { settingMap } from '../views/setting/config';
import { apiChatSetting } from '../commandApi';

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
  autoCommit: boolean,
) {
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

  return apiChatSetting({
    main_model: convertToApiModel(setting),
    editor_model: editorModel ? convertToApiModel(editorModel) : null,
    auto_commits: autoCommit,
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
        // auto commit when edit file, this will not review code changes.
        autoCommit: false,
      },
      (set, get) => ({
        async setSetting(
          current: string,
          editorModel: string,
          models: ChatModelSetting[],
          autoCommit: boolean,
        ) {
          const setting = models.find((item) => item.name === current);
          const editorSetting = models.find(
            (item) => item.name === editorModel,
          );
          if (!setting || !current || !editorSetting) {
            throw new Error('Setting not found');
          }

          set((state) => ({
            ...state,
            current: current,
            editorModel,
            models,
            autoCommit,
          }));

          await apiSetting(setting, editorSetting, autoCommit);
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
