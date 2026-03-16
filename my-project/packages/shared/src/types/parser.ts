export const SupportedLanguage = {
  TS: 'ts',
  TSX: 'tsx',
  JS: 'js',
  JSX: 'jsx',
  PY: 'py',
} as const;
export type SupportedLanguage = typeof SupportedLanguage[keyof typeof SupportedLanguage];

export interface ParseTask {
  filePath: string;       // project-relative path
  source: string;         // file content
  language: SupportedLanguage;
  sequenceId: number;     // monotonic per-result ID
}

export interface ImportInfo {
  source: string;         // the import specifier (e.g. './auth.service')
  isTypeOnly: boolean;    // for TS type-only imports
}

export interface ExportInfo {
  name: string;           // exported name (e.g. 'AuthService', 'default')
  isDefault: boolean;
  isTypeOnly: boolean;    // for TS type-only exports
}

export interface CallInfo {
  callee: string;         // function/method name
  isTopLevel: boolean;    // direct call vs nested
}

export interface ParseResult {
  filePath: string;       // project-relative path
  language: SupportedLanguage;
  imports: ImportInfo[];
  exports: ExportInfo[];
  calls: CallInfo[];
  sequenceId: number;     // monotonic ID from the task
  parseTimeMs: number;    // how long parsing took
  hasErrors: boolean;     // tree-sitter found syntax errors
}

export interface FileRemoved {
  filePath: string;
  sequenceId: number;
  type: 'removed';
}

export type ParseBatchResult = {
  results: (ParseResult | FileRemoved)[];
  batchSequenceStart: number;
  processedAt: number;
};
