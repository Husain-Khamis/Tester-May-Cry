// Best to worst; index = rank points
export const RANKS = ['D', 'C', 'B', 'A', 'S', 'SS', 'SSS']

export const RANK_WORDS = {
  SSS: 'Stylish!!!',
  SS: 'Showtime!!',
  S: 'Sweet!',
  A: 'Alright!',
  B: 'Blast!',
  C: 'Crazy!',
  D: 'Dope!',
}

// Rank for a first pass that came after `fails` failed Tests
export const rankFor = (fails) => RANKS[Math.max(0, RANKS.length - 1 - fails)]
