import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const CONFIG_DIR = path.join(os.homedir(), '.vibecheck');
const ENV_FILE = path.join(CONFIG_DIR, '.env');

/**
 * Reads the .env file contents
 */
function readEnvFile(): string {
  if (!fs.existsSync(ENV_FILE)) {
    return '';
  }

  try {
    return fs.readFileSync(ENV_FILE, 'utf8');
  } catch {
    return '';
  }
}

/**
 * Reads the API key from the .env file
 */
function readApiKeyFromFile(): string | null {
  const envContent = readEnvFile();
  const apiKeyMatch = envContent.match(/^VIBECHECK_API_KEY=(.+)$/m);
  return apiKeyMatch ? apiKeyMatch[1].trim() : null;
}

/**
 * Reads the API URL from the .env file
 */
function readApiUrlFromFile(): string | null {
  const envContent = readEnvFile();
  const urlMatch = envContent.match(/^VIBECHECK_URL=(.+)$/m);
  return urlMatch ? urlMatch[1].trim() : null;
}

/**
 * Gets the API key with proper precedence:
 * 1. Environment variable VIBECHECK_API_KEY
 * 2. Environment variable API_KEY
 * 3. .env file VIBECHECK_API_KEY
 */
export function getApiKey(): string | null {
  // Check environment variables first
  if (process.env.VIBECHECK_API_KEY) {
    return process.env.VIBECHECK_API_KEY;
  }

  if (process.env.API_KEY) {
    return process.env.API_KEY;
  }

  // Check .env file
  return readApiKeyFromFile();
}

/**
 * Gets the API URL with proper precedence:
 * 1. Environment variable VIBECHECK_API_URL
 * 2. Environment variable VIBECHECK_URL
 * 3. Environment variable API_BASE_URL
 * 4. .env file VIBECHECK_URL
 * 5. null (caller will use default)
 */
export function getApiUrl(): string | null {
  // Check environment variables first
  if (process.env.VIBECHECK_API_URL) {
    return process.env.VIBECHECK_API_URL;
  }

  if (process.env.VIBECHECK_URL) {
    return process.env.VIBECHECK_URL;
  }

  if (process.env.API_BASE_URL) {
    return process.env.API_BASE_URL;
  }

  // Check .env file
  return readApiUrlFromFile();
}
