import ScrollArea from '../../components/scrollArea';
import { useChatStore } from '../../stores/useChatStore';
import { SnippetReference } from './snippetReference';

export function ChatReferenceItemPreview() {
  const generateCodeSnippet = useChatStore(
    (state) => state.generateCodeSnippet,
  );
  const currentPreviewReference = useChatStore(
    (state) => state.currentPreviewReference,
  );
  return (
    <ScrollArea>
      {(currentPreviewReference && (
        <SnippetReference snippet={currentPreviewReference} />
      )) ||
        (generateCodeSnippet && (
          <SnippetReference snippet={generateCodeSnippet} />
        ))}
    </ScrollArea>
  );
}
