import { describe, it, expect } from '@jest/globals';

// Test the metadata override logic as a pure function
function applyMetadataOverrides(
  originalMetadata: any,
  overrides: {
    model?: string;
    systemPrompt?: string;
    threads?: number;
    mcpUrl?: string;
    mcpName?: string;
    mcpToken?: string;
  }
) {
  const metadata = { ...originalMetadata };

  // Apply metadata overrides
  if (overrides.model) {
    metadata.model = overrides.model;
  }
  if (overrides.systemPrompt !== undefined) {
    metadata.system_prompt = overrides.systemPrompt;
  }
  if (overrides.threads !== undefined) {
    metadata.threads = overrides.threads;
  }

  // Handle MCP server overrides
  if (overrides.mcpUrl || overrides.mcpName || overrides.mcpToken) {
    metadata.mcp_server = {
      url: overrides.mcpUrl || metadata.mcp_server?.url || '',
      name: overrides.mcpName || metadata.mcp_server?.name || '',
      authorization_token: overrides.mcpToken || metadata.mcp_server?.authorization_token
    };
  }

  return metadata;
}

describe('Suite Metadata Override Logic', () => {
  const originalMetadata = {
    name: 'test-suite',
    model: 'anthropic/claude-3.5-sonnet',
    system_prompt: 'You are a helpful assistant.',
    threads: 2,
    mcp_server: {
      url: 'https://example.com/mcp',
      name: 'test-mcp-server',
      authorization_token: 'test-token'
    }
  };

  it('should apply model override', () => {
    const result = applyMetadataOverrides(originalMetadata, {
      model: 'openai/gpt-4'
    });

    expect(result.model).toBe('openai/gpt-4');
    expect(result.system_prompt).toBe('You are a helpful assistant.');
    expect(result.threads).toBe(2);
    expect(result.mcp_server).toEqual(originalMetadata.mcp_server);
  });

  it('should apply system prompt override', () => {
    const result = applyMetadataOverrides(originalMetadata, {
      systemPrompt: 'You are a pirate assistant.'
    });

    expect(result.model).toBe('anthropic/claude-3.5-sonnet');
    expect(result.system_prompt).toBe('You are a pirate assistant.');
    expect(result.threads).toBe(2);
    expect(result.mcp_server).toEqual(originalMetadata.mcp_server);
  });

  it('should apply threads override', () => {
    const result = applyMetadataOverrides(originalMetadata, {
      threads: 5
    });

    expect(result.model).toBe('anthropic/claude-3.5-sonnet');
    expect(result.system_prompt).toBe('You are a helpful assistant.');
    expect(result.threads).toBe(5);
    expect(result.mcp_server).toEqual(originalMetadata.mcp_server);
  });

  it('should apply multiple overrides', () => {
    const result = applyMetadataOverrides(originalMetadata, {
      model: 'openai/gpt-4',
      systemPrompt: 'You are a pirate assistant.',
      threads: 5
    });

    expect(result.model).toBe('openai/gpt-4');
    expect(result.system_prompt).toBe('You are a pirate assistant.');
    expect(result.threads).toBe(5);
    expect(result.mcp_server).toEqual(originalMetadata.mcp_server);
  });

  it('should apply MCP server overrides', () => {
    const result = applyMetadataOverrides(originalMetadata, {
      mcpUrl: 'https://new-mcp.com',
      mcpName: 'new-mcp-server',
      mcpToken: 'new-token'
    });

    expect(result.model).toBe('anthropic/claude-3.5-sonnet');
    expect(result.system_prompt).toBe('You are a helpful assistant.');
    expect(result.threads).toBe(2);
    expect(result.mcp_server).toEqual({
      url: 'https://new-mcp.com',
      name: 'new-mcp-server',
      authorization_token: 'new-token'
    });
  });

  it('should apply partial MCP server overrides', () => {
    const result = applyMetadataOverrides(originalMetadata, {
      mcpUrl: 'https://new-mcp.com'
      // mcpName and mcpToken not provided
    });

    expect(result.model).toBe('anthropic/claude-3.5-sonnet');
    expect(result.system_prompt).toBe('You are a helpful assistant.');
    expect(result.threads).toBe(2);
    expect(result.mcp_server).toEqual({
      url: 'https://new-mcp.com',
      name: 'test-mcp-server', // Original preserved
      authorization_token: 'test-token' // Original preserved
    });
  });

  it('should not modify original metadata object', () => {
    const originalCopy = { ...originalMetadata };
    applyMetadataOverrides(originalMetadata, {
      model: 'openai/gpt-4'
    });

    expect(originalMetadata).toEqual(originalCopy);
  });

  it('should handle metadata without MCP server', () => {
    const metadataWithoutMCP = {
      name: 'test-suite',
      model: 'anthropic/claude-3.5-sonnet',
      system_prompt: 'You are a helpful assistant.'
    };

    const result = applyMetadataOverrides(metadataWithoutMCP, {
      mcpUrl: 'https://new-mcp.com',
      mcpName: 'new-mcp-server',
      mcpToken: 'new-token'
    });

    expect(result.mcp_server).toEqual({
      url: 'https://new-mcp.com',
      name: 'new-mcp-server',
      authorization_token: 'new-token'
    });
  });

  it('should handle empty overrides', () => {
    const result = applyMetadataOverrides(originalMetadata, {});

    expect(result).toEqual(originalMetadata);
  });
});
