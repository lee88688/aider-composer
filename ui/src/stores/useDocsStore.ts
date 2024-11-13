import { create } from 'zustand';
import type { StoreApi } from 'zustand';
import { DocsConfig } from '../types';
import { initialDocs } from './initialDocs';

interface DocsState {
    providers: DocsConfig[];
    addProvider: (provider: DocsConfig) => void;
    removeProvider: (startUrl: string) => void;
    setProviders: (providers: DocsConfig[]) => void;
}

type DocsStore = {
    setState: StoreApi<DocsState>['setState'];
    getState: StoreApi<DocsState>['getState'];
};

export const useDocsStore = create<DocsState>()((set) => ({
    providers: initialDocs,
    addProvider: (provider: DocsConfig) =>
        set((state) => ({
            providers: [...state.providers, provider],
        })),
    removeProvider: (startUrl: string) =>
        set((state) => ({
            providers: state.providers.filter((p) => p.startUrl !== startUrl),
        })),
    setProviders: (providers: DocsConfig[]) =>
        set({
            providers,
        }),
}));
