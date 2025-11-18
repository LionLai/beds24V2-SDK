ini# Beds24 API V2 SDK

一套以 TypeScript 撰寫、為 Nuxt.js 與 Next.js 應用優化的 Beds24 API V2 SDK。透過 `openapi-fetch` 搭配官方 OpenAPI 規格自動產生型別，提供完整的端點定義與存取體驗。

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

```ts
import { createBeds24Client, parseRateLimitHeaders } from '@lionlai/beds24-v2-sdk';

const beds24 = createBeds24Client({
  token: process.env.BEDS24_TOKEN,
  organization: process.env.BEDS24_ORG
});

const result = await beds24.GET('/bookings', {
  params: { query: { propertyId: [12345] } }
});

if (result.error) {
  throw result.error;
}

console.log(result.data?.data);
console.log(parseRateLimitHeaders(result.response));
```

### Nuxt.js Plugin 範例

```ts
// plugins/beds24.client.ts
import { createBeds24Client } from '@lionlai/beds24-v2-sdk';

export default defineNuxtPlugin(() => {
  const runtimeConfig = useRuntimeConfig();
  const client = createBeds24Client({
    token: runtimeConfig.public.beds24Token,
    organization: runtimeConfig.public.beds24Organization
  });

  return { provide: { beds24: client } };
});
```

```ts
// 任一組件/Composable
const { $beds24 } = useNuxtApp();
const { data } = await $beds24.GET('/inventory/rooms/availability', {
  params: { query: { roomId: [123], startDate: '2025-01-01', endDate: '2025-01-07' } }
});
```

### Next.js（App Router）示例

```ts
// app/api/bookings/route.ts
import { NextResponse } from 'next/server';
import { createBeds24Client } from '@lionlai/beds24-v2-sdk';

const beds24 = createBeds24Client({
  token: process.env.BEDS24_TOKEN,
  organization: process.env.BEDS24_ORG
});

export async function GET() {
  const { data, error, response } = await beds24.GET('/bookings', {
    params: { query: { filter: 'arrivals' } }
  });

  if (error) {
    return NextResponse.json(error, { status: response.status });
  }

  return NextResponse.json({ bookings: data?.data });
}
```

## API

- `createBeds24Client(options)`：建立客戶端。
  - `token` / `organization`：預設 headers，可於執行期間以 `setToken` / `setOrganization` 更新。
  - `baseUrl`：預設 `https://api.beds24.com/v2`。
  - `fetch`：自訂 fetch 實作。
  - `headers`：所有請求共用 header。
  - `middleware`：`openapi-fetch` middleware array，可用於 logging、error tracking。
- 其他 `openapi-fetch` 內建方法：`GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS`, `HEAD`.
- `parseRateLimitHeaders(response)`：回傳 `{ limit, remaining, resetsInSeconds, requestCost }`。

## 開發腳本

| 指令       | 描述                                |
| ---------- | ----------------------------------- |
| `npm run generate` | 依據 OpenAPI 產生型別          |
| `npm run build`    | 使用 `tsup` 輸出 ESM/CJS/型別  |
| `npm run dev`      | 監聽模式打包                  |
| `npm run lint`     | 僅執行 `tsc --noEmit` 檢查     |

## 授權

MIT License.

