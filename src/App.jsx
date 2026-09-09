import { Routes, Route, useLocation, Link, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import Header from './components/Header.jsx'
import Footer from './components/Footer.jsx'
import Ticker from './components/Ticker.jsx'
import Home from './pages/Home.jsx'
import League from './pages/League.jsx'
import Scores from './pages/Scores.jsx'
import Stats from './pages/Stats.jsx'
import Teams from './pages/Teams.jsx'
import Team from './pages/Team.jsx'
import Game from './pages/Game.jsx'
import About from './pages/About.jsx'
import Privacy from './pages/Privacy.jsx'
import Terms from './pages/Terms.jsx'
import Contact from './pages/Contact.jsx'
import ConsentBanner from './components/ConsentBanner.jsx'
import Margin from './pages/Margin.jsx'
import Story from './pages/Story.jsx'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

function NotFound() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-32 text-center md:px-8">
      <p className="font-display text-7xl text-crimson">404</p>
      <h1 className="mt-4 text-4xl">That page never made the ledger.</h1>
      <Link to="/" className="eyebrow mt-8 inline-block text-crimson hover:underline">
        ← Back to the hardwood
      </Link>
    </div>
  )
}

export default function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <ScrollToTop />
      <Header />
      <Ticker />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/league/:key" element={<League />} />
          <Route path="/scores" element={<Scores />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/teams" element={<Teams />} />
          <Route path="/team/:leagueKey/:teamId" element={<Team />} />
          <Route path="/game/:leagueKey/:gameId" element={<Game />} />
          <Route path="/margin" element={<Margin />} />
          {/* The section was called Originals before it had a name; keep old
              links working rather than 404ing anyone who saved one. */}
          <Route path="/originals" element={<Navigate to="/margin" replace />} />
          <Route path="/story/:slug" element={<Story />} />
          <Route path="/about" element={<About />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
      <ConsentBanner />
    </div>
  )
}
