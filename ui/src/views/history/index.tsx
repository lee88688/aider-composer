import { VSCodeButton } from '@vscode/webview-ui-toolkit/react';
import { Trash2 } from 'lucide-react';
import { List, ListItem } from '../../components/list';
import { setChatSession, useChatSessionStore } from '../../stores/useChatStore';
import ScrollArea from '../../components/scrollArea';
import useExtensionStore from '../../stores/useExtensionStore';
import { css } from '@emotion/css';

const historyStyle = css({
  padding: '12px',
  display: 'flex',
  flexDirection: 'column',
  height: '100%',

  '.header': {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexShrink: 0,
  },

  '.title': {
    margin: '10px 0',
    fontSize: 'calc(var(--vscode-font-size) * 1.5)',
  },

  '.listHeader': {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  '.listBody': {
    whiteSpace: 'pre-wrap',
    lineHeight: '1.5',
    maxHeight: '6em',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    position: 'relative',
    wordBreak: 'break-word',
  },
});

export default function History() {
  const sessions = useChatSessionStore((state) => state.sessions);
  const deleteChatSession = useChatSessionStore((state) => state.deleteSession);

  return (
    <div className={historyStyle}>
      <div className="header">
        <h1 className="title">History</h1>
        <VSCodeButton
          onClick={() => useExtensionStore.setState({ viewType: 'chat' })}
        >
          Done
        </VSCodeButton>
      </div>
      <ScrollArea style={{ flex: 1 }} disableX>
        <List>
          {sessions.map((session) => (
            <ListItem
              style={{ position: 'relative', marginBottom: '10px' }}
              key={session.id}
              onClick={() => {
                setChatSession(session.id).then(() => {
                  useExtensionStore.setState({ viewType: 'chat' });
                });
              }}
            >
              <div className="listHeader">
                {new Date(session.time).toLocaleString()}
                <VSCodeButton
                  appearance="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteChatSession(session.id);
                  }}
                >
                  <Trash2 size={16} />
                </VSCodeButton>
              </div>
              <div className="listBody">{session.title}</div>
            </ListItem>
          ))}
        </List>
      </ScrollArea>
    </div>
  );
}
