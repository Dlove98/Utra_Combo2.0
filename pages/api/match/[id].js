import { fetchTeamRecentMatches, fetchHeadToHead } from '../../../lib/dataSources';
import { scoreMatch, CRITERIA } from '../../../lib/scoringEngine';
import { computeMarketProbabilities } from '../../../lib/markets';

// id attendu au format "homeTeamId-awayTeamId-matchId" (voir components/MatchCard.js)
export default async function handler(req, res) {
  const { id } = req.query;
  const [homeTeamId, awayTeamId, matchId] = String(id).split('-');

  if (!homeTeamId || !awayTeamId) {
    return res.status(400).json({ error: 'Identifiants d\'équipe manquants pour ce match.' });
  }

  try {
    const [homeRecent, awayRecent, h2h] = await Promise.all([
      fetchTeamRecentMatches(homeTeamId, 10),
      fetchTeamRecentMatches(awayTeamId, 10),
      matchId ? fetchHeadToHead(matchId, 10) : Promise.resolve([]),
    ]);

    const home = homeRecent.map((m) => ({ ...m, referenceTeamId: homeTeamId }));
    const away = awayRecent.map((m) => ({ ...m, referenceTeamId: awayTeamId }));

    const score = scoreMatch({
      recent: { home, away, h2h },
    });

    const avgGoalsHomeFor = average(home.map((m) => goalsFor(m, homeTeamId)).filter((v) => v != null));
    const avgGoalsAwayFor = average(away.map((m) => goalsFor(m, awayTeamId)).filter((v) => v != null));
    const markets = computeMarketProbabilities({ avgGoalsHomeFor, avgGoalsAwayFor });

    res.status(200).json({
      score,
      markets,
      criteria: CRITERIA,
      recentForm: { home, away },
      headToHead: h2h,
    });
  } catch (err) {
    console.error('[api/match/:id]', err);
    res.status(200).json({ error: 'Détails indisponibles pour le moment.', score: null, markets: null });
  }
}

function goalsFor(m, teamId) {
  const ft = m.score?.fullTime;
  if (ft?.home == null) return null;
  const isHome = String(m.homeTeam?.id) === String(teamId);
  return isHome ? ft.home : ft.away;
}

function average(arr) {
  if (!arr.length) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}
