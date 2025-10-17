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

  if (apiKeyRegex.test(envContent)) {
    // Update existing API key
    envContent = envContent.replace(apiKeyRegex, `VIBECHECK_API_KEY=${apiKey}`);
  } else {
    // Add new API key
    if (envContent && !envContent.endsWith('\n')) {
      envContent += '\n';
    }
    envContent += `VIBECHECK_API_KEY=${apiKey}\n`;
  }

  fs.writeFileSync(ENV_FILE, envContent, 'utf8');
}

/**
 * Gets the config file path
 */
export function getConfigPath(): string {
  return ENV_FILE;
}
