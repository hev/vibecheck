"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.readFixture = readFixture;
exports.parseYamlFixture = parseYamlFixture;
exports.createTempFile = createTempFile;
exports.cleanupTempFiles = cleanupTempFiles;
exports.withEnv = withEnv;
exports.suppressConsole = suppressConsole;
exports.waitFor = waitFor;
exports.mockProcessExit = mockProcessExit;
exports.restoreProcessExit = restoreProcessExit;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const yaml = __importStar(require("js-yaml"));
/**
 * Read a fixture file from tests/fixtures directory
 */
function readFixture(filename) {
    const fixturePath = path.join(__dirname, '..', 'fixtures', filename);
    return fs.readFileSync(fixturePath, 'utf8');
}
/**
 * Parse a YAML fixture file
 */
function parseYamlFixture(filename) {
    const content = readFixture(filename);
    return yaml.load(content);
}
/**
 * Create a temporary file for testing
 */
function createTempFile(content, filename = 'temp-test.yaml') {
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
function cleanupTempFiles() {
    const tempDir = path.join(__dirname, '..', '.tmp');
    if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
}
/**
 * Mock environment variables for tests
 */
function withEnv(envVars, fn) {
    const originalEnv = { ...process.env };
    // Set new env vars
    Object.entries(envVars).forEach(([key, value]) => {
        if (value === undefined) {
            delete process.env[key];
        }
        else {
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
    }
    catch (error) {
        // Restore original env on error
        process.env = originalEnv;
        throw error;
    }
}
/**
 * Suppress console output during tests
 */
function suppressConsole(fn) {
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
    }
    catch (error) {
        console.log = originalConsole.log;
        console.error = originalConsole.error;
        console.warn = originalConsole.warn;
        throw error;
    }
}
/**
 * Wait for a condition to be true
 */
async function waitFor(condition, timeout = 5000, interval = 100) {
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
function mockProcessExit() {
    return jest.spyOn(process, 'exit').mockImplementation((code) => {
        throw new Error(`process.exit called with code ${code}`);
    });
}
/**
 * Restore process.exit mock
 */
function restoreProcessExit(mock) {
    mock.mockRestore();
}
//# sourceMappingURL=test-utils.js.map