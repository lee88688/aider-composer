import { X } from 'lucide-react';
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
  const closePreviewReference = useChatStore(
    (state) => state.closePreviewReference,
  );
  const showClose = Boolean(currentPreviewReference);
  return (
    <ScrollArea
      className="hljs"
      style={{
        maxHeight: '200px',
      }}
    >
      {showClose && (
        <div style={{ minHeight: '10px' }}>
          <X
            size={12}
            style={{
              cursor: 'pointer',
              position: 'absolute',
              right: '1px',
              top: '1px',
              zIndex: 1000,
            }}
            onClick={closePreviewReference}
          />
        </div>
      )}
      {(currentPreviewReference && (
        <SnippetReference snippet={currentPreviewReference} />
      )) ||
        (generateCodeSnippet && (
          <SnippetReference snippet={generateCodeSnippet} />
        ))}
    </ScrollArea>
  );
}
