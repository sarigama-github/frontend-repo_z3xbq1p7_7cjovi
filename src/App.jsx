import ParkingGame from './components/ParkingGame'

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.07),transparent_50%)] pointer-events-none"></div>

      <div className="relative min-h-screen flex flex-col">
        <header className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <img src="/flame-icon.svg" alt="Flames" className="w-8 h-8" />
            <div>
              <h1 className="text-xl font-bold leading-tight">Car Parking Game</h1>
              <p className="text-xs text-blue-200/80">Park precisely without crashing</p>
            </div>
          </div>
          <nav className="text-sm text-blue-200/80">
            <a href="/test" className="hover:text-white transition-colors">Backend Test</a>
          </nav>
        </header>

        <main className="flex-1">
          <ParkingGame />
        </main>

        <footer className="px-6 py-4 text-center text-xs text-blue-300/60">
          Built with Flames Blue • Use WASD or Arrow Keys • Press R to restart
        </footer>
      </div>
    </div>
  )
}

export default App