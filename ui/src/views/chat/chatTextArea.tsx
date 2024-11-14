/* eslint-disable @typescript-eslint/no-unused-vars */
import React, {
  useMemo,
  useState,
  useCallback,
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
  MutableRefObject,
} from 'react';
import {
  createEditor,
  Descendant,
  Element,
  Transforms,
  Range,
  Editor,
  BaseEditor,
} from 'slate';
import {
  Slate,
  Editable,
  withReact,
  ReactEditor,
  RenderLeafProps,
  RenderElementProps as SlateRenderElementProps,
  DefaultElement,
} from 'slate-react';
import { ChevronDown } from 'lucide-react';
import styled from '@emotion/styled';
import * as Popover from '@radix-ui/react-popover';
import { Measurable } from '@radix-ui/rect';
import ChatFileList from './chatFileList';
import { List, ListItem } from '../../components/list';
import ToggleGroup from './ToggleGroup';
import { useChatStore, useChatSettingStore } from '../../stores/useChatStore';
import { useDocsStore } from '../../stores/useDocsStore';
import {
  ChatReferenceItem,
  DiffFormat,
  SerializedChatUserMessageChunk,
  DocItem,
} from '../../types';
import { useDebounceEffect, useMemoizedFn } from 'ahooks';
import { searchFile, showInfoMessage } from '../../commandApi';

const MAX_SUPPORTED_SEARCH_CHAR = 20;

enum EditorType {
  Mention = 'mention',
  Paragraph = 'paragraph',
}

type MentionElement = {
  type: 'mention';
  reference: ChatReferenceItem;
  children: CustomText[];
};

type ParagraphElement = {
  type: 'paragraph';
  children: Descendant[];
};

type CustomElement = MentionElement | ParagraphElement;

type CustomText = { text: string };

type RenderElementProps = Omit<SlateRenderElementProps, 'element'> & {
  element: CustomElement;
};

declare module 'slate' {
  interface CustomTypes {
    Editor: BaseEditor & ReactEditor;
    Element: CustomElement;
    Text: CustomText;
  }
}

function serialize(nodes: Descendant[]) {
  return nodes.flatMap((node): SerializedChatUserMessageChunk[] => {
    if (Element.isElement(node)) {
      if (node.type === 'mention') {
        return [{ type: 'mention', reference: node.reference }];
      }
      return serialize(node.children);
    }
    return [node.text];
  });
}

const Text = (props: RenderLeafProps) => {
  const { attributes, children, leaf } = props;
  return (
    <span
      className={leaf.text === '' ? 'pl-[0.1px]' : undefined}
      {...attributes}
    >
      {children}
    </span>
  );
};

const insertMention = (editor: Editor, reference: ChatReferenceItem) => {
  const mention: CustomElement = {
    type: 'mention',
    reference,
    children: [{ text: '' }],
  };
  editor.insertNode(mention);

  const point = Editor.after(editor, editor.selection!);
  if (point) {
    Transforms.setSelection(editor, { anchor: point, focus: point });
    editor.insertText(' ');
  }

  ReactEditor.focus(editor);
};

const InlineChromiumBugfix = () => (
  <span contentEditable={false} style={{ fontSize: 0 }}>
    {String.fromCodePoint(160)}
  </span>
);

const MentionElement = ({
  attributes,
  children,
  element,
}: RenderElementProps) => {
  const ref = (element as MentionElement).reference;
  const displayName = ref.type === 'doc' ? ref.title : ref.name;

  return (
    <span
      {...attributes}
      contentEditable={false}
      style={{
        color: 'var(--vscode-textLink-foreground)',
        padding: '2px',
        margin: '0 1px',
        verticalAlign: 'baseline',
        borderRadius: '4px',
        fontSize: '0.9em',
      }}
    >
      <InlineChromiumBugfix />@{displayName}
      {children}
      <InlineChromiumBugfix />
    </span>
  );
};

const withMentions = (editor: Editor) => {
  const { isInline, isSelectable } = editor;

  editor.isInline = (element) => {
    return element.type === 'mention' ? true : isInline(element);
  };

  editor.isSelectable = (element) => {
    return element.type === EditorType.Mention ? false : isSelectable(element);
  };

  return editor;
};

const ChatEditor = forwardRef<{ sendChat: () => void }>(
  function ChatEditor(_props, ref) {
    const editor = useMemo(() => withMentions(withReact(createEditor())), []);
    const [value, setValue] = useState<Descendant[]>([
      { type: 'paragraph', children: [{ text: '' }] },
    ]);

    const currentMode = useRef<'insert' | 'select'>('insert');

    const [references, setReferences] = useState<ChatReferenceItem[]>([]);
    const [mentionType, setMentionType] = useState<'file' | 'docs'>('file');

    const renderElement = useCallback((props: RenderElementProps) => {
      switch (props.element.type) {
        case 'mention':
          return <MentionElement {...props} />;
        default:
          return <DefaultElement {...props} />;
      }
    }, []);

    const [target, setTarget] = useState<Range | null>(null);
    const targetRef = useRef<Measurable>();
    const [index, setIndex] = useState(0);
    const [search, setSearch] = useState('');

    const sendChatMessage = useChatStore((state) => state.sendChatMessage);
    const addChatReference = useChatStore((state) => state.addChatReference);
    const providers = useDocsStore((state) => state.providers);

    useEffect(() => {
      if (target && references.length > 0) {
        const el = document.getElementById('mention-portal');
        if (el) {
          const domRange = ReactEditor.toDOMRange(editor, target);
          const rect = domRange.getBoundingClientRect();
          el.style.top = `${rect.top + window.scrollY + 24}px`;
          el.style.left = `${rect.left + window.scrollX}px`;
        }
      }
    }, [references.length, editor, target]);

    const sendChat = useMemoizedFn(() => {
      const { current } = useChatStore.getState();
      if (current) {
        showInfoMessage('there is a chat in progress, please wait.');
        return;
      }

      const content = serialize(editor.children);
      sendChatMessage(content);
      Transforms.delete(editor, {
        at: {
          anchor: Editor.start(editor, []),
          focus: Editor.end(editor, []),
        },
      });
    });

    useImperativeHandle(ref, () => ({
      sendChat,
    }));

    useDebounceEffect(
      () => {
        if (!search) {
          setReferences((p) => (p.length ? [] : p));
          return;
        }

        if (mentionType === 'docs') {
          const matchingDocs: DocItem[] = providers
            .filter((doc) =>
              doc.title.toLowerCase().includes(search.toLowerCase())
            )
            .map((doc) => ({
              type: 'doc',
              name: doc.title,
              path: doc.startUrl,
              ...doc,
            }));
          setReferences(matchingDocs);
        } else {
          searchFile(search, 10).then((files) => {
            setReferences(files.map((file) => ({ type: 'file', ...file })));
          });
        }
      },
      [search, mentionType],
      { wait: 500 },
    );

    const addReference = useCallback(
      (reference: ChatReferenceItem) => {
        addChatReference({ ...reference });
        insertMention(editor, reference);
        setTarget(null);
      },
      [addChatReference, editor],
    );

    const onKeyDown = useMemoizedFn(
      (event: React.KeyboardEvent<HTMLDivElement>) => {
        switch (event.key) {
          case 'ArrowDown':
            if (target) {
              event.preventDefault();
              const prevIndex = index >= references.length - 1 ? 0 : index + 1;
              setIndex(prevIndex);
            }
            break;
          case 'ArrowUp':
            if (target) {
              event.preventDefault();
              const nextIndex = index <= 0 ? references.length - 1 : index - 1;
              setIndex(nextIndex);
            }
            break;
          case 'Enter': {
            event.preventDefault();

            if (target) {
              Transforms.select(editor, target);
              addReference(references[index]);
            } else if (event.shiftKey) {
              Transforms.insertText(editor, '\n');
            } else if (currentMode.current === 'insert') {
              sendChat();
            }
            break;
          }
          case 'Escape':
            event.preventDefault();
            setTarget(null);
            break;
          default:
            return;
        }
      },
    );

    const handlePaste = useCallback(
      (event: React.ClipboardEvent<HTMLDivElement>) => {
        try {
          event.preventDefault();

          const text = event.clipboardData.getData('text/plain');
          if (!text) return;

          editor.insertText(text);
        } catch (error) {
          console.error('Failed to handle paste:', error);
        }
      },
      [editor],
    );

    return (
      <Slate
        editor={editor}
        initialValue={value}
        onChange={(value) => {
          setValue(value);
          const { selection } = editor;

          if (selection && Range.isCollapsed(selection)) {
            const [start] = Range.edges(selection);

            let currentPoint = start;
            let searchCount = 0;

            while (searchCount < MAX_SUPPORTED_SEARCH_CHAR) {
              const before = Editor.before(editor, currentPoint);

              if (!before) break;

              if (
                before.path[before.path.length - 1] !==
                currentPoint.path[currentPoint.path.length - 1]
              ) {
                break;
              }

              const range = Editor.range(editor, before, currentPoint);
              const char = Editor.string(editor, range);

              if (char === '@') {
                const beforeIncludeSpace = Editor.before(editor, before);
                if (!beforeIncludeSpace) break;

                const rangeIncludeSpace = Editor.range(
                  editor,
                  beforeIncludeSpace,
                  start,
                );
                const text = Editor.string(editor, rangeIncludeSpace);
                const docsMatch = text.match(/\s@Docs\s*(\w*)$/i);
                const fileMatch = text.match(/\s@(\w+)$/);

                if (docsMatch) {
                  const range = Editor.range(editor, before, start);
                  setTarget(range);
                  targetRef.current = {
                    getBoundingClientRect: () => {
                      const domRange = ReactEditor.toDOMRange(editor, range);
                      return domRange.getBoundingClientRect();
                    },
                  };
                  setMentionType('docs');
                  setSearch(docsMatch[1] || '');
                  setIndex(0);
                  return;
                } else if (fileMatch) {
                  const range = Editor.range(editor, before, start);
                  setTarget(range);
                  targetRef.current = {
                    getBoundingClientRect: () => {
                      const domRange = ReactEditor.toDOMRange(editor, range);
                      return domRange.getBoundingClientRect();
                    },
                  };
                  setMentionType('file');
                  setSearch(fileMatch[1]);
                  setIndex(0);
                  return;
                }
                break;
              }

              currentPoint = before;
              searchCount++;
            }

            setTarget(null);
          } else {
            setTarget(null);
          }
        }}
      >
        <Editable
          renderElement={renderElement}
          renderLeaf={(props) => <Text {...props} />}
          onKeyDown={onKeyDown}
          onPaste={handlePaste}
          placeholder="Ask anything, use @ to mention files or @Docs to reference documentation."
        />
        <Popover.Root open={Boolean(target)}>
          <Popover.Anchor
            virtualRef={targetRef as MutableRefObject<Measurable>}
          />
          <Popover.Portal>
            <Popover.Content
              autoFocus={false}
              align="start"
              side="top"
              sideOffset={3}
              style={{
                minWidth: 'min(calc(100vw - 40px), 300px)',
                maxWidth: 'calc(100vw - 40px)',
                boxShadow: '0 0 8px 2px var(--vscode-widget-shadow)',
              }}
              onOpenAutoFocus={(e) => e.preventDefault()}
            >
              <List>
                {references.map((r, i) => {
                  const key = r.type === 'file' ? r.path : r.startUrl;
                  const secondaryText = r.type === 'file' ? r.path : r.rootUrl;
                  const displayName = r.type === 'file' ? r.name : r.title;

                  return (
                    <ListItem
                      key={key}
                      className={i === index ? 'focus' : ''}
                      style={{ justifyContent: 'space-between' }}
                      secondaryText={secondaryText}
                      onClick={() => {
                        addReference(r);
                      }}
                    >
                      {displayName}
                    </ListItem>
                  );
                })}
              </List>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </Slate>
    );
  },
);

const ChatActionButton = styled.button({
  border: 'none',
  backgroundColor: 'transparent',
  cursor: 'pointer',
  padding: '0',
  color: 'var(--vscode-foreground)',
  fontSize: 'inherit',
});

function ChatActionBar(props: { onChatClick: () => void }) {
  const [open, setOpen] = useState(false);

  const chatType = useChatSettingStore((state) => state.chatType);
  const setChatType = useChatSettingStore((state) => state.setChatType);
  const diffFormat = useChatSettingStore((state) => state.diffFormat);
  const setDiffFormat = useChatSettingStore((state) => state.setDiffFormat);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: '4px',
        fontSize: '11px',
      }}
    >
      <ToggleGroup
        value={chatType}
        options={['ask', 'code']}
        defaultValue="ask"
        onChange={(value) => {
          if (!value) return;
          setChatType(value as 'ask' | 'code');
        }}
      />
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <div
            style={{
              display: chatType === 'code' ? 'flex' : 'none',
              alignItems: 'center',
              gap: '2px',
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            <ChevronDown
              size={12}
              style={{ transform: open ? 'rotate(0deg)' : 'rotate(180deg)' }}
            />
            {diffFormat}
          </div>
        </Popover.Trigger>
        <Popover.Content>
          <List>
            {Object.values(DiffFormat).map((format) => (
              <ListItem
                key={format}
                onClick={() => {
                  setDiffFormat(format);
                  setOpen(false);
                }}
              >
                {format}
              </ListItem>
            ))}
          </List>
        </Popover.Content>
      </Popover.Root>
      <div style={{ flexGrow: 1 }} />
      <ChatActionButton onClick={props.onChatClick}>⏎ chat</ChatActionButton>
    </div>
  );
}

export default function ChatTextArea() {
  const editorRef = useRef<{ sendChat: () => void }>(null);

  const onChatClick = () => {
    editorRef.current?.sendChat();
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        alignItems: 'stretch',
        border:
          'solid 1px var(--vscode-input-border,var(--vscode-commandCenter-inactiveBorder))',
        backgroundColor: 'var(--vscode-input-background)',
        flexGrow: 0,
        flexShrink: 1,
        margin: '6px',
        padding: '6px',
        borderRadius: '4px',
      }}
    >
      <ChatFileList />
      <div
        style={{
          minHeight: '40px',
        }}
      >
        <ChatEditor ref={editorRef} />
      </div>
      <ChatActionBar onChatClick={onChatClick} />
    </div>
  );
}
