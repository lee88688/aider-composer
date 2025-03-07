import { DiffViewManager } from './index';
import * as vscode from 'vscode';
import * as fsPromise from 'fs/promises';
import path from 'path';
import { diffLines } from 'diff';

type RemovedChange = {
  type: 'removed';
  line: number;
  count: number;
  value: string;
};

type AddedChange = {
  type: 'added';
  line: number;
  count: number;
  value: string;
};

type Change =
  | RemovedChange
  | AddedChange
  | {
      type: 'modified';
      removed: RemovedChange;
      added: AddedChange;
    };

// add TextDocumentContentProvider class
class DiffContentProvider implements vscode.TextDocumentContentProvider {
  provideTextDocumentContent(uri: vscode.Uri): string {
    return Buffer.from(uri.query, 'base64').toString('utf-8');
  }
}

export class DiffEditorViewManager
  extends DiffViewManager
  implements vscode.CodeLensProvider
{
  static readonly DiffContentProviderId = 'aider-diff';

  // uri -> content
  private fileChangeMap = new Map<
    string,
    {
      originalContent: string;
      modifiedContent: string;
      changes: Change[];
    }
  >();

  private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

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
      this._onDidChangeCodeLenses,
      vscode.languages.registerCodeLensProvider([{ scheme: 'file' }], this),

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

          this.fileChangeMap.delete(uri.toString());
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
          this.fileChangeMap.delete(document.uri.toString());
          this._onDidChange.fire({
            type: 'reject',
            path: document.uri.fsPath,
          });
        }
      }),
    );
  }

  async provideCodeLenses(
    document: vscode.TextDocument,
  ): Promise<vscode.CodeLens[]> {
    const fileUri = document.uri;
    const fileChange = this.fileChangeMap.get(fileUri.toString());
    if (!fileChange) {
      return [];
    }

    console.log('codelens', document.uri);

    const codeLenses: vscode.CodeLens[] = [];

    for (let i = 0; i < fileChange.changes.length; i++) {
      const change = fileChange.changes[i];

      const line = change.type === 'modified' ? change.added.line : change.line;
      const count =
        change.type === 'modified' ? change.added.count : change.count;

      const range = new vscode.Range(
        new vscode.Position(line, 0),
        new vscode.Position(line, 0),
      );

      codeLenses.push(
        new vscode.CodeLens(range, {
          title: 'Accept',
          command: 'aider-composer.AcceptChange',
          arguments: [document.uri.toString(), i],
        }),
        new vscode.CodeLens(range, {
          title: 'Reject',
          command: 'aider-composer.RejectChange',
          arguments: [document.uri.toString(), i],
        }),
      );
    }

    return codeLenses;
  }

  async openDiffView(data: { path: string; content: string }): Promise<void> {
    this.outputChannel.info(`command write file: ${data.path}`);

    let isNewFile = false;
    try {
      await fsPromise.access(data.path, fsPromise.constants.R_OK);
    } catch (error) {
      isNewFile = true;
    }

    const uri = vscode.Uri.file(data.path);
    let originalContent = '';
    if (this.fileChangeMap.has(uri.toString())) {
      const fileChange = this.fileChangeMap.get(uri.toString())!;
      originalContent = fileChange.originalContent;
    } else {
      originalContent = await vscode.workspace.fs
        .readFile(vscode.Uri.file(data.path))
        .then((buffer) => Buffer.from(buffer).toString('utf-8'));
    }

    const modifiedContent = data.content;
    const differences = diffLines(originalContent, modifiedContent);

    let lineNumber = 0;
    const changes: Change[] = [];
    let lastRemoved: RemovedChange | undefined;

    for (const part of differences) {
      let currentChange: Change | undefined;

      if (part.removed) {
        lastRemoved = {
          type: 'removed',
          line: lineNumber,
          count: part.count!,
          value: part.value,
        };
        // the last removed part should not wait for the next added part
        if (part === differences[differences.length - 1]) {
          currentChange = lastRemoved;
        }
      } else if (part.added) {
        const added: AddedChange = {
          type: 'added',
          line: lineNumber,
          count: part.count!,
          value: part.value,
        };
        if (lastRemoved) {
          currentChange = {
            type: 'modified',
            removed: lastRemoved,
            added,
          };
          lastRemoved = undefined;
        } else {
          currentChange = added;
        }
        lineNumber += part.count!;
      } else {
        if (lastRemoved) {
          currentChange = lastRemoved;
          lastRemoved = undefined;
        }
        lineNumber += part.count!;
      }

      if (currentChange) {
        changes.push(currentChange);
      }
    }

    try {
      const originalUri = isNewFile
        ? vscode.Uri.parse(
            `${DiffEditorViewManager.DiffContentProviderId}:${data.path}`,
          ).with({
            query: Buffer.from('').toString('base64'),
          })
        : vscode.Uri.parse(
            `${DiffEditorViewManager.DiffContentProviderId}:${data.path}`,
          ).with({
            query: Buffer.from(originalContent).toString('base64'),
          });

      const modifiedUri = vscode.Uri.file(data.path); // .with({ query: 'isDiff' });

      await vscode.workspace.fs.writeFile(
        modifiedUri,
        Buffer.from(modifiedContent),
      );

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
          renderSideBySide: true,
        },
      );
    } catch (error) {
      this.outputChannel.error(`Error opening diff: ${error}`);
    }

    this.fileChangeMap.set(uri.toString(), {
      originalContent: originalContent,
      modifiedContent: modifiedContent,
      changes: changes,
    });

    this._onDidChange.fire({
      type: 'add',
      path: data.path,
    });
  }

  private getChangeIndex(
    editor: vscode.TextEditor,
    fileChange: { changes: Change[] },
  ): number {
    // get change index from cursor position
    const position = editor.selection.active;
    const line = position.line;

    for (let i = 0; i < fileChange.changes.length; i++) {
      const change = fileChange.changes[i];
      if (change.type === 'added') {
        if (line >= change.line && line < change.line + change.count) {
          return i;
        }
      } else if (change.type === 'removed') {
        // the line is already removed, so just one line
        if (line >= change.line && line < change.line + 1) {
          return i;
        }
      } else {
        if (
          line >= change.added.line &&
          line < change.added.line + change.added.count
        ) {
          return i;
        }
      }
    }

    return -1;
  }

  private async applyChange(
    uri: string,
    fileChange: { changes: Change[] },
    index: number,
    isAccept: boolean,
  ) {
    if (!isAccept) {
      const edit = new vscode.WorkspaceEdit();
      const document = await vscode.workspace.openTextDocument(uri);
    }
    fileChange.changes.splice(index, 1);
  }

  private async acceptChange(uri: string, i?: number) {
    this.outputChannel.debug(`Accept change: ${uri}, ${i}`);

    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.uri.toString() !== uri) {
      return;
    }

    const fileChange = this.fileChangeMap.get(uri);
    if (!fileChange) {
      return;
    }

    let index: number;
    if (typeof i === 'number') {
      index = i;
    } else {
      index = this.getChangeIndex(editor, fileChange);
      if (index === -1) {
        return;
      }
    }

    fileChange.changes.splice(index, 1);

    if (fileChange.changes.length === 0) {
      this.fileChangeMap.delete(uri);
      await this.closeDiffEditor(uri);
    }
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
    this.fileChangeMap.clear();
  }

  async acceptAllFile(): Promise<void> {
    for (const [uri, content] of this.fileChangeMap.entries()) {
      await vscode.workspace.fs.writeFile(
        vscode.Uri.parse(uri),
        Buffer.from(''),
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
    this.fileChangeMap.delete(targetUri);
  }

  async acceptFile(path: string): Promise<void> {
    const uri = vscode.Uri.file(path);
    const content = this.fileChangeMap.get(uri.toString());

    if (content) {
      await vscode.workspace.fs.writeFile(uri, Buffer.from(''));
      await this.closeDiffEditor(path);
    }
  }

  async rejectFile(path: string): Promise<void> {
    await this.closeDiffEditor(path);
  }
}
