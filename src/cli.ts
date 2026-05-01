import * as fs from 'fs';
import * as path from 'path';
import { buildPayload, executePrompt, Payload } from './proxy';
import { applyPatches, SyntaxWeaveError } from './weaver';
import { resolveWorkspaceDependencies } from './resolver';

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('[NovAST] Usage: npx ts-node src/cli.ts <file:line> "<prompt>"');
    process.exit(1);
  }

  const [target, ...promptParts] = args;
  const userPrompt = promptParts.join(' ');
  const [filePath, lineStr] = target.split(':');
  
  if (!filePath || !lineStr) {
    console.error('[NovAST] Invalid target. Format: <file:line>');
    process.exit(1);
  }

  const cursorLine = parseInt(lineStr, 10) - 1;
  const ext = path.extname(filePath);
  
  if (!fs.existsSync(filePath)) {
    console.error(`[NovAST] File not found: ${filePath}`);
    process.exit(1);
  }

  console.log(`[NovAST] Targeting ${filePath}:${cursorLine + 1}...`);
  
  const code = fs.readFileSync(filePath, 'utf-8');

  console.log('[NovAST] Resolving workspace imports...');
  const workspaceContext = resolveWorkspaceDependencies(filePath, code, ext);

  let payload = buildPayload(userPrompt, code, ext, cursorLine);
  
  // Inject architectural awareness into the user prompt
  const userMessage = payload.messages.find(m => m.role === 'user');
  if (userMessage && workspaceContext) {
    userMessage.content = `[WORKSPACE CONTEXT]\n${workspaceContext}\n\n${userMessage.content}`;
  }

  try {
    console.log('[NovAST] Requesting surgical patches...');
    let patches = await executePrompt(payload);
    
    try {
      console.log('[NovAST] Weaving patches...');
      applyPatches(filePath, patches);
    } catch (error) {
      if (error instanceof SyntaxWeaveError) {
        console.warn('[NovAST] Syntax validation failed. Auto-healing...');
        
        const healingPayload: Payload = {
          messages: [
            ...payload.messages,
            { role: 'user', content: `Your previous patch introduced a syntax error:\n${error.stderr}\n\nFix the JSON patch.` }
          ]
        };
        
        const fixedPatches = await executePrompt(healingPayload);
        console.log('[NovAST] Applying healed patches...');
        applyPatches(filePath, fixedPatches);
      } else {
        throw error;
      }
    }
    
    console.log('[NovAST] Done.');
  } catch (error: any) {
    console.error(`[NovAST] Critical Failure: ${error.message}`);
    process.exit(1);
  }
}

main();
