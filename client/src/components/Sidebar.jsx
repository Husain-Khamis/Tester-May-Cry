import { useEffect, useState } from 'react'
import { activeSlot, useSaves } from '../saves'

const LANGUAGES = [
  { id: 'go', name: 'Go', tagline: 'Devil Hunter', color: 'text-steel' },
  { id: 'js', name: 'JavaScript', tagline: 'Son of Sparda', color: 'text-brimstone' },
  { id: 'rust', name: 'Rust', tagline: 'Dante Must Die', color: 'text-ember' },
]

function groupByLevel(questions) {
  const groups = {}
  for (const question of questions) {
    const key = question.group
    if (!groups[key]) groups[key] = []
    groups[key].push(question)
  }
  return groups
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

  async function handleMockExam() {
    try {
      const res = await fetch(`/api/questions/mock-exam?lang=${lang}`)
      const data = await res.json()
      onMockExam(data)
    } catch (err) {
      console.error(err)
    }
  }

  function toggleGroup(group) {
    setOpenGroups((prev) => ({ ...prev, [group]: !prev[group] }))
  }

  const grouped = groupByLevel(questions)

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
          onClick={handleMockExam}
          className="btn btn-primary w-full py-2"
        >
          Bloody Palace
        </button>
      </div>

      <div className="p-4 flex flex-col gap-2 overflow-y-auto">
        {loading ? (
          <p className="text-mute">Loading questions...</p>
        ) : (
          Object.entries(grouped).map(([group, qs]) => (
            <div key={group}>
              <button
                onClick={() => toggleGroup(group)}
                className="w-full flex items-center justify-between px-3 py-2 label hover:bg-brass/20 transition-colors duration-150"
              >
                <span>Mission {group}</span>
                <span>{openGroups[group] ? '▲' : '▼'}</span>
              </button>

              {openGroups[group] && (
                <div className="flex flex-col gap-1 mt-1 ml-2">
                  {qs.map((q) => (
                    <button
                      key={q.id}
                      onClick={() => onQuestionSelect(q)}
                      className={`text-left px-3 py-2 text-sm font-mono transition-colors duration-150 ${
                        selectedQuestion?.id === q.id
                          ? 'bg-blood text-bone'
                          : 'text-bone hover:bg-brass/20'
                      }`}
                    >
                      {q.name}{passed[q.name]?.passed && (
                        <span className={`${selectedQuestion?.id === q.id ? 'text-bone' : 'text-crimson'} font-display text-base ml-2`} title={passed[q.name].rank ? `Rank ${passed[q.name].rank}` : 'Mission Clear'}>
                          {passed[q.name].rank ?? '✓'}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </aside>
  )
}

export default Sidebar