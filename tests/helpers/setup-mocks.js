/**
 * Global mocks for interactive components that can cause Jest to hang
 * This file is loaded after Jest environment setup to mock problematic modules
 */

// Mock blessed terminal UI to prevent real terminal interactions
jest.mock('blessed', () => {
  const mockScreen = {
    append: jest.fn(),
    render: jest.fn(),
    destroy: jest.fn(),
    key: jest.fn(),
    on: jest.fn(),
    focused: null,
  };

  const mockText = jest.fn(() => ({
    setContent: jest.fn(),
    focus: jest.fn(),
  }));

  const mockTextbox = jest.fn(() => ({
    setValue: jest.fn(),
    clearValue: jest.fn(),
    focus: jest.fn(),
    on: jest.fn(),
  }));

  const mockBox = jest.fn(() => ({
    setContent: jest.fn(),
    focus: jest.fn(),
    scrollTo: jest.fn(),
  }));

  return {
    screen: jest.fn(() => mockScreen),
    text: mockText,
    textbox: mockTextbox,
    box: mockBox,
  };
});

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
