import { useRef, useState } from 'react'

export function usePyodide() {
  const pyodideRef = useRef(null)
  const loadingRef = useRef(false)
  const [pyReady, setPyReady] = useState(false)

  const load = async (setOutput) => {
    if (loadingRef.current) return
    loadingRef.current = true
    
    // Wait for pyodide script to be available
    let attempts = 0
    while (!window.loadPyodide && attempts < 30) {
      await new Promise(r => setTimeout(r, 500))
      attempts++
    }
    
    if (!window.loadPyodide) {
      setOutput('Pyodide kunne ikke indlæses')
      return
    }
    
    setOutput('Loading Python...')
    pyodideRef.current = await window.loadPyodide()
    setOutput('')
    setPyReady(true)
  }

  const run = async (code, setOutput, setRunning) => {
    if (!pyodideRef.current) { setOutput('Python ikke klar endnu...'); return }
    setRunning(true)
    setOutput('')
    try {
      // Normalize 2-space indent to 4-space
      const normalizedCode = code.split('\n').map(line => {
        const match = line.match(/^(\s+)/)
        if (!match) return line
        // eslint-disable-next-line no-regex-spaces
        const spaces = match[1].replace(/  /g, '    ')
        return spaces + line.trimStart()
      }).join('\n')

      await pyodideRef.current.runPythonAsync(`import sys, io\nsys.stdout = io.StringIO()`)
      await pyodideRef.current.runPythonAsync(normalizedCode)
      const out = await pyodideRef.current.runPythonAsync(`sys.stdout.getvalue()`)
      setOutput(out || '(ingen output)')
    } catch (e) {
      setOutput('Error: ' + e.message)
    }
    setRunning(false)
  }


  return { load, run, pyReady }
}