import { useMemo } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { buildDailyCombos, MAX_CANDIDATE_POOL } from '../lib/comboBuilder';

const fetcher = (url) => fetch(url).then((r) => r.json());

export default function Combines() {
  const { data, isLoading } = useSWR('/api/matches', fetcher, { refreshInterval: 5 * 60 * 1000 });

  const { pool, tickets } = useMemo(() => buildDailyCombos(data?.results || []), [data]);

  return (
    <div className="min-h-screen">
      <header className="border-b border-pitch-800 px-4 sm:px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-turf-400">Ultra Combo</p>
          <h1 className="font-display text-2xl sm:text-3xl">Combinés du jour</h1>
        </div>
        <Link href="/" className="text-sm text-chalk-500 hover:text-chalk-100">
          Retour au programme
        </Link>
      </header>

      <main className="px-4 sm:px-6 py-6 space-y-8">
        <p className="text-sm text-chalk-500 max-w-2xl">
          Pool des {MAX_CANDIDATE_POOL} matchs au score de confiance le plus élevé sur la fenêtre d'analyse,
          toutes compétitions confondues. Ces tickets sont générés automatiquement à partir de ce pool ; la
          cote totale affichée est une cote "juste" calculée depuis les probabilités du modèle, pas une cote
          de bookmaker.
        </p>

        {isLoading && <p className="text-sm text-chalk-500">Analyse des matchs en cours…</p>}

        <div className="grid gap-6 md:grid-cols-3">
          {tickets.map((ticket) => (
            <TicketCard key={ticket.profile.key} ticket={ticket} />
          ))}
        </div>

        {pool.length > 0 && (
          <section>
            <h2 className="font-display text-xl mb-2">Pool complet ({pool.length} matchs)</h2>
            <div className="border border-pitch-800 rounded overflow-hidden">
              {pool.map((entry, i) => (
                <div key={entry.match.id} className="flex items-center gap-3 px-4 py-2 border-b border-pitch-800 last:border-b-0">
                  <span className="font-display text-chalk-500 w-6 text-right">{i + 1}</span>
                  <span className="flex-1 truncate text-sm">
                    {entry.match.homeTeam} – {entry.match.awayTeam}
                  </span>
                  <span className="text-xs text-chalk-500">{entry.match.date}</span>
                  <span className="font-display text-flood-400 w-10 text-right">{entry.score.confidence}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        <p className="text-xs text-chalk-500 border-t border-pitch-800 pt-4">
          Ces informations sont fournies à titre statistique et informatif, elles ne garantissent aucun résultat.
          Jeu interdit aux mineurs. Jouer comporte des risques : endettement, dépendance — appelez le 09 74 75 13 13
          (appel non surtaxé, service d'aide gratuit) en cas de besoin.
        </p>
      </main>
    </div>
  );
}

function TicketCard({ ticket }) {
  return (
    <div className="border border-pitch-800 rounded p-4 flex flex-col">
      <h3 className="font-display text-lg">{ticket.profile.label}</h3>
      <p className="text-xs text-chalk-500 mb-3">{ticket.profile.legs} sélections</p>

      <ul className="space-y-2 flex-1">
        {ticket.selections.map((s) => (
          <li key={s.matchId} className="text-sm border-b border-pitch-800 pb-2">
            <p className="truncate">{s.homeTeam} – {s.awayTeam}</p>
            <p className="flex justify-between text-chalk-500">
              <span>{s.label}</span>
              <span className="text-flood-400">{s.probability}%</span>
            </p>
          </li>
        ))}
      </ul>

      <div className="mt-3 pt-3 border-t border-pitch-700 flex justify-between items-baseline">
        <span className="text-xs text-chalk-500">Cote totale estimée</span>
        <span className="font-display text-2xl text-turf-400">{ticket.estimatedTotalOdds}</span>
      </div>
      <p className="text-xs text-chalk-500 mt-1">Probabilité combinée : {ticket.combinedProbability}%</p>
    </div>
  );
}
