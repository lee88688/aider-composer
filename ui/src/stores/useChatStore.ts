import pick from 'lodash/pick';
import { create } from 'zustand';
import { combine, persist } from 'zustand/middleware';
import { SSE, SSEvent } from 'sse.js';
import {
  ChatAssistantMessage,
  ChatMessage,
  ChatReferenceFileItem,
  ChatReferenceItem,
  ChatReferenceSnippetItem,
  DiffFormat,
  DiffViewChange,
  SerializedChatUserMessageChunk,
} from '../types';
import { nanoid } from 'nanoid';
import {
  cancelGenerateCode,
  logToOutput,
  showErrorMessage,
  writeFile,
} from '../commandApi';
import useExtensionStore from './useExtensionStore';
import { persistStorage } from './lib';

// sse api 返回的类型
type ChatChunkMessage = {
  chunk: string;
};

type ServerChatPayload = {
  chat_type: 'ask' | 'code';
  diff_format: string;
  message: string;
  reference_list: { fs_path: string; readonly: boolean }[];
};

type ChatReferenceItemWithReadOnly = ChatReferenceItem & { readonly?: boolean };
type ChatFileItemWithReadOnly = ChatReferenceFileItem & { readonly?: boolean };

type ChatSessionHistory = {
  id: string;
  title: string;
  time: number;
  data: ChatMessage[];
};

export const useChatSettingStore = create(
  persist(
    combine(
      {
        chatType: 'ask' as 'ask' | 'code',
        diffFormat: DiffFormat.Diff,
      },
      (set) => ({
        setDiffFormat(nextDiffFormat: DiffFormat) {
          set({ diffFormat: nextDiffFormat });
        },
        setChatType(nextChatType: 'ask' | 'code') {
          set({ chatType: nextChatType });
        },
      }),
    ),
    {
      name: 'chat',
      storage: persistStorage,
      partialize: (state) => pick(state, ['chatType', 'diffFormat']),
    },
  ),
);

export const useChatSessionStore = create(
  persist(
    combine(
      {
        sessions: [] as ChatSessionHistory[],
      },
      (set) => ({
        setSessions(nextSessions: ChatSessionHistory[]) {
          set({ sessions: nextSessions });
        },
        addSession(id: string, data: ChatMessage[]) {
          if (!id) {
            console.error('id is required');
            return;
          }

          set((state) => {
            if (state.sessions.find((s) => s.id === id)) {
              return {
                ...state,
                sessions: state.sessions.map((s) =>
                  s.id === id ? { ...s, data, time: Date.now() } : s,
                ),
              };
            }

            const title =
              data[0].type === 'user'
                ? data[0].displayText.trim()
                : data[0].text.trim();
            return {
              ...state,
              sessions: [
                ...state.sessions,
                { id, title, time: Date.now(), data },
              ],
            };
          });
        },
        deleteSession(id: string) {
          set((state) => ({
            ...state,
            sessions: state.sessions.filter((s) => s.id !== id),
          }));
        },
      }),
    ),
    {
      name: 'sessions',
      storage: persistStorage,
    },
  ),
);

function formatCurrentChatMessage(
  message: string,
  options: {
    generateCodeSnippet?: ChatReferenceSnippetItem;
    chatReferenceList?: ChatReferenceItemWithReadOnly[];
  },
) {
  let reference = '';
  if (options.chatReferenceList) {
    reference = options.chatReferenceList
      .filter((r) => r.type === 'snippet')
      .map(
        (r) =>
          `<snippet fileName="${r.name}" language="${r.language}">\n${r.content}\n</snippet>`,
      )
      .join('\n');
    reference = `the following snippets are available:\n${reference}`;
  }

  if (options.generateCodeSnippet) {
    return `Your task is to generate code for the file \`${options.generateCodeSnippet.path}\` according to the user's request.
First, read the user's request.
Next, add the required code **only** on the line directly below the existing code in the file.
**Do not generate code in any other part of the file. In other words, place the code immediately following the line with the code given and nowhere else.**
The existing code in \`${options.generateCodeSnippet.path}\` is as follows:
\`\`\`${options.generateCodeSnippet.language}
${options.generateCodeSnippet.content.trimEnd()}
\`\`\`

Here is the user's request, delimited by triple quotes:
""" 
${message}
"""

Please reply in the same language as the request.`;
  }

  if (reference) {
    message = `${reference}\n\n${message}`;
  }

  return message;
}

export const useChatStore = create(
  combine(
    {
      id: nanoid(),
      history: [] as ChatMessage[],
      // current assistant message from server
      current: undefined as ChatAssistantMessage | undefined,
      // generate code snippet
      generateCodeSnippet: undefined as ChatReferenceSnippetItem | undefined,
      // current chat reference list
      chatReferenceList: [] as ChatReferenceItemWithReadOnly[],
      // current editor file
      currentEditorReference: undefined as ChatFileItemWithReadOnly | undefined,
      currentPreviewReference: undefined as
        | ChatReferenceSnippetItem
        | undefined,

      currentChatRequest: undefined as SSE | undefined,
      currentEditFiles: [] as DiffViewChange[],
    },
    (set, get) => ({
      async clearChat() {
        const { serverUrl } = useExtensionStore.getState();
        await fetch(`${serverUrl}/api/chat`, {
          method: 'DELETE',
        });
        set({
          id: nanoid(),
          history: [],
          current: undefined,
        });
      },
      setCurrentEditorReference(reference: ChatFileItemWithReadOnly) {
        set({ currentEditorReference: reference });
      },
      addChatReference(reference: ChatReferenceItemWithReadOnly) {
        set((state) => {
          // if already exists, do nothing
          if (state.chatReferenceList.find((r) => r.id === reference.id)) {
            return state;
          }

          return {
            ...state,
            chatReferenceList: [...state.chatReferenceList, reference],
          };
        });
      },
      removeChatReference(reference: ChatReferenceItemWithReadOnly) {
        set((state) => {
          if (state.currentEditorReference?.id === reference.id) {
            return {
              ...state,
              currentEditorReference: undefined,
              chatReferenceList: state.chatReferenceList.filter(
                (r) => r.id !== reference.id,
              ),
            };
          }

          return {
            ...state,
            chatReferenceList: state.chatReferenceList.filter((r) => {
              return r.id !== reference.id;
            }),
          };
        });
      },
      async cancelGenerateCode() {
        await cancelGenerateCode();
        set({ generateCodeSnippet: undefined, currentEditFiles: [] });
      },
      clearEditFile() {
        set({ currentEditFiles: [] });
      },
      closePreviewReference() {
        set({ currentPreviewReference: undefined });
      },
      clickOnChatReference(reference: ChatReferenceItemWithReadOnly) {
        set((state) => {
          // click on snippet to open preview
          if (reference.type === 'snippet') {
            return {
              ...state,
              currentPreviewReference: reference,
            };
          }

          if (state.currentEditorReference?.id === reference.id) {
            return state;
          }

          // click on file to switch readonly state
          return {
            ...state,
            chatReferenceList: state.chatReferenceList.map((r) => {
              if (r.type === 'file' && r.id === reference.id) {
                return { ...r, readonly: !r.readonly };
              }
              return r;
            }),
          };
        });
      },
      sendChatMessage(messageChunks: SerializedChatUserMessageChunk[]) {
        // this message is input by user
        const inputMessage = messageChunks
          .map((item) =>
            typeof item === 'string' ? item : `\`${item.reference.path}\``,
          )
          .join('');

        const displayText = messageChunks
          .map((item) =>
            typeof item === 'string' ? item : `@${item.reference.name}`,
          )
          .join('');

        const message = formatCurrentChatMessage(inputMessage, get());
        logToOutput('info', `sendChatMessage: ${message}`);

        set((state) => {
          return {
            ...state,
            history: [
              ...state.history,
              {
                id: nanoid(),
                text: message,
                displayText,
                type: 'user',
                referenceList: state.chatReferenceList,
              },
            ],
            current: {
              id: nanoid(),
              text: '',
              type: 'assistant',
            },
          };
        });

        // reference list for server
        let referenceList = get()
          .chatReferenceList.filter((item) => item.type === 'file')
          .map((item) => ({
            fs_path: item.fsPath,
            readonly: item.readonly ?? false,
          }));
        const currentEditorFsPath = get().currentEditorReference?.fsPath;
        if (currentEditorFsPath) {
          referenceList = referenceList.filter(
            (r) => r.fs_path !== currentEditorFsPath,
          );
          referenceList.push({
            fs_path: currentEditorFsPath,
            readonly: false,
          });
        }

        const { serverUrl } = useExtensionStore.getState();

        const { chatType, diffFormat } = useChatSettingStore.getState();

        const eventSource = new SSE(`${serverUrl}/api/chat`, {
          headers: {
            'Content-Type': 'application/json',
          },
          payload: JSON.stringify({
            chat_type: chatType,
            diff_format: diffFormat,
            message: message,
            reference_list: referenceList,
          } satisfies ServerChatPayload),
        });

        set({ currentChatRequest: eventSource });

        eventSource.addEventListener('data', (event: { data: string }) => {
          const chunkMessage = JSON.parse(event.data) as ChatChunkMessage;
          set((state) => ({
            ...state,
            current: state.current
              ? {
                  ...state.current,
                  text: (state.current?.text ?? '') + chunkMessage.chunk,
                }
              : state.current,
          }));
        });

        eventSource.addEventListener('usage', (event: { data: string }) => {
          const usage = JSON.parse(event.data) as { usage: string };
          set((state) => ({
            ...state,
            current: state.current
              ? {
                  ...state.current,
                  usage: usage.usage,
                }
              : state.current,
          }));
        });

        eventSource.addEventListener('write', (event: { data: string }) => {
          const writeParams = JSON.parse(event.data) as {
            write: Record<string, string>;
          };

          for (const [path, content] of Object.entries(writeParams.write)) {
            writeFile({ path, content });
          }
        });

        const end = () => {
          if (!get().current) {
            return;
          }
          set((state) => {
            const history = state.current
              ? [...state.history, state.current]
              : state.history;

            // generate code do not store in session
            if (!state.generateCodeSnippet) {
              const id = state.id;
              useChatSessionStore.getState().addSession(id, history);
            }

            return {
              ...state,
              history,
              current: undefined,
              currentChatRequest: undefined,
            };
          });
        };

        eventSource.addEventListener('reflected', (event: { data: string }) => {
          const reflectedMessage = JSON.parse(event.data) as {
            message: string;
          };
          // reflected message is a user message
          set((state) => {
            const history = state.current
              ? [...state.history, state.current]
              : [...state.history];
            history.push({
              type: 'user',
              text: reflectedMessage.message,
              displayText: reflectedMessage.message,
              id: nanoid(),
              reflected: true,
              referenceList: state.chatReferenceList,
            });

            // generate code do not store in session
            if (!state.generateCodeSnippet) {
              const id = state.id;
              useChatSessionStore.getState().addSession(id, history);
            }

            // create new assistant message for next round
            return {
              ...state,
              history,
              current: {
                id: nanoid(),
                text: '',
                type: 'assistant',
              },
            };
          });
          logToOutput('info', `reflected message: ${reflectedMessage.message}`);
        });

        eventSource.addEventListener('log', (event: { data: string }) => {
          const logMessage = JSON.parse(event.data) as { message: string };
          logToOutput('info', `server log: ${logMessage.message}`);
        });

        eventSource.addEventListener('end', () => {
          end();
          eventSource.close();
        });

        eventSource.addEventListener('error', (event: { data: string }) => {
          const errorData = JSON.parse(event.data) as { error: string };
          logToOutput('error', `server error: ${errorData.error}`);
          showErrorMessage(errorData.error);
        });

        eventSource.onerror = (event: SSEvent) => {
          // todo: should deal with current, currently only deal with end event
          console.log('error', event);
          if ((event.target as SSE | null)?.readyState === EventSource.CLOSED) {
            console.log('EventSource connection closed');
            // deal with end event
          } else {
            console.error('EventSource error:', event);
          }
          end();
          eventSource.close();
        };
      },
      cancelChat() {
        get().currentChatRequest?.close();
        set({ currentChatRequest: undefined });
      },
    }),
  ),
);

export async function setChatSession(id: string) {
  const session = useChatSessionStore
    .getState()
    .sessions.find((s) => s.id === id);
  if (!session) {
    console.error('session not found');
    return;
  }

  const { serverUrl } = useExtensionStore.getState();
  await fetch(`${serverUrl}/api/chat/session`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(
      session.data.map((m) => ({ role: m.type, content: m.text })),
    ),
  });

  useChatStore.setState({ id, history: session.data, current: undefined });
}
