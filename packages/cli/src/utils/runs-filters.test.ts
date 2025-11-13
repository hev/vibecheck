import { describe, it, expect } from '@jest/globals';
import { buildRunsQueryParams, RunsListFilters } from './runs-filters';

describe('runs-filters utilities', () => {
  describe('buildRunsQueryParams', () => {
    it('should return empty string when no filters provided', () => {
      const result = buildRunsQueryParams({});
      expect(result).toBe('');
    });

    it('should build status filter', () => {
      const filters: RunsListFilters = { status: 'completed' };
      const result = buildRunsQueryParams(filters);
      expect(result).toBe('status=completed');
    });

    it('should build statusIn filter with multiple values', () => {
      const filters: RunsListFilters = { statusIn: 'completed,running' };
      const result = buildRunsQueryParams(filters);
      expect(result).toBe('status=completed%2Crunning');
    });

    it('should build statusNe filter', () => {
      const filters: RunsListFilters = { statusNe: 'failed' };
      const result = buildRunsQueryParams(filters);
      expect(result).toBe('status__ne=failed');
    });

    it('should build model filter', () => {
      const filters: RunsListFilters = { model: 'anthropic/claude-3-5-sonnet' };
      const result = buildRunsQueryParams(filters);
      expect(result).toBe('model=anthropic%2Fclaude-3-5-sonnet');
    });

    it('should build modelLike filter', () => {
      const filters: RunsListFilters = { modelLike: 'anthropic%' };
      const result = buildRunsQueryParams(filters);
      expect(result).toBe('model__like=anthropic%25');
    });

    it('should build suite filter (maps to suite_name)', () => {
      const filters: RunsListFilters = { suite: 'test-suite' };
      const result = buildRunsQueryParams(filters);
      expect(result).toBe('suite_name=test-suite');
    });

    it('should build cost range filters', () => {
      const filters: RunsListFilters = { minCost: 0.001, maxCost: 0.01 };
      const result = buildRunsQueryParams(filters);
      expect(result).toBe('total_cost__gte=0.001&total_cost__lte=0.01');
    });

    it('should handle zero cost filters', () => {
      const filters: RunsListFilters = { minCost: 0, maxCost: 0 };
      const result = buildRunsQueryParams(filters);
      expect(result).toBe('total_cost__gte=0&total_cost__lte=0');
    });

    it('should build success percentage filters', () => {
      const filters: RunsListFilters = { minSuccess: 80, maxSuccess: 100 };
      const result = buildRunsQueryParams(filters);
      expect(result).toBe('success_percentage__gte=80&success_percentage__lte=100');
    });

    it('should handle zero success filters', () => {
      const filters: RunsListFilters = { minSuccess: 0 };
      const result = buildRunsQueryParams(filters);
      expect(result).toBe('success_percentage__gte=0');
    });

    it('should normalize date filters without time component (from)', () => {
      const filters: RunsListFilters = { dateFrom: '2024-01-15' };
      const result = buildRunsQueryParams(filters);
      expect(result).toBe('created_at__gte=2024-01-15T00%3A00%3A00Z');
    });

    it('should normalize date filters without time component (to)', () => {
      const filters: RunsListFilters = { dateTo: '2024-01-15' };
      const result = buildRunsQueryParams(filters);
      expect(result).toBe('created_at__lte=2024-01-15T23%3A59%3A59Z');
    });

    it('should preserve date filters with time component', () => {
      const filters: RunsListFilters = {
        dateFrom: '2024-01-15T10:30:00Z',
        dateTo: '2024-01-16T10:30:00Z'
      };
      const result = buildRunsQueryParams(filters);
      expect(result).toBe('created_at__gte=2024-01-15T10%3A30%3A00Z&created_at__lte=2024-01-16T10%3A30%3A00Z');
    });

    it('should build completed date filters', () => {
      const filters: RunsListFilters = {
        completedFrom: '2024-01-15',
        completedTo: '2024-01-16'
      };
      const result = buildRunsQueryParams(filters);
      expect(result).toBe('completed_at__gte=2024-01-15T00%3A00%3A00Z&completed_at__lte=2024-01-16T23%3A59%3A59Z');
    });

    it('should build duration filters', () => {
      const filters: RunsListFilters = { minDuration: 1.5, maxDuration: 10.0 };
      const result = buildRunsQueryParams(filters);
      expect(result).toBe('duration_seconds__gte=1.5&duration_seconds__lte=10');
    });

    it('should handle zero duration', () => {
      const filters: RunsListFilters = { minDuration: 0 };
      const result = buildRunsQueryParams(filters);
      expect(result).toBe('duration_seconds__gte=0');
    });

    it('should include pagination parameters', () => {
      const result = buildRunsQueryParams({}, 50, 10);
      expect(result).toBe('limit=50&offset=10');
    });

    it('should handle zero pagination values', () => {
      const result = buildRunsQueryParams({}, 0, 0);
      expect(result).toBe('limit=0&offset=0');
    });

    it('should combine multiple filters correctly', () => {
      const filters: RunsListFilters = {
        status: 'completed',
        suite: 'test-suite',
        minSuccess: 80,
        dateFrom: '2024-01-01'
      };
      const result = buildRunsQueryParams(filters, 50, 0);

      // Parse and verify all parameters are present
      const params = new URLSearchParams(result);
      expect(params.get('status')).toBe('completed');
      expect(params.get('suite_name')).toBe('test-suite');
      expect(params.get('success_percentage__gte')).toBe('80');
      expect(params.get('created_at__gte')).toBe('2024-01-01T00:00:00Z');
      expect(params.get('limit')).toBe('50');
      expect(params.get('offset')).toBe('0');
    });

    it('should handle all filters together', () => {
      const filters: RunsListFilters = {
        status: 'completed',
        statusNe: 'failed',
        model: 'gpt-4',
        modelLike: 'anthropic%',
        suite: 'test-suite',
        minCost: 0.001,
        maxCost: 0.01,
        minSuccess: 50,
        maxSuccess: 100,
        dateFrom: '2024-01-01',
        dateTo: '2024-01-31',
        completedFrom: '2024-01-01T00:00:00Z',
        completedTo: '2024-01-31T23:59:59Z',
        minDuration: 1.0,
        maxDuration: 10.0
      };
      const result = buildRunsQueryParams(filters, 100, 0);

      // Verify all parameters are present
      const params = new URLSearchParams(result);
      expect(params.get('status')).toBe('completed');
      expect(params.get('status__ne')).toBe('failed');
      expect(params.get('model')).toBe('gpt-4');
      expect(params.get('model__like')).toBe('anthropic%');
      expect(params.get('suite_name')).toBe('test-suite');
      expect(params.get('total_cost__gte')).toBe('0.001');
      expect(params.get('total_cost__lte')).toBe('0.01');
      expect(params.get('success_percentage__gte')).toBe('50');
      expect(params.get('success_percentage__lte')).toBe('100');
      expect(params.get('created_at__gte')).toBe('2024-01-01T00:00:00Z');
      expect(params.get('created_at__lte')).toBe('2024-01-31T23:59:59Z');
      expect(params.get('completed_at__gte')).toBe('2024-01-01T00:00:00Z');
      expect(params.get('completed_at__lte')).toBe('2024-01-31T23:59:59Z');
      expect(params.get('duration_seconds__gte')).toBe('1');
      expect(params.get('duration_seconds__lte')).toBe('10');
      expect(params.get('limit')).toBe('100');
      expect(params.get('offset')).toBe('0');
    });

    it('should handle special characters in filter values', () => {
      const filters: RunsListFilters = {
        suite: 'test suite with spaces',
        model: 'anthropic/claude-3-5-sonnet'
      };
      const result = buildRunsQueryParams(filters);

      const params = new URLSearchParams(result);
      expect(params.get('suite_name')).toBe('test suite with spaces');
      expect(params.get('model')).toBe('anthropic/claude-3-5-sonnet');
    });

    it('should skip undefined filter values', () => {
      const filters: RunsListFilters = {
        status: 'completed',
        suite: undefined,
        minSuccess: undefined
      };
      const result = buildRunsQueryParams(filters);
      expect(result).toBe('status=completed');
    });

    it('should skip empty string values', () => {
      const filters: RunsListFilters = {
        status: '',
        suite: ''
      };
      const result = buildRunsQueryParams(filters);
      // Empty strings are falsy in the if checks, so they should be skipped
      expect(result).toBe('');
    });
  });

  describe('Date normalization edge cases', () => {
    it('should normalize simple YYYY-MM-DD dates for from filter', () => {
      const filters: RunsListFilters = { dateFrom: '2024-12-25' };
      const result = buildRunsQueryParams(filters);
      expect(result).toBe('created_at__gte=2024-12-25T00%3A00%3A00Z');
    });

    it('should normalize simple YYYY-MM-DD dates for to filter', () => {
      const filters: RunsListFilters = { dateTo: '2024-12-25' };
      const result = buildRunsQueryParams(filters);
      expect(result).toBe('created_at__lte=2024-12-25T23%3A59%3A59Z');
    });

    it('should not modify dates that already have time', () => {
      const filters: RunsListFilters = {
        dateFrom: '2024-12-25T15:30:45Z',
        dateTo: '2024-12-26T18:45:30Z'
      };
      const result = buildRunsQueryParams(filters);
      expect(result).toBe('created_at__gte=2024-12-25T15%3A30%3A45Z&created_at__lte=2024-12-26T18%3A45%3A30Z');
    });

    it('should handle completed date normalization', () => {
      const filters: RunsListFilters = {
        completedFrom: '2024-01-01',
        completedTo: '2024-01-31'
      };
      const result = buildRunsQueryParams(filters);
      expect(result).toBe('completed_at__gte=2024-01-01T00%3A00%3A00Z&completed_at__lte=2024-01-31T23%3A59%3A59Z');
    });
  });
});
