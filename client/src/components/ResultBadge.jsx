function ResultBadge({ result }) {
  if (!result) return null
  const [label, color] = result.timedOut
    ? ['Time Up', 'text-brimstone']
    : result.passed
      ? ['Mission Clear', 'text-brass']
      : ['Mission Failed', 'text-crimson']
  return <span className={`${color} font-display text-2xl leading-none`}>{label}</span>
}

export default ResultBadge
