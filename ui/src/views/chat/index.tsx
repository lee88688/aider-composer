import ChatMessageList from './chatMessageList';
import ChatTextArea from './chatTextArea';
// react-syntax-highlighter 's highlight.js version is not same as package.json
// here we just use style code.
import './codeTheme.scss';

export function Chat() {
  return (
    <div
      style={{
        position: 'relative',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        alignItems: 'stretch',
      }}
    >
      <ChatMessageList />
      <ChatTextArea />
    </div>
  );
}
