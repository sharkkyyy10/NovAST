import * as fs from 'fs';
import * as path from 'path';
import { getParser, extractSkeleton } from './parser';

export function resolveWorkspaceDependencies(filePath: string, code: string, ext: string): string {
  const parser = getParser(ext);
  const tree = parser.parse(code);
  const root = tree.rootNode;
  const baseDir = path.dirname(filePath);

  const localPaths = new Set<string>();

  function findImports(node: any): void {
    if (node.type.includes('import')) {
      for (const child of node.children) {
        // Handle TS/JS/Java string literals
        if (child.type === 'string' || child.type === 'string_literal') {
          const rawPath = child.text.replace(/['"]/g, '');
          if (rawPath.startsWith('.')) localPaths.add(rawPath);
        }
        // Handle Python relative imports (e.g., from .models)
        if (child.type === 'relative_import' || (child.type === 'dotted_name' && child.text.startsWith('.'))) {
          localPaths.add(child.text.replace(/\./g, '/'));
        }
      }
    }
    for (const child of node.children) {
      findImports(child);
    }
  }

  findImports(root);

  let context = '';
  const extensions = ['.ts', '.tsx', '.js', '.py', '.java', '.dart'];

  for (const rawPath of localPaths) {
    let resolvedPath = path.resolve(baseDir, rawPath);

    if (!fs.existsSync(resolvedPath)) {
      for (const e of extensions) {
        if (fs.existsSync(resolvedPath + e)) {
          resolvedPath += e;
          break;
        }
      }
    }

    if (!fs.existsSync(resolvedPath) || fs.lstatSync(resolvedPath).isDirectory()) continue;

    try {
      const fileCode = fs.readFileSync(resolvedPath, 'utf-8');
      const fileExt = path.extname(resolvedPath);
      const skeleton = extractSkeleton(fileCode, fileExt);
      
      context += `// === [WORKSPACE CONTEXT: ${path.basename(resolvedPath)}] ===\n${skeleton}\n\n`;
    } catch {
      continue;
    }
  }

  return context;
}
