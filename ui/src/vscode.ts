import { nanoid } from 'nanoid';
import useExtensionStore, { ViewType } from './stores/useExtensionStore';
import { useChatStore } from './stores/useChatStore';
import { ChatReferenceItem } from './types';

type Resolver = {
  resolve: (data: unknown) => void;
  reject: (error: unknown) => void;
};

type EventListener = (data: {
  id: string;
  command: string;
  data: unknown;
}) => void;

const vscode = acquireVsCodeApi();

const resolvers: Record<string, Resolver> = {};

const events: Record<string, EventListener[]> = {};

window.addEventListener('message', (event) => {
  const { id, command, data } = event.data;
  if (command === 'result') {
    const resolver = resolvers[id];
    resolver.resolve(data);
    delete resolvers[id];
    return;
  }

  const listeners = events[command];
  if (listeners) {
    listeners.forEach((listener) => listener({ id, command, data }));
  }
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function callCommand(command: string, data: unknown): Promise<any> {
  const id = nanoid();
  vscode.postMessage({
    id,
    command,
    data,
  });

  return new Promise((resolve, reject) => {
    resolvers[id] = { resolve, reject };
  });
}

export function addCommandEventListener(
  command: string,
  listener: EventListener,
) {
  if (!events[command]) {
    events[command] = [];
  }
  events[command].push(listener);
}

export function removeCommandEventListener(
  command: string,
  listener: EventListener,
) {
  if (events[command]) {
    events[command] = events[command].filter((l) => l !== listener);
  }
}

addCommandEventListener('new-chat', async () => {
  const isInChat = Boolean(useChatStore.getState().current);
  if (isInChat) {
    return;
  }

  const currentViewType = useExtensionStore.getState().viewType;
  if (currentViewType !== 'chat') {
    useExtensionStore.setState({ viewType: 'chat' });
  } else {
    // clear chat history
    const { serverUrl } = useExtensionStore.getState();
    await fetch(`${serverUrl}/api/chat`, {
      method: 'DELETE',
    });
    useChatStore.getState().clearChat();
  }
});

addCommandEventListener('set-view-type', ({ data }) => {
  useExtensionStore.setState({ viewType: data as ViewType });
});

addCommandEventListener('current-editor-changed', ({ data }) => {
  const item = data as ChatReferenceItem;
  useChatStore.setState({ currentEditorReference: item });
});

addCommandEventListener('server-started', async ({ data }) => {
  console.log('server-started', data);
  useExtensionStore.setState({
    isStarted: true,
    serverUrl: data as string,
  });
});
