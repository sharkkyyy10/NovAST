import Parser from 'tree-sitter';
import typescript from 'tree-sitter-typescript';
import javascript from 'tree-sitter-javascript';
import python from 'tree-sitter-python';
import java from 'tree-sitter-java';
import dart from 'tree-sitter-dart';

const GRAMMARS: Record<string, any> = {
  '.ts': typescript.typescript,
  '.tsx': typescript.tsx,
  '.js': javascript,
  '.py': python,
  '.java': java,
  '.dart': dart,
};

const BODY_NODES: Record<string, Set<string>> = {
  '.ts': new Set(['statement_block']),
  '.tsx': new Set(['statement_block']),
  '.js': new Set(['statement_block']),
  '.py': new Set(['block']),
  '.java': new Set(['block']),
  '.dart': new Set(['block']),
};

interface Edit {
  start: number;
  end: number;
  replacement: string;
}

export function getParser(ext: string): Parser {
  const language = GRAMMARS[ext];
  if (!language) throw new Error(`[NovAST] Unsupported language extension: ${ext}`);
  
  const parser = new Parser();
  parser.setLanguage(language);
  return parser;
}

export function extractSkeleton(code: string, ext: string): string {
  const parser = getParser(ext);
  const tree = parser.parse(code);
  const bodyTypes = BODY_NODES[ext] || new Set(['statement_block', 'block']);

  const edits: Edit[] = [];

  function traverse(node: Parser.SyntaxNode) {
    if (bodyTypes.has(node.type)) {
      const replacement = ext === '.py' ? ':\n    pass\n' : ' { /* NovAST: Stripped */ }';
      edits.push({ start: node.startIndex, end: node.endIndex, replacement });
      return; 
    }
    for (const child of node.children) { traverse(child); }
  }

  traverse(tree.rootNode);

  let skeleton = code;
  const sortedEdits = edits.sort((a, b) => b.start - a.start);
  for (const edit of sortedEdits) {
    skeleton = skeleton.slice(0, edit.start) + edit.replacement + skeleton.slice(edit.end);
  }
  return skeleton;
}
