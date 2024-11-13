import { VSCodeButton } from '@vscode/webview-ui-toolkit/react';
import { Trash2 } from 'lucide-react';
import { List, ListItem } from '../../components/list';
import { setChatSession, useChatSessionStore } from '../../stores/useChatStore';
import ScrollArea from '../../components/scrollArea';
import useExtensionStore from '../../stores/useExtensionStore';

export default function History() {
  const sessions = useChatSessionStore((state) => state.sessions);
  const deleteChatSession = useChatSessionStore((state) => state.deleteSession);

  return (
    <div
      style={{
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <h1
          style={{
            margin: '10px 0',
            fontSize: 'calc(var(--vscode-font-size) * 1.5)',
          }}
        >
          History
        </h1>
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
              style={{ position: 'relative' }}
              key={session.id}
              onClick={() => {
                setChatSession(session.id).then(() => {
                  useExtensionStore.setState({ viewType: 'chat' });
                });
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
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
              {session.title}
            </ListItem>
          ))}
        </List>
      </ScrollArea>
    </div>
  );
}
