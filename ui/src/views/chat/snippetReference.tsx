import SyntaxHighlighter from 'react-syntax-highlighter';
import { ChatReferenceSnippetItem } from '../../types';
import { css } from '@emotion/css';

const snippetReferenceStyle = css({
  backgroundColor: 'var(--vscode-editor-background)',
  borderRadius: '4px',
  padding: '4px',
  margin: '0',
});

export function SnippetReference(props: { snippet: ChatReferenceSnippetItem }) {
  const { snippet } = props;

  return (
    <SyntaxHighlighter
      className={snippetReferenceStyle}
      language={snippet.language}
      useInlineStyles={false}
    >
      {snippet.content}
    </SyntaxHighlighter>
  );
}
