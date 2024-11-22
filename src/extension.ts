import * as vscode from 'vscode';
import * as fsPromises from 'fs/promises';
import VscodeReactView from './webViewProvider';
import { DiffContentProviderId } from './types';
import AiderChatService from './aiderChatService';
import { InlineDiffViewManager } from './diffView/InlineDiff';
import { DiffEditorViewManager } from './diffView/diffEditor';
import { isProductionMode } from './utils/isProductionMode';
import { DiffViewManager } from './diffView';

let outputChannel: vscode.LogOutputChannel;

let aiderChatService: AiderChatService | undefined;

export function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel('Aider Composer', {
    log: true,
  });
  outputChannel.info('Extension "aider-composer" is now active!');

  const inlineDiffEnable = vscode.workspace
    .getConfiguration('aider-composer')
    .get('inlineDiff.enable');

  let diffViewManager: DiffViewManager;
  if (inlineDiffEnable) {
    // inline diff view manager
    const inlineDiffViewManager = new InlineDiffViewManager(
      context,
      outputChannel,
    );
    context.subscriptions.push(inlineDiffViewManager);
    diffViewManager = inlineDiffViewManager;
  } else {
    // diff editor diff manager
    const diffEditorDiffManager = new DiffEditorViewManager(
      context,
      outputChannel,
    );
    context.subscriptions.push(diffEditorDiffManager);
    diffViewManager = diffEditorDiffManager;
  }

  // webview provider
  const webviewProvider = new VscodeReactView(
    context,
    outputChannel,
    diffViewManager,
  );
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      VscodeReactView.viewType,
      webviewProvider,
      { webviewOptions: { retainContextWhenHidden: true } },
    ),
    webviewProvider,
  );

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

  if (!isProductionMode(context)) {
    context.subscriptions.push(
      vscode.commands.registerCommand('aider-composer.Test', async () => {
        outputChannel.info('Test command executed!');
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          return;
        }

        const content = await fsPromises.readFile('', 'utf-8');

        inlineDiffViewManager.openDiffView({
          path: '',
          content: content,
        });
      }),
    );
  }
}

export function deactivate() {
  outputChannel.info('Extension "aider-composer" is now deactive!');
  aiderChatService?.stop();
}
