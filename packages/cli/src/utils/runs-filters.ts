/**
 * Filter builder utility for runs API queries
 * Maps user-friendly CLI filter options to API query parameter syntax
 */

export interface RunsListFilters {
  status?: string;
  statusIn?: string; // Comma-separated string
  statusNe?: string;
  model?: string;
  modelLike?: string;
  suite?: string; // Maps to suite_name
  minCost?: number;
  maxCost?: number;
  minSuccess?: number;
  maxSuccess?: number;
  dateFrom?: string; // ISO date string (e.g., "2024-01-01" or "2024-01-01T00:00:00Z")
  dateTo?: string;
  completedFrom?: string;
  completedTo?: string;
  minDuration?: number;
  maxDuration?: number;
}

/**
 * Normalize a date string to ISO 8601 format
 * Accepts dates with or without time component
 * For dates without time: from dates get 00:00:00Z, to dates get 23:59:59Z
 */
function normalizeDate(dateString: string, isToDate: boolean = false): string {
  // If already has time component, return as-is
  if (dateString.includes('T')) {
    return dateString;
  }
  
  // If no time component, add appropriate time
  if (isToDate) {
    // For "to" dates, use end of day
    return `${dateString}T23:59:59Z`;
  } else {
    // For "from" dates, use start of day
    return `${dateString}T00:00:00Z`;
  }
}

/**
 * Build query parameter string for runs API from user-friendly filter options
 * 
 * @param filters - Filter options from CLI
 * @param limit - Optional limit for pagination
 * @param offset - Optional offset for pagination
 * @returns URLSearchParams string ready for API query
 */
export function buildRunsQueryParams(
  filters: RunsListFilters = {},
  limit?: number,
  offset?: number
): string {
  const params = new URLSearchParams();
  
  // Status filters
  if (filters.status) {
    params.append('status', filters.status);
  }
  if (filters.statusIn) {
    // Multiple statuses: comma-separated string becomes status=val1,val2 (IN operator)
    params.append('status', filters.statusIn);
  }
  if (filters.statusNe) {
    params.append('status__ne', filters.statusNe);
  }
  
  // Model filters
  if (filters.model) {
    params.append('model', filters.model);
  }
  if (filters.modelLike) {
    params.append('model__like', filters.modelLike);
  }
  
  // Suite filter (maps to suite_name)
  if (filters.suite) {
    params.append('suite_name', filters.suite);
  }
  
  // Cost filters
  if (filters.minCost !== undefined) {
    params.append('total_cost__gte', filters.minCost.toString());
  }
  if (filters.maxCost !== undefined) {
    params.append('total_cost__lte', filters.maxCost.toString());
  }
  
  // Success percentage filters
  if (filters.minSuccess !== undefined) {
    params.append('success_percentage__gte', filters.minSuccess.toString());
  }
  if (filters.maxSuccess !== undefined) {
    params.append('success_percentage__lte', filters.maxSuccess.toString());
  }
  
  // Created date filters
  if (filters.dateFrom) {
    params.append('created_at__gte', normalizeDate(filters.dateFrom, false));
  }
  if (filters.dateTo) {
    params.append('created_at__lte', normalizeDate(filters.dateTo, true));
  }
  
  // Completed date filters
  if (filters.completedFrom) {
    params.append('completed_at__gte', normalizeDate(filters.completedFrom, false));
  }
  if (filters.completedTo) {
    params.append('completed_at__lte', normalizeDate(filters.completedTo, true));
  }
  
  // Duration filters
  if (filters.minDuration !== undefined) {
    params.append('duration_seconds__gte', filters.minDuration.toString());
  }
  if (filters.maxDuration !== undefined) {
    params.append('duration_seconds__lte', filters.maxDuration.toString());
  }
  
  // Pagination
  if (limit !== undefined) {
    params.append('limit', limit.toString());
  }
  if (offset !== undefined) {
    params.append('offset', offset.toString());
  }
  
  return params.toString();
}

