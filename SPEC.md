# 旅行拆帳 App — 完整開發規格書

> 本文件是給 Claude Code 的開發規格。目標:做一個旅伴共用的旅行拆帳 PWA,可加入手機主畫面當 app 使用,資料即時同步,全部使用免費資源,不上架。

---

## 1. 架構總覽

```
┌─────────────────────┐
│  手機瀏覽器 (PWA)     │  ← 旅伴各自「加入主畫面」
│  React + Vite        │
└─────────┬───────────┘
          │ supabase-js (HTTPS + WebSocket Realtime)
          ▼
┌─────────────────────┐
│  Supabase 免費方案    │  PostgreSQL + Realtime + REST
└─────────────────────┘

前端託管:GitHub Pages(GitHub Actions 自動部署)
```

- **不需要自建後端伺服器**:前端透過 supabase-js 直接讀寫資料庫,Supabase 同時負責即時同步。
- **成本:0 元**。GitHub Pages 免費,Supabase 免費方案(500MB 資料庫、Realtime 200 同時連線)對私人拆帳綽綽有餘。

## 2. 技術選型

| 項目 | 選擇 | 理由 |
|------|------|------|
| 前端框架 | React 18 + TypeScript | 生態成熟,Claude Code 支援度高 |
| 建置工具 | Vite | 快,且 `vite-plugin-pwa` 一鍵搞定 PWA |
| 路由 | react-router(**HashRouter**) | GitHub Pages 不支援 SPA 的伺服器端路由回退,HashRouter 最穩,不需要 404 hack |
| 樣式 | Tailwind CSS | 快速、行動裝置優先 |
| 後端 / DB | Supabase(supabase-js v2) | Postgres + Realtime + 免費 |
| PWA | vite-plugin-pwa(Workbox) | manifest + service worker 自動產生 |
| 部署 | GitHub Actions → GitHub Pages | push 到 main 自動部署 |

## 3. 產品規格

### 3.1 使用流程(無帳號設計)

刻意不做註冊登入,降低旅伴使用門檻:

1. **建立行程**:輸入行程名稱、預設幣別 → 系統產生一組 6 碼邀請碼(例如 `K3M9QP`)與行程 UUID。
2. **加入行程**:旅伴輸入邀請碼 + 自己的暱稱 → 成為該行程成員。
3. **身分記憶**:用 `localStorage` 記住「我在這個行程裡是哪個成員」(存 member_id),下次開 app 直接進入。
4. 首頁顯示「我的行程列表」(localStorage 記錄加入過的行程)。

### 3.2 核心功能

**支出記帳**
- 新增支出:品項名稱、金額、幣別、付款人(**可多人,各自輸入付款金額,加總須等於總金額**;明細存 `expense_payers`)、分攤對象(可全選/部分成員)、分攤方式(平分 / 自訂金額 / 自訂比例)、日期、分類(餐飲/交通/住宿/門票/購物/其他)、備註。
- 自訂金額分攤:每人金額手動輸入、未填視為 0,成員列表下方即時顯示「尚未分配金額」。
- 支出列表:依日期分組顯示,可編輯、刪除。
- **即時同步**:任何成員新增/修改支出,其他人的畫面透過 Supabase Realtime 立即更新,不用手動重新整理。

**結算(誰欠誰)**
- 「結算」頁顯示:每位成員的淨額(付了多少、應付多少、餘額正負)。
- 用「最少轉帳次數」演算法算出結清方案,例如:`小明 → 小華 NT$1,250`。
- 提供「標記已還款」功能:還款記錄存成一筆特殊類型的交易(settlement),計入餘額。

**多幣別(確定要做)**
- 每筆支出可選幣別,行程設定各幣別對主幣別的匯率(手動輸入,不串匯率 API 以保持零成本與簡單)。
- 匯率採「每筆快照」設計:新增支出時把當下匯率寫進 `expenses.fx_rate`,之後修改行程匯率設定不影響已記的帳;`trip_fx_rates` 作為新增支出時的預設值。
- 結算一律換算成主幣別;settlement(還款)記錄一律以主幣別記。

**統計(確定要做)**
- 總支出、分類圓餅圖、每人支出長條圖(用 recharts)。
- 純前端計算:抓取該行程全部支出後在瀏覽器分組加總,不建統計表或 view。

### 3.3 結算演算法(最少轉帳次數)

```
1. 計算每位成員淨額 net[i] = 他付出的總額(expense_payers 加總) − 他應分攤的總額(expense_splits 加總,含已還款記錄)
2. 分成債權人(net > 0)與債務人(net < 0)兩組
3. 貪婪法:每次取最大債務人與最大債權人配對,
   轉帳金額 = min(|債務|, 債權),更新兩者餘額,歸零者移出
4. 重複直到所有人歸零
5. 金額用整數「分」運算避免浮點誤差,顯示時才轉回元
```

## 4. 資料模型(Supabase SQL)

在 Supabase Dashboard 的 SQL Editor 執行:

```sql
-- 行程
create table trips (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,        -- 6 碼大寫英數
  base_currency text not null default 'TWD',
  created_at timestamptz default now()
);

-- 成員(不綁帳號,只是暱稱)
create table members (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  nickname text not null,
  created_at timestamptz default now(),
  unique (trip_id, nickname)
);

-- 支出(也涵蓋還款:kind = 'settlement')
create table expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  kind text not null default 'expense',     -- 'expense' | 'settlement'
  title text not null,
  amount_cents bigint not null,              -- 以「分」為單位的整數
  currency text not null default 'TWD',
  fx_rate numeric not null default 1,        -- 對主幣別匯率
  payer_id uuid references members(id),      -- 已退役:付款人改存 expense_payers,此欄僅為相容保留
  category text default '其他',
  spent_at date not null default current_date,
  note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 每筆支出的付款明細(付款人可多人,各自輸入金額)
create table expense_payers (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references expenses(id) on delete cascade,
  member_id uuid not null references members(id),
  paid_cents bigint not null,                -- 此成員付款金額(分)
  unique (expense_id, member_id)
);

-- 每筆支出的分攤明細
create table expense_splits (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references expenses(id) on delete cascade,
  member_id uuid not null references members(id),
  share_cents bigint not null,               -- 此成員應分攤金額(分)
  unique (expense_id, member_id)
);

-- 行程的匯率設定(新增支出時的預設匯率)
create table trip_fx_rates (
  trip_id uuid not null references trips(id) on delete cascade,
  currency text not null,
  rate numeric not null,
  primary key (trip_id, currency)
);

-- 開啟 Realtime
alter publication supabase_realtime add table expenses, expense_splits, expense_payers, members, trip_fx_rates;

-- RLS:開啟但允許 anon 存取(安全模型見第 5 節)
alter table trips enable row level security;
alter table members enable row level security;
alter table expenses enable row level security;
alter table expense_splits enable row level security;
alter table expense_payers enable row level security;
alter table trip_fx_rates enable row level security;

create policy "anon all" on trips for all using (true) with check (true);
create policy "anon all" on members for all using (true) with check (true);
create policy "anon all" on expenses for all using (true) with check (true);
create policy "anon all" on expense_splits for all using (true) with check (true);
create policy "anon all" on expense_payers for all using (true) with check (true);
create policy "anon all" on trip_fx_rates for all using (true) with check (true);
```

**重要實作細節**:依邀請碼查行程時,不要用 `select *` 撈全表,要寫成 `.eq('invite_code', code).single()`;前端所有查詢一律以 `trip_id` 過濾。

## 5. 安全模型(請理解後接受這個取捨)

- Supabase 的 **anon key 本來就設計成可公開**放在前端程式碼裡,放進 GitHub repo 沒問題。
- 因為不做帳號系統,資料保護依賴「行程 UUID / 邀請碼不外流」——知道邀請碼的人就能看到並編輯該行程的帳。對「旅伴私人共用」這個場景是合理取捨,等同一個共享連結的 Google 試算表。
- 不要存任何敏感個資(只有暱稱與金額)。
- 若日後想加強,可改用 Supabase Anonymous Sign-in + 以 membership 為基礎的 RLS,本規格先不做。

## 6. PWA 設定

使用 `vite-plugin-pwa`:

- `manifest`:`name: 旅行拆帳`、`short_name: 拆帳`、`display: standalone`、`theme_color` 與 `background_color` 配合 UI 主色、192/512px 圖示(請順手產生一組簡潔的 SVG → PNG 圖示)。
- `registerType: 'autoUpdate'`,確保部署新版後使用者重開 app 會自動更新。
- Service worker 快取 app shell,離線時可開啟並瀏覽最後同步的資料(讀取用 React Query 或簡單的記憶體 + localStorage 快取即可;離線「寫入佇列」屬於進階功能,第一版不做,離線新增時直接提示需要網路)。
- iOS 注意:Safari 需要 `apple-touch-icon`,且 PWA 必須走 HTTPS(GitHub Pages 預設就是 HTTPS,符合)。

## 7. GitHub Pages 部署

### 7.1 Vite 設定

```ts
// vite.config.ts
export default defineConfig({
  base: '/REPO_NAME/',   // 換成實際 repo 名稱;若用 username.github.io 主站則為 '/'
  ...
})
```

### 7.2 路由

使用 `HashRouter`(網址形如 `/#/trip/xxx`),避免 GitHub Pages 重新整理 404 的問題。

### 7.3 GitHub Actions

`.github/workflows/deploy.yml`:push 到 `main` → `npm ci && npm run build` → 用官方 `actions/deploy-pages` 部署 `dist/`。Repo 設定中 Pages 來源選「GitHub Actions」。

### 7.4 環境變數

`VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY` 放在 GitHub repo 的 Actions Variables(或直接寫在程式中,因 anon key 可公開)。本機開發放 `.env.local`。

## 8. 頁面結構

```
/#/                     首頁:我的行程列表 + 建立行程 + 輸入邀請碼加入
/#/trip/:id             行程主頁:支出列表(依日期分組)+ 底部新增按鈕
/#/trip/:id/new         新增/編輯支出表單
/#/trip/:id/settle      結算頁:每人淨額 + 最少轉帳方案 + 標記已還款
/#/trip/:id/stats       統計頁:總支出、分類圓餅圖、每人支出長條圖
/#/trip/:id/members     成員與行程設定(邀請碼分享、匯率設定)
```

行動裝置優先:底部 tab 導覽(支出 / 結算 / 設定),所有互動元件最小點擊區 44px。分享邀請碼用 `navigator.share`(行動瀏覽器原生分享面板),不支援時退回複製到剪貼簿。

## 9. UI 設計方向

不要做成通用的 Bootstrap 風格。給設計的定調:

- **主題**:旅行帳本——輕快、像旅程中的隨手記帳,不是冷冰冰的財務軟體。
- **色彩**:以一個飽和但不刺眼的主色(例如山嵐藍綠或夕陽珊瑚擇一)搭配大量留白;金額正負用語意色(收回款項=綠、應付=暖橘紅)。
- **字體**:金額使用 tabular numbers(`font-variant-numeric: tabular-nums`)對齊;中文介面文案使用口語、動詞開頭(「記一筆」「算一下誰欠誰」)。
- **簽名元素**:結算頁的「轉帳方案」用箭頭連線卡片呈現(小明 ➜ 小華),這是這個 app 最常被截圖分享到群組的畫面,值得花心思。
- 深色模式跟隨系統(`prefers-color-scheme`)。

## 10. 開發階段(建議 Claude Code 依序執行)

**Phase 1 — 專案骨架**
1. `npm create vite@latest`(react-ts)+ Tailwind + react-router(HashRouter)+ supabase-js + vite-plugin-pwa。
2. 建立 Supabase client 模組、TypeScript 型別(對應第 4 節 schema)。
3. GitHub Actions 部署流程,先部署一個 Hello World 確認 Pages 正常。

**Phase 2 — 核心流程**
4. 建立行程 / 邀請碼加入 / localStorage 身分記憶。
5. 支出 CRUD + 分攤(平分 / 自訂金額),金額一律以「分」運算。
6. Supabase Realtime 訂閱:`expenses`、`expense_splits`、`members` 變動時更新畫面。

**Phase 3 — 結算**
7. 淨額計算 + 最少轉帳貪婪演算法(寫單元測試,含浮點與除不盡的邊界案例:例如 100 元 3 人平分 = 34/33/33)。
8. 標記已還款(settlement 交易)。

**Phase 4 — PWA 與打磨**
9. manifest、圖示、autoUpdate、iOS meta tags。
10. UI 打磨(第 9 節設計方向)、深色模式、空狀態與錯誤訊息文案。

**Phase 5 — 多幣別與統計(確定要做)**
11. 多幣別:支出表單幣別選單、成員設定頁的匯率管理(讀寫 `trip_fx_rates`,Realtime 同步)、新增支出時以行程匯率為預設快照寫入 `fx_rate`、結算與統計一律換算主幣別。
12. 統計頁:總支出、分類圓餅圖、每人支出長條圖(recharts,前端計算)。

## 11. 你(使用者)需要手動做的事

1. 到 [supabase.com](https://supabase.com) 註冊免費帳號 → New Project(區域選 Singapore 或 Tokyo,離台灣近)。
2. 在 SQL Editor 貼上第 4 節的 SQL 執行。
3. 在 Project Settings → API 複製 `URL` 與 `anon public` key,提供給 Claude Code。
4. 建立 GitHub repo,Settings → Pages → Source 選「GitHub Actions」。

## 12. 給 Claude Code 的起手 prompt(建議)

> 請閱讀專案根目錄的這份規格書,依照第 10 節的 Phase 順序開發。每完成一個 Phase 先讓我確認再繼續。Supabase 的 URL 與 anon key 是:(貼上)。GitHub repo 名稱是:(貼上,用於 vite base path)。

也建議把本文件存成 repo 根目錄的 `SPEC.md`,並在 `CLAUDE.md` 中寫一行:「開發時遵循 SPEC.md 規格;金額一律以整數分運算;所有資料查詢必須以 trip_id 過濾。」
