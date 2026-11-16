const express = require('express')
const router = express.Router()

const REBOOT01_URL = 'https://learn.reboot01.com/api/object/bahrain'

const SUPPORTED_LANGUAGES = ['js', 'go', 'rust']
const MAX_CODE = 100 * 1024
const CACHE_TTL = 10 * 60 * 1000

const deps = {
    runInImage: (...a) => require('../runner').runInImage(...a),
    fetchUpstream: async () => (await fetch(REBOOT01_URL)).json(),
    fetchText: async (url) => { const r = await fetch(url); return r.ok ? r.text() : null }
}
let cache = null

function _setDeps(d) {
    Object.assign(deps, d)
    cache = null
}

async function getUpstream() {
    if (!cache || Date.now() - cache.time > CACHE_TTL) {
        cache = { data: await deps.fetchUpstream(), time: Date.now() }
    }
    return cache.data
}

// "/x/piscine-js/checkpoint-02-js" -> "Checkpoint 2"; a bare "checkpoint" is the Go module one
function checkpointLabel(path) {
    const seg = path.split('/').at(-1).replace(/-(js|go|rust)$/, '')
    if (seg === 'checkpoint') return 'Module checkpoint'
    const label = seg.replace(/-0*(\d+)/g, ' $1').replace(/-/g, ' ')
    return label[0].toUpperCase() + label.slice(1)
}

// Some upstream nodes (JS checkpoint 3) lack attrs.language; the grader image name gives it away
function exerciseLang(node) {
    return node.attrs.language || node.attrs.validations?.[0]?.testImage?.match(/-(js|go|rust)$/)?.[1]
}

function extractExercises(children, lang) {
    const exercises = []
    const seen = new Set()

    function walk(children) {
        for (const key in children) {
            const node = children[key]

            if (
                node.type === 'exercise' &&
                exerciseLang(node) === lang &&
                node.attrs.parentType === 'exam' &&
                !seen.has(node.path)
            ) {
                seen.add(node.path)
                const checkpoint = node.path.replace(/\/[^/]*$/, '')
                exercises.push({
                    id: node.id,
                    name: node.name,
                    difficulty: node.attrs.difficulty,
                    group: node.attrs.group,
                    level: node.attrs.level,
                    subject: node.attrs.subject,
                    expectedFiles: node.attrs.expectedFiles,
                    allowedFunctions: node.attrs.allowedFunctions || [],
                    testImage: node.attrs.validations?.[0]?.testImage,
                    path: node.path,
                    checkpoint,
                    checkpointLabel: checkpointLabel(checkpoint)
                })
            }

            if (node.children) {
                walk(node.children)
            }
        }
    }

    walk(children)
    // keep upstream checkpoint order, then order by group within each (sort is stable)
    const order = [...new Set(exercises.map(e => e.checkpoint))]
    exercises.sort((a, b) => order.indexOf(a.checkpoint) - order.indexOf(b.checkpoint) || a.group - b.group)
    return exercises
}

function getRandomByGroup(exercises) {
    const grouped = {}

    for (const exercise of exercises) {
        const g = exercise.group
        if (!grouped[g]) grouped[g] = []
        grouped[g].push(exercise)
    }

    return Object.entries(grouped).map(([group, questions]) => ({
        group: Number(group),
        question: questions[Math.floor(Math.random() * questions.length)]
    })).sort((a, b) => a.group - b.group)
}

router.get('/', async (req, res) => {
    const lang = req.query.lang

    if (!lang || !SUPPORTED_LANGUAGES.includes(lang)) {
        return res.status(400).json({ error: `lang query param must be one of: ${SUPPORTED_LANGUAGES.join(', ')}` })
    }

    try {
        const data = await getUpstream()
        const exercises = extractExercises(data.children, lang)
        res.json(exercises)
    } catch (error) {
        console.error('Failed to fetch questions:', error)
        res.status(500).json({ error: 'Failed to fetch questions' })
    }
})

router.get('/mock-exam', async (req, res) => {
    const lang = req.query.lang

    if (!lang || !SUPPORTED_LANGUAGES.includes(lang)) {
        return res.status(400).json({ error: `lang query param must be one of: ${SUPPORTED_LANGUAGES.join(', ')}` })
    }

    try {
        const data = await getUpstream()
        const exercises = extractExercises(data.children, lang)
        const checkpoint = req.query.checkpoint
        if (typeof checkpoint !== 'string' || !exercises.some(e => e.checkpoint === checkpoint)) {
            return res.status(400).json({ error: 'checkpoint query param must be one of this language\'s checkpoints' })
        }
        const mockExam = getRandomByGroup(exercises.filter(e => e.checkpoint === checkpoint))
        res.json(mockExam)
    } catch (error) {
        console.error('Failed to fetch mock exam:', error)
        res.status(500).json({ error: 'Failed to fetch mock exam' })
    }
})

router.get('/subject', async (req, res) => {
    let path = req.query.path

    if (!path) return res.status(400).json({ error: 'path query param is required' })

    if (path.startsWith('/markdown/root/public/subjects/')) {
        const name = path.split('/').at(-2)
        path = `/api/content/root/01-edu_module/content/${name}/README.md`
    }

    let url
    try {
        url = new URL(path, 'https://learn.reboot01.com')
    } catch {
        return res.status(400).json({ error: 'Invalid subject path' })
    }
    if (url.origin !== 'https://learn.reboot01.com' || !url.pathname.startsWith('/api/content/root/') || !path.startsWith('/')) {
        return res.status(400).json({ error: 'Invalid subject path' })
    }

    try {
        console.log('Fetching subject:', url.href)
        const text = await deps.fetchText(url.href)

        if (text == null || text.includes('<!DOCTYPE html>')) {
            return res.status(404).json({ error: 'Subject not found' })
        }

        res.type('text/plain').send(text)
    } catch (error) {
        console.error('Failed to fetch subject:', error)
        res.status(500).json({ error: 'Failed to fetch subject' })
    }
})

function grade(runOnly) {
    return async (req, res) => {
        const { lang, path, code, main } = req.body || {}

        if (!SUPPORTED_LANGUAGES.includes(lang)) {
            return res.status(400).json({ error: `lang must be one of: ${SUPPORTED_LANGUAGES.join(', ')}` })
        }
        if (runOnly && lang === 'js') return res.status(400).json({ error: 'js runs in the browser' })
        if (typeof path !== 'string' || path.length > 300) return res.status(400).json({ error: 'path must be a string up to 300 chars' })
        if (typeof code !== 'string' || Buffer.byteLength(code) > MAX_CODE) {
            return res.status(400).json({ error: 'code must be a string up to 100KB' })
        }

        if (runOnly && main != null && (typeof main !== 'string' || Buffer.byteLength(main) > MAX_CODE)) {
            return res.status(400).json({ error: 'main must be a string up to 100KB' })
        }

        // Client gave up (Stop / closed tab): kill the container instead of running to the timeout
        const ac = new AbortController()
        res.on('close', () => { if (!res.writableFinished) ac.abort() })

        try {
            const data = await getUpstream()
            const ex = extractExercises(data.children, lang).find(e => e.path === path)
            if (!ex) return res.status(404).json({ error: 'Exercise not found' })
            if (!ex.testImage || !ex.expectedFiles?.[0]) return res.status(404).json({ error: 'Exercise has no grader' })

            // Run-only: also write the subject's usage program next to the solution (path derived server-side)
            const file = ex.expectedFiles[0]
            let mainPath
            if (runOnly && main) {
                if (lang === 'go' && !file.includes('/')) mainPath = `${ex.name}/main.go`
                else if (lang === 'rust' && file.endsWith('src/lib.rs')) mainPath = file.replace(/lib\.rs$/, 'main.rs')
            }

            res.json(await deps.runInImage({
                image: ex.testImage,
                exercise: ex.name,
                file,
                allowedFunctions: ex.allowedFunctions,
                code,
                extraFile: mainPath && { path: mainPath, code: main },
                runOnly,
                signal: ac.signal
            }))
        } catch (error) {
            if (error.busy) return res.status(429).json({ error: error.message })
            console.error('Grader failed:', error)
            res.status(/unavailable/.test(error.message) ? 503 : 500).json({ error: /unavailable/.test(error.message) ? error.message : 'Grader failed' })
        }
    }
}

router.post('/test', grade(false))
router.post('/run', grade(true))

module.exports = router
module.exports._setDeps = _setDeps
module.exports.checkpointLabel = checkpointLabel
// Never leak stack traces or parser internals to clients
module.exports.errorHandler = (err, req, res, next) => {
    res.status(err.status || 500).json({ error: err.status === 413 ? 'Request too large' : err.status ? 'Bad request' : 'Server error' })
}