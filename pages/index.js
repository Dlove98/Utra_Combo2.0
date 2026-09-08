import { useMemo, useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import DateNav from '../components/DateNav';
import MatchCard from '../components/MatchCard';
import MatchModal from '../components/MatchModal';

const fetcher = (url) => fetch(url).then((r) => r.json());
const WINDOW_DAYS = Number(process.env.NEXT_PUBLIC_ANALYSIS_WINDOW_DAYS || 3);

export default function Home() {
  const { data, isLoading, error } = useSWR('/api/matches', fetcher, { refreshInterval: 5 * 60 * 1000 });
  const [openEntry, setOpenEntry] = useState(null);

  const dates = useMemo(() => buildDateRange(WINDOW_DAYS), []);
  const [activeDate, setActiveDate] = useState(dates[0]);

  const dayEntries = useMemo(
    () => (data?.results || []).filter((e) => e.match.date === activeDate),
    [data, activeDate]
  );

  const byCompetition = useMemo(() => groupBy(dayEntries, (e) => e.match.competitionLabel || e.match.competitionId || 'Autres'), [dayEntries]);

  return (
    <div className="min-h-screen">
      <header className="border-b border-pitch-800 px-4 sm:px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-turf-400">Ultra Combo</p>
          <h1 className="font-display text-2xl sm:text-3xl">Programme &amp; pronostics</h1>
        </div>
        <Link href="/combines" className="font-display text-sm border border-turf-500 text-turf-400 px-4 py-2 rounded hover:bg-turf-500 hover:text-pitch-950 transition-colors">
          Combinés du jour
        </Link>
      </header>

      <div className="px-4 sm:px-6 pt-3">
        <DateNav dates={dates} activeDate={activeDate} onSelect={setActiveDate} />
      </div>

      <main className="px-0 sm:px-6 py-4">
        {isLoading && <p className="px-4 text-chalk-500 text-sm">Récupération des données réelles…</p>}
        {error && <p className="px-4 text-danger text-sm">Impossible de charger le programme pour le moment.</p>}
        {!isLoading && dayEntries.length === 0 && (
          <p className="px-4 text-chalk-500 text-sm">Aucun match trouvé pour cette date sur les compétitions configurées.</p>
        )}

        {Object.entries(byCompetition).map(([competition, entries]) => (
          <section key={competition} className="mb-6">
            <h2 className="px-4 sm:px-0 py-2 font-display text-sm tracking-wide text-chalk-500 border-b border-pitch-800">
              {competition}
            </h2>
            <div>
              {entries.map((entry) => (
                <MatchCard key={entry.match.id} entry={entry} onOpen={setOpenEntry} />
              ))}
            </div>
          </section>
        ))}
      </main>

      <footer className="px-4 sm:px-6 py-6 text-xs text-chalk-500 border-t border-pitch-800">
        Données : openfootball (GitHub) et football-data.org. Analyse statistique informative, ne constitue pas un
        conseil financier. Jeu interdit aux mineurs — jouez avec modération.
      </footer>

      {openEntry && <MatchModal entry={openEntry} onClose={() => setOpenEntry(null)} />}
    </div>
  );
}

function buildDateRange(days) {
  const out = [];
  const today = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function groupBy(arr, keyFn) {
  return arr.reduce((acc, item) => {
    const k = keyFn(item);
    acc[k] = acc[k] || [];
    acc[k].push(item);
    return acc;
  }, {});
}
