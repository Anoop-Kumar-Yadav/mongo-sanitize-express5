import { RequestHandler } from 'express';

export interface SanitizeOptions {
  /** Replace offending chars instead of dropping the key, e.g. '_' turns "$gt" into "_gt". Default: null (drop). */
  replaceWith?: string | null;
  /** Allow dot-notation keys like "a.b" (still blocks $-prefixed and __proto__/constructor/prototype). Default: false. */
  allowDots?: boolean;
  /** Max recursion depth before truncating (DoS guard). Default: 25. */
  maxDepth?: number;
  /** Report offending keys without mutating. Default: false. */
  dryRun?: boolean;
  /** Called for every offending key found. */
  onSanitize?: (key: string, path: string) => void;
}

export interface MiddlewareOptions extends SanitizeOptions {
  /** Which req properties to sanitize. Default: ['body', 'params', 'query']. */
  targets?: Array<'body' | 'params' | 'query' | 'headers'>;
  onSanitize?: (key: string, path: string, req: import('express').Request) => void;
}

export interface SanitizeResult<T> {
  sanitized: T;
  hits: string[];
}

declare function mongoSanitize(options?: MiddlewareOptions): RequestHandler;

declare namespace mongoSanitize {
  function sanitize<T>(obj: T, options?: SanitizeOptions): SanitizeResult<T>;
  function sanitizeInPlace<T>(obj: T, options?: SanitizeOptions): SanitizeResult<T>;
}

export default mongoSanitize;
export = mongoSanitize;
