import * as path from 'path';
import * as vscode from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind
} from 'vscode-languageclient/node';

let client: LanguageClient;

export function activate(context: vscode.ExtensionContext) {
  // The server is implemented in the parent directory's dist/lsp.js
  const serverModule = context.asAbsolutePath(
    path.join('..', 'dist', 'lsp.js')
  );

  // The debug options for the server
  // --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
  const debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

  // If the extension is launched in debug mode then the debug server options are used
  // Otherwise the run options are used
  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: debugOptions
    }
  };

  // Options to control the language client
  const clientOptions: LanguageClientOptions = {
    // Register the server for all supported documents
    documentSelector: [
      { scheme: 'file', language: 'typescript' },
      { scheme: 'file', language: 'javascript' },
      { scheme: 'file', language: 'python' },
      { scheme: 'file', language: 'java' },
      { scheme: 'file', language: 'dart' },
      { scheme: 'file', language: 'go' },
      { scheme: 'file', language: 'rust' },
      { scheme: 'file', language: 'cpp' },
      { scheme: 'file', language: 'ruby' },
      { scheme: 'file', language: 'csharp' }
    ],
    synchronize: {
      // Notify the server about file changes to '.clientrc files contained in the workspace
      fileEvents: vscode.workspace.createFileSystemWatcher('**/.clientrc')
    }
  };

  // Create the language client and start the client.
  client = new LanguageClient(
    'novastLanguageServer',
    'NovAST Language Server',
    serverOptions,
    clientOptions
  );

  // Start the client. This will also launch the server
  client.start();

  // Register the generateContext command
  let disposable = vscode.commands.registerCommand('novast.generateContext', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    const position = editor.selection.active;
    
    // We send a request to the LSP to get the context
    try {
      const response = await client.sendRequest('workspace/executeCommand', {
        command: 'novast.generateContext',
        arguments: [editor.document.uri.toString(), position.line]
      });

      if (response) {
        await vscode.env.clipboard.writeText(response as string);
        vscode.window.showInformationMessage('NovAST: Surgical context copied to clipboard! 🛰️');
      }
    } catch (err) {
      vscode.window.showErrorMessage('NovAST: Failed to generate context.');
    }
  });

  context.subscriptions.push(disposable);
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}
