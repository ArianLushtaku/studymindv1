import { useEffect, useRef, useState } from 'react'
import { EditorView, keymap } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { defaultKeymap, indentWithTab } from '@codemirror/commands'
import { indentUnit } from '@codemirror/language'
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

function splitCode(codeblock) {
  if (!codeblock) return { editable: '', tests: '' }
  const splitMarkers = ['# Test cases', '# Tests', '# test cases']
  for (const marker of splitMarkers) {
    const idx = codeblock.indexOf(marker)
    if (idx !== -1) {
      return {
        editable: codeblock.slice(0, idx).trim(),
        tests: codeblock.slice(idx).trim()
      }
    }
  }
  return { editable: codeblock, tests: '' }
}

export default function CodeQuestion({ q, sessionKey}) {
  const { editable, tests } = splitCode(q.codeblock)
  const codeKey = `code_${sessionKey}_${q.id}`
  const savedCode = localStorage.getItem(codeKey) || editable || ''
  const [code, setCode] = useState(savedCode)
  // eslint-disable-next-line no-unused-vars
  const [output, setOutput] = useState('')
  const [running, setRunning] = useState(false)
  const [showAnswer, setShowAnswer] = useState(false)
  const editorRef = useRef(null)
  const viewRef = useRef(null)
  const { load, run, pyReady } = usePyodide()
  const [showInfo, setShowInfo] = useState(true)

  useEffect(() => {
    load(setOutput)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!q.id || !sessionKey) return
    localStorage.setItem(codeKey, code)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  useEffect(() => {
    if (viewRef.current || !editorRef.current) return
    viewRef.current = new EditorView({
      state: EditorState.create({
        doc: savedCode,
        extensions: [
          basicSetup,
          keymap.of([...defaultKeymap, indentWithTab]),
          python(),
          oneDark,
          indentUnit.of('    '),
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const runFull = () => {
    const fullCode = code + '\n\n' + tests
    run(fullCode, setOutput, setRunning)
  }

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
      <div className="code-info">
        <div className="code-info-header" onClick={() => setShowInfo(v => !v)}>
          <span className="code-info-icon">ℹ</span>
          <span className="code-info-title">Sådan fungerer kodeopgaverne</span>
          <span style={{ marginLeft: 'auto', color: 'var(--text-dim)', fontSize: '0.7rem' }}>
            {showInfo ? '▲ skjul' : '▼ vis'}
          </span>
        </div>
        {showInfo && (
          <div className="code-info-body">
            <p>Du skal skrive din løsning i editoren nedenfor. Når du trykker <strong>▶ Kør</strong>, kører din kode mod en række skjulte tests.</p>
            <p>Hver test tjekker om din funktion returnerer det rigtige resultat for et bestemt input. Hvis alle tests består, ser du:</p>
            <pre className="code-info-example success">Test 1 passed: Valid email accepted
      Test 2 passed: Uppercase converted to lowercase</pre>
            <p>Hvis din kode er forkert, ser du en fejl som denne:</p>
            <pre className="code-info-example error">AssertionError: Test 1 failed</pre>
            <p>Det betyder at din funktion returnerede et forkert resultat. Ret din kode og tryk <strong>▶ Kør</strong> igen. Brug <strong>Vis svar</strong> hvis du er gået i stå.</p>
          </div>
        )}
      </div>

      <div ref={editorRef} className="editor-wrapper" />

      <div className="btn-row">
        <button
          onClick={runFull}
          disabled={running || !pyReady}
          className="btn-primary"
        >
          {!pyReady ? 'Loading Python...' : running ? 'Kører...' : '▶ Kør'}
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