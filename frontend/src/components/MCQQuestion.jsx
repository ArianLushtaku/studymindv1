import { useState } from 'react'

export default function MCQQuestion({ q }) {
  const selectedKey = `selected_${q.id}`
  const revealedKey = `revealed_${q.id}`

  const [selected, setSelected] = useState(localStorage.getItem(selectedKey) || null)
  const [revealed, setRevealed] = useState(localStorage.getItem(revealedKey) === 'true')

  const handleSelect = (key) => {
    if (revealed) return
    setSelected(key)
    localStorage.setItem(selectedKey, key)
  }

  const handleReveal = () => {
    setRevealed(true)
    localStorage.setItem(revealedKey, 'true')
  }

  return (
    <div className="card">
      <div className="card-header">
        <span className="badge-blue">{q.topic}</span>
        <span className="badge-dim">MCQ</span>
      </div>

      <p className="question-text">{q.spørgsmål}</p>

      {q.codeblock && (
        <pre className="pre-code">{q.codeblock}</pre>
      )}

      <div className="options">
        {Object.entries(q.muligheder).map(([key, val]) => {
          const isSelected = selected === key
          const isCorrect = key === q.answer
          let cls = 'option-btn'
          if (revealed && isCorrect) cls += ' correct'
          else if (revealed && isSelected && !isCorrect) cls += ' wrong'
          else if (isSelected) cls += ' selected'

          return (
            <button key={key} className={cls} onClick={() => handleSelect(key)}>
              <span style={{ color: 'var(--green-dim)', marginRight: '0.75rem' }}>{key}.</span>{val}
            </button>
          )
        })}
      </div>

      <button
        className={`btn-check${selected && !revealed ? ' active' : ''}`}
        onClick={handleReveal}
        disabled={!selected || revealed}
      >
        {revealed ? '// svar afsløret' : '// check svar'}
      </button>

      {revealed && (
        <div className="forklaring">
          <strong>Forklaring</strong>
          {q.forklaring}
        </div>
      )}
    </div>
  )
}