import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { runAny, testCode } from '../api'
import AllowedFunctions from './AllowedFunctions'
import ResultBadge from './ResultBadge'
import Workspace from './Workspace'
import CodeTabs from './CodeTabs'
import LongRunDialog from './LongRunDialog'
import { useRun } from '../useRun'
import { extractUsage } from '../usage'

const THREE_HOURS = 3 * 60 * 60

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600).toString().padStart(2, '0')
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return `${h}:${m}:${s}`
}

function MockExam({ questions, lang }) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [loaded, setLoaded] = useState({ subject: null, markdown: '' })
  const [codes, setCodes] = useState({})
  const [mains, setMains] = useState({})
  const [outputs, setOutputs] = useState({})
  const [results, setResults] = useState({})
  const [busy, setBusy] = useState(false)
  const run = useRun()
  const [timeLeft, setTimeLeft] = useState(THREE_HOURS)
  const [timeUp, setTimeUp] = useState(false)

  const activeQuestion = questions[activeIndex]?.question

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          setTimeUp(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!activeQuestion) return
    fetch(`/api/questions/subject?path=${activeQuestion.subject}`)
      .then((res) => {
        if (!res.ok) throw new Error('Subject not found')
        return res.text()
      })
      .then((data) => setLoaded({ subject: activeQuestion.subject, markdown: data }))
      .catch(() =>
        setLoaded({ subject: activeQuestion.subject, markdown: 'Could not load question description.' })
      )
  }, [activeQuestion])

  const loadingMarkdown = loaded.subject !== activeQuestion?.subject
  const markdown = loaded.markdown

  function handleCodeChange(value) {
    setCodes((prev) => ({ ...prev, [activeIndex]: value }))
  }

  const file = activeQuestion?.expectedFiles?.[0]
  const code = codes[activeIndex] ?? `// ${file}\n`
  const usage = /(^|\/)main\.go$|src\/main\.rs$/.test(file) ? null : extractUsage(markdown)
  const main = loadingMarkdown || usage == null ? null : (mains[activeIndex] ?? usage)

  async function exec(fn) {
    const i = activeIndex
    const setOut = (v) => setOutputs((prev) => ({ ...prev, [i]: v }))
    setBusy(true)
    setResults((prev) => ({ ...prev, [i]: null }))
    setOut('')
    try {
      await run.track((signal) => fn(i, setOut, signal))
    } catch (err) {
      setOut(`Error: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  const runCode = () =>
    exec(async (i, setOut, signal) => setOut((await runAny(lang, activeQuestion.path, code, main, signal)).output))

  const runTests = () =>
    exec(async (i, setOut, signal) => {
      const data = await testCode(lang, activeQuestion.path, code, signal)
      if (!data.stopped) setResults((prev) => ({ ...prev, [i]: data }))
      setOut(data.output || (data.passed ? 'All tests passed' : 'No output'))
    })

  if (timeUp) {
    return (
      <div className="flex-1 flex items-center justify-center flex-col gap-4 text-bone">
        <h2 className="font-display text-5xl text-crimson">Time is Up</h2>
        <p className="text-mute">Your Bloody Palace run has ended</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <LongRunDialog startedAt={run.startedAt} onStop={run.stop} onKeep={run.keepWaiting} />
      <div className="bg-stone border-b border-brass/40 px-4 py-2 flex items-center gap-3">
        <span className="font-display text-2xl text-brass mr-2">Bloody Palace · {questions[0]?.question.checkpointLabel}</span>

        <div className="flex gap-2 flex-1 flex-wrap">
          {questions.map((item, index) => (
            <button
              key={index}
              onClick={() => setActiveIndex(index)}
              className={`font-heading text-xs tracking-wider px-3 py-1.5 border border-brass/60 transition-colors duration-150 ${
                activeIndex === index
                  ? 'bg-blood text-bone'
                  : 'bg-stone text-bone hover:bg-brass/20'
              }`}
            >
              Mission {item.group}{results[index]?.passed ? ' ✓' : ''}
            </button>
          ))}
        </div>

        <span className={`font-mono text-sm font-bold ml-auto ${timeLeft < 600 ? 'text-crimson' : 'text-brass'}`}>
          ⏱ {formatTime(timeLeft)}
        </span>
      </div>

      {activeQuestion && (
      <Workspace
        id="mock"
        description={
          <div className="overflow-y-auto h-full">
            <div className="p-4 border-b border-brass/40">
              <div className="flex items-center justify-between mb-3">
                <h1 className="font-mono font-bold text-xl text-bone">{activeQuestion.name}</h1>
                <span className="border border-brass/60 text-brass font-heading text-xs tracking-wider px-3 py-1">
                  Mission {questions[activeIndex].group}
                </span>
              </div>

              <div className="flex gap-4 flex-wrap">
                <div>
                  <p className="label mb-1">Difficulty</p>
                  <p className="text-bone">{activeQuestion.difficulty}</p>
                </div>
                <div>
                  <p className="label mb-1">Expected Files</p>
                  <div className="flex gap-2 flex-wrap">
                    {activeQuestion.expectedFiles.map((file) => (
                      <span
                        key={file}
                        className="bg-obsidian border border-brass/40 text-brass text-xs px-2 py-1 font-mono"
                      >
                        {file}
                      </span>
                    ))}
                  </div>
                </div>
                <AllowedFunctions functions={activeQuestion.allowedFunctions} lang={lang} />
              </div>
            </div>

            <div className="p-4">
              {loadingMarkdown ? (
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
            key={activeIndex}
            lang={lang}
            id={`mock/${activeQuestion.name}`}
            file={file}
            code={code}
            onCode={handleCodeChange}
            main={main}
            onMain={(v) => setMains((prev) => ({ ...prev, [activeIndex]: v }))}
          />
        }
        output={
          <>
            <div className="px-4 py-2 border-b border-brass/40 flex items-center gap-3">
              <p className="label">Output</p>
              <ResultBadge result={results[activeIndex]} />
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-4 font-mono text-sm text-bone">
              {outputs[activeIndex] ? (
                <pre className="whitespace-pre-wrap break-words">{outputs[activeIndex]}</pre>
              ) : (
                <p className="text-mute">Run your code to see output here</p>
              )}
            </div>
          </>
        }
      />
      )}
    </div>
  )
}

export default MockExam