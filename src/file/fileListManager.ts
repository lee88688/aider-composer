import Disposables from '../utils/disposables';
import * as vscode from 'vscode';
import Fuse from 'fuse.js/dist/fuse.cjs';
import path from 'path';

export default class FileListManager extends Disposables {
  private fileList: { path: string; fsPath: string; basePath: string }[] = [];

  constructor() {
    super();
    this.disposables.push(
      vscode.workspace.onDidCreateFiles((e) => {
        for (const file of e.files) {
          const workspaceFolder = vscode.workspace.getWorkspaceFolder(file);
          const basePath = workspaceFolder?.uri.fsPath ?? '';
          const relativePath = path.relative(basePath, file.fsPath);
          this.fileList.push({
            path: relativePath,
            fsPath: file.fsPath,
            basePath,
          });
        }
      }),

      vscode.workspace.onDidDeleteFiles((e) => {
        for (const file of e.files) {
          const index = this.fileList.findIndex(
            (item) => item.fsPath === file.fsPath,
          );
          if (index > -1) {
            this.fileList.splice(index, 1);
          }
        }
      }),
    );
  }

  get canSearch() {
    return this.fileList.length > 0;
  }

  async scanFiles(cwd: string) {
    if (this.fileList.length === 0) {
      const { globby } = await import('globby');
      const files = await globby(['**/*'], {
        ignore: ['**/node_modules/**', '**/.git/**'],
        gitignore: true,
        absolute: true,
        cwd: cwd,
      });
      this.fileList = files.map((file) => ({
        path: file,
        fsPath: `${cwd}/${file}`,
        basePath: cwd,
      }));
    }
    return this.fileList;
  }

  async searchFiles(query: string, limit = 20) {
    const fuse = new Fuse(this.fileList, {
      threshold: 0.4,
      ignoreLocation: true,
      includeScore: true,
    });

    return fuse.search(query, { limit }).map((result) => result.item);
  }
}
