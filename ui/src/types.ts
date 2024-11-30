export type ChatReferenceFileItem = {
  // this is just fsPath
  id: string;
  type: 'file';
  fsPath: string;
  path: string;
  name: string;
};

export type ChatReferenceSnippetItem = {
  id: string;
  type: 'snippet';
  name: string;
  content: string;
  language?: string;
  path: string;
};

export type ChatReferenceItem =
  | ChatReferenceFileItem
  | ChatReferenceSnippetItem;

export interface ChatUserMessage {
  id: string;
  type: 'user';
  text: string;
  displayText: string;
  referenceList: ChatReferenceItem[];
  reflected?: boolean;
}

export interface ChatAssistantMessage {
  id: string;
  type: 'assistant';
  text: string;
  usage?: string;
}

export type ChatMessage = ChatAssistantMessage | ChatUserMessage;

export type SerializedChatUserMessageChunk =
  | string
  | { type: 'mention'; reference: ChatReferenceItem };

export enum DiffFormat {
  Diff = 'diff',
  DiffFenced = 'diff-fenced',
  UDiff = 'udiff',
  Whole = 'whole',
}

export type DiffViewChange = {
  type: 'add' | 'accept' | 'reject';
  path: string;
  name: string;
  fsPath: string;
};
