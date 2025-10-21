import chalk from 'chalk';
import ora from 'ora';
import axios from 'axios';
import { displayInvitePrompt } from '../utils/auth-error';
import { isNetworkError, displayNetworkError } from '../utils/network-error';

const API_URL = process.env.VIBECHECK_URL || 'https://vibecheck-api-prod-681369865361.us-central1.run.app';

function getAuthHeaders() {
  const currentApiKey = process.env.VIBECHECK_API_KEY;
  
  if (!currentApiKey) {
    displayInvitePrompt();
    process.exit(1);
  }

  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${currentApiKey}`
  };
}

interface ModelPricing {
  prompt: string;
  completion: string;
  request?: string;
  image?: string;
}

interface ModelInfo {
  id: string;
  name?: string;
  description?: string;
  supported_parameters?: string[];
  pricing?: ModelPricing;
  [key: string]: unknown;
}

function calculatePriceTier(models: ModelInfo[]): Map<string, string> {
  // Calculate average price for each model
  const modelPrices = models
    .filter(m => m.pricing?.prompt && m.pricing?.completion)
    .map(m => {
      const promptPrice = parseFloat(m.pricing!.prompt);
      const completionPrice = parseFloat(m.pricing!.completion);
      const avgPrice = (promptPrice + completionPrice) / 2;
      return { id: m.id, avgPrice };
    })
    .sort((a, b) => a.avgPrice - b.avgPrice);

  // Create price tier map
  const tierMap = new Map<string, string>();
  const quartileSize = Math.ceil(modelPrices.length / 4);

  modelPrices.forEach((model, index) => {
    if (index < quartileSize) {
      tierMap.set(model.id, '$');
    } else if (index < quartileSize * 2) {
      tierMap.set(model.id, '$$');
    } else if (index < quartileSize * 3) {
      tierMap.set(model.id, '$$$');
    } else {
      tierMap.set(model.id, '$$$$');
    }
  });

  return tierMap;
}

function hasMcpSupport(model: ModelInfo): boolean {
  // Check if supported_parameters includes 'tools'
  if (Array.isArray(model.supported_parameters)) {
    return model.supported_parameters.includes('tools');
  }
  return false;
}

function pad(str: string, width: number): string {
  if (str.length > width) return str.slice(0, width - 1) + '…';
  return str + ' '.repeat(Math.max(0, width - str.length));
}

function colorizePrice(price: string): string {
  switch (price) {
    case '$': return chalk.green(price);
    case '$$': return chalk.yellow(price);
    case '$$$': return chalk.hex('#FFA500')(price); // orange
    case '$$$$': return chalk.red(price);
    default: return chalk.gray('-');
  }
}

export async function modelsCommand(debug: boolean = false, mcpFilter: boolean = false, priceFilter?: string, providerFilter?: string) {
  const spinner = ora('Fetching available models...').start();

  try {
    const url = `${API_URL}/api/models`;
    if (debug) {
      spinner.stop();
      console.log(chalk.gray(`[DEBUG] Request URL: ${url}`));
      spinner.start();
    }

    const response = await axios.get(url, {
      headers: getAuthHeaders()
    });

    if (debug) {
      spinner.stop();
      console.log(chalk.gray(`[DEBUG] Response status: ${response.status}`));
      console.log(chalk.gray(`[DEBUG] Response data:`), JSON.stringify(response.data, null, 2));
      spinner.start();
    }

    if (response.data.error) {
      spinner.fail(chalk.redBright(`Error: ${response.data.error}`));
      process.exit(1);
    }

    spinner.stop();

    let models: ModelInfo[] = response.data.models || [];

    if (models.length === 0) {
      console.log(chalk.yellow('No models available'));
      return;
    }

    // Calculate price tiers for all models first
    const priceTiers = calculatePriceTier(models);

    // Parse price filter
    let priceQuartiles: number[] = [];
    if (priceFilter) {
      priceQuartiles = priceFilter.split(',').map(q => parseInt(q.trim(), 10)).filter(q => q >= 1 && q <= 4);
    }

    // Parse provider filter
    let providers: string[] = [];
    if (providerFilter) {
      providers = providerFilter.split(',').map(p => p.trim().toLowerCase()).filter(p => p.length > 0);
    }

    // Apply filters
    const originalCount = models.length;
    if (mcpFilter) {
      models = models.filter(m => hasMcpSupport(m));
    }
    if (priceQuartiles.length > 0) {
      const priceSymbols = priceQuartiles.map(q => '$'.repeat(q));
      models = models.filter(m => {
        const tier = priceTiers.get(m.id);
        return tier && priceSymbols.includes(tier);
      });
    }
    if (providers.length > 0) {
      models = models.filter(m => {
        const modelId = m.id.toLowerCase();
        const providerPrefix = modelId.split('/')[0];
        return providers.includes(providerPrefix);
      });
    }

    // Check if filters resulted in no models
    if (models.length === 0) {
      console.log(chalk.yellow('No models match the specified filters'));
      return;
    }

    // Build filter description
    let filterDesc = '';
    if (mcpFilter || priceQuartiles.length > 0 || providers.length > 0) {
      const filters: string[] = [];
      if (mcpFilter) filters.push('MCP only');
      if (priceQuartiles.length > 0) {
        const priceSymbols = priceQuartiles.map(q => '$'.repeat(q)).join(', ');
        filters.push(`Price: ${priceSymbols}`);
      }
      if (providers.length > 0) {
        filters.push(`Provider: ${providers.join(', ')}`);
      }
      filterDesc = ` [${filters.join('] [')}]`;
    }

    // Display table
    console.log(chalk.bold(`\nModels (${models.length})${filterDesc}\n`));

    // Column widths
    const w1 = 40; // id
    const w2 = 50; // description
    const w3 = 5;  // mcp
    const w4 = 6;  // price

    // Header
    console.log(
      chalk.bold(
        pad('ID', w1) + '  ' +
        pad('Description', w2) + '  ' +
        pad('MCP', w3) + '  ' +
        pad('Price', w4)
      )
    );
    console.log('-'.repeat(w1 + w2 + w3 + w4 + 6));

    // Rows
    for (const model of models) {
      const id = String(model.id || '');
      const desc = String(model.description || model.name || '');
      const mcp = hasMcpSupport(model) ? 'yes' : 'no';
      const priceTier = priceTiers.get(model.id) || '-';

      console.log(
        chalk.cyan(pad(id, w1)) + '  ' +
        chalk.gray(pad(desc, w2)) + '  ' +
        (mcp === 'yes' ? chalk.green(pad(mcp, w3)) : chalk.gray(pad(mcp, w3))) + '  ' +
        colorizePrice(priceTier)
      );
    }

    console.log();
  } catch (error: any) {
    spinner.fail(chalk.redBright('Failed to fetch models'));

    // Handle network errors first
    if (isNetworkError(error)) {
      displayNetworkError();
      process.exit(1);
    }

    // Handle specific HTTP error codes
    if (error.response?.status === 401 || error.response?.status === 403) {
      displayInvitePrompt();
      process.exit(1);
    } else if (error.response?.status === 500) {
      console.error(chalk.redBright('\nServer error: The VibeCheck API encountered an error'));
      process.exit(1);
    } else if (error.response?.data?.error) {
      console.error(chalk.redBright(`\nAPI Error: ${error.response.data.error}`));
      process.exit(1);
    } else {
      console.error(chalk.redBright(`\n${error.message}`));
      process.exit(1);
    }
  }
}
