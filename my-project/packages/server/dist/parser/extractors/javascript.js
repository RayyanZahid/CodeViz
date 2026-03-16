import { extractTypeScript } from './typescript.js';
/**
 * Extract imports, exports, and call relationships from a JavaScript/JSX AST.
 *
 * JavaScript uses the same node types as TypeScript (import_statement,
 * export_statement, call_expression). The only difference is that JavaScript
 * has no concept of type-only imports/exports, so all isTypeOnly flags are
 * forced to false.
 */
export function extractJavaScript(rootNode, filePath) {
    // Delegate to the TypeScript extractor (identical node structure) and then
    // strip all type-only flags — JavaScript has no `import type` / `export type`.
    const result = extractTypeScript(rootNode, filePath);
    return {
        imports: result.imports.map((imp) => ({ ...imp, isTypeOnly: false })),
        exports: result.exports.map((exp) => ({ ...exp, isTypeOnly: false })),
        calls: result.calls,
    };
}
