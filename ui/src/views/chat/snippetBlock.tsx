import { SnippetReference } from './snippetReference';
import { ChatReferenceSnippetItem } from '../../types';

const snippet: ChatReferenceSnippetItem = {
  type: 'snippet',
  name: 'Hello, world!',
  language: 'typescript',
  content: 'console.log("Hello, world!");',
};

export function SnippetBlock() {
  return <SnippetReference snippet={snippet} />;
}
