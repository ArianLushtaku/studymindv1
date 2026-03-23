import { useRef } from 'react'

export function usePyodide() {
  const pyodideRef = useRef(null)
  const loadingRef = useRef(false)

  const load = async (setOutput) => {
    if (loadingRef.current) return
    loadingRef.current = true
    if (!window.loadPyodide) return
    setOutput('Loading Python...')
    pyodideRef.current = await window.loadPyodide()
    setOutput('')
  }

  const run = async (code, setOutput, setRunning) => {
    if (!pyodideRef.current) { setOutput('Python ikke klar endnu...'); return }
    setRunning(true)
    setOutput('')
    try {
      await pyodideRef.current.runPythonAsync(`import sys, io\nsys.stdout = io.StringIO()`)
      await pyodideRef.current.runPythonAsync(code)
      const out = await pyodideRef.current.runPythonAsync(`sys.stdout.getvalue()`)
      setOutput(out || '(ingen output)')
    } catch (e) {
      setOutput('Error: ' + e.message)
    }
    setRunning(false)
  }

  return { load, run }
}