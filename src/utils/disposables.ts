import * as vscode from 'vscode';

export default class Disposables {
  protected disposables: vscode.Disposable[] = [];

  public dispose = () => {
    while (this.disposables.length) {
      const disposable = this.disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  };
}
