import Disposables from '../utils/disposables';
import * as vscode from 'vscode';
import Fuse from 'fuse.js';
import path from 'path';
import { globby } from 'globby';

const normalIgnore = ['**/node_modules', '**/.git', '**/__pycache__'];

export default class FileListManager extends Disposables {
  private fileList: { path: string; fsPath: string; basePath: string }[] = [];
  private fuse?: Fuse<{ path: string; fsPath: string; basePath: string }>;

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

  private initFuse() {
    this.fuse = new Fuse(this.fileList, {
      ignoreLocation: true,
      includeScore: true,
      keys: ['path'],
    });
  }

  get canSearch() {
    return this.fileList.length > 0;
  }

  async scanFiles(cwd: string) {
    if (this.fileList.length === 0) {
      const files = await globby(['**/*'], {
        ignore: normalIgnore,
        gitignore: true,
        cwd: cwd,
      });
      this.fileList = files.map((file) => ({
        path: file,
        fsPath: path.join(cwd, file),
        basePath: cwd,
      }));
      this.initFuse();
    }
    return this.fileList;
  }

  async searchFiles(query: string, limit = 20) {
    return (
      this.fuse?.search(query, { limit }).map((result) => result.item) ?? []
    );
  }
}
