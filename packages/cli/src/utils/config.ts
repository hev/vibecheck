import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const CONFIG_DIR = path.join(os.homedir(), '.vibecheck');
const ENV_FILE = path.join(CONFIG_DIR, '.env');

/**
 * Ensures the config directory exists
 */
export function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

/**
 * Reads the current .env file contents
 */
export function readEnvFile(): string {
  ensureConfigDir();

  if (!fs.existsSync(ENV_FILE)) {
    return '';
  }

  return fs.readFileSync(ENV_FILE, 'utf8');
}

/**
 * Writes or updates the API key in the .env file
 */
export function saveApiKey(apiKey: string): void {
  ensureConfigDir();

  let envContent = readEnvFile();
  const apiKeyRegex = /^VIBECHECK_API_KEY=.*$/m;

  debugConfig('saveApiKey', `Saving API key to ${ENV_FILE}`);

  if (apiKeyRegex.test(envContent)) {
    // Update existing API key
    envContent = envContent.replace(apiKeyRegex, `VIBECHECK_API_KEY=${apiKey}`);
    debugConfig('saveApiKey', 'Updated existing API key');
  } else {
    // Add new API key
    if (envContent && !envContent.endsWith('\n')) {
      envContent += '\n';
    }
    envContent += `VIBECHECK_API_KEY=${apiKey}\n`;
    debugConfig('saveApiKey', 'Added new API key');
  }

  fs.writeFileSync(ENV_FILE, envContent, 'utf8');
  debugConfig('saveApiKey', `File written successfully`);
}

/**
 * Gets the config file path
 */
export function getConfigPath(): string {
  return ENV_FILE;
}

/**
 * Reads the API key from the .env file
 */
export function readApiKey(): string | null {
  const envContent = readEnvFile();
  const apiKeyMatch = envContent.match(/^VIBECHECK_API_KEY=(.+)$/m);
  return apiKeyMatch ? apiKeyMatch[1] : null;
}

/**
 * Reads the API URL from the .env file
 */
export function readApiUrl(): string | null {
  const envContent = readEnvFile();
  const urlMatch = envContent.match(/^VIBECHECK_URL=(.+)$/m);
  return urlMatch ? urlMatch[1] : null;
}

/**
 * Writes or updates the API URL in the .env file
 */
export function saveApiUrl(url: string): void {
  ensureConfigDir();

  let envContent = readEnvFile();
  const urlRegex = /^VIBECHECK_URL=.*$/m;

  debugConfig('saveApiUrl', `Saving API URL to ${ENV_FILE}`);

  if (urlRegex.test(envContent)) {
    // Update existing API URL
    envContent = envContent.replace(urlRegex, `VIBECHECK_URL=${url}`);
    debugConfig('saveApiUrl', 'Updated existing API URL');
  } else {
    // Add new API URL
    if (envContent && !envContent.endsWith('\n')) {
      envContent += '\n';
    }
    envContent += `VIBECHECK_URL=${url}\n`;
    debugConfig('saveApiUrl', 'Added new API URL');
  }

  fs.writeFileSync(ENV_FILE, envContent, 'utf8');
  debugConfig('saveApiUrl', `File written successfully`);
}

/**
 * Gets the effective API URL with proper precedence:
 * 1. Environment variable VIBECHECK_API_URL (highest priority)
 * 2. Environment variable VIBECHECK_URL
 * 3. Environment variable API_BASE_URL
 * 4. .env file VIBECHECK_URL
 * 5. Default production URL (lowest priority: http://localhost:3000 for user-cli commands)
 */
export function getApiUrl(): string {
  // Check environment variables first (highest priority)
  if (process.env.VIBECHECK_API_URL) {
    debugConfig('getApiUrl', `Using environment variable: ${process.env.VIBECHECK_API_URL}`);
    return process.env.VIBECHECK_API_URL;
  }
  
  if (process.env.VIBECHECK_URL) {
    debugConfig('getApiUrl', `Using environment variable: ${process.env.VIBECHECK_URL}`);
    return process.env.VIBECHECK_URL;
  }
  
  if (process.env.API_BASE_URL) {
    debugConfig('getApiUrl', `Using environment variable: ${process.env.API_BASE_URL}`);
    return process.env.API_BASE_URL;
  }

  // Check .env file
  const envUrl = readApiUrl();
  if (envUrl) {
    debugConfig('getApiUrl', `Using .env file: ${envUrl}`);
    return envUrl;
  }

  // Use default production URL
  const defaultUrl = 'https://vibecheck-api-prod-681369865361.us-central1.run.app';
  debugConfig('getApiUrl', `Using default URL: ${defaultUrl}`);
  return defaultUrl;
}

/**
 * Gets the effective API URL for runtime commands.
 * Delegates to getApiUrl() so all commands share identical behavior and
 * default to the production Cloud Run URL unless overridden by env or .env.
 */
export function getApiUrlForRuntime(): string {
  return getApiUrl();
}

/**
 * Gets the org API key with proper precedence:
 * 1. Environment variable VIBECHECK_API_KEY
 * 2. Environment variable API_KEY
 * 3. .env file VIBECHECK_API_KEY
 */
export function getOrgApiKey(): string | null {
  // Check environment variables first
  if (process.env.VIBECHECK_API_KEY) {
    debugConfig('getOrgApiKey', 'Using VIBECHECK_API_KEY from environment');
    return process.env.VIBECHECK_API_KEY;
  }
  
  if (process.env.API_KEY) {
    debugConfig('getOrgApiKey', 'Using API_KEY from environment');
    return process.env.API_KEY;
  }

  // Check .env file
  const envKey = readApiKey();
  if (envKey) {
    debugConfig('getOrgApiKey', 'Using API key from .env file');
    return envKey;
  }

  return null;
}

/**
 * Debug function to log config file operations
 */
export function debugConfig(operation: string, details?: any): void {
  if (process.argv.includes('--debug')) {
    const chalk = require('chalk');
    console.log(chalk.cyan(`[DEBUG] Config ${operation}:`), details || '');
  }
}
