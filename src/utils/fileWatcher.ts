import Disposables from './disposables';
import * as vscode from 'vscode';

export interface FileWatcherEvent {
  type: 'create' | 'change' | 'delete';
  uri: vscode.Uri;
}

export interface FileWatcherOptions {
  ignoreCreateEvents?: boolean;
  ignoreChangeEvents?: boolean;
  ignoreDeleteEvents?: boolean;
}

export default class FileWatcher extends Disposables {
  private watcher?: vscode.FileSystemWatcher;
  private readonly onFileChangeEmitter =
    new vscode.EventEmitter<FileWatcherEvent>();

  constructor(
    private readonly globPattern: string | vscode.RelativePattern,
    private readonly options: FileWatcherOptions = {},
  ) {
    super();
    this.disposables.push(this.onFileChangeEmitter);
    this.startWatching();
  }

  public readonly onFileChange = this.onFileChangeEmitter.event;

  private startWatching() {
    this.watcher = vscode.workspace.createFileSystemWatcher(
      this.globPattern,
      this.options.ignoreCreateEvents,
      this.options.ignoreChangeEvents,
      this.options.ignoreDeleteEvents,
    );

    // Watch file creation events
    this.disposables.push(
      this.watcher.onDidCreate((uri) => {
        this.onFileChangeEmitter.fire({ type: 'create', uri });
      }),
    );

    // Watch file change events
    this.disposables.push(
      this.watcher.onDidChange((uri) => {
        this.onFileChangeEmitter.fire({ type: 'change', uri });
      }),
    );

    // Watch file deletion events
    this.disposables.push(
      this.watcher.onDidDelete((uri) => {
        this.onFileChangeEmitter.fire({ type: 'delete', uri });
      }),
    );

    // Add watcher to disposables
    this.disposables.push(this.watcher);
  }
}
