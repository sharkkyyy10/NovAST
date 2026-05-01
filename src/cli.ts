import * as fs from 'fs';
import * as path from 'path';
import { buildPayload, executePrompt } from './proxy';
import { applyPatches } from './weaver';

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
    console.error('[NovAST] Invalid target format. Expected <file:line>');
    process.exit(1);
  }

  const cursorLine = parseInt(lineStr, 10) - 1;
  if (isNaN(cursorLine)) {
    console.error('[NovAST] Invalid line number');
    process.exit(1);
  }

  console.log(`[NovAST] Targeting ${filePath}:${cursorLine + 1}...`);

  const ext = path.extname(filePath);
  if (!fs.existsSync(filePath)) {
    console.error(`[NovAST] File not found: ${filePath}`);
    process.exit(1);
  }

  const code = fs.readFileSync(filePath, 'utf-8');

  try {
    const payload = buildPayload(userPrompt, code, ext, cursorLine);
    console.log('[NovAST] Executing prompt...');
    
    const patches = await executePrompt(payload);
    console.log('[NovAST] Weaving patches...');
    
    applyPatches(filePath, patches);
    console.log('[NovAST] Done.');
  } catch (error) {
    console.error(`[NovAST] Error: ${(error as Error).message}`);
    process.exit(1);
  }
}

main();
