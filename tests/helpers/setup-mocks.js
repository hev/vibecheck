/**
 * Global mocks for components that can cause Jest to hang
 * This file is loaded after Jest environment setup to mock problematic modules
 */

// Mock readline to prevent real stdin/stdout interactions
jest.mock('readline', () => {
  const mockInterface = {
    question: jest.fn(),
    close: jest.fn(),
    on: jest.fn(),
  };

  return {
    createInterface: jest.fn(() => mockInterface),
  };
});

// Mock child_process spawnSync to prevent launching real processes
jest.mock('child_process', () => ({
  spawnSync: jest.fn(() => ({ 
    status: 0, 
    stdout: '', 
    stderr: '', 
    error: null 
  })),
}));

// Mock string-width to prevent dynamic import issues
jest.mock('string-width', () => ({
  default: jest.fn((str) => str.length),
}));

// Mock ora to suppress spinner output in tests
jest.mock('ora', () => {
  const mockSpinner = {
    start: jest.fn(function() { return this; }),
    stop: jest.fn(function() { return this; }),
    succeed: jest.fn(function() { return this; }),
    fail: jest.fn(function() { return this; }),
    warn: jest.fn(function() { return this; }),
    info: jest.fn(function() { return this; }),
    text: '',
  };
  
  const mockOra = jest.fn(() => mockSpinner);
  return {
    __esModule: true,
    default: mockOra,
  };
});

// Global cleanup after all tests to ensure nock is properly cleaned
afterAll(async () => {
  const nock = require('nock');
  nock.abortPendingRequests();
  nock.cleanAll();
  nock.restore();
});
