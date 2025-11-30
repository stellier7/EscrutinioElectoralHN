/**
 * Database operations helper with retry logic and error handling
 * Provides robust error handling for database operations with exponential backoff
 */

export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  onRetry?: (error: Error, attempt: number, maxRetries: number) => void;
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  onRetry: (error, attempt, maxRetries) => {
    console.error(`Database operation retry ${attempt}/${maxRetries}:`, error.message);
  },
};

/**
 * Wraps a database operation with retry logic and exponential backoff
 * 
 * @param operation - The database operation to retry
 * @param options - Retry configuration options
 * @returns The result of the database operation
 * @throws The last error if all retries are exhausted
 */
export async function withDatabaseRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const config = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error | unknown;
  
  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      // Don't retry on certain Prisma errors that won't be fixed by retrying
      if (error instanceof Error) {
        const errorMessage = error.message;
        const errorCode = (error as any).code;
        
        // P2002 = Unique constraint violation - don't retry
        if (errorCode === 'P2002') {
          throw error;
        }
        
        // P2025 = Record not found - don't retry
        if (errorCode === 'P2025') {
          throw error;
        }
        
        // Validation errors - don't retry
        if (errorMessage.includes('Invalid') || errorMessage.includes('invalid')) {
          throw error;
        }
      }
      
      // If this is the last attempt, throw the error
      if (attempt >= config.maxRetries) {
        break;
      }
      
      // Calculate delay with exponential backoff
      const delay = Math.min(
        config.baseDelay * Math.pow(2, attempt - 1),
        config.maxDelay
      );
      
      // Call onRetry callback
      if (config.onRetry && error instanceof Error) {
        config.onRetry(error, attempt, config.maxRetries);
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  // If we get here, all retries failed
  if (lastError instanceof Error) {
    console.error(`Database operation failed after ${config.maxRetries} attempts:`, {
      message: lastError.message,
      stack: lastError.stack,
      code: (lastError as any).code,
    });
    throw lastError;
  }
  
  throw lastError || new Error('Database operation failed with unknown error');
}

/**
 * Checks if an error is a database connection error that should trigger retry
 */
export function isDatabaseConnectionError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  
  const errorMessage = error.message.toLowerCase();
  const errorCode = (error as any).code;
  
  // Common database connection error patterns
  const connectionErrorPatterns = [
    'connection',
    'timeout',
    'econnrefused',
    'enotfound',
    'connect econnrefused',
    'connection closed',
    'connection terminated',
    'can\'t reach database server',
    'connection pool',
    'prisma client',
  ];
  
  // Common error codes for connection issues
  const connectionErrorCodes = [
    'P1001', // Can't reach database server
    'P1002', // Connection timeout
    'P1003', // Database does not exist
    'P1008', // Operations timed out
    'P1009', // Database already exists
    'P1010', // User was denied access
    'P1011', // TLS connection error
    'P1017', // Server has closed the connection
  ];
  
  return (
    connectionErrorPatterns.some(pattern => errorMessage.includes(pattern)) ||
    connectionErrorCodes.includes(errorCode)
  );
}

/**
 * Checks if an error is a Prisma unique constraint violation
 */
export function isUniqueConstraintError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  
  const errorCode = (error as any).code;
  return errorCode === 'P2002';
}

/**
 * Checks if an error is a record not found error
 */
export function isRecordNotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  
  const errorCode = (error as any).code;
  return errorCode === 'P2025';
}

/**
 * Formats a database error for logging
 */
export function formatDatabaseError(error: unknown, context?: string): string {
  if (!(error instanceof Error)) {
    return `Unknown database error${context ? ` in ${context}` : ''}`;
  }
  
  const errorCode = (error as any).code;
  const errorMeta = (error as any).meta;
  
  let message = error.message;
  
  if (errorCode) {
    message = `[${errorCode}] ${message}`;
  }
  
  if (errorMeta) {
    message += ` | Meta: ${JSON.stringify(errorMeta)}`;
  }
  
  if (context) {
    message = `[${context}] ${message}`;
  }
  
  return message;
}

