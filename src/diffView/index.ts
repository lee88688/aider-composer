import * as vscode from 'vscode';

export abstract class DiffViewManager {
  protected disposables: vscode.Disposable[] = [];

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
  abstract acceptAllCode(): Promise<void>;

  // reject all code generate by aider
  abstract rejectAllCode(): Promise<void>;
}
