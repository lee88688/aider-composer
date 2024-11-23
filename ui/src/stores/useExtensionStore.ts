import { create } from 'zustand';
import { combine } from 'zustand/middleware';

export type ViewType = 'chat' | 'setting' | 'welcome' | 'history';

const useExtensionStore = create(
  combine(
    {
      isStarted: false,
      viewType: 'welcome' as ViewType,
      serverUrl: '',
      errorMessage: '',
    },
    (set) => ({
      setViewType: (viewType: ViewType) => set({ viewType }),
      setServerUrl: (url: string) => set({ serverUrl: url, isStarted: true }),
      setErrorMessage: (message: string) => set({ errorMessage: message }),
    }),
  ),
);

export default useExtensionStore;
