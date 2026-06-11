# CLAUDE.md — 旅行拆帳 PWA

## 專案是什麼
旅伴共用的旅行拆帳 PWA。前端部署在 GitHub Pages,資料與即時同步用 Supabase 免費方案。不上架、無帳號系統,旅伴用邀請碼加入行程。

## 最高原則
- 完整規格在 `SPEC.md`,開發一律遵循它;規格與本檔衝突時以本檔為準。
- 依 SPEC.md 第 10 節的 Phase 順序開發,**每完成一個 Phase 停下來讓我確認後才繼續**。
- 不要擅自擴充規格以外的功能;有更好的做法先提出討論。

## 技術棧(不可替換)
- Vite + React 18 + TypeScript + Tailwind CSS
- react-router,**只能用 HashRouter**(GitHub Pages 不支援 SPA 伺服器端路由回退)
- supabase-js v2(前端直連,無自建後端)
- vite-plugin-pwa(registerType: 'autoUpdate')
- 測試用 Vitest

## 鐵則(每次寫程式都要遵守)
- 金額一律以整數「分」(cents)運算與儲存,只在顯示層轉成元;禁止用浮點數算錢。
- 所有 Supabase 查詢必須以 `trip_id` 過濾,禁止無條件撈全表。
- `vite.config.ts` 的 `base` 必須是 `'/<repo名稱>/'`,改 repo 名稱要同步改這裡。
- 結算演算法(淨額計算 + 最少轉帳)必須有單元測試,含除不盡的案例(如 100 元 3 人平分)。
- UI 文案使用繁體中文、口語、動詞開頭(「記一筆」而非「新增支出項目」);行動裝置優先,點擊區最小 44px。
- 對 Supabase 的寫入操作要處理失敗情況,給使用者看得懂的中文錯誤訊息。

## 機密與環境變數
- `VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY` 放 `.env.local`(已在 .gitignore)。
- anon/publishable key 屬可公開金鑰,進入打包後的前端程式碼是預期行為,不算洩漏。
- 絕對不要把 Supabase 的 database password 或 service_role/secret key 寫進任何前端程式或 commit。

## 常用指令
- `npm run dev` 本機開發
- `npm run build` 建置(部署前先在本機跑一次確認過)
- `npm run test` 跑 Vitest
- 部署:push 到 `main` 由 GitHub Actions 自動部署到 GitHub Pages

## Git 慣例
- 小步提交,一個功能一個 commit,訊息格式:`feat: ...`、`fix: ...`、`chore: ...`。
- 每個 Phase 完成時 commit 並 push,讓我能在手機上看 GitHub Pages 的實際效果。
