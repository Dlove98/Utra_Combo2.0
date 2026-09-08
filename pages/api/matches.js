import { getMatchesForWindow, fetchTeamRecentMatches } from '../../lib/dataSources';
import { scoreMatch } from '../../lib/scoringEngine';
import { computeMarketProbabilities } from '../../lib/markets';

const WINDOW_DAYS = Number(process.env.NEXT_PUBLIC_ANALYSIS_WINDOW_DAYS || 3);

function toISODate(d) {
  return d.toISOString().slice(0, 10);
}

// NOTE PRODUCTION : football-data.org (offre gratuite) limite les appels
// à ~10 requêtes/minute. Scorer chaque match nécessite 2 appels
// supplémentaires (forme domicile + forme extérieur). Pour un usage en
// production, mettez ce handler derrière un cache (Next.js ISR /
// revalidate, ou un cron Vercel qui pré-calcule les scores toutes les
// 30-60 min) plutôt que de recalculer à chaque visite.
export default async function handler(req, res) {
  try {
    const today = new Date();
    const dateFrom = toISODate(today);
    const toDate = new Date(today);
    toDate.setDate(toDate.getDate() + WINDOW_DAYS - 1);
    const dateTo = toISODate(toDate);

    const matches = await getMatchesForWindow(dateFrom, dateTo);

    // Limite de sécurité pour rester sous les quotas API en dev/preview.
    const MAX_SCORED_PER_REQUEST = 40;
    const toScore = matches.slice(0, MAX_SCORED_PER_REQUEST);
    const rest = matches.slice(MAX_SCORED_PER_REQUEST);

    const scored = [];
    for (const match of toScore) {
      scored.push(await scoreSingleMatch(match));
      // Petite pause pour respecter le rate-limit gratuit de football-data.org
      await sleep(150);
    }

    const unscored = rest.map((match) => ({ match, score: null, markets: null }));

    res.status(200).json({ dateFrom, dateTo, results: [...scored, ...unscored] });
  } catch (err) {
    console.error('[api/matches]', err);
    res.status(200).json({ dateFrom: null, dateTo: null, results: [], error: 'Erreur de récupération, réessayez.' });
  }
}

async function scoreSingleMatch(match) {
  if (!match.homeTeamId || !match.awayTeamId) {
    // Match issu d'openfootball sans identifiant football-data.org :
    // pas de forme/H2H disponible -> pas de score inventé.
    return { match, score: null, markets: null };
  }

  const [homeRecent, awayRecent] = await Promise.all([
    fetchTeamRecentMatches(match.homeTeamId, 8),
    fetchTeamRecentMatches(match.awayTeamId, 8),
  ]);

  const home = homeRecent.map((m) => ({ ...m, referenceTeamId: match.homeTeamId }));
  const away = awayRecent.map((m) => ({ ...m, referenceTeamId: match.awayTeamId }));

  const score = scoreMatch({
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    recent: { home, away, h2h: [] },
  });

  const avgGoalsHomeFor = average(
    home.filter((m) => m.score?.fullTime?.home != null).map((m) => goalsFor(m, match.homeTeamId))
  );
  const avgGoalsAwayFor = average(
    away.filter((m) => m.score?.fullTime?.home != null).map((m) => goalsFor(m, match.awayTeamId))
  );

  const markets = computeMarketProbabilities({ avgGoalsHomeFor, avgGoalsAwayFor });

  return { match, score, markets };
}

function goalsFor(m, teamId) {
  const isHome = m.homeTeam?.id === teamId;
  return isHome ? m.score.fullTime.home : m.score.fullTime.away;
}

function average(arr) {
  if (!arr.length) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
