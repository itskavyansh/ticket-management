import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import { Dashboard } from '@/pages/Dashboard'
import { Tickets } from '@/pages/Tickets'
import { Technicians } from '@/pages/Technicians'
import { Workload } from '@/pages/Workload'
import { Analytics } from '@/pages/Analytics'
import { SLAMonitor } from '@/pages/SLAMonitor'
import { Settings } from '@/pages/Settings'
import { Profile } from '@/pages/Profile'
import { AIChatbot } from '@/components/chatbot/AIChatbot'

function App() {
  const [isChatbotOpen, setIsChatbotOpen] = useState(false)

  const toggleChatbot = () => {
    setIsChatbotOpen(!isChatbotOpen)
  }

  return (
    <>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/tickets/*" element={<Tickets />} />
          <Route path="/technicians" element={<Technicians />} />
          <Route path="/workload" element={<Workload />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/sla" element={<SLAMonitor />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </Layout>
      
      {/* AI Chatbot */}
      <AIChatbot isOpen={isChatbotOpen} onToggle={toggleChatbot} />
    </>
  )
}

export default App