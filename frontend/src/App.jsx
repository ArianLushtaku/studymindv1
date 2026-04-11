import './App.css'
import { useEffect, useState, useCallback } from 'react'
import CodeQuestion from './components/CodeQuestion'
import MCQQuestion from './components/MCQQuestion'
import FlashCard from './components/FlashCard'
import { SUBJECTS, API_URL } from './constants'

// ── Learn content renderers ──────────────────────────────────────────────────

function SummaryView({ data }) {
  const s = data.summary
  return (
    <div className="learn-content">
      <div className="learn-section">
        <div className="learn-section-label">Overblik</div>
        <p className="learn-text">{s.overview}</p>
      </div>
      {s.key_points?.length > 0 && (
        <div className="learn-section">
          <div className="learn-section-label">Vigtigste pointer</div>
          <ul className="learn-list">
            {s.key_points.map((p, i) => <li key={i}>{p}</li>)}
          </ul>
        </div>
      )}
      {s.key_terms?.length > 0 && (
        <div className="learn-section">
          <div className="learn-section-label">Centrale begreber</div>
          <div className="term-tags">
            {s.key_terms.map((t, i) => <span key={i} className="term-tag">{t}</span>)}
          </div>
        </div>
      )}
      {s.learning_goals?.length > 0 && (
        <div className="learn-section">
          <div className="learn-section-label">Læringsmål</div>
          <ul className="learn-list">
            {s.learning_goals.map((g, i) => <li key={i}>{g}</li>)}
          </ul>
        </div>
      )}
    </div>
  )
}

function ConceptsView({ data }) {
  return (
    <div className="learn-content">
      {data.concepts?.map((c, i) => (
        <div key={i} className="concept-card">
          <div className="concept-name">{c.name}</div>
          <p className="concept-explanation">{c.explanation}</p>
          {c.example && (
            <div className="concept-example">
              <span className="concept-example-label">Eksempel:</span> {c.example}
            </div>
          )}
          {c.relevance && (
            <div className="concept-relevance">
              <span className="concept-relevance-label">Relevans:</span> {c.relevance}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function TipsView({ data }) {
  const t = data.tips
  const sections = [
    { key: 'exam_focus', label: 'Fokusér på til eksamen' },
    { key: 'common_mistakes', label: 'Hyppige fejl' },
    { key: 'memory_tricks', label: 'Husketricks' },
    { key: 'quick_wins', label: 'Lette point' },
  ]
  return (
    <div className="learn-content">
      {sections.map(({ key, label }) => t[key]?.length > 0 && (
        <div key={key} className="learn-section">
          <div className="learn-section-label">{label}</div>
          <ul className="learn-list">
            {t[key].map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        </div>
      ))}
    </div>
  )
}

function FlashCardsView({ data }) {
  const [current, setCurrent] = useState(0)
  const cards = data.flashcards || []
  if (!cards.length) return <p className="status">Ingen flashcards genereret.</p>
  return (
    <div className="flashcard-container">
      <FlashCard card={cards[current]} index={current} total={cards.length} />
      <div className="flashcard-nav">
        <button
          className="btn-secondary"
          onClick={() => setCurrent(c => Math.max(0, c - 1))}
          disabled={current === 0}
        >← Forrige</button>
        <span className="flashcard-progress">{current + 1} / {cards.length}</span>
        <button
          className="btn-secondary"
          onClick={() => setCurrent(c => Math.min(cards.length - 1, c + 1))}
          disabled={current === cards.length - 1}
        >Næste →</button>
      </div>
    </div>
  )
}

// ── Session helpers (file upload flow) ──────────────────────────────────────

function getSavedSessions() {
  const sessions = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith('questions_')) {
      const parts = key.replace('questions_', '').split('_')
      sessions.push({ key, subject: parts[0], filename: parts.slice(1, -1).join('_') })
    }
  }
  return sessions
}

// ── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [mode, setMode] = useState('learn') // 'learn' | 'quiz' | 'upload'
  const [subject, setSubject] = useState(null)
  const [topic, setTopic] = useState(null)
  const [topics, setTopics] = useState([])
  const [contentType, setContentType] = useState(null)
  const [content, setContent] = useState(null)
  const [questions, setQuestions] = useState([])
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark')

  // Upload mode state
  const [file, setFile] = useState(null)
  const [sessions, setSessions] = useState(getSavedSessions())
  const [activeSession, setActiveSession] = useState(null)

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

  // Load topics when subject changes
  useEffect(() => {
    if (!subject || mode === 'upload') return
    setTopics([])
    setTopic(null)
    setContent(null)
    setQuestions([])
    fetch(`${API_URL}/topics?subject=${encodeURIComponent(subject)}`)
      .then(r => r.json())
      .then(d => setTopics(d.topics || []))
      .catch(() => setTopics([]))
  }, [subject, mode])

  const learnTypes = [
    { id: 'summary', label: 'Sammendrag' },
    { id: 'concepts', label: 'Begreber' },
    { id: 'tips', label: 'Tips & Tricks' },
  ]

  const quizTypes = [
    { id: 'mcq', label: 'MCQ' },
    ...(subject === 'Programmering' ? [{ id: 'code', label: 'Kodning' }] : []),
    { id: 'flashcards', label: 'Flashcards' },
  ]

  const activeTypes = mode === 'learn' ? learnTypes : quizTypes

  const handleGenerate = useCallback(async () => {
    if (!subject || !topic || !contentType) return
    setLoading(true)
    setStatus('Genererer...')
    setContent(null)
    setQuestions([])

    try {
      const res = await fetch(`${API_URL}/content`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, topic, type: contentType }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Fejl')

      const payload = data.data
      if (contentType === 'mcq' || contentType === 'code') {
        setQuestions(payload.questions || [])
      } else {
        setContent(payload)
      }
      setStatus(data.cached ? '⚡ Fra cache' : '✓ Genereret')
      setTimeout(() => setStatus(''), 2000)
    } catch (e) {
      setStatus('Fejl: ' + e.message)
    } finally {
      setLoading(false)
    }
  }, [subject, topic, contentType])

  // File upload handlers (legacy mode)
  const handleFileChange = (e) => {
    const f = e.target.files[0]
    setFile(f)
    if (f && subject) {
      const key = `questions_${subject}_${f.name}_${f.size}`
      const cached = localStorage.getItem(key)
      if (cached) {
        setQuestions(JSON.parse(cached))
        setActiveSession(key)
        setStatus('Cache hentet')
        setTimeout(() => setStatus(''), 2000)
      }
    }
  }

  const handleUploadSubmit = async (e) => {
    e.preventDefault()
    if (!file || !subject) { setStatus('Vælg fil og fag.'); return }
    const formData = new FormData()
    formData.append('file', file)
    formData.append('subject', subject)
    try {
      setStatus('Behandler fil...')
      const res = await fetch(`${API_URL}/upload`, { method: 'POST', body: formData })
      const data = await res.json()
      if (!data.text) throw new Error(data.message)
      const parsed = JSON.parse(data.text)
      const key = `questions_${subject}_${file.name}_${file.size}`
      localStorage.setItem(key, JSON.stringify(parsed.questions))
      setActiveSession(key)
      setSessions(getSavedSessions())
      setQuestions(parsed.questions)
      setStatus('')
    } catch (err) {
      setStatus('Fejl: ' + err.message)
    }
  }

  const loadSession = (key) => {
    const cached = localStorage.getItem(key)
    if (!cached) return
    setSubject(key.replace('questions_', '').split('_')[0])
    setQuestions(JSON.parse(cached))
    setActiveSession(key)
    setMode('upload')
  }

  const deleteSession = (key) => {
    localStorage.removeItem(key)
    const toRemove = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && (k.startsWith(`code_${key}`) || k.startsWith(`selected_${key}`) || k.startsWith(`revealed_${key}`)))
        toRemove.push(k)
    }
    toRemove.forEach(k => localStorage.removeItem(k))
    setSessions(getSavedSessions())
    if (activeSession === key) { setQuestions([]); setActiveSession(null) }
  }

  const now = new Date()
  const dateStr = now.toISOString().split('T')[0]

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            CYBS-F26A
            <span>STUDY SYSTEM v2.0</span>
          </div>
        </div>

        {sessions.length > 0 && (
          <div className="sidebar-section">
            <div className="sidebar-label">Upload sessioner</div>
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
        )}
      </aside>

      <main className="page">
        <div className="page-header">
          <div className="page-title">CYBS-F26A</div>
          <div className="page-subtitle">CYBERSECURITY STUDY SYSTEM</div>
          <div className="page-meta">
            <span className="meta-item">STATUS: <span>ONLINE</span></span>
            <span className="meta-item">DATE: <span>{dateStr}</span></span>
            <span className="meta-item">MODEL: <span>CLAUDE HAIKU</span></span>
          </div>
          <div className="theme-selector">
            <span className="theme-selector-label">Theme:</span>
            {['cyber', 'dark', 'quiz'].map(t => (
              <button key={t} className={`theme-btn${theme === t ? ' active' : ''}`} onClick={() => setTheme(t)}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Mode selector */}
        <div className="mode-bar">
          <button className={`mode-btn${mode === 'learn' ? ' active' : ''}`} onClick={() => { setMode('learn'); setContentType(null); setContent(null); setQuestions([]) }}>
            Lær
          </button>
          <button className={`mode-btn${mode === 'quiz' ? ' active' : ''}`} onClick={() => { setMode('quiz'); setContentType(null); setContent(null); setQuestions([]) }}>
            Quiz
          </button>
          <button className={`mode-btn${mode === 'upload' ? ' active' : ''}`} onClick={() => { setMode('upload'); setContent(null); setQuestions([]) }}>
            Upload
          </button>
        </div>

        {/* Subject selector */}
        <div className="section-label">Fag</div>
        <div className="subject-bar">
          {SUBJECTS.filter(s => s !== 'General' || mode === 'upload').map(s => (
            <button
              key={s}
              type="button"
              className={`subject-btn${subject === s ? ' active' : ''}`}
              onClick={() => { setSubject(s); setTopic(null); setContent(null); setQuestions([]) }}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Topic browser (Learn + Quiz modes) */}
        {mode !== 'upload' && subject && (
          <>
            <div className="section-label">Emne</div>
            {topics.length === 0 ? (
              <p className="status">Indlæser emner...</p>
            ) : (
              <div className="topic-bar">
                {topics.map(t => (
                  <button
                    key={t.topic_name}
                    className={`topic-btn${topic === t.topic_name ? ' active' : ''}`}
                    onClick={() => { setTopic(t.topic_name); setContent(null); setQuestions([]) }}
                  >
                    {t.topic_name}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* Content type selector */}
        {mode !== 'upload' && subject && topic && (
          <>
            <div className="section-label">{mode === 'learn' ? 'Læringstype' : 'Quiztype'}</div>
            <div className="type-bar">
              {activeTypes.map(t => (
                <button
                  key={t.id}
                  className={`type-btn${contentType === t.id ? ' active' : ''}`}
                  onClick={() => { setContentType(t.id); setContent(null); setQuestions([]) }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Generate button */}
        {mode !== 'upload' && subject && topic && contentType && (
          <div className="generate-row">
            <button
              className="btn-primary"
              onClick={handleGenerate}
              disabled={loading}
            >
              {loading ? 'Genererer...' : 'Generer'}
            </button>
          </div>
        )}

        {/* Upload mode */}
        {mode === 'upload' && (
          <form onSubmit={handleUploadSubmit}>
            <div className="upload-panel">
              <div className="file-row">
                <input type="file" className="file-input" onChange={handleFileChange} />
                <button type="submit" className="btn-primary">Generer</button>
              </div>
            </div>
          </form>
        )}

        {status && <p className="status">{status}</p>}

        {/* Learn content */}
        {content && contentType === 'summary' && <SummaryView data={content} />}
        {content && contentType === 'concepts' && <ConceptsView data={content} />}
        {content && contentType === 'tips' && <TipsView data={content} />}
        {content && contentType === 'flashcards' && <FlashCardsView data={content} />}

        {/* Quiz content */}
        {questions.length > 0 && (
          <div>
            <p className="question-count">// {questions.length} spørgsmål genereret</p>
            {questions.map(q =>
              q.type === 'code'
                ? <CodeQuestion key={q.id} q={q} sessionKey={activeSession} />
                : <MCQQuestion key={q.id} q={q} sessionKey={activeSession} />
            )}
          </div>
        )}
      </main>
    </div>
  )
}
