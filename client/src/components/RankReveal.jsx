import { RANK_WORDS } from '../rank'

function RankReveal({ rank }) {
  return (
    <div className="rank-slam shrink-0 text-center px-4" data-testid="rank-reveal">
      <p aria-label={`Rank ${rank}`} className="font-display text-crimson text-[72px] leading-none -skew-x-6">{rank}</p>
      <p className="font-heading font-bold tracking-wider text-bone text-sm mt-1">{RANK_WORDS[rank]}</p>
    </div>
  )
}

export default RankReveal
