const TIER_COLOR = {
  Exceptionnel: 'bg-turf-400',
  'Très solide': 'bg-turf-500',
  Solide: 'bg-flood-400',
  Correct: 'bg-chalk-500',
  'À éviter': 'bg-danger',
  'Données insuffisantes': 'bg-pitch-700',
};

export default function MatchCard({ entry, onOpen }) {
  const { match, score, markets } = entry;
  const tier = score?.tier || 'Données insuffisantes';
  const tip = bestTip(markets);

  return (
    <button
      onClick={() => onOpen(entry)}
      className="w-full flex items-center gap-4 border-b border-pitch-800 px-4 py-3 text-left hover:bg-pitch-900 transition-colors"
    >
      <span className={`h-10 w-1 rounded-full ${TIER_COLOR[tier]}`} aria-hidden="true" />

      <span className="w-14 shrink-0 font-display text-sm text-chalk-500">{match.time || '--:--'}</span>

      <span className="flex-1 min-w-0">
        <span className="block text-xs text-chalk-500">{match.competitionLabel || match.competitionId}</span>
        <span className="block truncate font-medium text-chalk-100">
          {match.homeTeam} <span className="text-chalk-500">–</span> {match.awayTeam}
        </span>
      </span>

      {tip && (
        <span className="hidden sm:flex flex-col items-end shrink-0">
          <span className="text-xs text-chalk-500">{tip.label}</span>
          <span className="font-display text-lg text-flood-400">{tip.probability}%</span>
        </span>
      )}

      <span className="w-20 shrink-0 text-right">
        <span className="font-display text-xl text-chalk-100">{score?.confidence ?? '—'}</span>
        <span className="block text-[11px] text-chalk-500">{tier}</span>
      </span>
    </button>
  );
}

function bestTip(markets) {
  if (!markets) return null;
  const candidates = [
    markets.BTTS != null && { label: 'BTTS', probability: markets.BTTS },
    markets.WINNER && { label: '1X2', probability: markets.WINNER.probability },
    markets.OVER_25 != null && { label: '+2,5 buts', probability: markets.OVER_25 },
    markets.UNDER_35 != null && { label: '-3,5 buts', probability: markets.UNDER_35 },
  ].filter(Boolean);
  if (!candidates.length) return null;
  return candidates.sort((a, b) => b.probability - a.probability)[0];
}
