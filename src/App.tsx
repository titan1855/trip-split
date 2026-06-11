import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import TripLayout from './pages/TripLayout'
import ExpensesPage from './pages/ExpensesPage'
import ExpenseFormPage from './pages/ExpenseFormPage'
import SettlePage from './pages/SettlePage'
import StatsPage from './pages/StatsPage'
import MembersPage from './pages/MembersPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/trip/:id" element={<TripLayout />}>
        <Route index element={<ExpensesPage />} />
        <Route path="new" element={<ExpenseFormPage />} />
        <Route path="edit/:expenseId" element={<ExpenseFormPage />} />
        <Route path="settle" element={<SettlePage />} />
        <Route path="stats" element={<StatsPage />} />
        <Route path="members" element={<MembersPage />} />
      </Route>
    </Routes>
  )
}
