/**
 * CJS wrapper for piscina worker thread.
 *
 * tree-sitter and its grammar native addons require CJS `require()`.
 * Since the package uses "type": "module", .js files are ESM by default.
 * This .cjs file is loaded by piscina and uses native require() to load
 * the tree-sitter bindings correctly in worker threads.
 */

'use strict';

const Parser = require('tree-sitter');
const { performance } = require('node:perf_hooks');
const { typescript, tsx } = require('tree-sitter-typescript');
const JavaScript = require('tree-sitter-javascript');
const Python = require('tree-sitter-python');

// ---------------------------------------------------------------------------
// Grammar cache — one Parser instance per language, per worker thread
// ---------------------------------------------------------------------------

const tsParser = new Parser();
tsParser.setLanguage(typescript);

const tsxParser = new Parser();
tsxParser.setLanguage(tsx);

const jsParser = new Parser();
jsParser.setLanguage(JavaScript);

const jsxParser = new Parser();
jsxParser.setLanguage(JavaScript);

const pyParser = new Parser();
pyParser.setLanguage(Python);

const parsers = {
  ts: tsParser,
  tsx: tsxParser,
  js: jsParser,
  jsx: jsxParser,
  py: pyParser,
};

// ---------------------------------------------------------------------------
// Tree cache for incremental parsing
// ---------------------------------------------------------------------------

const treeCache = new Map();

// ---------------------------------------------------------------------------
// TypeScript/JavaScript import extraction
// ---------------------------------------------------------------------------

function extractImportsTS(rootNode) {
  const imports = [];
  for (const node of rootNode.namedChildren) {
    if (node.type === 'import_statement') {
      const sourceNode = node.children.find(c => c.type === 'string');
      if (!sourceNode) continue;
      const source = sourceNode.text.replace(/^['"]|['"]$/g, '');
      const isTypeOnly = node.text.startsWith('import type ');
      imports.push({ source, isTypeOnly });
    }
  }
  return imports;
}

// ---------------------------------------------------------------------------
// TypeScript/JavaScript export extraction
// ---------------------------------------------------------------------------

function extractExportsTS(rootNode) {
  const exports = [];
  for (const node of rootNode.namedChildren) {
    if (node.type !== 'export_statement') continue;

    const nodeText = node.text;
    const isTypeOnly = nodeText.startsWith('export type ');

    if (nodeText.startsWith('export default ')) {
      exports.push({ name: 'default', isDefault: true, isTypeOnly: false });
      continue;
    }

    const exportClause = node.children.find(c => c.type === 'export_clause');
    if (exportClause) {
      for (const item of exportClause.namedChildren) {
        if (item.type === 'export_specifier') {
          const names = item.children.filter(c =>
            c.type === 'identifier' || c.type === 'property_identifier'
          );
          const exportedName = names.length > 1 ? names[names.length - 1].text : (names[0] && names[0].text);
          if (exportedName) {
            exports.push({ name: exportedName, isDefault: false, isTypeOnly });
          }
        }
      }
      continue;
    }

    const declaration = node.children.find(c =>
      c.type === 'function_declaration' ||
      c.type === 'class_declaration' ||
      c.type === 'lexical_declaration' ||
      c.type === 'variable_declaration'
    );

    if (declaration) {
      const nameNode = declaration.children.find(c =>
        c.type === 'identifier' || c.type === 'variable_declarator'
      );
      if (nameNode) {
        const name = nameNode.type === 'variable_declarator'
          ? ((nameNode.children.find(c => c.type === 'identifier') || {}).text || nameNode.text)
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
// TypeScript/JavaScript call extraction
// ---------------------------------------------------------------------------

function extractCallsTS(rootNode) {
  const calls = [];

  function walk(node, insideFunction) {
    if (node.type === 'call_expression') {
      const calleeNode = node.children[0];
      if (calleeNode && calleeNode.type === 'identifier') {
        calls.push({ callee: calleeNode.text, isTopLevel: !insideFunction });
      }
    }
    const entersFunctionScope =
      node.type === 'function_declaration' ||
      node.type === 'function' ||
      node.type === 'arrow_function' ||
      node.type === 'method_definition';
    for (const child of node.namedChildren) {
      walk(child, insideFunction || entersFunctionScope);
    }
  }

  walk(rootNode, false);
  return calls;
}

// ---------------------------------------------------------------------------
// Python import extraction
// ---------------------------------------------------------------------------

function extractImportsPython(rootNode) {
  const imports = [];
  for (const node of rootNode.namedChildren) {
    if (node.type === 'import_statement' || node.type === 'import_from_statement') {
      const modNode = node.children.find(c =>
        c.type === 'dotted_name' || c.type === 'relative_import'
      );
      if (modNode) {
        const source = modNode.text;
        imports.push({ source, isTypeOnly: false });
      }
    }
  }
  return imports;
}

// ---------------------------------------------------------------------------
// Python export extraction
// ---------------------------------------------------------------------------

function extractExportsPython(rootNode) {
  const exports = [];
  for (const node of rootNode.namedChildren) {
    if (node.type === 'function_definition' || node.type === 'class_definition') {
      const nameNode = node.children.find(c => c.type === 'identifier');
      if (nameNode && !nameNode.text.startsWith('_')) {
        exports.push({ name: nameNode.text, isDefault: false, isTypeOnly: false });
      }
    }
  }
  return exports;
}

// ---------------------------------------------------------------------------
// Python call extraction
// ---------------------------------------------------------------------------

function extractCallsPython(rootNode) {
  const calls = [];

  function walk(node, insideFunction) {
    if (node.type === 'call') {
      const fn = node.childForFieldName('function');
      if (fn && fn.type === 'identifier') {
        calls.push({ callee: fn.text, isTopLevel: !insideFunction });
      }
    }
    const entersFunctionScope = node.type === 'function_definition';
    for (const child of node.namedChildren) {
      walk(child, insideFunction || entersFunctionScope);
    }
  }

  walk(rootNode, false);
  return calls;
}

// ---------------------------------------------------------------------------
// Default export — the piscina task handler
// ---------------------------------------------------------------------------

module.exports = function parseFileTask(task) {
  const { filePath, source, language, sequenceId } = task;

  const parser = parsers[language];
  if (!parser) {
    throw new Error(`Unsupported language: ${language}`);
  }

  const start = performance.now();

  const oldTree = treeCache.get(filePath);
  const tree = oldTree ? parser.parse(source, oldTree) : parser.parse(source);

  treeCache.set(filePath, tree);

  const parseTimeMs = performance.now() - start;
  const hasErrors = tree.rootNode.hasError;

  let imports, exports, calls;
  if (language === 'ts' || language === 'tsx' || language === 'js' || language === 'jsx') {
    imports = extractImportsTS(tree.rootNode);
    exports = extractExportsTS(tree.rootNode);
    calls = extractCallsTS(tree.rootNode);
  } else {
    imports = extractImportsPython(tree.rootNode);
    exports = extractExportsPython(tree.rootNode);
    calls = extractCallsPython(tree.rootNode);
  }

  return {
    filePath,
    language,
    imports,
    exports,
    calls,
    sequenceId,
    parseTimeMs,
    hasErrors,
  };
};

module.exports.evictFile = function evictFile(filePath) {
  treeCache.delete(filePath);
};
