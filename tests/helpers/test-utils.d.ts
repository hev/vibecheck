/**
 * Read a fixture file from tests/fixtures directory
 */
export declare function readFixture(filename: string): string;
/**
 * Parse a YAML fixture file
 */
export declare function parseYamlFixture(filename: string): any;
/**
 * Create a temporary file for testing
 */
export declare function createTempFile(content: string, filename?: string): string;
/**
 * Clean up temporary test files
 */
export declare function cleanupTempFiles(): void;
/**
 * Mock environment variables for tests
 */
export declare function withEnv(envVars: Record<string, string | undefined>, fn: () => void | Promise<void>): void | Promise<void>;
/**
 * Suppress console output during tests
 */
export declare function suppressConsole(fn: () => void | Promise<void>): void | Promise<void>;
/**
 * Wait for a condition to be true
 */
export declare function waitFor(condition: () => boolean, timeout?: number, interval?: number): Promise<void>;
/**
 * Mock process.exit for testing
 */
export declare function mockProcessExit(): jest.SpyInstance;
/**
 * Restore process.exit mock
 */
export declare function restoreProcessExit(mock: jest.SpyInstance): void;
//# sourceMappingURL=test-utils.d.ts.map