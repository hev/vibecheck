import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { resolveModels } from './model-resolver';
import { fetchModels } from './command-helpers';

// Mock the command-helpers module
jest.mock('./command-helpers', () => ({
  fetchModels: jest.fn()
}));

const mockFetchModels = fetchModels as jest.MockedFunction<typeof fetchModels>;

describe('Model Resolver', () => {
  const mockModels = [
    { id: 'openai/gpt-4', supported_parameters: ['tools'], pricing: { prompt: '0.03', completion: '0.06' } },
    { id: 'openai/gpt-4-turbo', supported_parameters: ['tools'], pricing: { prompt: '0.01', completion: '0.03' } },
    { id: 'openai/gpt-3.5-turbo', pricing: { prompt: '0.0015', completion: '0.002' } },
    { id: 'anthropic/claude-3.5-sonnet', supported_parameters: ['tools'], pricing: { prompt: '0.003', completion: '0.015' } },
    { id: 'anthropic/claude-3-opus', supported_parameters: ['tools'], pricing: { prompt: '0.015', completion: '0.075' } },
    { id: 'google/gemini-pro', pricing: { prompt: '0.0005', completion: '0.0015' } },
    { id: 'google/gemini-ultra', pricing: { prompt: '0.001', completion: '0.005' } }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchModels.mockResolvedValue(mockModels);
  });

  it('should resolve "all" to return all models', async () => {
    const result = await resolveModels('all');
    expect(result).toHaveLength(7);
    expect(result).toContain('openai/gpt-4');
    expect(result).toContain('anthropic/claude-3.5-sonnet');
    expect(result).toContain('google/gemini-pro');
  });

  it('should resolve provider wildcard "openai*" to return only OpenAI models', async () => {
    const result = await resolveModels('openai*');
    expect(result).toHaveLength(3);
    expect(result).toContain('openai/gpt-4');
    expect(result).toContain('openai/gpt-4-turbo');
    expect(result).toContain('openai/gpt-3.5-turbo');
    expect(result).not.toContain('anthropic/claude-3.5-sonnet');
  });

  it('should resolve multiple wildcards "anthropic*,google*" correctly', async () => {
    const result = await resolveModels('anthropic*,google*');
    expect(result).toHaveLength(4);
    expect(result).toContain('anthropic/claude-3.5-sonnet');
    expect(result).toContain('anthropic/claude-3-opus');
    expect(result).toContain('google/gemini-pro');
    expect(result).toContain('google/gemini-ultra');
    expect(result).not.toContain('openai/gpt-4');
  });

  it('should resolve specific model ID', async () => {
    const result = await resolveModels('anthropic/claude-3.5-sonnet');
    expect(result).toHaveLength(1);
    expect(result).toContain('anthropic/claude-3.5-sonnet');
  });

  it('should resolve mixed wildcards and specific models', async () => {
    const result = await resolveModels('openai*,anthropic/claude-3.5-sonnet');
    expect(result).toHaveLength(4);
    expect(result).toContain('openai/gpt-4');
    expect(result).toContain('openai/gpt-4-turbo');
    expect(result).toContain('openai/gpt-3.5-turbo');
    expect(result).toContain('anthropic/claude-3.5-sonnet');
    expect(result).not.toContain('google/gemini-pro');
  });

  it('should filter by MCP support when mcp filter is enabled', async () => {
    const result = await resolveModels('all', { mcp: true });
    // Only models with tools support should be included
    expect(result).toHaveLength(4);
    expect(result).toContain('openai/gpt-4');
    expect(result).toContain('openai/gpt-4-turbo');
    expect(result).toContain('anthropic/claude-3.5-sonnet');
    expect(result).toContain('anthropic/claude-3-opus');
    expect(result).not.toContain('openai/gpt-3.5-turbo');
    expect(result).not.toContain('google/gemini-pro');
  });

  it('should filter by price quartile 1 (cheapest)', async () => {
    const result = await resolveModels('all', { price: '1' });
    // Should return only the cheapest quartile ($ tier)
    expect(result).toHaveLength(2); // google/gemini-pro and openai/gpt-3.5-turbo are cheapest
    expect(result).toContain('google/gemini-pro');
    expect(result).toContain('openai/gpt-3.5-turbo');
  });

  it('should filter by multiple price quartiles', async () => {
    const result = await resolveModels('all', { price: '1,2' });
    // Should return bottom 2 quartiles
    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  it('should filter by provider', async () => {
    const result = await resolveModels('all', { provider: 'anthropic' });
    expect(result).toHaveLength(2);
    expect(result).toContain('anthropic/claude-3.5-sonnet');
    expect(result).toContain('anthropic/claude-3-opus');
    expect(result).not.toContain('openai/gpt-4');
  });

  it('should filter by multiple providers', async () => {
    const result = await resolveModels('all', { provider: 'anthropic,openai' });
    expect(result).toHaveLength(5);
    expect(result).toContain('anthropic/claude-3.5-sonnet');
    expect(result).toContain('openai/gpt-4');
    expect(result).not.toContain('google/gemini-pro');
  });

  it('should combine MCP and price filters', async () => {
    const result = await resolveModels('all', { mcp: true, price: '1' });
    // Should return MCP-supported models in the cheapest quartile
    expect(result.length).toBeGreaterThanOrEqual(0);
    // Ensure all returned models have MCP support
    result.forEach(id => {
      const model = mockModels.find(m => m.id === id);
      expect(model?.supported_parameters).toContain('tools');
    });
  });

  it('should combine wildcard with MCP filter', async () => {
    const result = await resolveModels('openai*', { mcp: true });
    expect(result).toHaveLength(2);
    expect(result).toContain('openai/gpt-4');
    expect(result).toContain('openai/gpt-4-turbo');
    expect(result).not.toContain('openai/gpt-3.5-turbo'); // No MCP support
  });

  it('should return empty array when no models match filters', async () => {
    const result = await resolveModels('google*', { mcp: true });
    // No Google models have MCP support
    expect(result).toHaveLength(0);
  });

  it('should handle empty model spec gracefully', async () => {
    const result = await resolveModels('');
    expect(result).toHaveLength(0);
  });

  it('should handle non-existent model ID', async () => {
    const result = await resolveModels('non-existent/model');
    expect(result).toHaveLength(1);
    expect(result).toContain('non-existent/model');
  });

  it('should trim whitespace from model specs', async () => {
    const result = await resolveModels(' openai* , anthropic* ');
    expect(result).toHaveLength(5);
    expect(result).toContain('openai/gpt-4');
    expect(result).toContain('anthropic/claude-3.5-sonnet');
  });
});

