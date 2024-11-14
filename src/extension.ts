import * as vscode from 'vscode';
import WebviewProvider from './webViewProvider';
import { DocsConfig } from './types';

export function activate(context: vscode.ExtensionContext) {
    const outputChannel = vscode.window.createOutputChannel('Aider Composer', { log: true });
    const provider = new WebviewProvider(context, outputChannel);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            WebviewProvider.viewType,
            provider,
        ),
    );

    // Add command to configure docs providers
    context.subscriptions.push(
        vscode.commands.registerCommand('aider-composer.configureDocs', async () => {
            const config = vscode.workspace.getConfiguration('aider-composer');
            const currentProviders = config.get<DocsConfig[]>('docsProviders', []);

            const title = await vscode.window.showInputBox({
                prompt: 'Enter documentation title',
                placeHolder: 'e.g., React Documentation'
            });
            if (!title) return;

            const startUrl = await vscode.window.showInputBox({
                prompt: 'Enter documentation start URL',
                placeHolder: 'e.g., https://react.dev/reference/react'
            });
            if (!startUrl) return;

            const rootUrl = await vscode.window.showInputBox({
                prompt: 'Enter documentation root URL',
                placeHolder: 'e.g., https://react.dev'
            });
            if (!rootUrl) return;

            const faviconUrl = await vscode.window.showInputBox({
                prompt: 'Enter favicon URL (optional)',
                placeHolder: 'e.g., https://react.dev/favicon.ico'
            });

            const newProvider: DocsConfig = {
                title,
                startUrl,
                rootUrl,
                faviconUrl: faviconUrl || undefined
            };

            await config.update(
                'docsProviders',
                [...currentProviders, newProvider],
                vscode.ConfigurationTarget.Global
            );

            vscode.window.showInformationMessage(`Added documentation provider: ${title}`);
        })
    );

    // Add command to start docs indexing
    context.subscriptions.push(
        vscode.commands.registerCommand('aider-composer.indexDocs', async () => {
            const config = vscode.workspace.getConfiguration('aider-composer');
            const providers = config.get<DocsConfig[]>('docsProviders', []);

            if (providers.length === 0) {
                vscode.window.showWarningMessage('No documentation providers configured. Use the "Configure Docs Provider" command first.');
                return;
            }

            const selected = await vscode.window.showQuickPick(
                providers.map(p => p.title),
                {
                    placeHolder: 'Select documentation to index'
                }
            );

            if (selected) {
                const provider = providers.find(p => p.title === selected);
                if (provider) {
                    // TODO: Implement actual indexing
                    vscode.window.showInformationMessage(`Started indexing: ${provider.title}`);
                }
            }
        })
    );

    // Add the output channel to subscriptions for cleanup
    context.subscriptions.push(outputChannel);
}

export function deactivate() {}
