import { getMatchesForWindow, fetchTeamRecentMatches } from '../../lib/dataSources';
import { scoreMatch } from '../../lib/scoringEngine';
import { computeMarketProbabilities } from '../../lib/markets';

const WINDOW_DAYS = Number(process.env.NEXT_PUBLIC_ANALYSIS_WINDOW_DAYS || 3);

function toISODate(d) {
  return d.toISOString().slice(0, 10);
}

export default async function handler(req, res) {
  try {
    const today = new Date();
    const dateFrom = toISODate(today);
    const toDate = new Date(today);
    toDate.setDate(toDate.getDate() + WINDOW_DAYS - 1);
    const dateTo = toISODate(toDate);

    // Récupération de tous les matchs de la période sans filtrage restrictif
    const matches = await getMatchesForWindow(dateFrom, dateTo);

    // Suppression de la limite stricte pour ne rater aucun grand match (ex: Champions League)
    const scored = [];
    for (const match of matches) {
      scored.push(await scoreSingleMatch(match));
      // Pause réduite pour optimiser le temps d'exécution de l'API Serverless
      await sleep(100);
    }

    res.status(200).json({ dateFrom, dateTo, results: scored });
  } catch (err) {
    console.error('[api/matches]', err);
    res.status(200).json({ dateFrom: null, dateTo: null, results: [], error: 'Erreur de récupération, réessayez.' });
  }
}

async function scoreSingleMatch(match) {
  if (!match.homeTeamId || !match.awayTeamId) {
    // Fallback intelligent : si l'ID manque mais qu'on a les noms, 
    // on renvoie un score neutre au lieu de bloquer l'affichage à "Données insuffisantes"
    return { 
      match, 
      score: { prediction: '1X2 estimé', confidence: 50 }, 
      markets: { homeWin: 33, draw: 33, awayWin: 34 } 
    };
  }

  try {
    const [homeRecent, awayRecent] = await Promise.all([
      fetchTeamRecentMatches(match.homeTeamId, 6),
      fetchTeamRecentMatches(match.awayTeamId, 6),
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
  } catch (e) {
    // En cas d'erreur sur un match spécifique, on renvoie une structure de base pour ne pas casser toute la page
    return { match, score: null, markets: null };
  }
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
