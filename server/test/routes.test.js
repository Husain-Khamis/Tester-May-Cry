const { test, before, after } = require('node:test')
const assert = require('node:assert')
const express = require('express')
const router = require('../routes/questions')

const ex = (id, name, cp, image, extra = {}) => ({ type: 'exercise', id, name, path: `/x/${cp}/${name}`, attrs: {
    language: 'go', parentType: 'exam', group: 1, expectedFiles: ['gcd.go'], allowedFunctions: ['--allow-builtin'],
    validations: [{ testImage: image }], ...extra } })
const tree = { children: {
    a: ex(1, 'gcd', 'checkpoint-01', 'ghcr.io/01-edu/test-go'),
    b: ex(2, 'gcd', 'checkpoint-02', 'ghcr.io/01-edu/module-go'),
    c: ex(3, 'other', 'checkpoint-02', 'ghcr.io/01-edu/module-go', { group: 1 }),
    e: ex(1, 'dup', 'final', 'ghcr.io/01-edu/dup-go', { group: 2 }), // same id as 'a', different checkpoint
    d: ex(4, 'js-deep', 'checkpoint-03-js', 'ghcr.io/01-edu/module-js', { language: undefined, group: 5 })
} }

let server, base, calls, busy, fetched
before(async () => {
    router._setDeps({
        fetchUpstream: async () => tree,
        fetchText: async (url) => { fetched = url; return '# gcd' },
        runInImage: async (opts) => {
            calls.push(opts)
            if (busy) throw Object.assign(new Error('busy'), { busy: true })
            return { passed: true, output: 'ok', timedOut: false }
        }
    })
    const app = express()
    app.use(express.json({ limit: '200kb' }))
    app.use('/api/questions', router)
    app.use(router.errorHandler)
    await new Promise(r => { server = app.listen(0, r) })
    base = `http://localhost:${server.address().port}/api/questions`
    calls = []
    busy = false
})
after(() => server.close())

const post = (p, body) => fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
const ok = { lang: 'go', path: '/x/checkpoint-01/gcd', code: 'package piscine' }

test('rejects bad or missing lang', async () => {
    assert.strictEqual((await post('/test', { ...ok, lang: 'php' })).status, 400)
    assert.strictEqual((await post('/test', { name: 'gcd', code: 'x' })).status, 400)
})

test('unknown path gives 404; bad path types and missing path give 400', async () => {
    assert.strictEqual((await post('/test', { ...ok, path: '/x/nope' })).status, 404)
    assert.strictEqual((await post('/test', { ...ok, path: '/x/checkpoint-03-js/js-deep' })).status, 404) // other language's exercise
    for (const path of [1, ['/x/checkpoint-01/gcd'], { a: 1 }, null, true, 'a'.repeat(301)]) {
        assert.strictEqual((await post('/test', { ...ok, path })).status, 400, JSON.stringify(path))
    }
    assert.strictEqual((await post('/test', { lang: 'go', name: 'gcd', code: 'x' })).status, 400)
    assert.strictEqual((await post('/test', { ...ok, path: '/x/checkpoint-02/gcd' })).status, 200)
})

test('checkpointLabel humanizes the last path segment', () => {
    const l = router.checkpointLabel
    assert.strictEqual(l('/a/checkpoint-01'), 'Checkpoint 1')
    assert.strictEqual(l('/a/piscine-js/checkpoint-03-js'), 'Checkpoint 3')
    assert.strictEqual(l('/a/checkpoint-final-js'), 'Checkpoint final')
    assert.strictEqual(l('/a/final-checkpoint-rust'), 'Final checkpoint')
    assert.strictEqual(l('/a/retest'), 'Retest')
    assert.strictEqual(l('/bahrain/bh-module/checkpoint'), 'Module checkpoint')
})

test('same name/id in two checkpoints is kept; each path grades with its own image', async () => {
    const list = await (await fetch(`${base}?lang=go`)).json()
    assert.deepStrictEqual(list.map(e => [e.path, e.checkpointLabel]), [['/x/checkpoint-01/gcd', 'Checkpoint 1'], ['/x/checkpoint-02/gcd', 'Checkpoint 2'], ['/x/checkpoint-02/other', 'Checkpoint 2'], ['/x/final/dup', 'Final']])
    calls = []
    await post('/test', { ...ok, path: '/x/checkpoint-01/gcd' })
    await post('/test', { ...ok, path: '/x/checkpoint-02/gcd' })
    await post('/test', { ...ok, path: '/x/final/dup' })
    await post('/test', { ...ok, path: '/x/checkpoint-02/other' })
    assert.deepStrictEqual(calls.map(c => c.image), ['ghcr.io/01-edu/test-go', 'ghcr.io/01-edu/module-go', 'ghcr.io/01-edu/dup-go', 'ghcr.io/01-edu/module-go'])
})

test('exercise without attrs.language is inferred from its image', async () => {
    const list = await (await fetch(`${base}?lang=js`)).json()
    assert.deepStrictEqual(list.map(e => e.name), ['js-deep'])
})

test('/mock-exam needs a valid checkpoint and returns one exercise per group', async () => {
    const m = (q) => fetch(`${base}/mock-exam?lang=go${q}`)
    assert.strictEqual((await m('')).status, 400)
    assert.strictEqual((await m('&checkpoint=/x/nope')).status, 400)
    assert.strictEqual((await m('&checkpoint=/x/checkpoint-01&checkpoint=/x/checkpoint-02')).status, 400)
    const body = await (await m('&checkpoint=/x/checkpoint-02')).json()
    assert.strictEqual(body.length, 1)
    assert.strictEqual(body[0].question.checkpoint, '/x/checkpoint-02')
})

test('code must be a string up to 100KB', async () => {
    assert.strictEqual((await post('/test', { ...ok, code: 5 })).status, 400)
    assert.strictEqual((await post('/test', { ...ok, code: 'a'.repeat(100 * 1024 + 1) })).status, 400)
})

test('client-supplied image/file are ignored', async () => {
    calls = []
    const res = await post('/test', { ...ok, image: 'evil/img', file: '../../etc/passwd', allowedFunctions: ['x'] })
    assert.strictEqual(res.status, 200)
    assert.deepStrictEqual(await res.json(), { passed: true, output: 'ok', timedOut: false })
    assert.strictEqual(calls[0].image, 'ghcr.io/01-edu/test-go')
    assert.strictEqual(calls[0].file, 'gcd.go')
    assert.deepStrictEqual(calls[0].allowedFunctions, ['--allow-builtin'])
    assert.strictEqual(calls[0].runOnly, false)
})

test('/run rejects js, passes runOnly for others', async () => {
    assert.strictEqual((await post('/run', { ...ok, lang: 'js' })).status, 400)
    calls = []
    assert.strictEqual((await post('/run', ok)).status, 200)
    assert.strictEqual(calls[0].runOnly, true)
})

test('main: /test ignores it, /run derives the path, bad main gives 400', async () => {
    calls = []
    await post('/test', { ...ok, main: 'package main' })
    assert.strictEqual(calls[0].extraFile, undefined)
    await post('/run', { ...ok, main: 'package main' })
    assert.deepStrictEqual(calls[1].extraFile, { path: 'gcd/main.go', code: 'package main' })
    await post('/run', { ...ok, main: 'package main', file: '../x' })
    assert.strictEqual(calls[2].extraFile.path, 'gcd/main.go')
    assert.strictEqual((await post('/run', { ...ok, main: 5 })).status, 400)
    assert.strictEqual((await post('/run', { ...ok, main: 'a'.repeat(100 * 1024 + 1) })).status, 400)
})

test('/run accepts main: null as absent', async () => {
    calls = []
    assert.strictEqual((await post('/run', { ...ok, main: null })).status, 200)
    assert.strictEqual(calls[0].extraFile, undefined)
})

test('/run ignores main for program exercises', async () => {
    const orig = tree.children.a.attrs.expectedFiles
    tree.children.a.attrs.expectedFiles = ['gcd/main.go']
    calls = []
    await post('/run', { ...ok, main: 'package main' })
    tree.children.a.attrs.expectedFiles = orig
    assert.strictEqual(calls[0].extraFile, undefined)
})

test('busy runner gives 429', async () => {
    busy = true
    assert.strictEqual((await post('/test', ok)).status, 429)
    busy = false
})

test('/subject rejects off-host and non-content paths', async () => {
    for (const p of ['.evil.example/x', '/api/internal/x', '@127.0.0.1:9999/']) {
        assert.strictEqual((await fetch(`${base}/subject?path=${encodeURIComponent(p)}`)).status, 400, p)
    }
})

test('/subject returns 404 when upstream is not ok', async () => {
    router._setDeps({ fetchText: async () => null })
    assert.strictEqual((await fetch(`${base}/subject?path=/markdown/root/public/subjects/gcd/README.md`)).status, 404)
    router._setDeps({ fetchText: async (url) => { fetched = url; return '# gcd' } })
})

test('/subject maps a subject path and serves text/plain', async () => {
    const res = await fetch(`${base}/subject?path=/markdown/root/public/subjects/gcd/README.md`)
    assert.strictEqual(res.status, 200)
    assert.match(res.headers.get('content-type'), /^text\/plain/)
    assert.strictEqual(fetched, 'https://learn.reboot01.com/api/content/root/01-edu_module/content/gcd/README.md')
})

test('malformed JSON gives 400 without stack details', async () => {
    const res = await fetch(base + '/test', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{bad' })
    const text = await res.text()
    assert.strictEqual(res.status, 400)
    assert.ok(!text.includes('node_modules') && !text.includes('at '))
})

test('closing the request aborts the runner signal', async () => {
    let signal
    const aborted = new Promise((resolve) => {
        router._setDeps({ runInImage: (opts) => new Promise((done) => {
            signal = opts.signal
            signal.addEventListener('abort', () => { resolve(); done({ stopped: true }) })
            fetchAbort.abort()
        }) })
    })
    const fetchAbort = new AbortController()
    await fetch(base + '/test', { method: 'POST', signal: fetchAbort.signal, headers: { 'content-type': 'application/json' }, body: JSON.stringify(ok) }).catch(() => {})
    await aborted
    assert.ok(signal.aborted)
})
