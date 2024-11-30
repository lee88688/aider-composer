import * as vscode from 'vscode';

type DiffViewChange =
  | {
      type: 'add';
      path: string;
    }
  | {
      type: 'accept' | 'reject';
      /** file path, URI.fsPath */
      path: string;
    };

export abstract class DiffViewManager {
  protected disposables: vscode.Disposable[] = [];
  protected _onDidChange = new vscode.EventEmitter<DiffViewChange>();
  readonly onDidChange = this._onDidChange.event;

  constructor() {
    this.disposables.push(this._onDidChange);
  }

  public dispose = () => {
    while (this.disposables.length) {
      const disposable = this.disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  };

  abstract openDiffView(data: { path: string; content: string }): Promise<void>;

  // accept all code generate by aider
  abstract acceptAllFile(): Promise<void>;

  // reject all code generate by aider
  abstract rejectAllFile(): Promise<void>;

  // accept a file
  abstract acceptFile(path: string): Promise<void>;

  // reject a file
  abstract rejectFile(path: string): Promise<void>;
}
