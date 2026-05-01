import { SyntaxNode } from 'tree-sitter';
import { getParser } from './parser';

const BODY_NODES: Record<string, Set<string>> = {
  '.ts': new Set(['statement_block']),
  '.tsx': new Set(['statement_block']),
  '.js': new Set(['statement_block']),
  '.py': new Set(['block']),
  '.java': new Set(['block']),
  '.dart': new Set(['block']),
};

const PERIPHERY_TYPES = new Set([
  'import_statement',
  'import_declaration',
  'import_from_statement',
  'type_alias_declaration',
  'interface_declaration',
]);

function isEpicenter(type: string): boolean {
  return type.includes('function') || type.includes('method') || type.includes('class');
}

export function generateHeatmap(code: string, ext: string, cursorLine: number): string {
  const parser = getParser(ext);
  const tree = parser.parse(code);
  const root = tree.rootNode;

  let epicenter: SyntaxNode = root;

  function findEpicenter(node: SyntaxNode): void {
    if (cursorLine < node.startPosition.row || cursorLine > node.endPosition.row) return;
    
    if (isEpicenter(node.type)) epicenter = node;
    for (const child of node.children) findEpicenter(child);
  }

  findEpicenter(root);

  const identifiers = new Set<string>();

  function collectIdentifiers(node: SyntaxNode): void {
    if (node.type.includes('identifier')) identifiers.add(node.text);
    for (const child of node.children) collectIdentifiers(child);
  }

  if (epicenter !== root) collectIdentifiers(epicenter);

  const peripheryNodes: SyntaxNode[] = [];
  const blastRadiusNodes = new Map<number, SyntaxNode>();

  for (const child of root.children) {
    if (child === epicenter) continue;

    if (PERIPHERY_TYPES.has(child.type)) {
      peripheryNodes.push(child);
      continue;
    }

    if (epicenter !== root && (child.type.includes('declaration') || isEpicenter(child.type))) {
      let isRelated = false;
      
      // Restrict depth to prevent over-indexing massive inline object structures
      function checkDeclName(n: SyntaxNode, depth: number): void {
        if (isRelated || depth > 2) return;
        if (n.type.includes('identifier') || n.type.includes('name')) {
          if (identifiers.has(n.text)) isRelated = true;
        }
        for (const c of n.children) checkDeclName(c, depth + 1);
      }
      
      checkDeclName(child, 0);
      if (isRelated) blastRadiusNodes.set(child.startIndex, child);
    }
  }

  const bodyTypes = BODY_NODES[ext] || new Set(['statement_block', 'block']);
  const stripReplacement = ext === '.py' ? ':\n    pass\n' : ' { /* NovAST: Stripped */ }';

  function stripNode(node: SyntaxNode): string {
    const edits: { start: number; end: number; replacement: string }[] = [];

    function traverse(n: SyntaxNode): void {
      if (bodyTypes.has(n.type)) {
        edits.push({ start: n.startIndex, end: n.endIndex, replacement: stripReplacement });
        return;
      }
      for (const c of n.children) traverse(c);
    }

    traverse(node);

    let text = code.substring(node.startIndex, node.endIndex);
    const sortedEdits = edits.sort((a, b) => b.start - a.start);

    for (const edit of sortedEdits) {
      const relStart = edit.start - node.startIndex;
      const relEnd = edit.end - node.startIndex;
      if (relStart >= 0 && relEnd <= text.length) {
        text = text.slice(0, relStart) + edit.replacement + text.slice(relEnd);
      }
    }

    return text;
  }

  const peripheryText = peripheryNodes.map((n) => code.substring(n.startIndex, n.endIndex)).join('\n');
  const sortedBlastNodes = Array.from(blastRadiusNodes.values()).sort((a, b) => a.startIndex - b.startIndex);
  const blastText = sortedBlastNodes.map((n) => stripNode(n)).join('\n\n');
  const epicenterText = epicenter === root ? code : code.substring(epicenter.startIndex, epicenter.endIndex);

  return [
    '// === [PERIPHERY: Imports & Types] ===',
    peripheryText || '(none)',
    '',
    '// === [BLAST RADIUS: Related Signatures] ===',
    blastText || '(none)',
    '',
    '// === [EPICENTER: Target Context] ===',
    epicenterText
  ].join('\n');
}
