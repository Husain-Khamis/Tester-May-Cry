import { useState } from 'react'
import Editor from '@monaco-editor/react'

const LANGUAGE_MAP = {
  js: 'javascript',
  go: 'go',
  rust: 'rust'
}

function defineTheme(monaco) {
  monaco.editor.defineTheme('dmc', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'keyword', foreground: 'D3242B' },
      { token: 'string', foreground: 'B08D57' },
      { token: 'comment', foreground: '7A6F68', fontStyle: 'italic' },
    ],
    colors: {
      'editor.background': '#0C0809',
      'editor.foreground': '#E6D9BF',
      'editorCursor.foreground': '#D3242B',
      'editorLineNumber.foreground': '#7A6F68',
      'editor.selectionBackground': '#8E0F1466',
      'editor.lineHighlightBackground': '#1A1314',
    },
  })
}

// Solution editor; with `main` set, a second "main (usage)" tab holds the program Run executes alongside it.
function CodeTabs({ lang, id, file, code, onCode, main, onMain }) {
  const [tab, setTab] = useState('code')
  const showMain = main != null && tab === 'main'
  const tabClass = (active) =>
    `px-3 py-1 text-xs font-mono ${active ? 'bg-blood text-bone' : 'text-mute hover:text-bone'}`

  return (
    <div className="h-full flex flex-col">
      {main != null && (
        <div className="flex bg-obsidian border-b border-brass/40">
          <button onClick={() => setTab('code')} className={tabClass(tab === 'code')}>{file}</button>
          <button onClick={() => setTab('main')} className={tabClass(tab === 'main')}>main (usage)</button>
        </div>
      )}
      <div className="flex-1 min-h-0">
        <Editor
          height="100%"
          language={LANGUAGE_MAP[lang]}
          theme="dmc"
          beforeMount={defineTheme}
          path={`${id}/${showMain ? 'main' : file}`}
          value={showMain ? main : code}
          onChange={(value) => (showMain ? onMain : onCode)(value ?? '')}
          options={{
            fontSize: 14,
            automaticLayout: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            quickSuggestions: false,
            suggestOnTriggerCharacters: false,
            acceptSuggestionOnEnter: 'off',
            tabCompletion: 'off',
            wordBasedSuggestions: 'off',
            parameterHints: { enabled: false },
            hover: { enabled: false },
          }}
        />
      </div>
    </div>
  )
}

export default CodeTabs
