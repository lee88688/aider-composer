import { css } from '@emotion/css';
import { RefreshCw } from 'lucide-react';
import Markdown, {
  type Components as MarkdownComponents,
} from 'react-markdown';
import ScrollArea from '../../components/scrollArea';
import {
  ChatAssistantMessage,
  ChatMessage,
  ChatUserMessage,
} from '../../types';
import { useChatStore } from '../../stores/useChatStore';
import { memo, useMemo } from 'react';
import SyntaxHighlighter from 'react-syntax-highlighter';
// react-syntax-highlighter 's highlight.js version is not same as package.json
// here we just use style code.
import './codeTheme.scss';

const messageItemStyle = css({
  marginBottom: '16px',
  // whiteSpace: 'pre-wrap',
  '& pre': {
    overflow: 'auto hidden',
    width: '100%',
    maxWidth: '100%',
    backgroundColor: 'var(--vscode-editor-background)',
    borderRadius: '4px',
    padding: '4px',

    '& code': {
      backgroundColor: 'transparent',
      fontFamily: 'var(--vscode-editor-font-family)',
    },
  },
});

function ChatUserMessageItem(props: { message: ChatUserMessage }) {
  const { message } = props;

  return (
    <div
      style={{
        backgroundColor: 'var(--vscode-input-background)',
        borderRadius: '4px',
        padding: '4px',
        marginBottom: '16px',
        whiteSpace: 'pre-wrap',
      }}
    >
      <Markdown>{message.displayText}</Markdown>
    </div>
  );
}

const code: MarkdownComponents['code'] = (props) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { children, className, node, ...rest } = props;
  const match = /language-(\w+)/.exec(className || '');
  return match ? (
    // @ts-expect-error ref is not compatible with SyntaxHighlighter, but it's not used
    <SyntaxHighlighter
      {...rest}
      PreTag="div"
      children={String(children)}
      language={match[1]}
      useInlineStyles={false}
      // style={hljsStyle}
    />
  ) : (
    <code {...rest} className={className}>
      {children}
    </code>
  );
};

function ChatAssistantMessageItem(props: { message: ChatAssistantMessage }) {
  const { message } = props;

  return (
    <div className={messageItemStyle}>
      <Markdown components={{ code }}>{message.text}</Markdown>
      {message.usage && (
        <div
          style={{
            padding: '6px',
            backgroundColor: 'var(--vscode-notifications-background)',
            borderRadius: '4px',
            marginTop: '8px',
          }}
        >
          {message.usage}
        </div>
      )}
    </div>
  );
}

const ChatMessageItem = memo(function ChatMessageItem(props: {
  message: ChatMessage;
}) {
  const { message } = props;

  if (message.type === 'user') {
    return <ChatUserMessageItem message={message} />;
  } else if (message.type === 'assistant') {
    return <ChatAssistantMessageItem message={message} />;
  }

  return null;
});

export default function ChatMessageList() {
  const { history, current } = useChatStore();

  const historyItems = useMemo(() => {
    return (
      <>
        {history.map((message) => (
          <ChatMessageItem key={message.id} message={message} />
        ))}
      </>
    );
  }, [history]);

  let currentItem: React.ReactNode;
  if (current) {
    if (current.text) {
      currentItem = <ChatMessageItem key={current.id} message={current} />;
    } else {
      currentItem = (
        <div>
          <RefreshCw
            size={16}
            style={{
              animation: 'spin 2s linear infinite',
            }}
          />
        </div>
      );
    }
  }

  return (
    <ScrollArea style={{ padding: '1rem', flexGrow: 1 }} disableX>
      <div style={{ lineHeight: '1.6' }}>
        {historyItems}
        {currentItem}
      </div>
      <div style={{ minHeight: '50vh' }}></div>
    </ScrollArea>
  );
}
