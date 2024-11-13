import { createJSONStorage, StateStorage } from 'zustand/middleware';
import {
  deleteGlobalState,
  deleteSecretState,
  deleteWorkspaceState,
  getGlobalState,
  getSecretState,
  getWorkspaceState,
  setGlobalState,
  setSecretState,
  setWorkspaceState,
} from '../commandApi';

const vscodeStorage: StateStorage = {
  getItem: (key: string) => {
    return getWorkspaceState({ key });
  },
  setItem: (key: string, value: string) => {
    return setWorkspaceState({ key, value });
  },
  removeItem: (key: string) => {
    return deleteWorkspaceState({ key });
  },
};

export const persistStorage = createJSONStorage(() => vscodeStorage);

const globalStorage: StateStorage = {
  getItem: (key: string) => {
    return getGlobalState({ key });
  },
  setItem: (key: string, value: string) => {
    return setGlobalState({ key, value });
  },
  removeItem: (key: string) => {
    return deleteGlobalState({ key });
  },
};

export const persistGlobalStorage = createJSONStorage(() => globalStorage);

const secretStorage: StateStorage = {
  getItem: (key: string) => {
    return getSecretState({ key });
  },
  setItem: (key: string, value: string) => {
    return setSecretState({ key, value });
  },
  removeItem: (key: string) => {
    return deleteSecretState({ key });
  },
};

export const persistSecretStorage = createJSONStorage(() => secretStorage);
