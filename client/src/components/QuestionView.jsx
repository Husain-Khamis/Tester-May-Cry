import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { runAny, testCode } from '../api'
import AllowedFunctions from './AllowedFunctions'
import ResultBadge from './ResultBadge'
import Workspace from './Workspace'
import CodeTabs from './CodeTabs'
import LongRunDialog from './LongRunDialog'
import { useRun } from '../useRun'
import { extractUsage } from '../usage'
import RankReveal from './RankReveal'
import { getExercise, recordTest, saveExercise } from '../saves'

function QuestionView({ question, lang }) {
  const [loaded, setLoaded] = useState({ subject: null, markdown: '' })
  const file = question.expectedFiles?.[0]
  const [saved] = useState(() => getExercise(lang, question.name))
  const [initial] = useState(() => ({ code: saved?.code ?? `// ${file}\n`, main: saved?.main ?? null }))
  const [code, setCode] = useState(initial.code)
  const [mainEdit, setMainEdit] = useState(initial.main)
  const [output, setOutput] = useState('')
  const [result, setResult] = useState(null)
  const [rank, setRank] = useState(null)
  const [busy, setBusy] = useState(false)
  const run = useRun()

  useEffect(() => {
    if (!question) return
    fetch(`/api/questions/subject?path=${question.subject}`)
      .then((res) => {
        if (!res.ok) throw new Error('Subject not found')
        return res.text()
      })
      .then((data) => setLoaded({ subject: question.subject, markdown: data }))
      .catch(() =>
        setLoaded({ subject: question.subject, markdown: 'Could not load question description.' })
      )
  }, [question])

  const loading = loaded.subject !== question.subject
  const markdown = loaded.markdown

  // The usage program only makes sense when the solution file isn't itself a program
  const usage = /(^|\/)main\.go$|src\/main\.rs$/.test(file) ? null : extractUsage(markdown)
  const main = usage == null ? null : (mainEdit ?? usage)

  // Debounced autosave; flushed on unmount so switching questions loses nothing
  const pending = useRef(null)
  const flush = () => {
    if (pending.current) saveExercise(lang, question.name, pending.current)
    pending.current = null
  }
  useEffect(() => {
    // Only save what the student changed; merely opening an exercise writes nothing
    pending.current =
      code === initial.code && mainEdit === initial.main ? null : { code, ...(mainEdit != null && { main: mainEdit }) }
    const t = setTimeout(flush, 500)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, mainEdit])
  useEffect(() => {
    window.addEventListener('pagehide', flush)
    return () => {
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function exec(fn) {
    setBusy(true)
    setResult(null)
    setRank(null)
    setOutput('')
    try {
      await run.track(fn)
    } catch (err) {
      setOutput(`Error: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  const runCode = () => exec(async (signal) => setOutput((await runAny(lang, question.path, code, main, signal)).output))

  const runTests = () =>
    exec(async (signal) => {
      const data = await testCode(lang, question.path, code, signal)
      if (!data.stopped) setResult(data)
      if (!data.stopped) setRank(recordTest(lang, question.name, data.passed))
      setOutput(data.output || (data.passed ? 'All tests passed' : 'No output'))
    })

  return (
    <>
    <LongRunDialog startedAt={run.startedAt} onStop={run.stop} onKeep={run.keepWaiting} />
    <Workspace
      id="practice"
      description={
        <div className="overflow-y-auto h-full">
          <div className="p-4 border-b border-brass/40">
            <div className="flex items-center justify-between mb-3">
              <h1 className="font-mono font-bold text-xl text-bone">{question.name}</h1>
              <span className="border border-brass/60 text-brass font-heading text-xs tracking-wider px-3 py-1">
                Mission {question.group}
              </span>
            </div>

            <div className="flex gap-4 flex-wrap">
              <div>
                <p className="label mb-1">Difficulty</p>
                <p className="text-bone">{question.difficulty}</p>
              </div>
              <div>
                <p className="label mb-1">Expected Files</p>
                <div className="flex gap-2 flex-wrap">
                  {question.expectedFiles.map((file) => (
                    <span
                      key={file}
                      className="bg-obsidian border border-brass/40 text-brass text-xs px-2 py-1 font-mono"
                    >
                      {file}
                    </span>
                  ))}
                </div>
              </div>
              <AllowedFunctions functions={question.allowedFunctions} lang={lang} />
            </div>
          </div>

          <div className="p-4">
            {loading ? (
              <p className="text-mute">Loading question...</p>
            ) : (
              <div className="prose prose-dmc">
                <ReactMarkdown>{markdown}</ReactMarkdown>
              </div>
            )}
          </div>
        </div>
      }
      toolbar={
        <div className="flex items-center justify-between px-4 py-2 bg-stone border-b border-brass/40">
          <p className="label">Solution</p>
          <div className="flex items-center gap-2">
            {busy && <span className="text-xs text-mute">Running…</span>}
            <button
              onClick={runCode}
              disabled={busy}
              className="btn btn-quiet"
            >
              Run
            </button>
            <button
              onClick={runTests}
              disabled={busy}
              className="btn btn-primary"
            >
              Test
            </button>
          </div>
        </div>
      }
      editor={
        <CodeTabs
          lang={lang}
          id={`practice/${question.name}`}
          file={file}
          code={code}
          onCode={setCode}
          main={main}
          onMain={setMainEdit}
        />
      }
      output={
        <>
          <div className="px-4 py-2 border-b border-brass/40 flex items-center gap-3">
            <p className="label">Output</p>
            <ResultBadge result={result} />
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-4 flex gap-4 items-start">
            <div className="flex-1 min-w-0 font-mono text-sm text-bone">
              {output ? (
                <pre className="whitespace-pre-wrap break-words">{output}</pre>
              ) : (
                <p className="text-mute">Run your code to see output here</p>
              )}
            </div>
            {rank && <RankReveal rank={rank} />}
          </div>
        </>
      }
    />
    </>
  )
}

export default QuestionView