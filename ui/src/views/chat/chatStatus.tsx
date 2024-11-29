import { RefreshCw, CircleX, Check, X, RotateCcw } from 'lucide-react';
import { VSCodeButton } from '@vscode/webview-ui-toolkit/react';
import { useChatStore } from '../../stores/useChatStore';
import { ReactNode } from 'react';
import { css } from '@emotion/css';
import { acceptGenerateCode, rejectGenerateCode } from '../../commandApi';

const statusLine = css({
  display: 'flex',
  alignItems: 'center',
  gap: '4px',

  '& .empty': {
    flex: 1,
  },
});

export function ChatStatus() {
  const isGenerating = useChatStore((state) => Boolean(state.current));
  const isGeneratingCode = useChatStore((state) =>
    Boolean(state.generateCodeSnippet && state.generateCodeSnippet),
  );

  const cancelChat = useChatStore((state) => state.cancelChat);
  const acceptCode = () => {
    acceptGenerateCode();
  };
  const rejectCode = () => {
    rejectGenerateCode();
  };

  const regenerateCode = () => {};

  let status: ReactNode;
  if (isGenerating) {
    status = (
      <div className={statusLine}>
        <RefreshCw
          size={16}
          style={{
            animation: 'spin 2s linear infinite',
          }}
        />
        <span>Generating...</span>
        <div className="empty"></div>
        <VSCodeButton appearance="icon" title="Cancel" onClick={cancelChat}>
          <CircleX size={16} />
        </VSCodeButton>
      </div>
    );
  } else if (isGeneratingCode) {
    status = (
      <div className={statusLine}>
        <span>Generate Complete</span>
        <div className="empty"></div>
        <VSCodeButton
          appearance="icon"
          title="ReGenerate"
          onClick={regenerateCode}
        >
          <RotateCcw size={16} />
        </VSCodeButton>
        <VSCodeButton appearance="icon" title="Accept" onClick={acceptCode}>
          <Check size={16} />
        </VSCodeButton>
        <VSCodeButton appearance="icon" title="Reject" onClick={rejectCode}>
          <X size={16} />
        </VSCodeButton>
      </div>
    );
  }

  return <div>{status}</div>;
}
