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
import * as http from 'http';

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
    return lastHeatmap;
  }
});

// HTTP Bridge for Web LLMs
const bridgeServer = http.createServer((req, res) => {
  // CORS for web LLMs
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  
  if (req.url === '/context') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ context: lastHeatmap }));
  } else {
    res.writeHead(404);
    res.end();
  }
});

bridgeServer.listen(6543, () => {
  connection.console.log('[NovAST Bridge] HTTP Server running on port 6543');
});

documents.listen(connection);
connection.listen();

