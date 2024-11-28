import { Plus, X } from 'lucide-react';
import styled from '@emotion/styled';
import { css } from '@emotion/css';
import { MouseEventHandler, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { List, ListItem } from '../../components/list';
import { getOpenedFiles, searchFile } from '../../commandApi';
import { useDebounceEffect } from 'ahooks';
import ScrollArea from '../../components/scrollArea';
import { useChatStore } from '../../stores/useChatStore';
import { ChatReferenceFileItem } from '../../types';

const Button = styled.button({
  height: '18px',
  border: '1px solid var(--vscode-list-inactiveSelectionBackground)',
  backgroundColor: 'var(--vscode-editor-background)',
  display: 'flex',
  flexDirection: 'row',
  justifyContent: 'center',
  alignItems: 'center',
  gap: '4px',
  fontSize: '10px',
  borderRadius: '5px',
  cursor: 'pointer',

  '&.edit': {
    outlineColor: 'var(--vscode-focusBorder)',
    outlineOffset: '-1px',
    outlineStyle: 'solid',
    outlineWidth: '1px',
  },
});

function FileItem(props: {
  name: string;
  type: string;
  title?: string;
  isEdit?: boolean;
  onClick?: () => void;
  onClose?: () => void;
}) {
  const handleClose: MouseEventHandler = (e) => {
    e.stopPropagation();
    props.onClose?.();
  };

  return (
    <Button
      style={{ padding: '0 4px' }}
      title={props.title}
      onClick={props.onClick}
      className={props.isEdit ? 'edit' : ''}
    >
      <span style={{ color: 'var(--vscode-editor-foreground)' }}>
        {props.name}
      </span>
      <span style={{ color: 'var(--vscode-input-placeholderForeground)' }}>
        {props.type}
      </span>
      <span onClick={handleClose}>
        <X style={{ width: '10px', height: '10px', cursor: 'pointer' }} />
      </span>
    </Button>
  );
}

const Input = styled.input({
  display: 'block',
  backgroundColor: 'var(--vscode-quickInput-background)',
  color: 'var(--vscode-quickInput-foreground)',
  border: '1px solid var(--vscode-input-border, transparent)',
  padding: '2px 4px',
  width: '100%',

  '&:focus': {
    outlineColor: 'var(--vscode-focusBorder)',
    outlineOffset: '-1px',
    outlineStyle: 'solid',
    outlineWidth: '1px',
  },
});

const listCss = css({
  overflow: 'hidden',
  height: '300px',
  backgroundColor: 'var(--vscode-quickInput-background)',
  color: 'var(--vscode-quickInput-foreground)',
  display: 'flex',
  flexDirection: 'column',
  // border: '1px solid var(--vscode-commandCenter-inactiveBorder)',
  borderRadius: '4px',

  '& li:hover': {
    backgroundColor: 'var(--vscode-quickInputList-focusBackground)',
  },
  '& li': {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});

// when empty input, show opened files in editor
// when input, show search result
function FileSearchList() {
  const [references, setReferences] = useState<ChatReferenceFileItem[]>([]);
  const [query, setQuery] = useState('');

  const addChatReference = useChatStore((state) => state.addChatReference);

  useDebounceEffect(
    () => {
      if (!query) {
        setReferences([]);
        getOpenedFiles().then((files) => {
          setReferences(files.map((file) => ({ ...file, type: 'file' })));
        });
        return;
      }
      searchFile(query).then((files) => {
        setReferences(files.map((file) => ({ ...file, type: 'file' })));
      });
    },
    [query],
    { wait: 500 },
  );

  return (
    <div className={listCss}>
      <div style={{ padding: '6px 4px 4px' }}>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="input search text."
        />
      </div>
      <ScrollArea
        disableX
        style={{ whiteSpace: 'nowrap', flexGrow: 1, padding: '4px 4px 6px' }}
      >
        <List
          style={{
            border: 'none',
            minHeight: '100%',
            background: 'transparent',
          }}
        >
          {references.map((file) => (
            <ListItem
              key={file.path}
              title={file.path}
              secondaryText={file.path}
              onClick={() => addChatReference({ ...file, readonly: true })}
            >
              {file.name}
            </ListItem>
          ))}
        </List>
      </ScrollArea>
    </div>
  );
}

export default function ChatFileList() {
  const currentEditorReference = useChatStore(
    (state) => state.currentEditorReference,
  );
  const generateCodeSnippet = useChatStore(
    (state) => state.generateCodeSnippet,
  );

  const chatReferenceList = useChatStore((state) => state.chatReferenceList);
  const removeChatReference = useChatStore(
    (state) => state.removeChatReference,
  );
  const clickOnChatReference = useChatStore(
    (state) => state.clickOnChatReference,
  );

  const cancelGenerateCode = useChatStore((state) => state.cancelGenerateCode);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: '4px',
      }}
    >
      <Popover.Root>
        <Popover.Trigger asChild>
          <Button
            style={{
              width: '18px',
              cursor: 'pointer',
            }}
          >
            <Plus style={{ width: '14px', height: '14px' }} />
          </Button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            side="top"
            align="start"
            sideOffset={2}
            style={{
              minWidth: 'min(calc(100vw - 40px), 300px)',
              maxWidth: '280px',
              boxShadow: '0 0 8px 2px var(--vscode-widget-shadow)',
            }}
          >
            <FileSearchList />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {generateCodeSnippet && (
        <FileItem
          key={'generate-code'}
          name={generateCodeSnippet.name}
          type={'generate code'}
          isEdit={false}
          title={generateCodeSnippet.path}
          onClose={() => cancelGenerateCode()}
        />
      )}
      {currentEditorReference && (
        <FileItem
          key={'current'}
          name={currentEditorReference?.name ?? ''}
          type={'current file'}
          isEdit={true}
          title={currentEditorReference?.path ?? ''}
          onClose={() => removeChatReference(currentEditorReference)}
        />
      )}
      {chatReferenceList.map((reference, index) => (
        <FileItem
          key={`${reference.path}-${index}`}
          {...reference}
          type={reference.type}
          isEdit={reference.type === 'file' && !reference.readonly}
          title={reference.path}
          onClick={() => clickOnChatReference(reference)}
          onClose={() => removeChatReference(reference)}
        />
      ))}
    </div>
  );
}
