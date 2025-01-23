import Disposables from '../utils/disposables';
import FileWatcher from '../utils/fileWatcher';
import * as path from 'path';
import fs from 'fs/promises';
import { parse } from 'yaml';
import * as vscode from 'vscode';

interface AiderConfig {
  /** Whether to lint and fix provided files, or dirty files if none provided */
  lint?: boolean;

  /** Specify lint commands to run for different languages */
  lintCmd?: string | string[];

  /** Enable/disable automatic linting after changes */
  autoLint?: boolean;

  /** Specify command to run tests */
  testCmd?: string;

  /** Enable/disable automatic testing after changes */
  autoTest?: boolean;

  /** Run tests, fix problems found and then exit */
  test?: boolean;
}

export default class ConfigFileManager extends Disposables {
  private fileWatcher: FileWatcher;
  private _config: AiderConfig;

  constructor(private cwd: string) {
    super();
    this._config = {};
    this.fileWatcher = new FileWatcher(path.join(cwd, '.aider.conf.yml'));

    this.disposables.push(this.fileWatcher);

    this.fileWatcher.onFileChange(() => {
      this.loadConfig();
    });
  }

  public get config() {
    return this._config;
  }

  private loadConfig = async () => {
    const configFile = path.join(this.cwd, '.aider.conf.yml');

    try {
      await fs.access(configFile, fs.constants.R_OK);
    } catch (error) {
      this._config = {};
      return;
    }

    const config = await fs.readFile(configFile, 'utf8');

    try {
      this._config = parse(config) as AiderConfig;
    } catch (error) {
      vscode.window.showErrorMessage(
        'Failed to parse .aider.conf.yml, please check the file for syntax errors',
      );
    }
  };
}
