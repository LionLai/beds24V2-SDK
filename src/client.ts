import createClient, { type Middleware } from 'openapi-fetch';
import type { paths } from './generated/beds24';

const DEFAULT_BASE_URL = 'https://api.beds24.com/v2';

type OpenApiFetchClient = ReturnType<typeof createClient<paths>>;

export interface Beds24ClientOptions {
  /**
   * Fully qualified API base URL. Defaults to https://api.beds24.com/v2
   */
  baseUrl?: string;
  /**
   * Provide a custom fetch implementation (e.g. node-fetch) if global fetch is unavailable.
   */
  fetch?: typeof fetch;
  /**
   * Extra headers that should be sent with every request.
   */
  headers?: Record<string, string | undefined>;
  /**
   * Optional middleware executed by openapi-fetch before each request.
   * Useful for logging or tracing.
   */
  middleware?: Middleware[];
}

export interface Beds24RateLimit {
  limit?: number;
  remaining?: number;
  resetsInSeconds?: number;
  requestCost?: number;
}

export type Beds24Client = OpenApiFetchClient;

/**
 * Parse Beds24 rate limit headers from a fetch Response object.
 */
export function parseRateLimitHeaders(response: Response): Beds24RateLimit {
  const readInt = (header: string): number | undefined => {
    const value = response.headers.get(header);
    if (!value) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  return {
    limit: readInt('X-FiveMinCreditLimit'),
    remaining: readInt('X-FiveMinCreditLimit-Remaining'),
    resetsInSeconds: readInt('X-FiveMinCreditLimit-ResetsIn'),
    requestCost: readInt('X-RequestCost')
  };
}

/**
 * 創建 Beds24 API 客戶端
 * 
 * Token 管理：此客戶端不保管 token，用戶需要在每次請求時通過 headers 傳入
 * 
 * @example
 * ```typescript
 * const client = createBeds24Client();
 * 
 * // 每次請求時傳入 token
 * const result = await client.GET('/bookings', {
 *   headers: {
 *     token: 'your-token-here',
 *     organization: 'your-org' // 可選
 *   }
 * });
 * ```
 */
export function createBeds24Client(options: Beds24ClientOptions = {}): Beds24Client {
  const fetchImpl = options.fetch ?? globalThis.fetch;
  if (!fetchImpl) {
    throw new Error('No fetch implementation found. Provide one via options.fetch.');
  }

  const baseHeaders: Record<string, string> = {
    accept: 'application/json',
    ...(options.headers ?? {})
  };

  // 簡化的 fetch wrapper，只處理 base headers
  // 用戶的 token 和 organization 通過每次請求的 headers 傳入
  const withBaseHeadersFetch: typeof fetch = (input, init = {}) => {
    const existingHeaders = input instanceof Request 
      ? input.headers 
      : (init.headers ?? {});
    
    const headers = new Headers(existingHeaders);

    // 只添加 base headers（不包含 token）
    Object.entries(baseHeaders).forEach(([key, value]) => {
      if (value !== undefined && !headers.has(key)) {
        headers.set(key, value);
      }
    });

    // 如果 input 是 Request，創建新的 Request
    if (input instanceof Request) {
      const newRequest = new Request(input, {
        ...init,
        headers
      });
      return fetchImpl(newRequest);
    }

    // 否則直接傳遞
    return fetchImpl(input, {
      ...init,
      headers
    });
  };

  const client = createClient<paths>({
    baseUrl: options.baseUrl ?? DEFAULT_BASE_URL,
    fetch: withBaseHeadersFetch
  });

  options.middleware?.forEach((mw) => client.use(mw));

  return client;
}

