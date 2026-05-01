import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  TextDocumentSyncKind,
  InitializeResult,
  ExecuteCommandParams,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { generateHeatmap, index_workspace } from '../novast-core';
import * as path from 'path';

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

let workspaceRoot: string | null = null;
let lastHeatmap: string = '';

connection.onInitialize((params: InitializeParams) => {
  workspaceRoot = params.rootPath || (params.rootUri ? path.resolve(params.rootUri) : null);
  
  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      executeCommandProvider: {
        commands: ['novast.generateContext'],
      },
    },
  };
  return result;
});

connection.onInitialized(() => {
  if (workspaceRoot) {
    connection.console.log(`[NovAST LSP] Initialized at ${workspaceRoot}`);
    // Background indexing
    setTimeout(() => {
      try {
        index_workspace(workspaceRoot!);
        connection.console.log(`[NovAST LSP] Workspace indexed successfully.`);
      } catch (err: any) {
        connection.console.error(`[NovAST LSP] Indexing failed: ${err.message}`);
      }
    }, 1000);
  }
});

documents.onDidChangeContent((change) => {
  updateContext(change.document);
});

documents.onDidSave((event) => {
  updateContext(event.document);
  if (workspaceRoot) {
    index_workspace(workspaceRoot);
  }
});

async function updateContext(document: TextDocument, cursorLine: number = 0) {
  const code = document.getText();
  const ext = path.extname(document.uri);
  try {
    lastHeatmap = generateHeatmap(code, ext, cursorLine);
  } catch (err) {
    // Silent fail in background
  }
}

connection.onExecuteCommand(async (params: ExecuteCommandParams) => {
  if (params.command === 'novast.generateContext') {
    // In a real LSP, we might return this to the client via a custom message
    // For now, we return it as a result of the command
    return lastHeatmap;
  }
});

documents.listen(connection);
connection.listen();
