import { spawn, ChildProcess } from 'node:child_process';
import * as fsPromise from 'node:fs/promises';
import * as path from 'node:path';
import * as readline from 'node:readline';
import * as vscode from 'vscode';
import { isProductionMode } from './utils/isProductionMode';
import { EventSourceParserStream } from 'eventsource-parser/stream';
import { createEventSource } from 'eventsource-client';

export default class AiderChatService {
  private aiderChatProcess: ChildProcess | undefined;
  private isDev = false;

  port: number = 0;

  onStarted: () => void = () => {};
  onError: (error: Error) => void = () => {};

  constructor(
    private context: vscode.ExtensionContext,
    private outputChannel: vscode.LogOutputChannel,
  ) {
    this.isDev = !isProductionMode(context);
  }

  private async pythonFilePathFinder(pythonPath: string) {
    const executableNames =
      process.platform === 'win32' ? ['python.exe'] : ['python', 'python3'];

    try {
      const fileOrDir = await fsPromise.stat(pythonPath);
      if (fileOrDir.isFile()) {
        const file = path.basename(pythonPath);
        if (executableNames.includes(file)) {
          return pythonPath;
        } else {
          pythonPath = path.dirname(pythonPath);
        }
      }
      // python path is a file
    } catch (e) {
      // continue
    }

    for (const executableName of executableNames) {
      const filePath = path.join(pythonPath, executableName);
      try {
        await fsPromise.access(filePath, fsPromise.constants.X_OK);
        return filePath;
      } catch (e) {
        // continue
      }
    }
  }

  async start() {
    this.outputChannel.info('Starting aider-chat service...');

    if (!isProductionMode(this.context)) {
      this.port = 5000;
      this.onStarted();
      return;
    }

    const config = vscode.workspace.getConfiguration('aider-composer');
    const pythonPath = config.get('pythonPath') as string;
    if (!pythonPath) {
      this.outputChannel.info(
        'Python path is not set, skip starting aider-chat service.',
      );
      vscode.window.showErrorMessage(
        'Python path is not set, please set it in vscode settings.',
      );
      return Promise.reject();
    }

    const pythonPathFile = await this.pythonFilePathFinder(pythonPath);
    if (!pythonPathFile) {
      this.outputChannel.error(
        'Python path does not include python executable, skip starting aider-chat service.',
      );
      vscode.window.showErrorMessage(
        'Python path does not include python executable, please set it in vscode settings.',
      );
      return Promise.reject();
    }

    const folders = vscode.workspace.workspaceFolders;
    if (!folders) {
      this.outputChannel.warn(
        'No workspace folders found, skip starting aider-chat service.',
      );
      vscode.window.showWarningMessage(
        'No workspace folders found, skip starting aider-chat service.',
      );
      return Promise.reject();
    }

    if (folders.length > 1) {
      this.outputChannel.warn(
        'Multiple workspace folders found, skip starting aider-chat service.',
      );
      vscode.window.showWarningMessage(
        'Current only support single workspace folder.',
      );

      return Promise.reject();
    }

    const folderPath = folders[0].uri.fsPath;

    return vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Starting aider-chat service...',
        cancellable: false,
      },
      async () => {
        const randomPort = Math.floor(Math.random() * 10000) + 10000;

        const env = { ...process.env };

        const httpConfig = vscode.workspace.getConfiguration('http');
        const proxy = httpConfig.get<string>('proxy');
        const proxyStrictSSL = httpConfig.get<boolean>('proxyStrictSSL');
        if (proxy) {
          env.HTTP_PROXY = proxy;
          env.HTTPS_PROXY = proxy;
          env.HTTPX_PROXY = proxy;
        }
        if (proxyStrictSSL === false) {
          env.SSL_VERIFY = 'false';
        }

        return new Promise<void>((resolve, reject) => {
          const aiderChatProcess = spawn(
            pythonPathFile,
            [
              '-m',
              'flask',
              '-A',
              path.join(this.context.extensionUri.fsPath, 'server/main.py'),
              'run',
              '--port',
              randomPort.toString(),
            ],
            {
              cwd: folderPath,
              env,
            },
          );

          this.outputChannel.info(
            'aider-chat process args:',
            aiderChatProcess.spawnargs.join(' '),
          );

          this.aiderChatProcess = aiderChatProcess;

          const timer = setTimeout(() => {
            this.stop();
            const timeoutMessage = 'aider-chat service start timeout';
            this.outputChannel.error(timeoutMessage);
            vscode.window.showErrorMessage(timeoutMessage);
            reject(new Error(timeoutMessage));
          }, 1000 * 60);

          aiderChatProcess.on('error', (err) => {
            this.outputChannel.error(`aider-chat: ${err}`);
            reject(err);
          });

          aiderChatProcess.on('close', () => {
            this.outputChannel.error('aider-chat service closed');
            reject(new Error('aider-chat service closed'));
          });

          aiderChatProcess.on('exit', (code, signal) => {
            clearTimeout(timer);
            this.outputChannel.error(
              `aider-chat service exited with code ${code} and signal ${signal}`,
            );
            reject(
              new Error(
                `aider-chat service exited with code ${code} and signal ${signal}`,
              ),
            );
          });

          if (aiderChatProcess.stderr) {
            const rl = readline.createInterface({
              input: aiderChatProcess.stderr,
            });

            let isRunning = false;
            rl.on('line', (line) => {
              this.outputChannel.info(`aider-chat: ${line}`);
              if (
                !isRunning &&
                line.includes(`Running on http://127.0.0.1:${randomPort}`)
              ) {
                isRunning = true;
                this.port = randomPort;
                this.onStarted();
                clearTimeout(timer);
                resolve();
              }
            });
          }

          if (aiderChatProcess.stdout) {
            const rl = readline.createInterface({
              input: aiderChatProcess.stdout,
            });

            rl.on('line', (line) => {
              this.outputChannel.debug(`aider-chat: ${line}`);
            });
          }
        });
      },
    );
  }

  restart() {
    this.outputChannel.info('Restarting aider-chat service...');
    this.stop();
    this.start();
  }

  stop() {
    this.outputChannel.info('Stopping aider-chat service...');
    this.aiderChatProcess?.kill();
    this.aiderChatProcess = undefined;
  }

  get serviceUrl() {
    return `http://127.0.0.1:${this.port}`;
  }

  async apiChat(
    payload: unknown,
    chunkCallback: (data: { name?: string; data: unknown }) => void,
  ) {
    const res = await fetch(`${this.serviceUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const stream = res.body
      ?.pipeThrough(new TextDecoderStream())
      .pipeThrough(new EventSourceParserStream());

    if (!stream) {
      return;
    }

    // eventsource-client has reconnect logic and it can't be cancelled
    // const stream = createEventSource({
    //   url: `${this.serviceUrl}/api/chat`,
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify(payload),
    // });

    try {
      for await (const event of stream) {
        if (this.isDev) {
          console.log('chunk', event);
        }
        chunkCallback({
          name: event.event,
          data:
            typeof event.data === 'string' && event.data
              ? JSON.parse(event.data)
              : event.data,
        });
        if (event.event === 'end' || event.event === 'error') {
          break;
        }
      }
    } catch (e) {
      console.error(e);
      chunkCallback({
        name: 'error',
        data: {
          error: `${e}`,
        },
      });
    }
    // stream.close();
  }

  async apiClearChat() {
    await fetch(`${this.serviceUrl}/api/chat`, {
      method: 'DELETE',
    });
  }

  async apiSaveSession(payload: unknown) {
    await fetch(`${this.serviceUrl}/api/chat/session`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  }

  async apiChatSetting(payload: unknown) {
    await fetch(`${this.serviceUrl}/api/chat/setting`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  }
}
