import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import GlobalNav from './components/GlobalNav'
import Toast from './components/Toast'
import OfflineBanner from './components/OfflineBanner'
import ConfirmModal from './components/ConfirmModal'

import Home from './screens/Home'
import Ranking from './screens/Ranking'
import AllGames from './screens/AllGames'
import Profile from './screens/Profile'
import Join from './screens/Join'
import Setup from './screens/Setup'
import Tournament from './screens/Tournament'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename="/padel-americano-react">
        <OfflineBanner />
        <ConfirmModal />
        <Routes>
          <Route path="/"          element={<Home />} />
          <Route path="/ranking"   element={<Ranking />} />
          <Route path="/games"     element={<AllGames />} />
          <Route path="/profile"   element={<Profile />} />
          <Route path="/join"      element={<Join />} />
          <Route path="/setup"     element={<Setup />} />
          <Route path="/tournament/:code" element={<Tournament />} />
          <Route path="*"          element={<Navigate to="/" />} />
        </Routes>
        <GlobalNav />
        <Toast />
      </BrowserRouter>
    </AuthProvider>
  )
}