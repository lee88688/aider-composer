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
  '& h1': {
    fontSize: '1.25rem',
    fontWeight: 'bold',
    lineHeight: '1.25',
    margin: '0.5rem 0',
  },
  '& h2': {
    fontSize: '1.25rem',
    fontWeight: 'bold',
    lineHeight: '1.25',
    margin: '0.5rem 0',
  },
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
  '& .hljs': {
    backgroundColor: 'transparent',
  },
});

function ChatUserMessageItem(props: { message: ChatUserMessage }) {
  const { message } = props;

  return (
    <div
      className={messageItemStyle}
      style={{
        backgroundColor: 'var(--vscode-input-background)',
        borderRadius: '4px',
        padding: '4px',
        marginBottom: '16px',
        whiteSpace: 'pre-wrap',
      }}
    >
      {message.reflected ? (
        message.displayText
      ) : (
        <Markdown>{message.displayText}</Markdown>
      )}
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

function ChatAssistantMessageItem(props: {
  message: ChatAssistantMessage;
  useComponents?: boolean;
}) {
  const { message, useComponents = true } = props;

  return (
    <div className={messageItemStyle}>
      <Markdown components={useComponents ? { code } : undefined}>
        {message.text}
      </Markdown>
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
  useComponents?: boolean;
}) {
  const { message, useComponents } = props;

  if (message.type === 'user') {
    return <ChatUserMessageItem message={message} />;
  } else if (message.type === 'assistant') {
    return (
      <ChatAssistantMessageItem
        message={message}
        useComponents={useComponents}
      />
    );
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
      currentItem = (
        // current may change very fast, so use components may cause performance issue
        <ChatMessageItem
          key={current.id}
          message={current}
          useComponents={false}
        />
      );
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
