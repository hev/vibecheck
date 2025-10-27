import { fetchModels } from './command-helpers';
import chalk from 'chalk';

interface ModelInfo {
  id: string;
  supported_parameters?: string[];
  pricing?: {
    prompt: string;
    completion: string;
  };
  [key: string]: unknown;
}

interface ResolveFilters {
  mcp?: boolean;
  price?: string;
  provider?: string;
}

/**
 * Calculate price tiers for models
 */
function calculatePriceTiers(models: ModelInfo[]): Map<string, string> {
  const modelPrices = models
    .filter(m => m.pricing?.prompt && m.pricing?.completion)
    .map(m => {
      const promptPrice = parseFloat(m.pricing!.prompt);
      const completionPrice = parseFloat(m.pricing!.completion);
      const avgPrice = (promptPrice + completionPrice) / 2;
      return { id: m.id, avgPrice };
    })
    .sort((a, b) => a.avgPrice - b.avgPrice);

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

/**
 * Check if a model has MCP support
 */
function hasMcpSupport(model: ModelInfo): boolean {
  if (Array.isArray(model.supported_parameters)) {
    return model.supported_parameters.includes('tools');
  }
  return false;
}

/**
 * Resolve model specifications to a list of model IDs
 * 
 * Supports:
 * - "all" to select all models
 * - "openai*" to match all OpenAI models
 * - Specific model IDs like "anthropic/claude-3.5-sonnet"
 * - Comma-delimited combinations of the above
 * 
 * Filters can be applied:
 * - mcp: Only models with MCP support
 * - price: Price quartiles (1,2,3,4 or "1,2")
 * - provider: Provider names (comma-delimited)
 */
export async function resolveModels(
  modelSpec: string,
  filters: ResolveFilters = {},
  debug?: boolean
): Promise<string[]> {
  const { mcp: mcpFilter, price: priceFilter, provider: providerFilter } = filters;

  // Fetch all models from API
  const models = await fetchModels(debug);

  if (models.length === 0) {
    console.log(chalk.yellow('No models available'));
    return [];
  }

  // Parse the model specification
  const specs = modelSpec.split(',').map(s => s.trim()).filter(s => s.length > 0);
  const resolvedIds = new Set<string>();

  for (const spec of specs) {
    if (spec === 'all') {
      // Add all models
      models.forEach((m: ModelInfo) => resolvedIds.add(m.id));
    } else if (spec.endsWith('*')) {
      // Wildcard match on provider prefix
      const provider = spec.slice(0, -1).toLowerCase();
      models.forEach((m: ModelInfo) => {
        const modelId = m.id.toLowerCase();
        const providerPrefix = modelId.split('/')[0];
        if (providerPrefix === provider) {
          resolvedIds.add(m.id);
        }
      });
    } else {
      // Specific model ID
      resolvedIds.add(spec);
    }
  }

  // Calculate price tiers for filtering
  const priceTiers = calculatePriceTiers(models);

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
  let filteredIds = Array.from(resolvedIds);

  // MCP filter
  if (mcpFilter) {
    filteredIds = filteredIds.filter(id => {
      const model = models.find((m: ModelInfo) => m.id === id);
      return model && hasMcpSupport(model);
    });
  }

  // Price filter
  if (priceQuartiles.length > 0) {
    const priceSymbols = priceQuartiles.map((q: number) => '$'.repeat(q));
    filteredIds = filteredIds.filter(id => {
      const tier = priceTiers.get(id);
      return tier && priceSymbols.includes(tier);
    });
  }

  // Provider filter
  if (providers.length > 0) {
    filteredIds = filteredIds.filter(id => {
      const modelId = id.toLowerCase();
      const providerPrefix = modelId.split('/')[0];
      return providers.includes(providerPrefix);
    });
  }

  if (debug && filteredIds.length !== Array.from(resolvedIds).length) {
    const originalCount = Array.from(resolvedIds).length;
    console.log(chalk.cyan(`[DEBUG] Model resolution: ${originalCount} → ${filteredIds.length} (after filters)`));
  }

  return filteredIds;
}

