import chalk from 'chalk';
import axios from 'axios';
import { getApiUrlForRuntime, getOrgApiKey } from '../utils/config';

/**
 * Gets auth headers for runtime API requests
 */
function getAuthHeaders(): { 'Content-Type': string; 'Authorization': string } {
  const apiKey = getOrgApiKey();
  
  if (!apiKey) {
    console.error(chalk.redBright('Error: API key required'));
    console.error(chalk.gray('Set VIBECHECK_API_KEY or API_KEY environment variable'));
    process.exit(1);
  }

  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  };
}

/**
 * Normalize secret name (trim whitespace)
 */
function normalizeName(name: string): string {
  return name.trim();
}

/**
 * Handle API errors with user-friendly messages
 */
function handleApiError(error: any): never {
  if (error.response?.status === 400) {
    const errorMsg = error.response?.data?.error || error.response?.data?.message || 'Invalid request';
    console.error(chalk.redBright(`Error: ${errorMsg}`));
    process.exit(1);
  } else if (error.response?.status === 403) {
    console.error(chalk.redBright('Error: Forbidden'));
    console.error(chalk.gray('Missing or invalid org API key. Check VIBECHECK_API_KEY or API_KEY.'));
    process.exit(1);
  } else if (error.response?.status === 404) {
    console.error(chalk.redBright('Not found'));
    process.exit(1);
  } else if (error.response?.data?.error) {
    console.error(chalk.redBright(`Error: ${error.response.data.error}`));
    process.exit(1);
  } else {
    console.error(chalk.redBright(`Error: ${error.message || 'Unknown error'}`));
    process.exit(1);
  }
}

/**
 * Set a secret
 */
export async function secretSetCommand(name: string, value: string, debug: boolean = false) {
  const normalizedName = normalizeName(name);
  
  if (!normalizedName) {
    console.error(chalk.redBright('Error: Secret name is required'));
    process.exit(1);
  }

  try {
    const url = `${getApiUrlForRuntime()}/api/runtime/secrets`;
    
    if (debug) {
      console.log(chalk.gray(`[DEBUG] POST ${url}`));
      console.log(chalk.gray(`[DEBUG] Body: ${JSON.stringify({ name: normalizedName, value: '[REDACTED]' }, null, 2)}`));
    }

    const response = await axios.post(url, { name: normalizedName, value }, {
      headers: getAuthHeaders()
    });

    if (debug) {
      console.log(chalk.gray(`[DEBUG] Status: ${response.status}`));
      console.log(chalk.gray(`[DEBUG] Response: ${JSON.stringify(response.data, null, 2)}`));
    }

    console.log(chalk.green('Secret set.'));
  } catch (error: any) {
    handleApiError(error);
  }
}

/**
 * Update a secret
 */
export async function secretUpdateCommand(name: string, value: string, debug: boolean = false) {
  const normalizedName = normalizeName(name);
  
  if (!normalizedName) {
    console.error(chalk.redBright('Error: Secret name is required'));
    process.exit(1);
  }

  try {
    const url = `${getApiUrlForRuntime()}/api/runtime/secrets/${encodeURIComponent(normalizedName)}`;
    
    if (debug) {
      console.log(chalk.gray(`[DEBUG] PUT ${url}`));
      console.log(chalk.gray(`[DEBUG] Body: ${JSON.stringify({ value: '[REDACTED]' }, null, 2)}`));
    }

    const response = await axios.put(url, { value }, {
      headers: getAuthHeaders()
    });

    if (debug) {
      console.log(chalk.gray(`[DEBUG] Status: ${response.status}`));
      console.log(chalk.gray(`[DEBUG] Response: ${JSON.stringify(response.data, null, 2)}`));
    }

    console.log(chalk.green('Secret updated.'));
  } catch (error: any) {
    handleApiError(error);
  }
}

/**
 * List all secrets (names only, no values)
 */
export async function secretListCommand(debug: boolean = false) {
  try {
    const url = `${getApiUrlForRuntime()}/api/runtime/secrets`;
    
    if (debug) {
      console.log(chalk.gray(`[DEBUG] GET ${url}`));
    }

    const response = await axios.get(url, {
      headers: getAuthHeaders()
    });

    if (debug) {
      console.log(chalk.gray(`[DEBUG] Status: ${response.status}`));
      console.log(chalk.gray(`[DEBUG] Response: ${JSON.stringify(response.data, null, 2)}`));
    }

    const secrets = response.data.secrets || [];
    
    // Print secret names only (one per line)
    secrets.forEach((s: { name: string }) => {
      console.log(s.name);
    });
  } catch (error: any) {
    handleApiError(error);
  }
}

/**
 * Delete a secret
 */
export async function secretDeleteCommand(name: string, debug: boolean = false) {
  const normalizedName = normalizeName(name);
  
  if (!normalizedName) {
    console.error(chalk.redBright('Error: Secret name is required'));
    process.exit(1);
  }

  try {
    const url = `${getApiUrlForRuntime()}/api/runtime/secrets/${encodeURIComponent(normalizedName)}`;
    
    if (debug) {
      console.log(chalk.gray(`[DEBUG] DELETE ${url}`));
    }

    const response = await axios.delete(url, {
      headers: getAuthHeaders()
    });

    if (debug) {
      console.log(chalk.gray(`[DEBUG] Status: ${response.status}`));
      console.log(chalk.gray(`[DEBUG] Response: ${JSON.stringify(response.data, null, 2)}`));
    }

    console.log(chalk.green('Secret deleted.'));
  } catch (error: any) {
    handleApiError(error);
  }
}

