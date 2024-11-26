import * as vscode from 'vscode';
import Disposables from '../utils/disposables';

interface CurrentGeneration {
  uri: string;
  line: number;
  code: string;
  // line and count
  codeRange: readonly [number, number];
  language?: string;
}

export default class GenerateCodeManager extends Disposables {
  private currentGeneration?: CurrentGeneration;

  private generateLineDecorationType: vscode.TextEditorDecorationType;

  private _onDidChangeCurrentGeneration =
    new vscode.EventEmitter<CurrentGeneration>();
  readonly onDidChangeCurrentGeneration =
    this._onDidChangeCurrentGeneration.event;

  constructor(private outputChannel: vscode.LogOutputChannel) {
    super();

    this.generateLineDecorationType =
      vscode.window.createTextEditorDecorationType({
        backgroundColor: '#7a715c',
        isWholeLine: true,
      });

    this.disposables.push(
      this.generateLineDecorationType,
      vscode.commands.registerCommand('aider-composer.GenerateCode', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          return;
        }

        const currentLine = editor.selection.active.line;
        const lineRange = new vscode.Range(currentLine, 0, currentLine, 0);

        editor.setDecorations(this.generateLineDecorationType, [lineRange]);

        const result = this.findUniqueCodeLines(editor.document, currentLine);
        this.currentGeneration = {
          uri: editor.document.uri.toString(),
          line: currentLine,
          code: editor.document.getText(
            new vscode.Range(result[0], 0, result[1], 0),
          ),
          codeRange: result,
          language: editor.document.languageId,
        };

        this._onDidChangeCurrentGeneration.fire(this.currentGeneration);

        this.outputChannel.debug(
          `Command 'aider-composer.GenerateCode' triggered at line ${currentLine}`,
        );
      }),
    );
  }

  private findUniqueCodeLines(document: vscode.TextDocument, line: number) {
    const MIN_CODE_LENGTH = 4;
    const eol = document.eol === vscode.EndOfLine.LF ? '\n' : '\r\n';
    const text = document.getText();

    const currentLine = document.lineAt(line).text.trim();
    if (currentLine.length >= MIN_CODE_LENGTH) {
      const index = text.indexOf(currentLine);
      // current line is unique
      if (text.indexOf(currentLine, index + 1) === -1) {
        return [line, 1] as const;
      }
    }

    let nextLine = line - 1;
    while (nextLine >= 0) {
      const nextLineText = document.lineAt(nextLine).text;
      const nextLineTextTrimmed = nextLineText.trim();
      if (nextLineTextTrimmed.length >= MIN_CODE_LENGTH) {
        const lines = [];
        for (let i = nextLine; i <= line; i++) {
          lines.push(document.lineAt(i).text);
        }
        const combinedText = lines.join(eol);
        const index = text.indexOf(combinedText);
        // lines are unique
        if (text.indexOf(combinedText, index + 1) === -1) {
          return [nextLine, line - nextLine + 1] as const;
        }
        nextLine--;
      }
    }

    return [0, line] as const;
  }

  clearCurrentGeneration() {
    if (this.currentGeneration) {
      const editor = vscode.window.activeTextEditor;
      if (
        editor &&
        editor.document.uri.toString() === this.currentGeneration.uri
      ) {
        editor.setDecorations(this.generateLineDecorationType, []);
      }
      this.currentGeneration = undefined;
    }
  }
}
