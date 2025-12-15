ini# Beds24 API V2 SDK

一套以 TypeScript 撰寫、為 Nuxt.js 與 Next.js 應用優化的 Beds24 API V2 SDK。透過 `openapi-fetch` 搭配官方 OpenAPI 規格自動產生型別，提供完整的端點定義與存取體驗。

> **⚠️ v0.2.0 重大變更**  
> 此版本採用**無狀態設計**，SDK 不再保管 token。您需要在每次請求時透過 headers 傳入 token。  
> 從 v0.1.x 升級？請查看 [遷移指南](./MIGRATION.md)

## 特點

- **型別安全**：`openapi-typescript` 直接從 `apiV2.yaml` 產生 `paths` 型別。
- **可插拔 fetch**：預設使用環境內的 `fetch`，也可自行注入（例如在舊版 Node.js 使用 `node-fetch`）。
- **自動附帶 headers**：統一處理 `token` 與 `organization` header，並提供動態更新方法。
- **Rate limit 工具**：方便解析 `X-FiveMin*` 等額度提示。
- **Nuxt / Next 友善**：僅依賴 ESM/CJS 同時輸出，支援 SSR 與 Edge Runtime。

## 安裝

```bash
npm install @lionlai/beds24-v2-sdk
# 或
pnpm add @lionlai/beds24-v2-sdk
```

## 產生型別（開發者）

若更新了 `apiV2.yaml`，執行：

```bash
npm run generate
```

會重新產生 `src/generated/beds24.ts`。

## 使用方式

此 SDK 採用**無狀態設計**，不保管 token。您需要在每次請求時透過 headers 傳入 token。

```ts
import { createBeds24Client, parseRateLimitHeaders } from '@lionlai/beds24-v2-sdk';

// 創建客戶端（不需要傳入 token）
const beds24 = createBeds24Client();

// 每次請求時傳入 token
const result = await beds24.GET('/bookings', {
  headers: {
    token: process.env.BEDS24_TOKEN,      // 必填
    organization: process.env.BEDS24_ORG  // 可選
  },
  params: { query: { propertyId: [12345] } }
});

if (result.error) {
  throw result.error;
}

console.log(result.data?.data);
console.log(parseRateLimitHeaders(result.response));
```

### 為什麼不保管 Token？

✅ **優點：**
- 無狀態設計，更安全
- 不需要擔心 token 持久化問題
- 可以在每次請求時動態選擇不同的 token
- 避免 token 過期同步問題
- 更適合 serverless 和微服務架構

### Token 管理建議

您可以使用各種方式管理 token，例如：

```ts
// 方案 1: 從環境變數讀取
const token = process.env.BEDS24_TOKEN;

// 方案 2: 從資料庫讀取
const token = await db.getToken('beds24');

// 方案 3: 從密鑰管理服務讀取
const token = await secretManager.getSecret('beds24-token');

// 方案 4: 使用閉包封裝
function createBeds24Service() {
  const client = createBeds24Client();
  
  async function getBookings(token: string) {
    return await client.GET('/bookings', {
      headers: { token }
    });
  }
  
  return { getBookings };
}
```


### Nuxt.js 範例

```ts
// plugins/beds24.client.ts
import { createBeds24Client } from '@lionlai/beds24-v2-sdk';

export default defineNuxtPlugin(() => {
  const client = createBeds24Client();
  return { provide: { beds24: client } };
});
```

```ts
// composables/useBeds24.ts
export const useBeds24 = () => {
  const { $beds24 } = useNuxtApp();
  const runtimeConfig = useRuntimeConfig();
  
  const getBookings = async () => {
    return await $beds24.GET('/bookings', {
      headers: {
        token: runtimeConfig.public.beds24Token,
        organization: runtimeConfig.public.beds24Organization
      }
    });
  };
  
  const getRoomAvailability = async (roomId: number, startDate: string, endDate: string) => {
    return await $beds24.GET('/inventory/rooms/availability', {
      headers: {
        token: runtimeConfig.public.beds24Token
      },
      params: {
        query: { roomId: [roomId], startDate, endDate }
      }
    });
  };
  
  return {
    getBookings,
    getRoomAvailability
  };
};
```

```ts
// 在組件中使用
const { getBookings } = useBeds24();
const { data } = await getBookings();
```

### Next.js（App Router）範例

```ts
// app/api/bookings/route.ts
import { NextResponse } from 'next/server';
import { createBeds24Client } from '@lionlai/beds24-v2-sdk';

const beds24 = createBeds24Client();

export async function GET() {
  const { data, error, response } = await beds24.GET('/bookings', {
    headers: {
      token: process.env.BEDS24_TOKEN!,
      organization: process.env.BEDS24_ORG
    },
    params: { query: { filter: 'arrivals' } }
  });

  if (error) {
    return NextResponse.json(error, { status: response.status });
  }

  return NextResponse.json({ bookings: data?.data });
}
```

```ts
// lib/beds24.ts - 創建輔助函數
import { createBeds24Client } from '@lionlai/beds24-v2-sdk';

const client = createBeds24Client();

export async function getBeds24Bookings(token: string) {
  return await client.GET('/bookings', {
    headers: { token }
  });
}

export async function createBeds24Booking(token: string, booking: any) {
  return await client.POST('/bookings', {
    headers: { token },
    body: booking
  });
}
```

### 除錯請求內容

SDK 提供了內建的除錯工具：

```ts
import { createBeds24Client, createTokenDiagnosticMiddleware, createDebugMiddleware } from '@lionlai/beds24-v2-sdk';

// 方法 1: 使用 token 診斷工具（檢查是否帶入 token）
const client = createBeds24Client({
  middleware: [createTokenDiagnosticMiddleware()]
});

await client.GET('/bookings', {
  headers: { token: 'your-token' }
});
// 會輸出：✅ token: your-token

// 方法 2: 使用完整除錯工具
const debugClient = createBeds24Client({
  middleware: [
    createDebugMiddleware({
      logHeaders: true,
      logRequestBody: true,
      logResponseBody: true
    })
  ]
});

// 只在開發環境啟用
const prodClient = createBeds24Client({
  middleware: process.env.NODE_ENV === 'development' 
    ? [createDebugMiddleware({ logHeaders: true })]
    : []
});
```

## API

### `createBeds24Client(options)`

建立 Beds24 API 客戶端（無狀態設計）

**選項：**
- `baseUrl`：API base URL，預設 `https://api.beds24.com/v2`
- `fetch`：自訂 fetch 實作（如 node-fetch）
- `headers`：所有請求共用的 headers
- `middleware`：openapi-fetch middleware array，用於 logging、error tracking

**回傳：** `Beds24Client` - 標準的 openapi-fetch 客戶端

### HTTP 方法

所有標準 HTTP 方法都可用：`GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS`, `HEAD`

**每次請求時傳入 token：**

```ts
await client.GET('/bookings', {
  headers: {
    token: 'your-token',           // 必填
    organization: 'your-org'        // 可選
  },
  params: { query: { ... } }
});
```

### 輔助函數

- **`parseRateLimitHeaders(response)`**：解析 rate limit headers
  - 回傳：`{ limit, remaining, resetsInSeconds, requestCost }`

- **`createDebugMiddleware(options)`**：建立除錯 middleware
  - 選項：`logHeaders`, `logRequestBody`, `logResponseBody`, `logger`

- **`createTokenDiagnosticMiddleware()`**：建立 token 診斷 middleware
  - 檢查每次請求是否有正確帶入 token

## 開發腳本

| 指令       | 描述                                |
| ---------- | ----------------------------------- |
| `npm run generate` | 依據 OpenAPI 產生型別          |
| `npm run build`    | 使用 `tsup` 輸出 ESM/CJS/型別  |
| `npm run dev`      | 監聽模式打包                  |
| `npm run lint`     | 僅執行 `tsc --noEmit` 檢查     |

## 授權

MIT License.

