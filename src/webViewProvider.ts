import { nanoid } from 'nanoid';
import {
  CancellationToken,
  Disposable,
  Uri,
  Webview,
  WebviewView,
  WebviewViewProvider,
  WebviewViewResolveContext,
} from 'vscode';
import * as vscode from 'vscode';
import * as path from 'path';
import fsPromise from 'fs/promises';
import { getUri } from './utils/getUri';
import { getNonce } from './utils/getNonce';
import { isProductionMode } from './utils/isProductionMode';
import { DiffViewManager } from './diffView';
import GenerateCodeManager from './generateCode/generateCodeManager';

class VscodeReactView implements WebviewViewProvider {
  public static readonly viewType = 'aider-composer.SidebarProvider';
  private disposables: Disposable[] = [];

  private view?: WebviewView;

  setupPromise: Promise<void>;
  private setupResolve: () => void = () => {};
  private isReady = false;

  private pendingMessages: any[] = [];

  private serverUrl: string = '';

  constructor(
    private readonly context: vscode.ExtensionContext,
    private outputChannel: vscode.LogOutputChannel,
    private diffViewManager: DiffViewManager,
    private generateCodeManager: GenerateCodeManager,
  ) {
    this.setupPromise = new Promise((resolve) => {
      this.setupResolve = () => {
        this.isReady = true;
        for (const message of this.pendingMessages) {
          this.view?.webview.postMessage(message);
        }
        this.pendingMessages = [];
        resolve();

        this.setupResolve = () => {};
      };
    });

    this.disposables.push(
      generateCodeManager.onDidChangeCurrentGeneration((generation) => {
        const uri = vscode.Uri.parse(generation.uri);
        this.postMessageToWebview({
          command: 'generate-code',
          data: {
            ...generation,
            id: nanoid(),
            type: 'snippet',
            name: `${path.basename(uri.fsPath)}(${generation.codeRange[0]}-${generation.codeRange[1]})`,
            content: generation.code,
            language: generation.language,
            fsPath: uri.fsPath,
            path: path.relative(this.getFileBasePath(uri), uri.fsPath),
          },
        });
      }),

      diffViewManager.onDidChange((change) => {
        this.postMessageToWebview({
          command: 'diff-view-change',
          data: {
            type: change.type,
            path: path.relative(
              this.getFileBasePath(vscode.Uri.file(change.path)),
              change.path,
            ),
            name: path.basename(change.path),
            fsPath: change.path,
          },
        });
      }),

      vscode.commands.registerTextEditorCommand(
        'aider-composer.InsertIntoChat',
        async (editor: vscode.TextEditor) => {
          const selection = editor.selection;
          const uri = editor.document.uri;

          await vscode.commands.executeCommand(
            'workbench.view.extension.aider-composer-activitybar',
          );

          if (!selection.isEmpty) {
            const text = editor.document.getText(selection);
            this.postMessageToWebview({
              command: 'insert-into-chat',
              data: {
                id: nanoid(),
                type: 'snippet',
                name: `${path.basename(uri.fsPath)}(${selection.start.line + 1}-${selection.end.line + 1})`,
                content: text,
                language: editor.document.languageId,
                fsPath: uri.fsPath,
                path: path.relative(this.getFileBasePath(uri), uri.fsPath),
                codeRange: [selection.start.line + 1, selection.end.line + 1],
              },
            });
          }
        },
      ),
    );
  }

  public resolveWebviewView(
    webviewView: WebviewView,
    _context: WebviewViewResolveContext,
    _token: CancellationToken,
  ) {
    this.view = webviewView;

    this.view.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri],
    };

    this.view.webview.html = this.getHtmlForWebview(this.view.webview);
    this.setWebviewMessageListener(this.view.webview);
  }

  /**
   * Cleans up and disposes of webview resources when the webview panel is closed.
   */
  public dispose() {
    while (this.disposables.length) {
      const disposable = this.disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }

  private getHtmlForWebview(webview: Webview) {
    const file = 'src/main.tsx';
    const localPort = '5173';
    const localServerUrl = `127.0.0.1:${localPort}`;

    // The CSS file from the React build output
    const stylesUri = getUri(webview, this.context.extensionUri, [
      'dist-ui',
      'assets',
      'index.css',
    ]);

    let scriptUri;
    const isProd = isProductionMode(this.context);
    if (isProd) {
      scriptUri = getUri(webview, this.context.extensionUri, [
        'dist-ui',
        'assets',
        'index.js',
      ]);
    } else {
      scriptUri = `http://${localServerUrl}/${file}`;
    }

    const nonce = getNonce();

    const reactRefresh = /*html*/ `
        <script type="module">
          import RefreshRuntime from "http://127.0.0.1:5173/@react-refresh"
          RefreshRuntime.injectIntoGlobalHook(window)
          window.$RefreshReg$ = () => {}
          window.$RefreshSig$ = () => (type) => type
          window.__vite_plugin_react_preamble_installed__ = true
        </script>`;

    // const reactRefreshHash =
    //   "sha256-YmMpkm5ow6h+lfI3ZRp0uys+EUCt6FOyLkJERkfVnTY=";

    const csp = [
      `default-src 'none';`,
      `script-src 'unsafe-eval' https://* ${
        isProd
          ? `'nonce-${nonce}'`
          : // 这里的hash是计算的什么代码的hash？
            // : `http://${localServerUrl} http://0.0.0.0:${localPort} '${reactRefreshHash}'`
            `http://${localServerUrl} http://0.0.0.0:${localPort} 'unsafe-inline'`
      }`,
      `style-src ${webview.cspSource} 'self' 'unsafe-inline' https://*`,
      `font-src ${webview.cspSource} http://127.0.0.1:*`,
      `connect-src https://* ${
        isProd
          ? `http://127.0.0.1:*`
          : `ws://${localServerUrl} http://127.0.0.1:*`
      }`,
    ];

    return /*html*/ `<!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta http-equiv="Content-Security-Policy" content="${csp.join(
            '; ',
          )}">
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <link rel="stylesheet" type="text/css" href="${stylesUri}">
          <title>VSCode React Starter</title>
        </head>
        <body>
          <div id="root"></div>
          ${isProd ? '' : reactRefresh}
          <script type="module" src="${scriptUri}"></script>
        </body>
      </html>`;
  }

  postMessageToWebview(data: any) {
    if (!this.isReady) {
      this.pendingMessages.push(data);
      return;
    }
    this.view?.webview.postMessage(data);
  }

  /**
   * Sets up an event listener to listen for messages passed from the webview context and
   * executes code based on the message that is recieved.
   *
   * @param webview A reference to the extension webview
   * @param context A reference to the extension context
   */
  private setWebviewMessageListener(webview: Webview) {
    webview.onDidReceiveMessage(
      async (message: any) => {
        const command = message.command;
        const data = message.data;

        let promise: Promise<any> | any;
        switch (command) {
          case 'webview-ready':
            promise = this.webviewReady();
            break;
          case 'search-file':
            promise = this.findFile(data);
            break;
          case 'write-file':
            promise = this.writeFile(data);
            break;
          case 'log-to-output':
            promise = this.logToOutput(data);
            break;
          case 'get-opened-files':
            promise = this.getOpenedFiles();
            break;
          case 'show-error-message':
            promise = this.showErrorMessage(data);
            break;
          case 'show-info-message':
            promise = this.showInfoMessage(data);
            break;
          // accept/reject file
          case 'accept-file':
            promise = this.acceptFile(data.path);
            break;
          case 'reject-file':
            promise = this.rejectFile(data.path);
            break;
          // generate code
          case 'cancel-generate-code':
            promise = this.cancelGenerateCode();
            break;
          case 'accept-generate-code':
            promise = this.acceptGenerateCode();
            break;
          case 'reject-generate-code':
            promise = this.rejectGenerateCode();
            break;
          // store state
          case 'set-global-state':
            promise = this.setGlobalState(data);
            break;
          case 'get-global-state':
            promise = this.getGlobalState(data);
            break;
          case 'delete-global-state':
            promise = this.deleteGlobalState(data);
            break;
          case 'set-workspace-state':
            promise = this.setWorkspaceState(data);
            break;
          case 'get-workspace-state':
            promise = this.getWorkspaceState(data);
            break;
          case 'delete-workspace-state':
            promise = this.deleteWorkspaceState(data);
            break;
          case 'set-secret-state':
            promise = this.setSecretState(data);
            break;
          case 'get-secret-state':
            promise = this.getSecretState(data);
            break;
          case 'delete-secret-state':
            promise = this.deleteSecretState(data);
            break;
          // Add more switch case statements here as more webview message commands
          // are created within the webview context (i.e. inside media/main.js)
        }
        const result = await promise;
        this.postMessageToWebview({
          id: message.id,
          command: 'result',
          data: result,
        });
      },
      undefined,
      this.disposables,
    );
  }

  private async webviewReady() {
    this.setupResolve();
    if (this.isReady && this.serverUrl) {
      this.postMessageToWebview({
        command: 'server-started',
        data: this.serverUrl,
      });
    }
  }

  private async acceptFile(path: string) {
    return this.diffViewManager.acceptFile(path);
  }

  private async rejectFile(path: string) {
    return this.diffViewManager.rejectFile(path);
  }

  private async cancelGenerateCode() {
    return this.generateCodeManager.clearCurrentGeneration();
  }

  private async acceptGenerateCode() {
    await this.diffViewManager.acceptAllFile();
    return this.generateCodeManager.clearCurrentGeneration();
  }

  private async rejectGenerateCode() {
    await this.diffViewManager.rejectAllFile();
    return this.generateCodeManager.clearCurrentGeneration();
  }

  private async setSecretState(data: { key: string; value: any }) {
    return this.context.secrets.store(data.key, data.value);
  }

  private async getSecretState(data: { key: string }) {
    return this.context.secrets.get(data.key);
  }

  private async deleteSecretState(data: { key: string }) {
    return this.context.secrets.delete(data.key);
  }

  private async setWorkspaceState(data: { key: string; value: any }) {
    return this.context.workspaceState.update(data.key, data.value);
  }

  private async deleteWorkspaceState(data: { key: string }) {
    return this.context.workspaceState.update(data.key, undefined);
  }

  private async getWorkspaceState(data: { key: string }) {
    return this.context.workspaceState.get(data.key);
  }

  private async getGlobalState(data: { key: string }) {
    return this.context.globalState.get(data.key);
  }

  private async setGlobalState(data: { key: string; value: any }) {
    return this.context.globalState.update(data.key, data.value);
  }

  private async deleteGlobalState(data: { key: string }) {
    return this.context.globalState.update(data.key, undefined);
  }

  private async showErrorMessage(data: { message: string }) {
    vscode.window.showErrorMessage(data.message);
  }

  private async showInfoMessage(data: { message: string }) {
    vscode.window.showInformationMessage(data.message);
  }

  private async logToOutput(data: {
    type: 'info' | 'warn' | 'error';
    message: string;
  }) {
    this.outputChannel[data.type](`From Webview: ${data.message}`);
  }

  private async getOpenedFiles() {
    const basePathSet = new Set<string>();
    const allTabs = vscode.window.tabGroups.all.flatMap((group) => group.tabs);

    return allTabs
      .filter((tab) => {
        const uri = (tab.input as any)?.uri;
        return uri?.scheme === 'file';
      })
      .map((tab) => {
        const uri = (tab.input as any).uri as vscode.Uri;
        let basePath;
        for (const path of basePathSet) {
          if (uri.fsPath.startsWith(path)) {
            basePath = path;
            break;
          }
        }

        if (!basePath) {
          basePath = this.getFileBasePath(uri);
          basePathSet.add(basePath);
        }

        return {
          id: uri.fsPath,
          type: 'file',
          name: path.basename(uri.fsPath),
          basePath: basePath,
          path: path.relative(basePath, uri.fsPath),
          fsPath: uri.fsPath,
        };
      });
  }

  private async writeFile(data: { path: string; content: string }) {
    this.outputChannel.info(`command write file: ${data.path}`);
    return this.diffViewManager.openDiffView(data);
  }

  private getFileBasePath(fileUri: vscode.Uri) {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(fileUri);
    return workspaceFolder?.uri.fsPath ?? '';
  }

  private findFile(data: { query: string; limit?: number }) {
    const { query, limit = 20 } = data;

    const basePathSet = new Set<string>();

    const ignore = ['**/{node_modules,__pycache__}'];
    return vscode.workspace
      .findFiles(`**/*${query}*`, ignore.join(','), limit)
      .then((files) => {
        return files.map((item) => {
          let basePath;
          for (const path in basePathSet) {
            if (item.fsPath.startsWith(path)) {
              basePath = path;
              break;
            }
          }
          if (!basePath) {
            basePath = this.getFileBasePath(item);
            basePathSet.add(basePath);
          }

          const relativePath = basePath
            ? path.relative(basePath, item.fsPath)
            : item.fsPath;
          return {
            id: item.fsPath,
            type: 'file',
            name: path.basename(item.fsPath),
            basePath,
            path: relativePath,
            fsPath: item.fsPath,
          };
        });
      });
  }

  setViewType(viewType: 'chat' | 'setting' | 'history') {
    this.postMessageToWebview({
      id: nanoid(),
      command: 'set-view-type',
      data: viewType,
    });
  }

  newChat() {
    this.postMessageToWebview({
      id: nanoid(),
      command: 'new-chat',
    });
  }

  currentEditorChanged(editor: vscode.TextEditor) {
    if (editor.document.uri.scheme !== 'file') {
      return;
    }

    const uri = editor.document.uri;
    const basePath = this.getFileBasePath(uri);
    this.postMessageToWebview({
      id: nanoid(),
      command: 'current-editor-changed',
      data: {
        id: uri.fsPath,
        type: 'file',
        name: path.basename(uri.fsPath),
        basePath,
        path: path.relative(basePath, uri.fsPath),
        fsPath: uri.fsPath,
      },
    });
  }

  serverStarted(url: string) {
    this.outputChannel.info(`server started: ${url}`);
    this.serverUrl = url;
    this.postMessageToWebview({
      id: nanoid(),
      command: 'server-started',
      data: url,
    });
  }
}

export default VscodeReactView;
