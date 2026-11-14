import test from 'node:test'
import assert from 'node:assert/strict'
import { rankFor, RANKS, RANK_WORDS } from './rank.js'

test('rankFor maps failed Tests to a rank', () => {
  const got = [0, 1, 2, 3, 4, 5, 6, 7, 999].map(rankFor)
  assert.deepEqual(got, ['SSS', 'SS', 'S', 'A', 'B', 'C', 'D', 'D', 'D'])
})

test('every rank has a word', () => {
  for (const r of RANKS) assert.ok(RANK_WORDS[r])
})
