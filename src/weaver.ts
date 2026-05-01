import * as fs from 'fs';

export interface Patch {
  action: 'insert' | 'replace';
  lineStart: number;
  lineEnd: number;
  code: string;
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

  fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
}
