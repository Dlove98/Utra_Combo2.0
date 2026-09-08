import useSWR from 'swr';
import CriteriaTable from './CriteriaTable';

const fetcher = (url) => fetch(url).then((r) => r.json());

export default function MatchModal({ entry, onClose }) {
  const { match } = entry;
  const canFetchDetail = match.id && match.id.includes('-') && !match.id.includes('|');
  const { data, isLoading } = useSWR(canFetchDetail ? `/api/match/${match.id}` : null, fetcher);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 px-0 sm:px-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-pitch-900 border border-pitch-700 sm:rounded-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-pitch-900 border-b border-pitch-700 px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-chalk-500">{match.competitionLabel || match.competitionId}</p>
            <h2 className="font-display text-2xl">
              {match.homeTeam} <span className="text-chalk-500">–</span> {match.awayTeam}
            </h2>
          </div>
          <button onClick={onClose} className="text-chalk-500 hover:text-chalk-100 text-2xl leading-none px-2" aria-label="Fermer">
            ×
          </button>
        </div>

        <div className="p-5 space-y-6">
          {!canFetchDetail && (
            <p className="text-sm text-chalk-500">
              Ce match provient uniquement d'openfootball (calendrier), sans identifiant football-data.org :
              l'historique détaillé n'est pas disponible pour cette rencontre.
            </p>
          )}

          {isLoading && <p className="text-sm text-chalk-500">Chargement des statistiques réelles…</p>}

          {data?.error && <p className="text-sm text-danger">{data.error}</p>}

          {data?.score && (
            <section>
              <div className="flex items-baseline gap-3 mb-1">
                <span className="font-display text-4xl text-flood-400">{data.score.confidence ?? '—'}</span>
                <span className="text-chalk-300">{data.score.tier}</span>
              </div>
              <p className="text-xs text-chalk-500">
                Fiabilité du modèle sur ce match : {data.score.reliability}% ({data.score.computedCriteria}/
                {data.score.totalCriteria} critères basés sur des données réelles disponibles).
              </p>
            </section>
          )}

          {data?.markets && (
            <section>
              <h3 className="font-display text-lg mb-2">Marchés (4 autorisés)</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <MarketRow label="Les 2 équipes marquent" value={data.markets.BTTS} />
                <MarketRow
                  label="Victoire"
                  value={data.markets.WINNER?.probability}
                  extra={data.markets.WINNER?.outcome}
                />
                <MarketRow label="+ de 2,5 buts" value={data.markets.OVER_25} />
                <MarketRow label="- de 3,5 buts" value={data.markets.UNDER_35} />
              </div>
            </section>
          )}

          {data?.score && (
            <section>
              <h3 className="font-display text-lg mb-2">Les 12 critères</h3>
              <CriteriaTable criteria={data.criteria} perCriterion={data.score.perCriterion} notes={data.score.notes} />
            </section>
          )}

          {data?.headToHead?.length > 0 && (
            <section>
              <h3 className="font-display text-lg mb-2">Confrontations directes</h3>
              <ul className="text-sm space-y-1">
                {data.headToHead.slice(0, 5).map((m) => (
                  <li key={m.id} className="flex justify-between border-b border-pitch-800 py-1">
                    <span className="text-chalk-300">{m.utcDate?.slice(0, 10)}</span>
                    <span>
                      {m.homeTeam?.name} {m.score?.fullTime?.home}-{m.score?.fullTime?.away} {m.awayTeam?.name}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <p className="text-xs text-chalk-500 border-t border-pitch-800 pt-4">
            Analyse statistique fournie à titre informatif. Jouer comporte des risques : mineurs interdits,
            jouez avec modération.
          </p>
        </div>
      </div>
    </div>
  );
}

function MarketRow({ label, value, extra }) {
  return (
    <div className="flex items-center justify-between bg-pitch-800 rounded px-3 py-2">
      <span className="text-chalk-300">
        {label}
        {extra && <span className="block text-xs text-chalk-500">{extra}</span>}
      </span>
      <span className="font-display text-lg text-flood-400">{value != null ? `${value}%` : '—'}</span>
    </div>
  );
}
