import { useState } from 'react'

export default function FlashCard({ card, index, total }) {
  const [flipped, setFlipped] = useState(false)

  return (
    <div className="flashcard-wrapper" onClick={() => setFlipped(f => !f)}>
      <div className={`flashcard${flipped ? ' flipped' : ''}`}>
        <div className="flashcard-front">
          <div className="flashcard-index">{index + 1} / {total}</div>
          <div className="flashcard-label">BEGREB</div>
          <div className="flashcard-content">{card.term}</div>
          <div className="flashcard-hint">Klik for at vende</div>
        </div>
        <div className="flashcard-back">
          <div className="flashcard-index">{index + 1} / {total}</div>
          <div className="flashcard-label">FORKLARING</div>
          <div className="flashcard-content">{card.definition}</div>
          <div className="flashcard-hint">Klik for at vende</div>
        </div>
      </div>
    </div>
  )
}
