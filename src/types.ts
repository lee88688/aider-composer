export interface DocsConfig {
    title: string;
    startUrl: string;
    rootUrl: string;
    faviconUrl?: string;
}

export const DiffContentProviderId = 'aider-composer-diff';

export interface DiffParams {
    path: string;
    content: string;
}
