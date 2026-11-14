import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  bestRank, createSlot, deleteSlot, exportSlot, importSlot, passedCount, renameSlot, setActive, useSaves,
} from '../saves'

const languages = [
  {
    id: 'go',
    name: 'Go',
    tagline: 'Devil Hunter',
    description: 'Checkpoint questions for the Go programming language',
    color: 'text-steel',
  },
  {
    id: 'js',
    name: 'JavaScript',
    tagline: 'Son of Sparda',
    description: 'Checkpoint questions for the JavaScript programming language',
    color: 'text-brimstone',
  },
  {
    id: 'rust',
    name: 'Rust',
    tagline: 'Dante Must Die',
    description: 'Checkpoint questions for the Rust programming language',
    color: 'text-ember',
  },
]

function Main() {
  const navigate = useNavigate()
  const saves = useSaves()
  const fileInput = useRef(null)
  const [error, setError] = useState('')

  const btn = 'link-btn'

  function newGame() {
    const name = window.prompt('Name your save slot', `Slot ${saves.slots.length + 1}`)
    if (name !== null) createSlot(name.trim())
  }

  async function handleImport(e) {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    try {
      setError('')
      await importSlot(file)
    } catch (err) {
      setError(err.message)
    }
  }

  function handleLanguageSelect(lang) {
    if (!saves.activeId && saves.slots.length === 0) createSlot('Slot 1')
    navigate(`/questions?lang=${lang}`)
  }

  return (
    <div className="min-h-screen bg-obsidian text-bone flex flex-col">
      <nav className="bg-stone px-6 py-3 border-b border-brass/40">
        <h1 className="font-display text-3xl text-brass leading-none">Tester May Cry</h1>
      </nav>

      <main className="flex flex-col items-center justify-center flex-1 gap-10 px-4">
        <div className="text-center">
          <h2 className="font-display text-6xl text-bone mb-3">Practice Checkpoints</h2>
          <p className="text-mute text-lg italic">Select a language to get started</p>
        </div>

        <div className="w-full max-w-3xl">
          <div className="flex items-center justify-between mb-3">
            <p className="label">Save slots</p>
            <button
              onClick={() => fileInput.current.click()}
              disabled={saves.slots.length >= 3}
              className="link-btn disabled:opacity-40"
            >
              Import
            </button>
            <input ref={fileInput} type="file" accept=".json,application/json" onChange={handleImport} className="hidden" />
          </div>
          {error && <p className="text-crimson text-sm mb-3">{error}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => {
              const slot = saves.slots[i]
              if (!slot) {
                return (
                  <button
                    key={i}
                    onClick={newGame}
                    className="border border-dashed border-brass/60 hover:bg-brass/10 p-4 font-heading tracking-wider text-mute hover:text-bone transition-colors duration-150"
                  >
                    New game
                  </button>
                )
              }
              const active = slot.id === saves.activeId
              return (
                <div
                  key={slot.id}
                  className={`frame p-4 ${active ? 'outline outline-2 -outline-offset-4 outline-blood' : ''}`}
                >
                  <p className="label">Slot {i + 1}</p>
                  <p className="font-heading font-bold tracking-wider truncate">{slot.name}</p>
                  <p className="text-sm text-mute">{new Date(slot.updatedAt).toLocaleString()}</p>
                  <p className="text-brass mb-3">
                    Missions cleared {passedCount(slot)}
                    {bestRank(slot) && <span className="ml-2 font-display text-xl text-crimson" title="Best rank">{bestRank(slot)}</span>}
                  </p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    <button onClick={() => setActive(slot.id)} className={btn}>{active ? 'Active' : 'Continue'}</button>
                    <button
                      onClick={() => {
                        const name = window.prompt('Rename slot', slot.name)
                        if (name?.trim()) renameSlot(slot.id, name.trim())
                      }}
                      className={btn}
                    >
                      Rename
                    </button>
                    <button
                      onClick={() => window.confirm(`Delete "${slot.name}"? This cannot be undone.`) && deleteSlot(slot.id)}
                      className={btn}
                    >
                      Delete
                    </button>
                    <button onClick={() => exportSlot(slot.id)} className={btn}>Export</button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full max-w-3xl">
          {languages.map((lang) => (
            <button
              key={lang.id}
              onClick={() => handleLanguageSelect(lang.id)}
              className="frame p-6 text-left transition-shadow duration-200 cursor-pointer hover:shadow-[inset_0_0_24px_rgba(211,36,43,0.45)]"
            >
              <h3 className={`font-heading font-bold tracking-wider text-xl ${lang.color}`}>{lang.name}</h3>
              <p className={`italic mb-2 ${lang.color}`}>{lang.tagline}</p>
              <p className="text-mute">{lang.description}</p>
            </button>
          ))}
        </div>
      </main>
    </div>
  )
}

export default Main