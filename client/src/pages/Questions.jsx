import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { activeSlot, useSaveError, useSaves } from '../saves'
import { Group, Panel, useDefaultLayout } from 'react-resizable-panels'
import Sidebar from '../components/Sidebar'
import QuestionView from '../components/QuestionView'
import MockExam from '../components/MockExam'
import ResizeHandle from '../components/ResizeHandle'

function Questions() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [questions, setQuestions] = useState([])
  const [selectedQuestion, setSelectedQuestion] = useState(null)
  const [isMockExam, setIsMockExam] = useState(false)
  const [mockExamQuestions, setMockExamQuestions] = useState([])
  const [loading, setLoading] = useState(false)

  const layout = useDefaultLayout({ id: 'layout-main', storage: localStorage })

  const slot = activeSlot(useSaves())
  const saveError = useSaveError()

  const lang = searchParams.get('lang')

  function handleLanguageChange(newLang) {
    setSearchParams({ lang: newLang })
    setSelectedQuestion(null)
    setIsMockExam(false)
    setQuestions([])
    setMockExamQuestions([])
  }

  function handleQuestionSelect(question) {
    setIsMockExam(false)
    setSelectedQuestion(question)
  }

  function handleMockExam(questions) {
    setIsMockExam(true)
    setSelectedQuestion(null)
    setMockExamQuestions(questions)
  }

  return (
    <div className="h-screen bg-obsidian text-bone flex flex-col">
      <nav className="bg-stone px-6 py-3 border-b border-brass/40 flex items-center gap-4">
        <Link to="/" title="Switch save slot" className="font-display text-3xl text-brass leading-none">Tester May Cry</Link>
        <span className="label">{lang}</span>
        {slot && (
          <span className="ml-auto text-sm text-mute">
            {slot.name}{' '}
            {saveError ? (
              <span className="text-crimson">· {saveError}</span>
            ) : (
              <span className="text-mute">· Saved {new Date(slot.updatedAt).toLocaleTimeString()}</span>
            )}
          </span>
        )}
      </nav>

      <Group orientation="horizontal" className="flex-1 overflow-hidden" {...layout}>
        <Panel id="sidebar" defaultSize="18%" minSize="12%" maxSize="40%">
          <Sidebar
            lang={lang}
            questions={questions}
            setQuestions={setQuestions}
            loading={loading}
            setLoading={setLoading}
            selectedQuestion={selectedQuestion}
            onQuestionSelect={handleQuestionSelect}
            onLanguageChange={handleLanguageChange}
            onMockExam={handleMockExam}
          />
        </Panel>
        <ResizeHandle aria-label="Resize sidebar" />
        <Panel id="content" minSize="30%" className="flex flex-col">
          {isMockExam ? (
            <MockExam key={mockExamQuestions.map((m) => m.question.path).join()} questions={mockExamQuestions} lang={lang} />
          ) : selectedQuestion ? (
            <QuestionView key={selectedQuestion.path} question={selectedQuestion} lang={lang} />
          ) : (
            <main className="flex-1 flex items-center justify-center text-mute">
              <p>Pick a mission from the sidebar</p>
            </main>
          )}
        </Panel>
      </Group>
    </div>
  )
}

export default Questions