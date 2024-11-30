import { DiffViewManager } from './index';
import * as vscode from 'vscode';
import * as fsPromise from 'fs/promises';
import path from 'path';

// add TextDocumentContentProvider class
class DiffContentProvider implements vscode.TextDocumentContentProvider {
  provideTextDocumentContent(uri: vscode.Uri): string {
    return Buffer.from(uri.query, 'base64').toString('utf-8');
  }
}

export class DiffEditorViewManager extends DiffViewManager {
  static readonly DiffContentProviderId = 'aider-diff';

  // uri -> content
  private fileChangeSet = new Map<string, string>();

  constructor(
    private context: vscode.ExtensionContext,
    private outputChannel: vscode.LogOutputChannel,
  ) {
    super();

    // diff content provider
    const diffProvider = new DiffContentProvider();
    const providerRegistration =
      vscode.workspace.registerTextDocumentContentProvider(
        DiffEditorViewManager.DiffContentProviderId,
        diffProvider,
      );

    this.disposables.push(
      providerRegistration,
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

          this.fileChangeSet.delete(uri.toString());
          this._onDidChange.fire({
            type: 'accept',
            path: fileUri.fsPath,
          });

          await vscode.commands.executeCommand(
            'workbench.action.closeActiveEditor',
          );

          this.outputChannel.debug(
            `path: ${uri.path} modified content is written`,
          );
          vscode.window.showInformationMessage(
            `path: ${uri.path} modified content is written`,
          );
        },
      ),

      vscode.workspace.onDidCloseTextDocument((document) => {
        if (
          document.uri.scheme === DiffEditorViewManager.DiffContentProviderId
        ) {
          this.outputChannel.debug(
            `Diff document closed for: ${document.uri.path}`,
          );
          this.fileChangeSet.delete(document.uri.toString());
          this._onDidChange.fire({
            type: 'reject',
            path: document.uri.fsPath,
          });
        }
      }),
    );
  }

  async openDiffView(data: { path: string; content: string }): Promise<void> {
    this.outputChannel.info(`command write file: ${data.path}`);

    let isNewFile = false;
    try {
      await fsPromise.access(data.path, fsPromise.constants.R_OK);
    } catch (error) {
      isNewFile = true;
    }

    try {
      const originalUri = isNewFile
        ? vscode.Uri.parse(
            `${DiffEditorViewManager.DiffContentProviderId}:${data.path}`,
          ).with({
            query: Buffer.from('').toString('base64'),
          })
        : vscode.Uri.file(data.path);
      const modifiedUri = vscode.Uri.parse(
        `${DiffEditorViewManager.DiffContentProviderId}:${data.path}`,
      ).with({
        query: Buffer.from(data.content).toString('base64'),
      });

      const name = path.basename(data.path);

      // open diff editor
      await vscode.commands.executeCommand(
        'vscode.diff',
        originalUri,
        modifiedUri,
        `${name} ${isNewFile ? 'Created' : 'Modified'}`,
        {
          viewColumn: vscode.ViewColumn.Two,
          preview: false,
        },
      );
    } catch (error) {
      this.outputChannel.error(`Error opening diff: ${error}`);
    }

    this.fileChangeSet.set(vscode.Uri.file(data.path).toString(), data.content);
    this._onDidChange.fire({
      type: 'add',
      path: data.path,
    });
  }

  // close all diff editor with DiffContentProviderId
  private async closeAllDiffEditor(): Promise<void> {
    // Find all tab groups
    const tabGroups = vscode.window.tabGroups.all;

    for (const group of tabGroups) {
      // Find tabs that match our diff URI scheme
      const diffTabs = group.tabs.filter(
        (tab) =>
          tab.input instanceof vscode.TabInputTextDiff &&
          tab.input.modified.scheme ===
            DiffEditorViewManager.DiffContentProviderId,
      );

      // Close the matching tabs
      if (diffTabs.length > 0) {
        await vscode.window.tabGroups.close(diffTabs);
      }
    }

    // Clear the file change set after closing all editors
    this.fileChangeSet.clear();
  }

  async acceptAllFile(): Promise<void> {
    for (const [uri, content] of this.fileChangeSet.entries()) {
      await vscode.workspace.fs.writeFile(
        vscode.Uri.parse(uri),
        Buffer.from(content),
      );
    }
    await this.closeAllDiffEditor();
  }

  async rejectAllFile(): Promise<void> {
    await this.closeAllDiffEditor();
  }

  private async closeDiffEditor(path: string): Promise<void> {
    // Find all tab groups
    const tabGroups = vscode.window.tabGroups.all;
    const targetUri = vscode.Uri.file(path).toString();

    for (const group of tabGroups) {
      // Find tabs that match our diff URI scheme and the specified path
      const diffTabs = group.tabs.filter(
        (tab) =>
          tab.input instanceof vscode.TabInputTextDiff &&
          tab.input.modified.scheme ===
            DiffEditorViewManager.DiffContentProviderId &&
          tab.input.modified.path === path,
      );

      // Close the matching tabs
      if (diffTabs.length > 0) {
        await vscode.window.tabGroups.close(diffTabs);
      }
    }

    // Remove the file from the change set
    this.fileChangeSet.delete(targetUri);
  }

  async acceptFile(path: string): Promise<void> {
    const uri = vscode.Uri.file(path);
    const content = this.fileChangeSet.get(uri.toString());

    if (content) {
      await vscode.workspace.fs.writeFile(uri, Buffer.from(content));
      await this.closeDiffEditor(path);
    }
  }

  async rejectFile(path: string): Promise<void> {
    await this.closeDiffEditor(path);
  }
}
