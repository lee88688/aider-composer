import { ChatReferenceItem } from './types';
import { callCommand } from './vscode';

export function webviewReady() {
  return callCommand('webview-ready', null);
}

export function searchFile(query: string, limit: number = 20) {
  return callCommand('search-file', { query, limit }) as Promise<
    { fsPath: string; path: string; basePath: string; name: string }[]
  >;
}

export function writeFile(params: { path: string; content: string }) {
  return callCommand('write-file', params);
}

export function logToOutput(type: 'info' | 'warn' | 'error', message: string) {
  return callCommand('log-to-output', { type, message });
}

export function showErrorMessage(message: string) {
  return callCommand('show-error-message', { message });
}

export function showInfoMessage(message: string) {
  return callCommand('show-info-message', { message });
}

export function getOpenedFiles() {
  return callCommand('get-opened-files', null) as Promise<
    Omit<ChatReferenceItem, 'type'>[]
  >;
}

export function setGlobalState(data: { key: string; value: unknown }) {
  return callCommand('set-global-state', data);
}

export function getGlobalState(data: { key: string }) {
  return callCommand('get-global-state', data);
}

export function deleteGlobalState(data: { key: string }) {
  return callCommand('delete-global-state', data);
}

export function setWorkspaceState(data: { key: string; value: unknown }) {
  return callCommand('set-workspace-state', data);
}

export function getWorkspaceState(data: { key: string }) {
  return callCommand('get-workspace-state', data);
}

export function deleteWorkspaceState(data: { key: string }) {
  return callCommand('delete-workspace-state', data);
}

export function setSecretState(data: { key: string; value: unknown }) {
  return callCommand('set-secret-state', data);
}

export function getSecretState(data: { key: string }) {
  return callCommand('get-secret-state', data);
}

export function deleteSecretState(data: { key: string }) {
  return callCommand('delete-secret-state', data);
}
