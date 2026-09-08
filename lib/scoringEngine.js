/**
 * lib/scoringEngine.js
 * -------------------------------------------------------------------------
 * Évalue un match sur les 12 critères demandés. IMPORTANT :
 *
 * Avec les seules sources gratuites configurées (openfootball + endpoints
 * gratuits de football-data.org), 6 des 12 critères sont réellement
 * calculables à partir de données réelles (résultats, calendrier).
 * Les 6 autres (blessures, compositions probables, cotes bookmakers,
 * conditions de match précises...) nécessitent des sources payantes ou
 * non configurées ici.
 *
 * Conformément à la règle "si une donnée manque, on l'ignore et on fait
 * au mieux" : ces critères ne sont PAS inventés. Ils sont soit omis du
 * calcul (poids redistribué sur les critères réels), soit calculés
 * partiellement quand une donnée proxy fiable existe (ex: motivation via
 * la position au classement, si le classement est disponible).
 *
 * Le score de confiance final est donc toujours honnête sur son niveau
 * de fiabilité (`reliability`), affiché à l'utilisateur.
 * -------------------------------------------------------------------------
 */

export const CRITERIA = [
  { key: 'forme', label: 'Forme actuelle (5-10 derniers matchs)', computable: true, weight: 12 },
  { key: 'domicileExterieur', label: 'Performances domicile / extérieur', computable: true, weight: 10 },
  { key: 'h2h', label: 'Confrontations directes (H2H)', computable: true, weight: 10 },
  { key: 'motivation', label: 'Motivation (titre, Europe, maintien, derby)', computable: 'partial', weight: 8 },
  { key: 'effectif', label: 'Effectif (blessures, suspensions)', computable: false, weight: 8 },
  { key: 'calendrier', label: 'Calendrier (repos, fatigue, déplacements)', computable: true, weight: 7 },
  { key: 'statsOffensives', label: 'Statistiques offensives', computable: true, weight: 12 },
  { key: 'statsDefensives', label: 'Statistiques défensives', computable: true, weight: 12 },
  { key: 'marcheBookmakers', label: 'Marché des bookmakers (tendances de cotes)', computable: false, weight: 7 },
  { key: 'compositionsProbables', label: 'Compositions probables', computable: false, weight: 5 },
  { key: 'styleDeJeu', label: 'Style de jeu', computable: 'partial', weight: 5 },
  { key: 'conditionsMatch', label: 'Conditions du match', computable: false, weight: 4 },
];

function safeDiv(a, b, fallback = 0) {
  return b > 0 ? a / b : fallback;
}

/**
 * @param {object} recent - { home: matches[], away: matches[], h2h: matches[] }
 *   Chaque "match" attendu au format football-data.org (score.fullTime, etc.)
 * @param {object} standings - classement optionnel { homeRank, awayRank, totalTeams }
 */
export function scoreMatch({ homeTeam, awayTeam, recent = {}, standings = null }) {
  const scores = {};
  const notes = {};

  // --- 1. Forme actuelle -----------------------------------------------
  scores.forme = formScore(recent.home, recent.away);

  // --- 2. Domicile / extérieur ------------------------------------------
  scores.domicileExterieur = homeAwayScore(recent.home, recent.away);

  // --- 3. H2H --------------------------------------------------------------
  scores.h2h = h2hScore(recent.h2h, homeTeam, awayTeam);

  // --- 4. Motivation (proxy = écart de classement, si dispo) -------------
  if (standings?.homeRank && standings?.awayRank && standings?.totalTeams) {
    scores.motivation = motivationScoreFromStandings(standings);
    notes.motivation = 'Estimée depuis le classement (proxy), pas depuis les enjeux réels du club.';
  } else {
    scores.motivation = null; // non calculable, ignoré du total
  }

  // --- 5. Effectif : non disponible via sources gratuites -----------------
  scores.effectif = null;

  // --- 6. Calendrier (jours de repos entre matchs) ------------------------
  scores.calendrier = restScore(recent.home, recent.away);

  // --- 7 & 8. Stats offensives / défensives (buts marqués/encaissés) ------
  const off = offensiveDefensiveScore(recent.home, recent.away);
  scores.statsOffensives = off.offensive;
  scores.statsDefensives = off.defensive;

  // --- 9. Marché bookmakers : non disponible sans flux de cotes -----------
  scores.marcheBookmakers = null;

  // --- 10. Compositions probables : non disponible ------------------------
  scores.compositionsProbables = null;

  // --- 11. Style de jeu (proxy = tendance buts marqués/encaissés) --------
  scores.styleDeJeu = off.offensive != null ? Math.round((off.offensive + off.defensive) / 2) : null;

  // --- 12. Conditions du match : non disponible sans API météo/stade ----
  scores.conditionsMatch = null;

  return aggregateScore(scores, notes);
}

function aggregateScore(scores, notes) {
  let weightedSum = 0;
  let weightUsed = 0;
  let computedCriteria = 0;

  for (const c of CRITERIA) {
    const v = scores[c.key];
    if (v == null) continue;
    weightedSum += v * c.weight;
    weightUsed += c.weight;
    computedCriteria += 1;
  }

  const totalPossibleWeight = CRITERIA.reduce((s, c) => s + c.weight, 0);
  const confidence = weightUsed > 0 ? Math.round((weightedSum / weightUsed) * 10) : null;
  const reliability = Math.round((weightUsed / totalPossibleWeight) * 100); // % du modèle réellement mesuré

  return {
    perCriterion: scores,
    notes,
    confidence, // /100, null si aucune donnée exploitable
    reliability, // % des critères effectivement basés sur des données réelles
    computedCriteria,
    totalCriteria: CRITERIA.length,
    tier: classify(confidence),
  };
}

function classify(confidence) {
  if (confidence == null) return 'Données insuffisantes';
  if (confidence >= 95) return 'Exceptionnel';
  if (confidence >= 85) return 'Très solide';
  if (confidence >= 75) return 'Solide';
  if (confidence >= 70) return 'Correct';
  return 'À éviter';
}

// --- Sous-fonctions basées uniquement sur des résultats réels -------------

function formScore(homeMatches = [], awayMatches = []) {
  // recent.home = 5-10 derniers matchs (tous contextes confondus) de
  // l'équipe recevante ; recent.away = idem pour l'équipe visiteuse.
  // Chaque match connaît sa propre équipe "teamId" de référence, injecté
  // par l'appelant (voir pages/api/match/[id].js) pour lever toute
  // ambiguïté domicile/extérieur dans le calcul des points.
  const homePts = pointsPerGame(homeMatches);
  const awayPts = pointsPerGame(awayMatches);
  const values = [homePts, awayPts].filter((v) => v != null);
  if (!values.length) return null;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return clamp(Math.round(safeDiv(avg, 3) * 10), 0, 10); // 3 pts/match max -> /10
}

function pointsPerGame(matches = []) {
  if (!matches.length) return null;
  let pts = 0;
  let counted = 0;
  for (const m of matches) {
    const ft = m.score?.fullTime;
    if (ft?.home == null || ft?.away == null || !m.referenceTeamId) continue;
    counted += 1;
    const teamIsHome = m.homeTeam?.id === m.referenceTeamId;
    const teamGoals = teamIsHome ? ft.home : ft.away;
    const oppGoals = teamIsHome ? ft.away : ft.home;
    if (teamGoals === oppGoals) pts += 1;
    else if (teamGoals > oppGoals) pts += 3;
  }
  return counted ? pts / counted : null;
}

function homeAwayScore(homeMatches = [], awayMatches = []) {
  if (!homeMatches.length && !awayMatches.length) return null;
  const homeWinRate = winRate(homeMatches, 'home');
  const awayWinRate = winRate(awayMatches, 'away');
  const combined = [homeWinRate, awayWinRate].filter((v) => v != null);
  if (!combined.length) return null;
  const avg = combined.reduce((a, b) => a + b, 0) / combined.length;
  return clamp(Math.round(avg * 10), 0, 10);
}

function winRate(matches = [], side) {
  const played = matches.filter((m) => m.score?.fullTime?.home != null);
  if (!played.length) return null;
  const wins = played.filter((m) => {
    const { home, away } = m.score.fullTime;
    return side === 'home' ? home > away : away > home;
  }).length;
  return wins / played.length;
}

function h2hScore(h2hMatches = [], homeTeam, awayTeam) {
  if (!h2hMatches.length) return null;
  const played = h2hMatches.filter((m) => m.score?.fullTime?.home != null);
  if (!played.length) return null;
  const homeWins = played.filter((m) => {
    const winnerIsFirstTeam = m.score.fullTime.home > m.score.fullTime.away;
    return (m.homeTeam?.name === homeTeam) === winnerIsFirstTeam;
  }).length;
  return clamp(Math.round(safeDiv(homeWins, played.length) * 10), 0, 10);
}

function motivationScoreFromStandings({ homeRank, awayRank, totalTeams }) {
  // Proxy simple : les équipes proches du haut (titre/Europe) ou du bas
  // (maintien) du classement sont considérées plus "motivées".
  const extremityScore = (rank) => {
    const distFromMiddle = Math.abs(rank - totalTeams / 2) / (totalTeams / 2);
    return clamp(Math.round(distFromMiddle * 10), 0, 10);
  };
  return Math.round((extremityScore(homeRank) + extremityScore(awayRank)) / 2);
}

function restScore(homeMatches = [], awayMatches = []) {
  const restDays = (matches) => {
    if (matches.length < 2) return null;
    const dates = matches.map((m) => new Date(m.utcDate)).sort((a, b) => b - a);
    return (dates[0] - dates[1]) / (1000 * 3600 * 24);
  };
  const homeRest = restDays(homeMatches);
  const awayRest = restDays(awayMatches);
  const values = [homeRest, awayRest].filter((v) => v != null);
  if (!values.length) return null;
  const avgRest = values.reduce((a, b) => a + b, 0) / values.length;
  // 7 jours de repos = optimal (10/10), <2 jours = fatigue (proche de 0)
  return clamp(Math.round(safeDiv(Math.min(avgRest, 7), 7) * 10), 0, 10);
}

function offensiveDefensiveScore(homeMatches = [], awayMatches = []) {
  const goalsFor = (matches, side) =>
    average(
      matches
        .filter((m) => m.score?.fullTime?.home != null)
        .map((m) => (side === 'home' ? m.score.fullTime.home : m.score.fullTime.away))
    );
  const goalsAgainst = (matches, side) =>
    average(
      matches
        .filter((m) => m.score?.fullTime?.home != null)
        .map((m) => (side === 'home' ? m.score.fullTime.away : m.score.fullTime.home))
    );

  const gfHome = goalsFor(homeMatches, 'home');
  const gfAway = goalsFor(awayMatches, 'away');
  const gaHome = goalsAgainst(homeMatches, 'home');
  const gaAway = goalsAgainst(awayMatches, 'away');

  const gf = average([gfHome, gfAway].filter((v) => v != null));
  const ga = average([gaHome, gaAway].filter((v) => v != null));

  return {
    offensive: gf != null ? clamp(Math.round(safeDiv(gf, 3) * 10), 0, 10) : null, // 3 buts/match = max
    defensive: ga != null ? clamp(Math.round((1 - safeDiv(Math.min(ga, 3), 3)) * 10), 0, 10) : null,
  };
}

function average(arr) {
  if (!arr.length) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
