import type Parser from 'tree-sitter';
import type { ImportInfo, ExportInfo, CallInfo } from '@archlens/shared/types';
/**
 * Extract imports, exports, and call relationships from a JavaScript/JSX AST.
 *
 * JavaScript uses the same node types as TypeScript (import_statement,
 * export_statement, call_expression). The only difference is that JavaScript
 * has no concept of type-only imports/exports, so all isTypeOnly flags are
 * forced to false.
 */
export declare function extractJavaScript(rootNode: Parser.SyntaxNode, filePath: string): {
    imports: ImportInfo[];
    exports: ExportInfo[];
    calls: CallInfo[];
};
//# sourceMappingURL=javascript.d.ts.map