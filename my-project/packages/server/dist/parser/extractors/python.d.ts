import type Parser from 'tree-sitter';
import type { ImportInfo, ExportInfo, CallInfo } from '@archlens/shared/types';
/**
 * Extract imports, exports, and call relationships from a Python AST.
 *
 * Python has no explicit export keyword — top-level function, class, and
 * module-level assignment definitions are treated as "exports" since they
 * are importable by other modules.
 *
 * Python has no type-only imports or default exports — isTypeOnly and
 * isDefault are always false.
 */
export declare function extractPython(rootNode: Parser.SyntaxNode, _filePath: string): {
    imports: ImportInfo[];
    exports: ExportInfo[];
    calls: CallInfo[];
};
//# sourceMappingURL=python.d.ts.map