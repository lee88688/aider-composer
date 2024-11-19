import { DiffViewManager } from './index';
import * as vscode from 'vscode';
import { diffLines } from 'diff';
import LineEditor from '../utils/lineEditor';

type RemovedChange = {
  type: 'removed';
  originalLine: number;
  modifiedLine: number;
  count: number;
  value: string;
};

type AddedChange = {
  type: 'added';
  originalLine: number;
  modifiedLine: number;
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
      originalEditor: LineEditor;
      changes: Change[];
    }
  >();

  constructor(
    private context: vscode.ExtensionContext,
    private outputChannel: vscode.LogOutputChannel,
  ) {
    super();

    // fixme
    // current only support all code in the editor
    // do not support decoration in multiple lines
    this.deletionDecorationType = vscode.window.createTextEditorDecorationType({
      backgroundColor: new vscode.ThemeColor(
        'diffEditor.removedTextBackground',
      ),
      isWholeLine: true,
      after: {
        margin: '0 0 0 1em',
        textDecoration: 'line-through',
      },
    });

    this.insertionDecorationType = vscode.window.createTextEditorDecorationType(
      {
        backgroundColor: new vscode.ThemeColor(
          'diffEditor.insertedTextBackground',
        ),
        isWholeLine: true,
      },
    );

    this.disposables.push(
      this.deletionDecorationType,
      this.insertionDecorationType,

      vscode.workspace.onDidChangeTextDocument((event) => {
        const uri = event.document.uri.toString();
        if (!this.fileChangeMap.has(uri)) {
          return;
        }

        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.uri.toString() !== uri) {
          return;
        }

        const changes = event.contentChanges;
        if (changes.length === 0) {
          return;
        }

        this.updateDiffChange(editor);
      }),

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

    for (const change of fileChange.changes) {
      const line =
        change.type === 'modified'
          ? change.removed.modifiedLine
          : change.modifiedLine;

      const range = new vscode.Range(
        new vscode.Position(line, 0),
        new vscode.Position(line, 0),
      );

      codeLenses.push(
        new vscode.CodeLens(range, {
          title: 'Accept',
          command: 'aider-composer.AcceptChange',
          arguments: [document.uri, change],
        }),
        new vscode.CodeLens(range, {
          title: 'Reject',
          command: 'aider-composer.RejectChange',
          arguments: [document.uri, change],
        }),
      );
    }

    return codeLenses;
  }

  private acceptChange(uri: string, change: Change) {
    this.outputChannel.debug(`Accept change: ${uri}, ${change.type}`);

    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.uri.toString() !== uri) {
      return;
    }

    const fileChange = this.fileChangeMap.get(uri);
    if (!fileChange) {
      return;
    }

    if (change.type === 'removed') {
      fileChange.originalEditor.delete(change.originalLine, change.count);
    } else if (change.type === 'added') {
      fileChange.originalEditor.add(change.modifiedLine, change.value);
    } else {
      // add is below the delete, change add don't change line number of delete part
      fileChange.originalEditor.add(
        change.added.modifiedLine,
        change.added.value,
      );
      fileChange.originalEditor.delete(
        change.removed.modifiedLine,
        change.removed.count,
      );
    }
    this.updateDiffChange(editor);
  }

  private rejectChange(uri: string, change: Change) {
    this.outputChannel.debug(`Reject change: ${uri}, ${change.type}`);

    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.uri.toString() !== uri) {
      return;
    }

    const fileChange = this.fileChangeMap.get(uri);
    if (!fileChange) {
      return;
    }

    if (change.type === 'removed') {
      editor.edit((edit) => {
        const startPos = new vscode.Position(change.modifiedLine, 0);
        // end line start with beginning which will not delete this line
        const endPos = new vscode.Position(
          change.modifiedLine + change.count,
          0,
        );

        const range = new vscode.Range(startPos, endPos);
        edit.replace(range, change.value);
      });
    } else if (change.type === 'added') {
      editor.edit((edit) => {
        const startPos = new vscode.Position(change.modifiedLine, 0);
        // end line start with beginning which will not delete this line
        const endPos = new vscode.Position(
          change.modifiedLine + change.count,
          0,
        );

        const range = new vscode.Range(startPos, endPos);
        edit.delete(range);
      });
    } else if (change.type === 'modified') {
      editor.edit((edit) => {
        const startPos = new vscode.Position(change.removed.modifiedLine, 0);
        const endPos = new vscode.Position(
          change.added.modifiedLine + change.added.count,
          0,
        );

        const range = new vscode.Range(startPos, endPos);
        edit.replace(range, change.removed.value);
      });
    }

    this.updateDiffChange(editor);
  }

  private updateDiffChange(editor: vscode.TextEditor) {
    const uri = editor.document.uri.toString();
    const fileChange = this.fileChangeMap.get(uri);
    if (!fileChange) {
      return;
    }

    const currentContent = editor.document.getText();

    const differences = diffLines(
      fileChange.originalEditor.current,
      currentContent,
    );

    let modifiedLineNumber = 0;
    let originalLineNumber = 0;
    const deletions: vscode.DecorationOptions[] = [];
    const insertions: vscode.DecorationOptions[] = [];

    const changes: Change[] = [];
    let lastRemoved: RemovedChange | undefined;

    for (const part of differences) {
      let currentChange: Change | undefined;

      if (part.removed) {
        const range = new vscode.Range(
          new vscode.Position(modifiedLineNumber, 0),
          new vscode.Position(modifiedLineNumber, 0),
        );
        deletions.push({
          range,
          renderOptions: {
            after: {
              contentText: part.value.trimEnd(),
            },
          },
        });

        lastRemoved = {
          type: 'removed',
          originalLine: originalLineNumber,
          modifiedLine: modifiedLineNumber,
          count: part.count!,
          value: part.value,
        };
        // the last removed part should not wait for the next added part
        if (part === differences[differences.length - 1]) {
          currentChange = lastRemoved;
        }
      } else if (part.added) {
        const range = new vscode.Range(
          new vscode.Position(modifiedLineNumber, 0),
          new vscode.Position(modifiedLineNumber + part.count!, 0),
        );
        insertions.push({ range });

        const added: AddedChange = {
          type: 'added',
          originalLine: originalLineNumber,
          modifiedLine: modifiedLineNumber,
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

      if (!part.removed) {
        modifiedLineNumber += part.count!;
      }

      if (!part.added) {
        originalLineNumber += part.count!;
      }
    }

    editor.setDecorations(this.deletionDecorationType, deletions);
    editor.setDecorations(this.insertionDecorationType, insertions);

    this.fileChangeMap.set(uri, {
      ...fileChange,
      changes,
    });

    this._onDidChangeCodeLenses.fire();

    // when there is no change, remove the file change
    if (changes.length === 0) {
      this.fileChangeMap.delete(uri);
    }
  }

  async openDiffView(data: { path: string; content: string }): Promise<void> {
    try {
      let editor = vscode.window.activeTextEditor;
      if (!editor || editor.document.uri.fsPath !== data.path) {
        const document = await vscode.workspace.openTextDocument(data.path);
        editor = await vscode.window.showTextDocument(document);
      }

      const lineEol =
        vscode.EndOfLine.CRLF === editor.document.eol ? '\r\n' : '\n';
      const modifiedContent = data.content.replace(/\r?\n/g, lineEol);

      const originalContent = editor.document.getText();

      const uri = editor.document.uri.toString();

      this.fileChangeMap.set(uri, {
        originalContent: originalContent,
        originalEditor: new LineEditor(originalContent, lineEol),
        changes: [],
      });

      const edit = new vscode.WorkspaceEdit();
      const range = new vscode.Range(
        new vscode.Position(0, 0),
        new vscode.Position(editor.document.lineCount, 0),
      );
      edit.replace(editor.document.uri, range, modifiedContent);
      await vscode.workspace.applyEdit(edit);

      this.outputChannel.debug(`Applied inline diff for ${data.path}`);
    } catch (error) {
      this.outputChannel.appendLine(`Error applying inline diff: ${error}`);
      throw error;
    }
  }
}
