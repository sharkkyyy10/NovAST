import * as fs from 'fs';
import * as path from 'path';
import { extractSkeleton, getLocalImports } from '../novast-core';

export function resolveWorkspaceDependencies(filePath: string, code: string, ext: string): string {
  const baseDir = path.dirname(filePath);
  
  let localPaths: string[];
  try {
    localPaths = getLocalImports(code, ext);
  } catch (error: any) {
    // If the native core fails to parse imports, fail gracefully by returning no workspace context
    return '';
  }

  let context = '';
  const extensions = ['.ts', '.tsx', '.js', '.py', '.java', '.dart', '.cpp', '.cc', '.go', '.rs', '.rb', '.cs'];

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
