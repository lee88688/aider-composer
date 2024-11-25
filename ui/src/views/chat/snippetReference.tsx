import SyntaxHighlighter from 'react-syntax-highlighter';
import { SnippetItem } from '../../types';
import { css } from '@emotion/css';

const snippetReferenceStyle = css({
  backgroundColor: 'var(--vscode-editor-background)',
  borderRadius: '4px',
  padding: '4px',
});

export function SnippetReference(props: { snippet: SnippetItem }) {
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
