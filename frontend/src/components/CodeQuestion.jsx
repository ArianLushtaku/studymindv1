import { useEffect, useRef, useState } from 'react'
import { EditorView, keymap } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { defaultKeymap, indentWithTab } from '@codemirror/commands'
import { python } from '@codemirror/lang-python'
import { oneDark } from '@codemirror/theme-one-dark'
import { basicSetup } from 'codemirror'
import { usePyodide } from '../hooks/usePyodide'

function formatAssignment(text) {
  return text
    .replace(/\\n/g, '\n')
    .replace(/•/g, '-')
    .split('\n')
    .map((line, i) => {
      if (!line.trim()) return <br key={i} />
      if (/^\d+\./.test(line.trim())) return <p key={i} className="numbered">{line}</p>
      if (/^-/.test(line.trim())) return <p key={i} className="bullet">{line}</p>
      return <p key={i}>{line}</p>
    })
}

export default function CodeQuestion({ q }) {
  const [code, setCode] = useState(q.codeblock || '')
  const [output, setOutput] = useState('')
  const [running, setRunning] = useState(false)
  const [showAnswer, setShowAnswer] = useState(false)
  const editorRef = useRef(null)
  const viewRef = useRef(null)
  const { load, run } = usePyodide()

  useEffect(() => {
    load(setOutput)
  }, [])

  useEffect(() => {
    if (viewRef.current || !editorRef.current) return
    viewRef.current = new EditorView({
      state: EditorState.create({
        doc: q.codeblock || '',
        extensions: [
          basicSetup,
          keymap.of([...defaultKeymap, indentWithTab]),
          python(),
          oneDark,
          EditorView.updateListener.of(update => {
            if (update.docChanged) setCode(update.state.doc.toString())
          }),
          EditorView.theme({
            '&': { borderRadius: '4px', border: '1px solid #334155' },
            '.cm-scroller': { fontFamily: 'monospace', fontSize: '0.9rem', minHeight: '200px' },
          })
        ]
      }),
      parent: editorRef.current
    })
  }, [])

  return (
    <div className="card">
      <div className="card-header">
        <span className="badge-purple">{q.topic}</span>
        <span className="badge-dim">Kodeopgave</span>
      </div>

      <div className="assignment">
        {formatAssignment(q.assignment)}
      </div>

      {q['Input/Output'] && (
        <pre className="pre-io">{q['Input/Output']}</pre>
      )}

      <div ref={editorRef} className="editor-wrapper" />

      <div className="btn-row">
        <button onClick={() => run(code, setOutput, setRunning)} disabled={running} className="btn-primary">
          {running ? 'Kører...' : '▶ Kør'}
        </button>
        <button onClick={() => setShowAnswer(v => !v)} className="btn-secondary">
          {showAnswer ? 'Skjul svar' : 'Vis svar'}
        </button>
      </div>

      {output && <pre className="pre-output">{output}</pre>}

      {showAnswer && (
        <div className="answer-section">
          <p className="answer-label">Løsning:</p>
          <pre className="pre-answer">{q.answer}</pre>
          {q.hint && <p className="hint">💡 {q.hint}</p>}
        </div>
      )}
    </div>
  )
}