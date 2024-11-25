import { SnippetReference } from './snippetReference';
import { SnippetItem } from '../../types';

const snippet: SnippetItem = {
  type: 'snippet',
  name: 'Hello, world!',
  language: 'typescript',
  content: 'console.log("Hello, world!");',
};

export function SnippetBlock() {
  return <SnippetReference snippet={snippet} />;
}
