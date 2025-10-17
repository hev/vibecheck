import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

/**
 * Read a fixture file from tests/fixtures directory
 */
export function readFixture(filename: string): string {
  const fixturePath = path.join(__dirname, '..', 'fixtures', filename);
  return fs.readFileSync(fixturePath, 'utf8');
}

/**
 * Parse a YAML fixture file
 */
export function parseYamlFixture(filename: string): any {
  const content = readFixture(filename);
  return yaml.load(content);
}

/**
 * Create a temporary file for testing
 */
export function createTempFile(content: string, filename: string = 'temp-test.yaml'): string {
  const tempDir = path.join(__dirname, '..', '.tmp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  const filePath = path.join(tempDir, filename);
  fs.writeFileSync(filePath, content, 'utf8');
  return filePath;
}

/**
 * Clean up temporary test files
 */
export function cleanupTempFiles() {
  const tempDir = path.join(__dirname, '..', '.tmp');
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

/**
 * Mock environment variables for tests
 */
export function withEnv(envVars: Record<string, string | undefined>, fn: () => void | Promise<void>) {
  const originalEnv = { ...process.env };

  // Set new env vars
  Object.entries(envVars).forEach(([key, value]) => {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  });

  try {
    const result = fn();
    if (result instanceof Promise) {
      return result.finally(() => {
        // Restore original env
        process.env = originalEnv;
      });
    }
    // Restore original env
    process.env = originalEnv;
    return result;
  } catch (error) {
    // Restore original env on error
    process.env = originalEnv;
    throw error;
  }
}

/**
 * Suppress console output during tests
 */
export function suppressConsole(fn: () => void | Promise<void>) {
  const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
  };

  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();

  try {
    const result = fn();
    if (result instanceof Promise) {
      return result.finally(() => {
        console.log = originalConsole.log;
        console.error = originalConsole.error;
        console.warn = originalConsole.warn;
      });
    }
    console.log = originalConsole.log;
    console.error = originalConsole.error;
    console.warn = originalConsole.warn;
    return result;
  } catch (error) {
    console.log = originalConsole.log;
    console.error = originalConsole.error;
    console.warn = originalConsole.warn;
    throw error;
  }
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => boolean,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> {
  const startTime = Date.now();
  while (!condition()) {
    if (Date.now() - startTime > timeout) {
      throw new Error('Timeout waiting for condition');
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
}

/**
 * Mock process.exit for testing
 */
export function mockProcessExit(): jest.SpyInstance {
  return jest.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined) => {
    throw new Error(`process.exit called with code ${code}`);
  } as any);
}

/**
 * Restore process.exit mock
 */
export function restoreProcessExit(mock: jest.SpyInstance) {
  mock.mockRestore();
}
