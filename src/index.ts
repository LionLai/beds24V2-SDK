import createClient, { type Middleware } from 'openapi-fetch';
import type { paths } from './generated/beds24';

const DEFAULT_BASE_URL = 'https://api.beds24.com/v2';

export type { paths } from './generated/beds24';

export interface AuthOptions {
  /**
   * Beds24 long life token or refresh token.
   */
  token?: string | null;
  /**
   * Organization header if you are an integration partner.
   */
  organization?: string | null;
}

type OpenApiFetchClient = ReturnType<typeof createClient<paths>>;

export interface Beds24ClientOptions extends AuthOptions {
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

export interface Beds24ClientState {
  baseUrl: string;
  headers: Record<string, string>;
  auth: Required<AuthOptions>;
}

export interface Beds24Client extends OpenApiFetchClient {
  /**
   * Returns the current immutable configuration snapshot.
   */
  readonly config: Beds24ClientState;
  /**
   * Updates only the token header.
   */
  setToken(token?: string | null): void;
  /**
   * Updates only the organization header.
   */
  setOrganization(organization?: string | null): void;
  /**
   * Convenience helper to update both token and organization at once.
   */
  setAuth(auth: AuthOptions): void;
}

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

export function createBeds24Client(options: Beds24ClientOptions = {}): Beds24Client {
  const fetchImpl = options.fetch ?? globalThis.fetch;
  if (!fetchImpl) {
    throw new Error('No fetch implementation found. Provide one via options.fetch.');
  }

  const baseHeaders: Record<string, string> = {
    accept: 'application/json',
    ...(options.headers ?? {})
  };

  const authState: Required<AuthOptions> = {
    token: options.token ?? null,
    organization: options.organization ?? null
  };

  const withAuthFetch: typeof fetch = (input, init = {}) => {
    const headers = new Headers(init.headers ?? {});

    Object.entries(baseHeaders).forEach(([key, value]) => {
      if (value !== undefined) {
        headers.set(key, value);
      }
    });

    if (authState.token) {
      headers.set('token', authState.token);
    }
    if (authState.organization) {
      headers.set('organization', authState.organization);
    }

    return fetchImpl(input, {
      ...init,
      headers
    });
  };

  const client = createClient<paths>({
    baseUrl: options.baseUrl ?? DEFAULT_BASE_URL,
    fetch: withAuthFetch
  });

  options.middleware?.forEach((mw) => client.use(mw));

  const state: Beds24ClientState = {
    baseUrl: options.baseUrl ?? DEFAULT_BASE_URL,
    headers: { ...baseHeaders },
    auth: { ...authState }
  };

  const updateStateSnapshot = () => {
    state.headers = { ...baseHeaders };
    state.auth = { ...authState };
  };

  const setToken = (token?: string | null) => {
    authState.token = token ?? null;
    updateStateSnapshot();
  };

  const setOrganization = (organization?: string | null) => {
    authState.organization = organization ?? null;
    updateStateSnapshot();
  };

  const setAuth = (auth: AuthOptions) => {
    if ('token' in auth) {
      authState.token = auth.token ?? null;
    }
    if ('organization' in auth) {
      authState.organization = auth.organization ?? null;
    }
    updateStateSnapshot();
  };

  return Object.assign(client, {
    config: state,
    setToken,
    setOrganization,
    setAuth
  }) as Beds24Client;
}

