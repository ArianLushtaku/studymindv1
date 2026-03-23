import './App.css'
import { useEffect, useState } from 'react'
import CodeQuestion from './components/CodeQuestion'
import MCQQuestion from './components/MCQQuestion'
import { SUBJECTS, API_URL } from './constants'

function getSavedSessions() {
  const sessions = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.startsWith('questions_')) {
      const parts = key.replace('questions_', '').split('_')
      const subject = parts[0]
      const filename = parts.slice(1, -1).join('_')
      sessions.push({ key, subject, filename })
    }
  }
  return sessions
}

export default function App() {
  const [file, setFile] = useState(null)
  const [status, setStatus] = useState('')
  const [questions, setQuestions] = useState([])
  const [subject, setSubject] = useState(null)
  const [sessions, setSessions] = useState(getSavedSessions())
  const [activeSession, setActiveSession] = useState(null)
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  useEffect(() => {
    if (subject !== 'Programmering') return
    if (document.getElementById('pyodide-script')) return
    const script = document.createElement('script')
    script.id = 'pyodide-script'
    script.src = 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js'
    document.head.appendChild(script)
  }, [subject])

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0]
    setFile(selectedFile)
    if (selectedFile && subject) {
      const cacheKey = `questions_${subject}_${selectedFile.name}_${selectedFile.size}`
      const cached = localStorage.getItem(cacheKey)
      if (cached) {
        setQuestions(JSON.parse(cached))
        setActiveSession(cacheKey)
        setStatus('Cache hentet')
        setTimeout(() => setStatus(''), 2000)
      }
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!file) { setStatus('Vælg en fil.'); return }
    if (!subject) { setStatus('Vælg et fag.'); return }

    const formData = new FormData()
    formData.append('file', file)
    formData.append('subject', subject)

    try {
      setStatus('Behandler fil...')
      const response = await fetch(`${API_URL}/upload`, { method: 'POST', body: formData })
      const data = await response.json()

      if (response.status === 429) {
        setStatus('Daglig grænse nået: Du kan maks uploade 5 filer per dag. Prøv igen i morgen.')
        return
      }

      if (!data.text) throw new Error(data.message || JSON.stringify(data))
      const parsed = JSON.parse(data.text)

      const cacheKey = `questions_${subject}_${file.name}_${file.size}`
      localStorage.setItem(cacheKey, JSON.stringify(parsed.questions))
      setActiveSession(cacheKey)
      setSessions(getSavedSessions())
      setQuestions(parsed.questions)
      setStatus('')
    } catch (error) {
      setStatus('Fejl: ' + error.message)
    }
  }

  const loadSession = (key) => {
    const cached = localStorage.getItem(key)
    if (!cached) return
    const subject = key.replace('questions_', '').split('_')[0]
    setSubject(subject)
    setQuestions(JSON.parse(cached))
    setActiveSession(key)
    setStatus('')
}

  const deleteSession = (key) => {
    localStorage.removeItem(key)
    setSessions(getSavedSessions())
    if (activeSession === key) {
      setQuestions([])
      setActiveSession(null)
    }
  }

  const now = new Date()
  const dateStr = now.toISOString().split('T')[0]

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            CYBS-F26A
            <span>EXAM PREP SYSTEM v1.0</span>
          </div>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-label">Sessioner</div>
          {sessions.length === 0 && (
            <p className="sidebar-empty">// ingen gemte sessioner</p>
          )}
          {sessions.map(s => (
            <div key={s.key} className={`session-item${activeSession === s.key ? ' active' : ''}`}>
              <div className="session-info" onClick={() => loadSession(s.key)}>
                <span className="session-subject">{s.subject}</span>
                <span className="session-file">{s.filename}</span>
              </div>
              <button className="session-delete" onClick={() => deleteSession(s.key)}>✕</button>
            </div>
          ))}
        </div>
      </aside>

      <main className="page">
        <div className="page-header">
          <div className="page-title">CYBS-F26A</div>
          <div className="page-subtitle">CYBERSECURITY EXAMINATION PREPARATION SYSTEM</div>
          <div className="page-meta">
            <span className="meta-item">STATUS: <span>ONLINE</span></span>
            <span className="meta-item">DATE: <span>{dateStr}</span></span>
            <span className="meta-item">MODEL: <span>CLAUDE HAIKU</span></span>
          </div>
          <div className="theme-selector">
            <span className="theme-selector-label">Color theme:</span>
            <button
              className={`theme-btn${theme === 'cyber' ? ' active' : ''}`}
              onClick={() => setTheme('cyber')}
            >
              Cybersecurity
            </button>
            <button
              className={`theme-btn${theme === 'dark' ? ' active' : ''}`}
              onClick={() => setTheme('dark')}
            >
              Dark
            </button>
            <button
              className={`theme-btn${theme === 'quiz' ? ' active' : ''}`}
              onClick={() => setTheme('quiz')}
            >
              Quiz
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="section-label">Vælg fag</div>
          <div className="subject-bar">
            {SUBJECTS.map(s => (
              <button
                key={s}
                type="button"
                className={`subject-btn${subject === s ? ' active' : ''}`}
                onClick={() => { setSubject(s); setQuestions([]) }}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="upload-panel">
            <div className="file-row">
              <input
                type="file"
                className="file-input"
                onChange={handleFileChange}
              />
              <button type="submit" className="btn-primary">Generer</button>
            </div>
          </div>
        </form>

        {status && <p className="status">{status}</p>}

        {questions.length > 0 && (
          <div>
            <p className="question-count">// {questions.length} spørgsmål genereret</p>
            {questions.map(q =>
              q.type === 'code'
                ? <CodeQuestion key={q.id} q={q} />
                : <MCQQuestion key={q.id} q={q} />
            )}
          </div>
        )}
      </main>
    </div>
  )
}