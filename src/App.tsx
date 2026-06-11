import { Routes, Route } from 'react-router-dom'

// Phase 1:Hello World 確認 GitHub Pages 部署正常,Phase 2 起替換成真正的頁面
function Home() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-teal-50 p-6">
      <h1 className="text-3xl font-bold text-teal-700">旅行拆帳</h1>
      <p className="text-teal-900">Hello World — Phase 1 部署測試</p>
    </main>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
    </Routes>
  )
}
