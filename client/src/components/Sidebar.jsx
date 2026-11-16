import { useEffect, useRef, useState } from 'react'
import { activeSlot, useSaves } from '../saves'

const LANGUAGES = [
  { id: 'go', name: 'Go', tagline: 'Devil Hunter', color: 'text-steel' },
  { id: 'js', name: 'JavaScript', tagline: 'Son of Sparda', color: 'text-brimstone' },
  { id: 'rust', name: 'Rust', tagline: 'Dante Must Die', color: 'text-ember' },
]

// checkpoint -> mission (group) -> exercises, all in upstream order
function groupTree(questions) {
  const tree = new Map()
  for (const q of questions) {
    if (!tree.has(q.checkpoint)) tree.set(q.checkpoint, { label: q.checkpointLabel, missions: new Map() })
    const { missions } = tree.get(q.checkpoint)
    if (!missions.has(q.group)) missions.set(q.group, [])
    missions.get(q.group).push(q)
  }
  return tree
}

function Sidebar({
  lang,
  questions,
  setQuestions,
  loading,
  setLoading,
  selectedQuestion,
  onQuestionSelect,
  onLanguageChange,
  onMockExam,
}) {
  const [openGroups, setOpenGroups] = useState({})
  const [choosing, setChoosing] = useState(false)
  const firstRef = useRef(null)
  const passed = activeSlot(useSaves())?.data[lang] ?? {}

  useEffect(() => {
    if (!lang) return
    setLoading(true)
    fetch(`/api/questions?lang=${lang}`)
      .then((res) => res.json())
      .then((data) => {
        setQuestions(data)
        setLoading(false)
      })
      .catch((err) => {
        console.error(err)
        setLoading(false)
      })
  }, [lang, setLoading, setQuestions])

  useEffect(() => {
    if (choosing) firstRef.current?.focus()
  }, [choosing])

  async function handleMockExam(checkpoint) {
    setChoosing(false)
    try {
      const res = await fetch(`/api/questions/mock-exam?lang=${lang}&checkpoint=${encodeURIComponent(checkpoint)}`)
      if (!res.ok) throw new Error(`Request failed (${res.status})`)
      onMockExam(await res.json())
    } catch (err) {
      console.error(err)
    }
  }

  function toggleGroup(group) {
    setOpenGroups((prev) => ({ ...prev, [group]: !prev[group] }))
  }

  const tree = groupTree(questions)

  return (
    <aside className="h-full frame flex flex-col overflow-y-auto">
      <div className="p-4 border-b border-brass/40">
        <p className="label mb-3">Language</p>
        <div className="flex flex-col gap-1">
          {LANGUAGES.map((l) => (
            <button
              key={l.id}
              onClick={() => l.id !== lang && onLanguageChange(l.id)}
              className={`text-left px-3 py-2 font-heading font-bold tracking-wider text-sm border transition-colors duration-150 ${
                l.id === lang
                  ? 'bg-obsidian border-brass/60 ' + l.color
                  : 'border-transparent text-mute hover:bg-brass/20 hover:text-bone'
              }`}
            >
              {l.name}
              <span className="block font-body italic font-normal tracking-normal text-sm">{l.tagline}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 border-b border-brass/40">
        <button
          onClick={() => setChoosing(true)}
          disabled={!questions.length}
          className="btn btn-primary w-full py-2"
        >
          Bloody Palace
        </button>
      </div>

      <div className="p-4 flex flex-col gap-2 overflow-y-auto">
        {loading ? (
          <p className="text-mute">Loading questions...</p>
        ) : (
          [...tree].map(([cp, { label, missions }]) => (
            <div key={cp}>
              <button
                onClick={() => toggleGroup(cp)}
                className="w-full flex items-center justify-between px-3 py-2 label hover:bg-brass/20 transition-colors duration-150"
              >
                <span>{label}</span>
                <span>{openGroups[cp] ? '▲' : '▼'}</span>
              </button>

              {openGroups[cp] && (
                <div className="flex flex-col gap-1 mt-1 ml-2">
                  {[...missions].map(([group, qs]) => {
                    const key = `${cp}|${group}`
                    return (
                      <div key={key}>
                        <button
                          onClick={() => toggleGroup(key)}
                          className="w-full flex items-center justify-between px-3 py-2 label hover:bg-brass/20 transition-colors duration-150"
                        >
                          <span>Mission {group}</span>
                          <span>{openGroups[key] ? '▲' : '▼'}</span>
                        </button>

                        {openGroups[key] && (
                          <div className="flex flex-col gap-1 mt-1 ml-2">
                            {qs.map((q) => (
                              <button
                                key={q.path}
                                onClick={() => onQuestionSelect(q)}
                                className={`text-left px-3 py-2 text-sm font-mono transition-colors duration-150 ${
                                  selectedQuestion?.path === q.path
                                    ? 'bg-blood text-bone'
                                    : 'text-bone hover:bg-brass/20'
                                }`}
                              >
                                {q.name}{passed[q.name]?.passed && (
                                  <span className={`${selectedQuestion?.path === q.path ? 'text-bone' : 'text-crimson'} font-display text-base ml-2`} title={passed[q.name].rank ? `Rank ${passed[q.name].rank}` : 'Mission Clear'}>
                                    {passed[q.name].rank ?? '✓'}
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ))
        )}
      </div>
      {choosing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian/80"
          onKeyDown={(e) => e.key === 'Escape' && setChoosing(false)}
        >
          <div role="dialog" aria-modal="true" aria-labelledby="palace-title" className="frame p-6 w-80">
            <h2 id="palace-title" className="font-heading font-bold text-bone mb-3 text-center">Bloody Palace: choose a checkpoint</h2>
            <div className="flex flex-col gap-1">
              {[...tree].map(([cp, { label }], i) => (
                <button key={cp} ref={i === 0 ? firstRef : null} onClick={() => handleMockExam(cp)} className="btn btn-quiet">
                  {label}
                </button>
              ))}
              <button onClick={() => setChoosing(false)} className="btn btn-quiet mt-2">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}

export default Sidebar