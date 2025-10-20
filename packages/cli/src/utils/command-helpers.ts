import axios from 'axios';
import { displayInvitePrompt } from './auth-error';
import { spawnSync } from 'child_process';
import { isNetworkError } from './network-error';

const API_URL = process.env.VIBECHECK_URL || 'http://localhost:3000';

export function getAuthHeaders() {
  const currentApiKey = process.env.VIBECHECK_API_KEY;
  
  if (!currentApiKey) {
    displayInvitePrompt();
    // Run the redeem command to prompt for code interactively
    spawnSync('vibe', ['redeem'], { stdio: 'inherit' });
    process.exit(1);
  }

  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${currentApiKey}`
  };
}

// Organization info
export async function fetchOrgInfo(debug: boolean = false) {
  const url = `${API_URL}/api/orginfo`;
  if (debug) {
    console.log(`[DEBUG] Request URL: ${url}`);
  }

  try {
    const response = await axios.get(url, {
      headers: getAuthHeaders()
    });

    if (debug) {
      console.log(`[DEBUG] Response status: ${response.status}`);
      console.log(`[DEBUG] Response data:`, JSON.stringify(response.data, null, 2));
    }

    if (response.data.error) {
      throw new Error(response.data.error);
    }

    return response.data;
  } catch (error: any) {
    handleApiError(error);
  }
}

// Suites
export async function fetchSuites(debug: boolean = false) {
  const url = `${API_URL}/api/suite/list`;
  if (debug) {
    console.log(`[DEBUG] Request URL: ${url}`);
  }

  const response = await axios.get(url, {
    headers: getAuthHeaders()
  });

  if (debug) {
    console.log(`[DEBUG] Response status: ${response.status}`);
    console.log(`[DEBUG] Response data:`, JSON.stringify(response.data, null, 2));
  }

  if (response.data.error) {
    throw new Error(response.data.error);
  }

  return response.data.suites || [];
}

export async function fetchSuite(name: string, debug: boolean = false) {
  const url = `${API_URL}/api/suite/${encodeURIComponent(name)}`;
  if (debug) {
    console.log(`[DEBUG] Request URL: ${url}`);
  }

  const response = await axios.get(url, {
    headers: await getAuthHeaders()
  });

  if (debug) {
    console.log(`[DEBUG] Response status: ${response.status}`);
    console.log(`[DEBUG] Response data:`, JSON.stringify(response.data, null, 2));
  }

  if (response.data.error) {
    throw new Error(response.data.error);
  }

  return response.data.suite;
}

// Runs
export async function fetchRuns(options: any = {}, debug: boolean = false) {
  const url = `${API_URL}/api/runs`;
  if (debug) {
    console.log(`[DEBUG] Request URL: ${url}`);
    console.log(`[DEBUG] Request options:`, options);
  }

  const response = await axios.get(url, {
    headers: getAuthHeaders(),
    params: options
  });

  if (debug) {
    console.log(`[DEBUG] Response status: ${response.status}`);
    console.log(`[DEBUG] Response data:`, JSON.stringify(response.data, null, 2));
  }

  if (response.data.error) {
    throw new Error(response.data.error);
  }

  return response.data.runs || [];
}

export async function fetchRun(runId: string, debug: boolean = false) {
  const url = `${API_URL}/api/runs/${encodeURIComponent(runId)}`;
  if (debug) {
    console.log(`[DEBUG] Request URL: ${url}`);
  }

  const response = await axios.get(url, {
    headers: getAuthHeaders()
  });

  if (debug) {
    console.log(`[DEBUG] Response status: ${response.status}`);
    console.log(`[DEBUG] Response data:`, JSON.stringify(response.data, null, 2));
  }

  if (response.data.error) {
    throw new Error(response.data.error);
  }

  return response.data.run;
}

// Models
export async function fetchModels(debug: boolean = false) {
  const url = `${API_URL}/api/models`;
  if (debug) {
    console.log(`[DEBUG] Request URL: ${url}`);
  }

  const response = await axios.get(url, {
    headers: getAuthHeaders()
  });

  if (debug) {
    console.log(`[DEBUG] Response status: ${response.status}`);
    console.log(`[DEBUG] Response data:`, JSON.stringify(response.data, null, 2));
  }

  if (response.data.error) {
    throw new Error(response.data.error);
  }

  return response.data.models || [];
}

// Error handling
export function handleApiError(error: any): never {
  // Handle network errors first
  if (isNetworkError(error)) {
    throw new Error('🎃 The Halloween pop-up can no longer be reached\n\nYour run logs are available at: ~/.vibecheck/runs\nGo to vibescheck.io to find out what\'s next.');
  }

  if (error.response?.status === 401 || error.response?.status === 403) {
    displayInvitePrompt();
    spawnSync('vibe', ['redeem'], { stdio: 'inherit' });
    process.exit(1);
  } else if (error.response?.status === 500) {
    throw new Error('Server error: The VibeCheck API encountered an error');
  } else if (error.response?.data?.error) {
    throw new Error(`API Error: ${error.response.data.error}`);
  } else {
    throw new Error(error.message);
  }
}
