import * as tmp from 'tmp';

// Enable automatic cleanup on process exit
tmp.setGracefulCleanup();

/**
 * Execute function with temporary directory that auto-cleans
 * Critical: handles cleanup even on error (research pitfall #6)
 */
export async function withTempDirectory<T>(
  fn: (dirPath: string) => Promise<T>
): Promise<T> {
  return new Promise((resolve, reject) => {
    tmp.dir(
      {
        unsafeCleanup: true, // Remove even if not empty
        prefix: 'rfp-proposal-'
      },
      async (err, dirPath, cleanup) => {
        if (err) {
          reject(err);
          return;
        }

        try {
          const result = await fn(dirPath);
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          // Explicit cleanup (automatic also happens on exit)
          cleanup();
        }
      }
    );
  });
}

/**
 * Create a temporary file with auto-cleanup
 */
export async function createTempFile(
  options?: { prefix?: string; postfix?: string }
): Promise<{ path: string; cleanup: () => void }> {
  return new Promise((resolve, reject) => {
    tmp.file(
      {
        prefix: options?.prefix || 'rfp-',
        postfix: options?.postfix || '.tmp'
      },
      (err, path, _fd, cleanup) => {
        if (err) {
          reject(err);
          return;
        }
        resolve({ path, cleanup });
      }
    );
  });
}
