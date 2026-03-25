import { useRef, useState } from 'react'

export function usePyodide() {
  const pyodideRef = useRef(null)
  const loadingRef = useRef(false)
  const [pyReady, setPyReady] = useState(false)

  const load = async (setOutput) => {
    if (loadingRef.current) return
    loadingRef.current = true

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

    // Load micropip so packages can be installed
    await pyodideRef.current.loadPackage('micropip')

    setOutput('')
    setPyReady(true)
  }

  const run = async (code, setOutput, setRunning) => {
    if (!pyodideRef.current) { setOutput('Python ikke klar endnu...'); return }
    setRunning(true)
    setOutput('Tjekker pakker...')

    try {
      // Extract imports and install missing packages
      const importMatches = code.match(/^(?:import|from)\s+([a-zA-Z0-9_]+)/gm) || []
      const builtins = ['sys', 'io', 're', 'os', 'math', 'json', 'random',
                        'datetime', 'collections', 'itertools', 'functools',
                        'string', 'time', 'copy', 'abc', 'typing', 'html',
                        'hashlib', 'base64', 'urllib', 'pathlib', 'struct']
      const modules = importMatches
        .map(m => m.replace(/^(?:import|from)\s+/, '').trim())
        .filter(m => !builtins.includes(m))

      if (modules.length > 0) {
        await pyodideRef.current.runPythonAsync(`
import micropip
async def _install():
    packages = ${JSON.stringify(modules)}
    for pkg in packages:
        try:
            await micropip.install(pkg)
        except Exception as e:
            print(f"Note: could not install {pkg}: {e}")
await _install()
        `)
      }

      setOutput('')

      // Normalize indentation
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