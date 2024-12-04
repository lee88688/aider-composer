import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './vscode.ts';
import { showErrorMessage, webviewReady } from './commandApi.ts';
import useSettingStore, {
  apiSetting,
  settingHydratedPromise,
} from './stores/useSettingStore.ts';
import useExtensionStore from './stores/useExtensionStore.ts';

// default to welcome page
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

async function main() {
  await webviewReady();

  await settingHydratedPromise;

  const setting = useSettingStore.getState().getCurrentSetting();
  if (!setting) {
    showErrorMessage('Model setting first.');
    useExtensionStore.setState({ viewType: 'setting' });
  } else {
    await apiSetting(setting);
    useExtensionStore.setState({ viewType: 'chat' });
  }
}

main();
