/**
 * Structured error types for parser operations
 * Provides consistent error handling across all parser modules
 */

/**
 * Base error class for parser-related errors
 * All parser errors extend this class for consistent error handling
 */
export class ParserError extends Error {
  /**
   * @param message - Human-readable error message
   * @param code - Machine-readable error code for error handling
   * @param context - Additional context data for debugging
   */
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ParserError';
  }
}

/**
 * Error thrown when import depth exceeds maximum allowed depth
 * Prevents stack overflow from deeply nested or circular imports
 */
export class ImportDepthExceededError extends ParserError {
  /**
   * @param depth - Current import depth that exceeded the limit
   * @param maxDepth - Maximum allowed import depth
   * @param importPath - Path to the import that triggered the error
   */
  constructor(depth: number, maxDepth: number, importPath: string) {
    super(
      `Import depth exceeded maximum of ${maxDepth} levels at depth ${depth}`,
      'IMPORT_DEPTH_EXCEEDED',
      { depth, maxDepth, importPath },
    );
    this.name = 'ImportDepthExceededError';
  }
}

/**
 * Error thrown when file resolution fails
 * Indicates that a file could not be found or accessed
 */
export class FileResolutionError extends ParserError {
  /**
   * @param path - Path to the file that failed to resolve
   * @param reason - Why the file could not be resolved
   */
  constructor(path: string, reason: string) {
    super(`Failed to resolve file: ${path}`, 'FILE_RESOLUTION_ERROR', {
      path,
      reason,
    });
    this.name = 'FileResolutionError';
  }
}

/**
 * Error thrown when CSS parsing fails
 * Indicates malformed or invalid CSS content
 */
export class CSSParseError extends ParserError {
  /**
   * @param css - CSS content that failed to parse
   * @param reason - Why the CSS could not be parsed
   * @param position - Optional character position where parsing failed
   */
  constructor(css: string, reason: string, position?: number) {
    super(`Failed to parse CSS: ${reason}`, 'CSS_PARSE_ERROR', {
      cssLength: css.length,
      reason,
      position,
    });
    this.name = 'CSSParseError';
  }
}
