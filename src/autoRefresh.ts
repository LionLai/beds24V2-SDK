import { createBeds24Client, type Beds24Client } from './index';

/**
 * 建立一個帶有自動刷新 Token 機制的 Wrapper
 * 
 * @param client - 原始的 Beds24 Client 實例
 * @param refreshToken - 用於刷新的 Refresh Token
 * @param onTokenUpdate - 當 Token 更新時的回呼函式（可選，用於持久化新 Token）
 * @returns 包裝後的 Client，介面與原始 Client 相同
 */
export function createAutoRefreshClient(
  client: Beds24Client,
  refreshToken: string,
  onTokenUpdate?: (newToken: string) => void
): Beds24Client {
  
  // 建立一個 Proxy 來攔截所有屬性存取
  return new Proxy(client, {
    get(target, prop, receiver) {
      const originalValue = Reflect.get(target, prop, receiver);

      // 只攔截 HTTP 方法 (GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS, TRACE)
      const httpMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS', 'TRACE'];
      
      if (typeof prop === 'string' && httpMethods.includes(prop) && typeof originalValue === 'function') {
        return async (...args: any[]) => {
          // 1. 嘗試執行原始請求
          const result = await originalValue.apply(target, args);

          // 2. 檢查是否發生 401 Unauthorized 或 403 Forbidden (視 API 而定，通常是 401)
          // 這裡假設 Beds24 在 token 過期時回傳 401 或 403
          if (result.error && (result.response.status === 401 || result.response.status === 403)) {
            
            try {
              // 3. 嘗試刷新 Token
              // 注意：這裡使用一個獨立的請求，避免無窮迴圈。
              // 我們直接使用 fetch，因為還沒有更新 client 的 token
              const refreshResponse = await fetch(`${client.config.baseUrl}/authentication/token`, {
                method: 'GET',
                headers: {
                  'refreshToken': refreshToken,
                  'accept': 'application/json'
                }
              });

              if (!refreshResponse.ok) {
                // 刷新失敗，直接回傳原始錯誤
                return result;
              }

              const refreshData = await refreshResponse.json();
              const newToken = refreshData.token;

              if (newToken) {
                // 4. 更新 Client 的 Token
                client.setToken(newToken);
                
                // 5. 觸發回呼（例如儲存到 localStorage 或 Cookie）
                if (onTokenUpdate) {
                  onTokenUpdate(newToken);
                }

                // 6. 重試原始請求
                return await originalValue.apply(target, args);
              }
            } catch (refreshError) {
              console.error('Auto-refresh token failed:', refreshError);
              // 刷新過程發生例外，回傳原始錯誤
              return result;
            }
          }

          return result;
        };
      }

      return originalValue;
    }
  });
}

