import type Parser from 'tree-sitter';
import type { ImportInfo, ExportInfo, CallInfo } from '@archlens/shared/types';

/**
 * Extract imports, exports, and call relationships from a TypeScript/TSX AST.
 */
export function extractTypeScript(
  rootNode: Parser.SyntaxNode,
  _filePath: string,
): { imports: ImportInfo[]; exports: ExportInfo[]; calls: CallInfo[] } {
  const imports = extractImports(rootNode);
  const exports = extractExports(rootNode);
  const calls = extractCalls(rootNode);
  return { imports, exports, calls };
}

// ---------------------------------------------------------------------------
// Import extraction
// ---------------------------------------------------------------------------

function extractImports(rootNode: Parser.SyntaxNode): ImportInfo[] {
  const imports: ImportInfo[] = [];

  for (const node of rootNode.namedChildren) {
    if (node.type === 'import_statement') {
      // Find the string literal child — the module specifier
      const sourceNode = node.children.find((c) => c.type === 'string');
      if (!sourceNode) continue;

      // Strip surrounding quotes
      const source = sourceNode.text.replace(/^['"]|['"]$/g, '');

      // Type-only detection: `import type ...`
      const isTypeOnly = node.text.startsWith('import type ');

      imports.push({ source, isTypeOnly });
    }
  }

  return imports;
}

// ---------------------------------------------------------------------------
// Export extraction
// ---------------------------------------------------------------------------

function extractExports(rootNode: Parser.SyntaxNode): ExportInfo[] {
  const exports: ExportInfo[] = [];

  for (const node of rootNode.namedChildren) {
    if (node.type !== 'export_statement') continue;

    const nodeText = node.text;
    const isTypeOnly = nodeText.startsWith('export type ');

    // `export default ...`
    if (nodeText.startsWith('export default ')) {
      exports.push({ name: 'default', isDefault: true, isTypeOnly: false });
      continue;
    }

    // `export { A, B, C }` or `export { A as B }` — re-exports with export_clause
    const exportClause = node.children.find((c) => c.type === 'export_clause');
    if (exportClause) {
      for (const item of exportClause.namedChildren) {
        // export_specifier nodes contain identifiers
        if (item.type === 'export_specifier') {
          // The exported name is the last identifier child (after optional 'as alias')
          const names = item.children.filter(
            (c) => c.type === 'identifier' || c.type === 'property_identifier',
          );
          // If there is an alias: `foo as bar` — exported as 'bar'
          const exportedName = names.length > 1 ? names[names.length - 1]!.text : names[0]?.text;
          if (exportedName) {
            exports.push({ name: exportedName, isDefault: false, isTypeOnly });
          }
        }
      }
      continue;
    }

    // `export function Foo`, `export class Foo`, `export const foo = ...`
    const declaration = node.children.find(
      (c) =>
        c.type === 'function_declaration' ||
        c.type === 'class_declaration' ||
        c.type === 'lexical_declaration' ||
        c.type === 'variable_declaration',
    );

    if (declaration) {
      const nameNode = declaration.children.find(
        (c) => c.type === 'identifier' || c.type === 'variable_declarator',
      );
      if (nameNode) {
        const name =
          nameNode.type === 'variable_declarator'
            ? (nameNode.children.find((c) => c.type === 'identifier')?.text ?? nameNode.text)
            : nameNode.text;
        if (name) {
          exports.push({ name, isDefault: false, isTypeOnly });
        }
      }
    }
  }

  return exports;
}

// ---------------------------------------------------------------------------
// Call extraction (direct calls only — not method chains)
// ---------------------------------------------------------------------------

function extractCalls(rootNode: Parser.SyntaxNode): CallInfo[] {
  const calls: CallInfo[] = [];

  function walk(node: Parser.SyntaxNode, depth: number, insideFunction: boolean): void {
    if (node.type === 'call_expression') {
      const calleeNode = node.children[0];
      // Only capture direct identifier calls (not member expressions like `a.b()`)
      if (calleeNode && calleeNode.type === 'identifier') {
        const isTopLevel = !insideFunction;
        calls.push({ callee: calleeNode.text, isTopLevel });
      }
    }

    // Track whether we're inside a function/method body to determine isTopLevel
    const entersFunctionScope =
      node.type === 'function_declaration' ||
      node.type === 'function' ||
      node.type === 'arrow_function' ||
      node.type === 'method_definition';

    for (const child of node.namedChildren) {
      walk(child, depth + 1, insideFunction || entersFunctionScope);
    }
  }

  walk(rootNode, 0, false);
  return calls;
}
