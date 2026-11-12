import React from 'react'
import { AppProvider, useApp } from './context/AppContext'
import { Header } from './components/Header'
import { Screen1Prompt } from './screens/Screen1Prompt'
import { Screen2Scope } from './screens/Screen2Scope'
import { Screen3ProjectOverview } from './screens/Screen3ProjectOverview'
import { Screen4Workspace } from './screens/Screen4Workspace'
import { Screen5Projects } from './screens/Screen5Projects'
import { Screen6Roadmap } from './screens/Screen6Roadmap'
import { LLMTracePanel } from './components/LLMTracePanel'

const MainContent: React.FC = () => {
  const { currentScreen } = useApp()

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
      <LLMTracePanel />
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <MainContent />
    </AppProvider>
  )
}
