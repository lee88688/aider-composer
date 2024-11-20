import { DiffViewManager } from './index';
import * as vscode from 'vscode';
import { diffLines } from 'diff';
import LineEditor from '../utils/lineEditor';

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

export class InlineDiffViewManager
  extends DiffViewManager
  implements vscode.CodeLensProvider
{
  private deletionDecorationType: vscode.TextEditorDecorationType;
  private insertionDecorationType: vscode.TextEditorDecorationType;

  private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

  private fileChangeMap = new Map<
    string,
    {
      originalContent: string;
      modifiedContent: string;
      changes: Change[];
    }
  >();

  constructor(
    private context: vscode.ExtensionContext,
    private outputChannel: vscode.LogOutputChannel,
  ) {
    super();

    // Set initial context value
    vscode.commands.executeCommand(
      'setContext',
      'aider-composer.hasChanges',
      false,
    );

    this.deletionDecorationType = vscode.window.createTextEditorDecorationType({
      backgroundColor: '#3e1c26',
      isWholeLine: true,
    });

    this.insertionDecorationType = vscode.window.createTextEditorDecorationType(
      {
        backgroundColor: '#1c3422',
        isWholeLine: true,
      },
    );

    this.disposables.push(
      this.deletionDecorationType,
      this.insertionDecorationType,

      vscode.workspace.onDidCloseTextDocument((doc) => {
        if (doc.uri.scheme === 'file') {
          const uri = doc.uri.toString();
          if (!this.fileChangeMap.has(uri)) {
            return;
          }

          this.fileChangeMap.delete(uri);
          this.outputChannel.debug(
            `Cleaned up decorations for ${doc.uri.fsPath}`,
          );
        }
      }),

      vscode.languages.registerCodeLensProvider({ scheme: 'file' }, this),
      this._onDidChangeCodeLenses,

      // accept command
      vscode.commands.registerCommand(
        'aider-composer.AcceptChange',
        (uri, change) => {
          this.acceptChange(uri, change);
        },
      ),
      // reject command
      vscode.commands.registerCommand(
        'aider-composer.RejectChange',
        (uri, change) => {
          this.rejectChange(uri, change);
        },
      ),

      // accept all command
      vscode.commands.registerCommand(
        'aider-composer.AcceptAllChanges',
        (uri) => {
          this.acceptAllChanges(uri);
        },
      ),
      // reject all command
      vscode.commands.registerCommand(
        'aider-composer.RejectAllChanges',
        (uri) => {
          this.rejectAllChanges(uri);
        },
      ),

      // 添加活动编辑器变化的监听
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor && editor.document.uri.scheme === 'file') {
          const uri = editor.document.uri.toString();
          const fileChange = this.fileChangeMap.get(uri);
          // 设置 context 基于当前编辑器是否有更改
          vscode.commands.executeCommand(
            'setContext',
            'aider-composer.hasChanges',
            fileChange !== undefined && fileChange.changes.length > 0,
          );
          if (fileChange) {
            this.drawChanges(editor, fileChange);
          }
        } else {
          vscode.commands.executeCommand(
            'setContext',
            'aider-composer.hasChanges',
            false,
          );
        }
      }),
    );
  }

  async provideCodeLenses(
    document: vscode.TextDocument,
  ): Promise<vscode.CodeLens[]> {
    const uri = document.uri.toString();
    const fileChange = this.fileChangeMap.get(uri);
    if (!fileChange) {
      return [];
    }

    const codeLenses: vscode.CodeLens[] = [];

    for (let i = 0; i < fileChange.changes.length; i++) {
      const change = fileChange.changes[i];

      const line =
        change.type === 'modified' ? change.removed.line : change.line;

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

  private drawChanges(
    editor: vscode.TextEditor,
    fileChange: { changes: Change[] },
    index?: number,
    count?: number,
  ) {
    // if has index and count, it means we need to delete a change
    if (index !== undefined && count !== undefined) {
      for (let i = index + 1; i < fileChange.changes.length; i++) {
        const change = fileChange.changes[i];
        if (change.type === 'modified') {
          change.removed.line -= count;
          change.added.line -= count;
        } else {
          change.line -= count;
        }
      }
      fileChange.changes.splice(index, 1);
    }

    // update decorations from changes
    let deletions: vscode.DecorationOptions[] = [];
    let insertions: vscode.DecorationOptions[] = [];
    for (const change of fileChange.changes) {
      if (change.type === 'removed') {
        deletions.push({
          range: new vscode.Range(
            new vscode.Position(change.line, 0),
            new vscode.Position(change.line + change.count - 1, 0),
          ),
        });
      } else if (change.type === 'added') {
        insertions.push({
          range: new vscode.Range(
            new vscode.Position(change.line, 0),
            new vscode.Position(change.line + change.count - 1, 0),
          ),
        });
      } else {
        deletions.push({
          range: new vscode.Range(
            new vscode.Position(change.removed.line, 0),
            new vscode.Position(
              change.removed.line + change.removed.count - 1,
              0,
            ),
          ),
        });
        insertions.push({
          range: new vscode.Range(
            new vscode.Position(change.added.line, 0),
            new vscode.Position(change.added.line + change.added.count - 1, 0),
          ),
        });
      }
    }

    editor.setDecorations(this.deletionDecorationType, deletions);
    editor.setDecorations(this.insertionDecorationType, insertions);

    this._onDidChangeCodeLenses.fire();
  }

  private async acceptChange(uri: string, index: number) {
    this.outputChannel.debug(`Accept change: ${uri}, ${index}`);

    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.uri.toString() !== uri) {
      return;
    }

    const fileChange = this.fileChangeMap.get(uri);
    if (!fileChange) {
      return;
    }

    const change = fileChange.changes[index];

    let range: vscode.Range;
    let value = '';
    let count = 0;
    if (change.type === 'removed') {
      range = new vscode.Range(
        new vscode.Position(change.line, 0),
        new vscode.Position(change.line + change.count, 0),
      );
      count = change.count;
    } else if (change.type === 'added') {
      // change is already extracted
      count = 0;
    } else {
      // add is below the delete, change add don't change line number of delete part
      range = new vscode.Range(
        new vscode.Position(change.removed.line, 0),
        new vscode.Position(change.added.line + change.added.count, 0),
      );
      value = change.added.value;
      count = change.removed.count;
    }

    if (count !== 0) {
      await editor.edit((edit) => {
        edit.replace(range, value);
      });
    }

    this.drawChanges(editor, fileChange, index, count);

    // Check if there are any remaining changes
    if (fileChange.changes.length === 0) {
      vscode.commands.executeCommand(
        'setContext',
        'aider-composer.hasChanges',
        false,
      );
    }
  }

  private async rejectChange(uri: string, index: number) {
    this.outputChannel.debug(`Reject change: ${uri}, ${index}`);

    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.uri.toString() !== uri) {
      return;
    }

    const fileChange = this.fileChangeMap.get(uri);
    if (!fileChange) {
      return;
    }

    const change = fileChange.changes[index];

    let range: vscode.Range;
    let value = '';
    let count = 0;
    if (change.type === 'removed') {
      count = 0;
    } else if (change.type === 'added') {
      range = new vscode.Range(
        new vscode.Position(change.line, 0),
        new vscode.Position(change.line + change.count, 0),
      );
      count = change.count;
    } else if (change.type === 'modified') {
      range = new vscode.Range(
        new vscode.Position(change.removed.line, 0),
        new vscode.Position(change.added.line + change.added.count, 0),
      );
      value = change.removed.value;
      count = change.added.count;
    }

    if (count !== 0) {
      await editor.edit((edit) => {
        edit.replace(range, value);
      });
    }

    this.drawChanges(editor, fileChange, index, count);
  }

  private async acceptAllChanges(uri: vscode.Uri) {
    this.outputChannel.debug(`Accept all changes: ${uri}`);

    const fileChange = this.fileChangeMap.get(uri.toString());
    if (!fileChange) {
      return;
    }

    const editor = await vscode.window.showTextDocument(uri);
    const edit = new vscode.WorkspaceEdit();
    const range = new vscode.Range(
      new vscode.Position(0, 0),
      new vscode.Position(editor.document.lineCount, 0),
    );
    edit.replace(editor.document.uri, range, fileChange.modifiedContent);
    await vscode.workspace.applyEdit(edit);
  }

  private async rejectAllChanges(uri: vscode.Uri) {
    this.outputChannel.debug(`Reject all changes: ${uri}`);

    const fileChange = this.fileChangeMap.get(uri.toString());
    if (!fileChange) {
      return;
    }

    const editor = await vscode.window.showTextDocument(uri);
    const edit = new vscode.WorkspaceEdit();
    const range = new vscode.Range(
      new vscode.Position(0, 0),
      new vscode.Position(editor.document.lineCount, 0),
    );
    edit.replace(editor.document.uri, range, fileChange.originalContent);
    await vscode.workspace.applyEdit(edit);
  }

  async openDiffView(data: { path: string; content: string }): Promise<void> {
    try {
      const document = await vscode.workspace.openTextDocument(data.path);
      const editor = await vscode.window.showTextDocument(document, {
        preview: false,
        preserveFocus: true,
      });

      const lineEol =
        vscode.EndOfLine.CRLF === editor.document.eol ? '\r\n' : '\n';
      const modifiedContent = data.content.replace(/\r?\n/g, lineEol);

      const uri = editor.document.uri.toString();

      const currentContent = editor.document.getText();

      const differences = diffLines(currentContent, modifiedContent);

      let lineNumber = 0;

      // combine original and modified content
      let combineContent = '';

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
        } else if (lastRemoved) {
          currentChange = lastRemoved;
          lastRemoved = undefined;
        }

        if (currentChange) {
          changes.push(currentChange);
        }

        combineContent += part.value;
        lineNumber += part.count!;
      }

      const edit = new vscode.WorkspaceEdit();
      const range = new vscode.Range(
        new vscode.Position(0, 0),
        new vscode.Position(editor.document.lineCount, 0),
      );
      edit.replace(editor.document.uri, range, combineContent);
      await vscode.workspace.applyEdit(edit);

      const fileChange = {
        originalContent: currentContent,
        modifiedContent: modifiedContent,
        changes: changes,
      };
      this.fileChangeMap.set(uri, fileChange);

      // Update context when changes exist
      vscode.commands.executeCommand(
        'setContext',
        'aider-composer.hasChanges',
        true,
      );

      this.drawChanges(editor, fileChange);

      this.outputChannel.debug(`Applied inline diff for ${data.path}`);
    } catch (error) {
      this.outputChannel.error(`Error applying inline diff: ${error}`);
      throw error;
    }
  }
}
