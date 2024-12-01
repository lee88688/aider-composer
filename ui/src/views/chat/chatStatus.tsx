import { RefreshCw, CircleX, Check, X, RotateCcw } from 'lucide-react';
import { VSCodeButton, VSCodeDivider } from '@vscode/webview-ui-toolkit/react';
import { useChatStore } from '../../stores/useChatStore';
import { ReactNode, useEffect } from 'react';
import { css } from '@emotion/css';
import {
  acceptFile,
  acceptGenerateCode,
  rejectFile,
  rejectGenerateCode,
} from '../../commandApi';

const statusLine = css({
  display: 'flex',
  alignItems: 'center',
  gap: '5px',

  '& .empty': {
    flex: 1,
  },
});

const fileIconColor = {
  add: 'var(--vscode-terminalCommandDecoration-defaultBackground)',
  accept: 'var(--vscode-terminalCommandDecoration-successBackground)',
  reject: 'var(--vscode-terminalCommandDecoration-errorBackground)',
};

function CircleIcon({ color = 'currentColor' }: { color?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
      fill={color}
      color={color}
    >
      <path
        fill-rule="evenodd"
        clip-rule="evenodd"
        d="M8 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm2.61-4a2.61 2.61 0 1 1-5.22 0 2.61 2.61 0 0 1 5.22 0zM8 5.246z"
      />
    </svg>
  );
}

function CircleFilledIcon({ color = 'currentColor' }: { color?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
      fill={color}
      color={color}
    >
      <path d="M8 4c.367 0 .721.048 1.063.145a3.943 3.943 0 0 1 1.762 1.031 3.944 3.944 0 0 1 1.03 1.762c.097.34.145.695.145 1.062 0 .367-.048.721-.145 1.063a3.94 3.94 0 0 1-1.03 1.765 4.017 4.017 0 0 1-1.762 1.031C8.72 11.953 8.367 12 8 12s-.721-.047-1.063-.14a4.056 4.056 0 0 1-1.765-1.032A4.055 4.055 0 0 1 4.14 9.062 3.992 3.992 0 0 1 4 8c0-.367.047-.721.14-1.063a4.02 4.02 0 0 1 .407-.953A4.089 4.089 0 0 1 5.98 4.546a3.94 3.94 0 0 1 .957-.401A3.89 3.89 0 0 1 8 4z" />
    </svg>
  );
}

export function ChatStatus() {
  const isGenerating = useChatStore((state) => Boolean(state.current));
  const isGeneratingCode = useChatStore((state) =>
    Boolean(
      state.generateCodeSnippet &&
        state.generateCodeSnippet &&
        state.currentEditFiles.length > 0,
    ),
  );

  const currentEditFiles = useChatStore((state) => state.currentEditFiles);

  const cancelGenerateCode = useChatStore((state) => state.cancelGenerateCode);
  const clearEditFile = useChatStore((state) => state.clearEditFile);
  const clearChat = useChatStore((state) => state.clearChat);

  const cancelChat = useChatStore((state) => state.cancelChat);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const acceptCode = async () => {
    await acceptGenerateCode();
    cancelGenerateCode();
    return clearChat();
  };
  const rejectCode = async () => {
    await rejectGenerateCode();
    cancelGenerateCode();
    return clearChat();
  };

  const handleRegenerateCode = async () => {
    clearEditFile();
    await rejectCode();
    await clearChat();
    // set last message to text area
  };

  const handleAcceptFile = async (path: string) => {
    await acceptFile(path);
  };

  const handleRejectFile = async (path: string) => {
    await rejectFile(path);
  };

  useEffect(() => {
    if (
      currentEditFiles.length > 0 &&
      currentEditFiles.every((file) => file.type !== 'add')
    ) {
      if (isGeneratingCode) {
        cancelGenerateCode();
      } else {
        clearEditFile();
      }
    }
  }, [cancelGenerateCode, clearEditFile, currentEditFiles, isGeneratingCode]);

  let status: ReactNode;
  // eslint-disable-next-line no-constant-condition
  if (isGenerating && false) {
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
          onClick={handleRegenerateCode}
        >
          <RotateCcw size={16} />
        </VSCodeButton>
        {/* <VSCodeButton appearance="icon" title="Accept" onClick={acceptCode}>
          <Check size={16} />
        </VSCodeButton>
        <VSCodeButton appearance="icon" title="Reject" onClick={rejectCode}>
          <X size={16} />
        </VSCodeButton> */}
      </div>
    );
  }

  return (
    <div>
      {currentEditFiles.length > 0 && (
        <>
          {currentEditFiles.map((file) => (
            <div className={statusLine} key={file.fsPath}>
              {file.type === 'add' ? (
                <CircleIcon color={fileIconColor[file.type]} />
              ) : (
                <CircleFilledIcon color={fileIconColor[file.type]} />
              )}
              <span>{file.name}</span>
              <div
                className="empty"
                style={{
                  direction: 'ltr',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {file.path}
              </div>
              <VSCodeButton
                disabled={file.type !== 'add'}
                appearance="icon"
                title="Accept"
                onClick={() => handleAcceptFile(file.fsPath)}
              >
                <Check size={16} />
              </VSCodeButton>
              <VSCodeButton
                disabled={file.type !== 'add'}
                appearance="icon"
                title="Reject"
                onClick={() => handleRejectFile(file.fsPath)}
              >
                <X size={16} />
              </VSCodeButton>
            </div>
          ))}
          <VSCodeDivider />
        </>
      )}
      {status}
    </div>
  );
}
