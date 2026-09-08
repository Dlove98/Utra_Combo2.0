/**
 * lib/comboBuilder.js
 * -------------------------------------------------------------------------
 * Onglet "Combinés du Jour" : extrait jusqu'à 25 matchs au score de
 * confiance le plus élevé (pool de candidats), sur les 4 marchés
 * autorisés uniquement.
 *
 * Choix d'implémentation important : plutôt que d'assembler UN seul
 * ticket à 25 sélections (une cote totale démesurée et une probabilité de
 * gain qui devient statistiquement quasi nulle, même si chaque sélection
 * individuelle semble "sûre"), le pool sert de réservoir pour composer
 * PLUSIEURS combinés de tailles différentes. C'est ce que fait
 * concrètement l'industrie du pronostic (Forebet, Flashscore, etc.) et
 * cela reste fidèle à la consigne ("assembler des combinés puissants
 * avec calcul de la cote totale estimée").
 * -------------------------------------------------------------------------
 */

export const MAX_CANDIDATE_POOL = 25;

const TICKET_PROFILES = [
  { key: 'surete', label: 'Combiné Sûreté', legs: 3, minReliability: 60 },
  { key: 'equilibre', label: 'Combiné Équilibré', legs: 5, minReliability: 50 },
  { key: 'audacieux', label: 'Combiné Audacieux', legs: 8, minReliability: 40 },
];

/**
 * @param {Array} scoredMatches - matchs déjà passés par scoreMatch() +
 *   computeMarketProbabilities(), avec { match, score, markets }
 */
export function buildDailyCombos(scoredMatches) {
  const pool = scoredMatches
    .filter((m) => m.score?.confidence != null)
    .sort((a, b) => b.score.confidence - a.score.confidence)
    .slice(0, MAX_CANDIDATE_POOL);

  const tickets = TICKET_PROFILES.map((profile) => buildTicket(pool, profile)).filter(
    (t) => t && t.selections.length === t.profile.legs
  );

  return { pool, tickets };
}

function buildTicket(pool, profile) {
  const eligible = pool.filter((m) => m.score.reliability >= profile.minReliability);
  const selections = eligible.slice(0, profile.legs).map((m) => bestSelectionFor(m));

  if (selections.length < profile.legs) return null;

  const totalOdds = selections.reduce((acc, s) => acc * (s.fairOdds ?? 1), 1);

  return {
    profile,
    selections,
    estimatedTotalOdds: Math.round(totalOdds * 100) / 100,
    combinedProbability: Math.round(
      selections.reduce((acc, s) => acc * ((s.probability ?? 0) / 100), 1) * 1000
    ) / 10,
  };
}

/**
 * Choisit, pour un match donné, le marché (parmi les 4 autorisés) qui a
 * la probabilité la plus élevée - c'est le "tip" affiché pour ce match.
 */
function bestSelectionFor(scoredMatch) {
  const { match, markets, score } = scoredMatch;
  const candidates = [
    markets.BTTS != null && { market: 'BTTS', label: 'Les 2 équipes marquent', probability: markets.BTTS },
    markets.WINNER && {
      market: 'WINNER',
      label: `Victoire ${markets.WINNER.outcome === 'DOMICILE' ? match.homeTeam : markets.WINNER.outcome === 'EXTERIEUR' ? match.awayTeam : 'match nul'}`,
      probability: markets.WINNER.probability,
    },
    markets.OVER_25 != null && { market: 'OVER_25', label: '+ de 2,5 buts', probability: markets.OVER_25 },
    markets.UNDER_35 != null && { market: 'UNDER_35', label: '- de 3,5 buts', probability: markets.UNDER_35 },
  ].filter(Boolean);

  const best = candidates.sort((a, b) => b.probability - a.probability)[0] || null;

  return {
    matchId: match.id,
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    competition: match.competitionLabel,
    date: match.date,
    confidence: score.confidence,
    reliability: score.reliability,
    ...(best || { market: null, label: 'Donnée insuffisante', probability: null }),
    fairOdds: best ? Math.round((100 / best.probability) * 100) / 100 : null,
  };
}
