import type Parser from 'tree-sitter';
import type { ImportInfo, ExportInfo, CallInfo } from '@archlens/shared/types';
/**
 * Extract imports, exports, and call relationships from a TypeScript/TSX AST.
 */
export declare function extractTypeScript(rootNode: Parser.SyntaxNode, _filePath: string): {
    imports: ImportInfo[];
    exports: ExportInfo[];
    calls: CallInfo[];
};
//# sourceMappingURL=typescript.d.ts.map