import React from 'react'
import { AppProvider, useApp } from './context/AppContext'
import { Header } from './components/Header'
import { Screen0Landing } from './screens/Screen0Landing'
import { Screen1Prompt } from './screens/Screen1Prompt'
import { Screen2Scope } from './screens/Screen2Scope'
import { Screen3ProjectOverview } from './screens/Screen3ProjectOverview'
import { Screen4Workspace } from './screens/Screen4Workspace'
import { Screen5Projects } from './screens/Screen5Projects'
import { Screen6Roadmap } from './screens/Screen6Roadmap'
import { TermsPrivacyView } from './screens/TermsPrivacyView'
import { PublicProfileView } from './screens/PublicProfileView'
import { LLMTracePanel } from './components/LLMTracePanel'
import { ErrorBoundary } from './components/ErrorBoundary'

const MainContent: React.FC = () => {
  const { currentScreen, isAuthenticated, authLoading } = useApp()

  // Routing checks
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '/'
  if (pathname === '/terms-privacy') {
    return <TermsPrivacyView />
  }
  if (pathname.startsWith('/u/')) {
    const username = pathname.replace('/u/', '').split('/')[0]
    return <PublicProfileView username={username} />
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#07080C] text-cyan-400">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-semibold tracking-wide">Loading Ascent Academy...</span>
        </div>
      </div>
    )
  }

  // Signed out -> Show Landing Page
  if (!isAuthenticated) {
    return <Screen0Landing />
  }

  const showDebugTrace =
    process.env.NODE_ENV !== 'production' ||
    (typeof window !== 'undefined' && window.location.search.includes('debug=true'))

  return (
    <div className="min-h-screen flex flex-col bg-[#0A0A0F]">
      <Header />
      <main className="flex-1 flex flex-col overflow-hidden">
        {currentScreen === 1 && <Screen1Prompt />}
        {currentScreen === 2 && <Screen2Scope />}
        {currentScreen === 3 && <Screen3ProjectOverview />}
        {currentScreen === 4 && <Screen4Workspace />}
        {currentScreen === 5 && <Screen5Projects />}
        {currentScreen === 6 && <Screen6Roadmap />}
      </main>
      {showDebugTrace && <LLMTracePanel />}
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <MainContent />
      </AppProvider>
    </ErrorBoundary>
  )
}
