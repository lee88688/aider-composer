import ScrollArea from '../../components/scrollArea';
import { useChatStore } from '../../stores/useChatStore';
import { SnippetReference } from './snippetReference';

export function ChatReferenceItemPreview() {
  const generateCodeSnippet = useChatStore(
    (state) => state.generateCodeSnippet,
  );
  return (
    <ScrollArea>
      {generateCodeSnippet && (
        <SnippetReference snippet={generateCodeSnippet} />
      )}
    </ScrollArea>
  );
}
