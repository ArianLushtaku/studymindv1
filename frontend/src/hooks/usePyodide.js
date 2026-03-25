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
  setOutput('Installerer pakker...')
  
  try {
    // Extract all imports from the code
    const importMatches = code.match(/^(?:import|from)\s+([a-zA-Z0-9_]+)/gm) || []
    const modules = importMatches
      .map(m => m.replace(/^(?:import|from)\s+/, '').trim())
      .filter(m => !['sys', 'io', 're', 'os', 'math', 'json', 'random', 
                      'datetime', 'collections', 'itertools', 'functools',
                      'string', 'time', 'copy', 'abc', 'typing'].includes(m))

    if (modules.length > 0) {
      await pyodideRef.current.runPythonAsync(`
import micropip
import asyncio
async def install_packages():
    packages = ${JSON.stringify(modules)}
    for pkg in packages:
        try:
            await micropip.install(pkg)
        except Exception as e:
            print(f"Could not install {pkg}: {e}")
await install_packages()
      `)
    }

    setOutput('')
    await pyodideRef.current.runPythonAsync(`import sys, io\nsys.stdout = io.StringIO()`)
    const normalizedCode = code.replace(/\t/g, '    ')
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