import * as vscode from 'vscode';
import VscodeReactView from './webViewProvider';
import { DiffContentProviderId } from './types';
import AiderChatService from './aiderChatService';

let outputChannel: vscode.LogOutputChannel;

// 添加一个新的 TextDocumentContentProvider 类
class DiffContentProvider implements vscode.TextDocumentContentProvider {
  provideTextDocumentContent(uri: vscode.Uri): string {
    return Buffer.from(uri.query, 'base64').toString('utf-8');
  }
}

let aiderChatService: AiderChatService | undefined;

export function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel('Aider Composer', {
    log: true,
  });
  outputChannel.info('Extension "aider-composer" is now active!');

  const webviewProvider = new VscodeReactView(context, outputChannel);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      VscodeReactView.viewType,
      webviewProvider,
      { webviewOptions: { retainContextWhenHidden: true } },
    ),
  );

  // diff content provider
  const diffProvider = new DiffContentProvider();
  const providerRegistration =
    vscode.workspace.registerTextDocumentContentProvider(
      DiffContentProviderId,
      diffProvider,
    );
  context.subscriptions.push(providerRegistration);

  // add button click
  context.subscriptions.push(
    vscode.commands.registerCommand('aider-composer.AddButtonClick', () => {
      outputChannel.info('Add button clicked!');
      webviewProvider.newChat();
    }),
  );

  // setting button click
  context.subscriptions.push(
    vscode.commands.registerCommand('aider-composer.SettingButtonClick', () => {
      outputChannel.info('Setting button clicked!');
      webviewProvider.setViewType('setting');
    }),
  );

  // history button click
  context.subscriptions.push(
    vscode.commands.registerCommand('aider-composer.HistoryButtonClick', () => {
      outputChannel.info('History button clicked!');
      webviewProvider.setViewType('history');
    }),
  );

  // confirm modify
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'aider-composer.ConfirmModify',
      async (uri: vscode.Uri, group: unknown) => {
        outputChannel.info(`ConfirmModify: ${uri.path}`);

        const modifiedContent = Buffer.from(uri.query, 'base64');
        const fileUri = vscode.Uri.file(uri.path);

        try {
          await vscode.workspace.fs.writeFile(fileUri, modifiedContent);
        } catch (error) {
          vscode.window.showErrorMessage(`Error writing file: ${error}`);
          outputChannel.error(`Error writing file: ${error}`);
        }

        await vscode.commands.executeCommand(
          'workbench.action.closeActiveEditor',
        );

        vscode.window.showInformationMessage(
          `path: ${uri.path} modified content is written`,
        );
      },
    ),
  );

  // current editor changed
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (!editor) {
        return;
      }

      webviewProvider.currentEditorChanged(editor);
    }),
  );

  const aiderChatService = new AiderChatService(context, outputChannel);

  aiderChatService.onStarted = () => {
    vscode.commands.executeCommand(
      'setContext',
      'aider-composer.Started',
      true,
    );
    webviewProvider.serverStarted(`http://127.0.0.1:${aiderChatService.port}`);
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
      webviewProvider.currentEditorChanged(activeEditor);
    }
  };

  // Add configuration change listener
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      // Check if our extension's config was changed
      if (event.affectsConfiguration('aider-composer')) {
        if (event.affectsConfiguration('aider-composer.pythonPath')) {
          const config = vscode.workspace.getConfiguration('aider-composer');
          const newPythonPath = config.get('pythonPath');
          outputChannel.debug(`Python path changed to: ${newPythonPath}`);

          aiderChatService.restart();
        }
      }
    }),
  );

  aiderChatService.start();

  outputChannel.show();
}

export function deactivate() {
  outputChannel.info('Extension "aider-composer" is now deactive!');
  aiderChatService?.stop();
}
