import React from 'react'
import { AppProvider, useApp } from './context/AppContext'
import { Header } from './components/Header'
import { Screen1Prompt } from './screens/Screen1Prompt'
import { Screen2Scope } from './screens/Screen2Scope'
import { Screen3Calibration } from './screens/Screen3Calibration'
import { Screen5Projects } from './screens/Screen5Projects'

const MainContent: React.FC = () => {
  const { currentScreen } = useApp()

  return (
    <div className="min-h-screen flex flex-col bg-[#0A0A0F]">
      <Header />
      <main className="flex-1 flex flex-col">
        {currentScreen === 1 && <Screen1Prompt />}
        {currentScreen === 2 && <Screen2Scope />}
        {currentScreen === 3 && <Screen3Calibration />}
        {currentScreen === 4 && (
          <div className="p-8 text-center">
            <h2 className="text-2xl font-bold text-white font-display">Screen 4: IDE Workspace Placeholder</h2>
          </div>
        )}
        {currentScreen === 5 && <Screen5Projects />}
        {currentScreen === 6 && (
          <div className="p-8 text-center">
            <h2 className="text-2xl font-bold text-white font-display">Screen 6: Full Roadmap Placeholder</h2>
          </div>
        )}
      </main>
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
