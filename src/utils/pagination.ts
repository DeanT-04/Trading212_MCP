export interface CursorPage {
  data: unknown[];
  nextCursor?: string;
  hasMore: boolean;
}

export function buildCursorResponse<T>(
  data: T[],
  cursor: string | undefined,
  limit: number
): CursorPage {
  const hasMore = data.length > limit;
  const results = hasMore ? data.slice(0, -1) : data;

  return {
    data: results,
    nextCursor: hasMore ? cursor : undefined,
    hasMore,
  };
}

export function getPaginationParams(input: { limit?: number; cursor?: string }) {
  return {
    limit: Math.min(input.limit ?? 50, 50),
    cursor: input.cursor,
  };
}