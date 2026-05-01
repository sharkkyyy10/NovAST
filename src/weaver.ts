import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

export interface Patch {
  action: 'insert' | 'replace';
  lineStart: number;
  lineEnd: number;
  code: string;
}

export class SyntaxWeaveError extends Error {
  constructor(public stderr: string) {
    super(`[NovAST] Syntax validation failed during weaving.`);
    this.name = 'SyntaxWeaveError';
  }
}

export function applyPatches(filePath: string, patches: Patch[]): void {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  const sortedPatches = [...patches].sort((a, b) => b.lineStart - a.lineStart);

  for (const patch of sortedPatches) {
    if (patch.lineStart < 0 || patch.lineStart > lines.length) {
      throw new Error(`[NovAST] lineStart ${patch.lineStart} is out of bounds for ${filePath}`);
    }

    const injection = patch.code.split('\n');

    if (patch.action === 'replace') {
      if (patch.lineEnd < patch.lineStart || patch.lineEnd > lines.length) {
        throw new Error(`[NovAST] lineEnd ${patch.lineEnd} is out of bounds for ${filePath}`);
      }
      const deleteCount = patch.lineEnd - patch.lineStart;
      lines.splice(patch.lineStart, deleteCount, ...injection);
    } else if (patch.action === 'insert') {
      lines.splice(patch.lineStart, 0, ...injection);
    }
  }

  const patchedCode = lines.join('\n');
  const tempPath = `${filePath}.novast_temp`;
  const ext = path.extname(filePath);

  fs.writeFileSync(tempPath, patchedCode, 'utf-8');

  try {
    validateSyntax(tempPath, ext);
    fs.renameSync(tempPath, filePath);
  } catch (error) {
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    throw error;
  }
}

function validateSyntax(tempPath: string, ext: string): void {
  try {
    if (['.ts', '.tsx', '.js'].includes(ext)) {
      execSync(`npx tsc --noEmit --allowJs --skipLibCheck ${tempPath}`, { stdio: 'pipe' });
    } else if (ext === '.py') {
      execSync(`python3 -m py_compile ${tempPath}`, { stdio: 'pipe' });
    }
  } catch (error: any) {
    const stderr = error.stderr?.toString() || error.message;
    throw new SyntaxWeaveError(stderr);
  }
}
