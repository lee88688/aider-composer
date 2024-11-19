import { DiffViewManager } from './index';
import * as vscode from 'vscode';
import * as fsPromise from 'fs/promises';
import path from 'path';

export class DiffEditorViewManager extends DiffViewManager {
  static readonly DiffContentProviderId = 'aider-diff';

  constructor(
    private context: vscode.ExtensionContext,
    private outputChannel: vscode.LogOutputChannel,
  ) {
    super();
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
  }
}
