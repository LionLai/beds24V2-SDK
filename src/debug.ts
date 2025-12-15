/**
 * 除錯工具 - 幫助檢查請求和回應
 */

import type { Middleware } from 'openapi-fetch';

export interface DebugMiddlewareOptions {
  /**
   * 是否記錄 request body
   */
  logRequestBody?: boolean;
  /**
   * 是否記錄 response body
   */
  logResponseBody?: boolean;
  /**
   * 是否記錄完整的 headers
   */
  logHeaders?: boolean;
  /**
   * 是否只記錄特定的 headers
   */
  logSpecificHeaders?: string[];
  /**
   * 自訂 logger 函式
   */
  logger?: (message: string, data?: any) => void;
}

/**
 * 建立一個除錯 middleware
 * 可以查看實際發送的請求內容
 */
export function createDebugMiddleware(options: DebugMiddlewareOptions = {}): Middleware {
  const {
    logRequestBody = false,
    logResponseBody = false,
    logHeaders = true,
    logSpecificHeaders,
    logger = console.log
  } = options;

  return {
    async onRequest(req: Request, _options: any) {
      const logData: Record<string, any> = {
        method: req.method,
        url: req.url
      };

      if (logHeaders) {
        const headers: Record<string, string> = {};
        
        // 檢查兩個地方的 headers
        // 1. Request 物件的 headers（這是實際會發送的）
        logger('🔍 [Debug] Request.headers (實際發送):');
        const headerEntries = Array.from(req.headers as any as Iterable<[string, string]>);
        for (const [key, value] of headerEntries) {
          if (logSpecificHeaders) {
            if (logSpecificHeaders.includes(key)) {
              headers[key] = value;
              logger(`   ${key}: ${value}`);
            }
          } else {
            headers[key] = value;
            if (key === 'token' || key === 'organization') {
              logger(`   ✅ ${key}: ${value}`);
            } else {
              logger(`   ${key}: ${value}`);
            }
          }
        }
        
        // 檢查 token 是否存在
        const hasToken = req.headers.has('token');
        const tokenValue = req.headers.get('token');
        
        if (!hasToken) {
          logger('   ⚠️  警告: token header 不存在！');
          logger('   💡 請確認:');
          logger('      1. 初始化時是否設置了 token');
          logger('      2. token 值是否為 null 或 undefined');
          logger('      3. 是否呼叫了 setToken()');
        } else {
          logger(`   ✅ Token 正常: ${tokenValue}`);
        }
        
        logData.headers = headers;
      }

      if (logRequestBody && _options?.body) {
        logData.body = _options.body;
        logger('📤 Request Body:', _options.body);
      }

      logger('🚀 [Beds24 SDK] Request:', req.method, req.url);
      logger('');

      return undefined;
    },

    async onResponse(res: Response, _options: any) {
      const clonedResponse = res.clone();
      
      const emoji = res.ok ? '✅' : '❌';
      logger(`${emoji} [Beds24 SDK] Response: ${res.status} ${res.statusText}`);

      if (logHeaders) {
        logger('📥 Response Headers:');
        const headerEntries = Array.from(res.headers as any as Iterable<[string, string]>);
        for (const [key, value] of headerEntries) {
          logger(`   ${key}: ${value}`);
        }
      }

      if (logResponseBody) {
        try {
          const body = await clonedResponse.json();
          logger('📥 Response Body:', JSON.stringify(body, null, 2));
        } catch {
          const text = await clonedResponse.text();
          logger('📥 Response Body (text):', text);
        }
      }

      logger('');
      return undefined;
    }
  };
}

/**
 * 建立一個簡單的 token 診斷 middleware
 * 檢查每次請求是否有帶入 token
 */
export function createTokenDiagnosticMiddleware(): Middleware {
  return {
    async onRequest(req: Request) {
      console.log('\n' + '='.repeat(60));
      console.log('🔍 Token 診斷報告');
      console.log('='.repeat(60));
      console.log(`📍 URL: ${req.url}`);
      console.log(`📋 Method: ${req.method}`);
      console.log('');
      
      const tokenHeader = req.headers.get('token');
      const orgHeader = req.headers.get('organization');
      
      console.log('📦 認證 Headers:');
      if (tokenHeader) {
        console.log(`   ✅ token: ${tokenHeader}`);
      } else {
        console.log('   ❌ token: 不存在');
        console.log('');
        console.log('💡 解決方法:');
        console.log('   在請求時傳入 token:');
        console.log('   client.GET("/bookings", {');
        console.log('     headers: { token: "your-token" }');
        console.log('   })');
      }
      
      if (orgHeader) {
        console.log(`   ✅ organization: ${orgHeader}`);
      } else {
        console.log('   ℹ️  organization: 未設置 (可選)');
      }
      
      console.log('='.repeat(60) + '\n');
      
      return undefined;
    }
  };
}

