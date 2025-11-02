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
  }) as jest.SpyInstance;
}

/**
 * Restore process.exit mock
 */
export function restoreProcessExit(mock: jest.SpyInstance) {
  mock.mockRestore();
}

/**
 * Configure axios to disable keep-alive connections for tests
 * This prevents HTTP connections from staying open and blocking Jest exit
 * Note: When nock is active, we skip agent configuration as nock manages connections
 */
export function configureAxiosForTests() {
  const nock = require('nock');

  // When nock is active, it manages HTTP connections itself
  // Setting custom agents can interfere with nock's MockHttpSocket
  if (nock.isActive()) {
    // Return no-op cleanup - nock will handle connection cleanup
    return async () => {
      // No cleanup needed when nock is managing connections
    };
  }

  // Only configure agents when nock is NOT active (e.g., for unit tests without mocking)
  const axios = require('axios');
  const http = require('http');
  const https = require('https');

  // Store previous agents for cleanup
  const previousHttpAgent = axios.defaults.httpAgent;
  const previousHttpsAgent = axios.defaults.httpsAgent;

  // Create new agents that don't keep connections alive
  const httpAgent = new http.Agent({
    keepAlive: false,
    maxSockets: 1,
  });

  const httpsAgent = new https.Agent({
    keepAlive: false,
    maxSockets: 1,
  });

  // Configure axios defaults to use these agents
  axios.defaults.httpAgent = httpAgent;
  axios.defaults.httpsAgent = httpsAgent;

  // Return cleanup function that destroys agents and restores previous ones
  return async () => {
    // Close all connections on the agents before destroying
    httpAgent.destroy();
    httpsAgent.destroy();
    // Wait briefly to ensure connections are fully closed
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        // Restore previous agents (or undefined if there were none)
        axios.defaults.httpAgent = previousHttpAgent;
        axios.defaults.httpsAgent = previousHttpsAgent;
        resolve();
      }, 10);
    });
  };
}
