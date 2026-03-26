const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export interface PaginationParams {
    skip: number;
    take: number;
}

export interface PaginatedMeta {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
}

export function parsePaginationParams(url: URL): PaginationParams {
    const rawLimit = url.searchParams.get('limit');
    const rawOffset = url.searchParams.get('offset');

    const limit = rawLimit ? Math.min(Math.max(parseInt(rawLimit, 10) || DEFAULT_LIMIT, 1), MAX_LIMIT) : DEFAULT_LIMIT;
    const offset = rawOffset ? Math.max(parseInt(rawOffset, 10) || 0, 0) : 0;

    return { skip: offset, take: limit };
}

export function paginatedMeta(total: number, params: PaginationParams): PaginatedMeta {
    return {
        total,
        limit: params.take,
        offset: params.skip,
        hasMore: params.skip + params.take < total,
    };
}
