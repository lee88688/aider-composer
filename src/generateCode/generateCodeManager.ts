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
      vscode.commands.registerTextEditorCommand(
        'aider-composer.GenerateCode',
        async (editor: vscode.TextEditor) => {
          const currentLine = editor.selection.active.line;

          const result = this.findUniqueCodeLines(editor.document, currentLine);
          const [startLine, count] = result;
          this.currentGeneration = {
            uri: editor.document.uri.toString(),
            line: currentLine,
            code: editor.document.getText(
              new vscode.Range(startLine, 0, startLine + count, 0),
            ),
            codeRange: [startLine, count + startLine],
            language: editor.document.languageId,
          };

          this.drawDecoration(editor);

          await vscode.commands.executeCommand(
            'workbench.view.extension.aider-composer-activitybar',
          );

          this._onDidChangeCurrentGeneration.fire(this.currentGeneration);

          this.outputChannel.debug(
            `Command 'aider-composer.GenerateCode' triggered at line ${currentLine}`,
          );
        },
      ),

      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (
          editor &&
          editor.document.uri.toString() === this.currentGeneration?.uri
        ) {
          this.drawDecoration(editor);
        }
      }),
    );
  }

  private drawDecoration(editor: vscode.TextEditor) {
    if (this.currentGeneration) {
      const lineRange = new vscode.Range(
        this.currentGeneration.line,
        0,
        this.currentGeneration.line,
        0,
      );
      editor.setDecorations(this.generateLineDecorationType, [lineRange]);
    }
  }

  // return [startLine, count]
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

    let preLine = line - 1;
    while (preLine >= 0) {
      const preLineText = document.lineAt(preLine).text;
      const preLineTextTrimmed = preLineText.trim();
      if (preLineTextTrimmed.length >= MIN_CODE_LENGTH) {
        const lines = [];
        for (let i = preLine; i <= line; i++) {
          lines.push(document.lineAt(i).text);
        }
        const combinedText = lines.join(eol);
        const index = text.indexOf(combinedText);
        // lines are unique
        if (text.indexOf(combinedText, index + 1) === -1) {
          return [preLine, line - preLine + 1] as const;
        }
        preLine--;
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
