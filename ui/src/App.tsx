import useExtensionStore from './stores/useExtensionStore';
import './app.scss';
import { Chat } from './views/chat';
import Setting from './views/setting';
import Welcome from './views/welcome';
import History from './views/history';

function App() {
  const extensionState = useExtensionStore();

  let view;

  switch (extensionState.viewType) {
    case 'chat':
      view = <Chat />;
      break;
    case 'setting':
      view = <Setting />;
      break;
    case 'welcome':
      view = <Welcome />;
      break;
    case 'history':
      view = <History />;
      break;
    default:
      view = null;
  }

  return <>{view}</>;
}

export default App;
