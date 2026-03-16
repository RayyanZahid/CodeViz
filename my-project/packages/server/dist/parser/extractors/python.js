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
export function extractPython(rootNode, _filePath) {
    const imports = extractImports(rootNode);
    const exports = extractExports(rootNode);
    const calls = extractCalls(rootNode);
    return { imports, exports, calls };
}
// ---------------------------------------------------------------------------
// Import extraction
// ---------------------------------------------------------------------------
function extractImports(rootNode) {
    const imports = [];
    for (const node of rootNode.namedChildren) {
        if (node.type === 'import_statement') {
            // `import foo` or `import foo, bar` — extract dotted_name children
            for (const child of node.namedChildren) {
                if (child.type === 'dotted_name' || child.type === 'aliased_import') {
                    // For aliased_import (`import foo as f`), take the first dotted_name
                    const nameNode = child.type === 'aliased_import'
                        ? child.children.find((c) => c.type === 'dotted_name')
                        : child;
                    if (nameNode) {
                        imports.push({ source: nameNode.text, isTypeOnly: false });
                    }
                }
            }
        }
        else if (node.type === 'import_from_statement') {
            // `from foo import bar` or `from . import bar` or `from ..utils import Y`
            // The module source is the `module_name` or relative_import portion.
            // Tree-sitter Python: import_from_statement children include:
            //   `from`, [relative_import | dotted_name], `import`, [import names]
            let source = '';
            // Check for relative import prefix (dots)
            const relativeImport = node.children.find((c) => c.type === 'relative_import');
            if (relativeImport) {
                // relative_import contains import_prefix (the dots) and optional dotted_name
                const importPrefix = relativeImport.children.find((c) => c.type === 'import_prefix');
                const moduleNameNode = relativeImport.children.find((c) => c.type === 'dotted_name');
                const dots = importPrefix ? importPrefix.text : '';
                const moduleName = moduleNameNode ? moduleNameNode.text : '';
                source = dots + moduleName;
            }
            else {
                // Absolute import: `from foo.bar import baz`
                const moduleNameNode = node.children.find((c) => c.type === 'dotted_name');
                if (moduleNameNode) {
                    source = moduleNameNode.text;
                }
            }
            if (source) {
                imports.push({ source, isTypeOnly: false });
            }
        }
    }
    return imports;
}
// ---------------------------------------------------------------------------
// Export extraction (top-level definitions)
// ---------------------------------------------------------------------------
function extractExports(rootNode) {
    const exports = [];
    for (const node of rootNode.namedChildren) {
        if (node.type === 'function_definition') {
            // `def foo(...):`
            const nameNode = node.children.find((c) => c.type === 'identifier');
            if (nameNode) {
                exports.push({ name: nameNode.text, isDefault: false, isTypeOnly: false });
            }
        }
        else if (node.type === 'class_definition') {
            // `class Foo:`
            const nameNode = node.children.find((c) => c.type === 'identifier');
            if (nameNode) {
                exports.push({ name: nameNode.text, isDefault: false, isTypeOnly: false });
            }
        }
        else if (node.type === 'expression_statement') {
            // Module-level assignment: `MY_CONSTANT = ...`
            // tree-sitter-python wraps assignments inside expression_statement at top level
            const assignment = node.children.find((c) => c.type === 'assignment' || c.type === 'augmented_assignment');
            if (assignment) {
                const lhs = assignment.children[0];
                if (lhs && lhs.type === 'identifier') {
                    exports.push({ name: lhs.text, isDefault: false, isTypeOnly: false });
                }
            }
        }
        else if (node.type === 'assignment') {
            // Direct assignment at module level (some tree-sitter-python versions)
            const lhs = node.children[0];
            if (lhs && lhs.type === 'identifier') {
                exports.push({ name: lhs.text, isDefault: false, isTypeOnly: false });
            }
        }
    }
    return exports;
}
// ---------------------------------------------------------------------------
// Call extraction (direct identifier calls only — not method chains)
// ---------------------------------------------------------------------------
function extractCalls(rootNode) {
    const calls = [];
    function walk(node, insideFunction) {
        if (node.type === 'call') {
            // Python tree-sitter uses `call` (not `call_expression`)
            // The callee is the first child (the `function` field)
            // Use childForFieldName if available, fall back to first child
            const calleeNode = node.childForFieldName('function') ?? node.children[0];
            if (calleeNode && calleeNode.type === 'identifier') {
                const isTopLevel = !insideFunction;
                calls.push({ callee: calleeNode.text, isTopLevel });
            }
            // Skip attribute callees (method calls like `self.method()` — too noisy for v1)
        }
        // Track whether we're inside a function or class body to determine isTopLevel
        const entersFunctionScope = node.type === 'function_definition' ||
            node.type === 'lambda';
        for (const child of node.namedChildren) {
            walk(child, insideFunction || entersFunctionScope);
        }
    }
    walk(rootNode, false);
    return calls;
}
