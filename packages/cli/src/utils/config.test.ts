import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock modules before importing
jest.mock('fs');
jest.mock('os');

// Set up mocks before importing config
const mockHomeDir = '/mock/home';

// Mock os.homedir() before importing config
jest.doMock('os', () => ({
  homedir: jest.fn(() => mockHomeDir)
}));

// Mock fs before importing config
jest.doMock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn()
}));

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { 
  readApiUrl, 
  saveApiUrl, 
  getApiUrl, 
  readApiKey, 
  saveApiKey,
  readEnvFile,
  ensureConfigDir,
  getConfigPath
} from './config';

const mockedFs = fs as jest.Mocked<typeof fs>;
const mockedOs = os as jest.Mocked<typeof os>;

describe('Config utilities', () => {
  const mockHomeDir = '/mock/home';
  const mockConfigDir = path.join(mockHomeDir, '.vibecheck');
  const mockEnvFile = path.join(mockConfigDir, '.env');

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock os.homedir()
    mockedOs.homedir.mockReturnValue(mockHomeDir);
    
    // Mock fs.existsSync to return true for config dir
    mockedFs.existsSync.mockImplementation((filePath: any) => {
      if (filePath === mockConfigDir) return true;
      if (filePath === mockEnvFile) return true;
      return false;
    });
  });

  afterEach(() => {
    // Clear environment variables
    delete process.env.VIBECHECK_URL;
  });

  describe('readApiUrl', () => {
    it('should read VIBECHECK_URL from .env file', () => {
      const mockEnvContent = 'VIBECHECK_API_KEY=test-key\nVIBECHECK_URL=http://localhost:3000\n';
      mockedFs.readFileSync.mockReturnValue(mockEnvContent);

      const result = readApiUrl();
      expect(result).toBe('http://localhost:3000');
      expect(mockedFs.readFileSync).toHaveBeenCalledWith(mockEnvFile, 'utf8');
    });

    it('should return null when VIBECHECK_URL not found in .env file', () => {
      const mockEnvContent = 'VIBECHECK_API_KEY=test-key\n';
      mockedFs.readFileSync.mockReturnValue(mockEnvContent);

      const result = readApiUrl();
      expect(result).toBeNull();
    });

    it('should return null when .env file does not exist', () => {
      mockedFs.existsSync.mockReturnValue(false);
      mockedFs.readFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });

      const result = readApiUrl();
      expect(result).toBeNull();
    });
  });

  describe('saveApiUrl', () => {
    it('should save VIBECHECK_URL to new .env file', () => {
      mockedFs.existsSync.mockReturnValue(false);
      mockedFs.readFileSync.mockReturnValue('');
      mockedFs.writeFileSync.mockImplementation(() => {});

      saveApiUrl('http://localhost:3000');

      expect(mockedFs.mkdirSync).toHaveBeenCalledWith(mockConfigDir, { recursive: true });
      expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
        mockEnvFile,
        'VIBECHECK_URL=http://localhost:3000\n',
        'utf8'
      );
    });

    it('should update existing VIBECHECK_URL in .env file', () => {
      const mockEnvContent = 'VIBECHECK_API_KEY=test-key\nVIBECHECK_URL=http://old-url\nOTHER_VAR=value\n';
      mockedFs.readFileSync.mockReturnValue(mockEnvContent);
      mockedFs.writeFileSync.mockImplementation(() => {});

      saveApiUrl('http://localhost:3000');

      expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
        mockEnvFile,
        'VIBECHECK_API_KEY=test-key\nVIBECHECK_URL=http://localhost:3000\nOTHER_VAR=value\n',
        'utf8'
      );
    });

    it('should add VIBECHECK_URL to existing .env file without URL', () => {
      const mockEnvContent = 'VIBECHECK_API_KEY=test-key\nOTHER_VAR=value';
      mockedFs.readFileSync.mockReturnValue(mockEnvContent);
      mockedFs.writeFileSync.mockImplementation(() => {});

      saveApiUrl('http://localhost:3000');

      expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
        mockEnvFile,
        'VIBECHECK_API_KEY=test-key\nOTHER_VAR=value\nVIBECHECK_URL=http://localhost:3000\n',
        'utf8'
      );
    });
  });

  describe('getApiUrl', () => {
    it('should return environment variable when set (highest priority)', () => {
      process.env.VIBECHECK_URL = 'http://env-url';
      
      const result = getApiUrl();
      expect(result).toBe('http://env-url');
    });

    it('should return .env file value when no environment variable', () => {
      delete process.env.VIBECHECK_URL;
      const mockEnvContent = 'VIBECHECK_URL=http://env-file-url\n';
      mockedFs.readFileSync.mockReturnValue(mockEnvContent);

      const result = getApiUrl();
      expect(result).toBe('http://env-file-url');
    });

    it('should return default URL when neither environment nor .env file has URL', () => {
      delete process.env.VIBECHECK_URL;
      mockedFs.readFileSync.mockReturnValue('');
      
      const result = getApiUrl();
      expect(result).toBe('https://vibecheck-api-prod-681369865361.us-central1.run.app');
    });

    it('should return default URL when .env file does not exist', () => {
      delete process.env.VIBECHECK_URL;
      mockedFs.existsSync.mockReturnValue(false);
      mockedFs.readFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });

      const result = getApiUrl();
      expect(result).toBe('https://vibecheck-api-prod-681369865361.us-central1.run.app');
    });
  });

  describe('integration with existing functions', () => {
    it('should work with saveApiKey and saveApiUrl independently', () => {
      mockedFs.existsSync.mockReturnValue(false);
      mockedFs.readFileSync.mockReturnValue('');
      mockedFs.writeFileSync.mockImplementation(() => {});

      // Save API key
      saveApiKey('test-api-key');
      expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
        mockEnvFile,
        'VIBECHECK_API_KEY=test-api-key\n',
        'utf8'
      );

      // Save API URL
      saveApiUrl('http://localhost:3000');
      expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
        mockEnvFile,
        'VIBECHECK_URL=http://localhost:3000\n',
        'utf8'
      );
    });
  });
});
