/**
 * lib/dataSources.js
 * -------------------------------------------------------------------------
 * Toutes les données proviennent de sources réelles, aucune donnée simulée :
 *
 * 1) openfootball (GitHub, raw.githubusercontent.com)
 *    - Calendriers officiels, structure des championnats, logos d'équipes.
 *    - Dépôts utilisés : football.json (multi-ligues), europe, england,
 *      espana, italy, deutschland, internationals, worldcup.json
 *
 * 2) football-data.org (API temps réel, clé lue depuis process.env)
 *    - Scores en direct, calendrier à jour, complète/rafraîchit les données
 *      openfootball qui sont mises à jour manuellement par la communauté.
 *
 * Règle appliquée partout : si une source ne répond pas ou qu'un champ
 * manque, on l'ignore et on continue avec ce qui est disponible (jamais
 * de valeur inventée ou aléatoire en remplacement).
 * -------------------------------------------------------------------------
 */

const OPENFOOTBALL_RAW_BASE = 'https://raw.githubusercontent.com/openfootball';
const FOOTBALL_DATA_BASE = 'https://api.football-data.org/v4';

// Compétitions couvertes -> code openfootball (fichier json) + code football-data.org
// Complétez cette table selon les championnats que vous voulez exposer.
export const COMPETITIONS = [
  { id: 'PL', label: 'Premier League', country: 'Angleterre', ofRepo: 'football.json', ofFile: 'en.1', fdCode: 'PL' },
  { id: 'PD', label: 'La Liga', country: 'Espagne', ofRepo: 'football.json', ofFile: 'es.1', fdCode: 'PD' },
  { id: 'SA', label: 'Serie A', country: 'Italie', ofRepo: 'football.json', ofFile: 'it.1', fdCode: 'SA' },
  { id: 'BL1', label: 'Bundesliga', country: 'Allemagne', ofRepo: 'football.json', ofFile: 'de.1', fdCode: 'BL1' },
  { id: 'FL1', label: 'Ligue 1', country: 'France', ofRepo: 'football.json', ofFile: 'fr.1', fdCode: 'FL1' },
  { id: 'DED', label: 'Eredivisie', country: 'Pays-Bas', ofRepo: 'football.json', ofFile: 'nl.1', fdCode: 'DED' },
  { id: 'CL', label: 'Champions League', country: 'Europe', ofRepo: 'internationals', ofFile: 'champions-league', fdCode: 'CL' },
];

function currentSeasonFolder(date = new Date()) {
  // openfootball nomme ses dossiers de saison "2024-25" (juillet -> juin)
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1; // 1-12
  const startYear = m >= 7 ? y : y - 1;
  const shortEnd = String((startYear + 1) % 100).padStart(2, '0');
  return `${startYear}-${shortEnd}`;
}

async function safeFetchJson(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    if (!res.ok) return null; // on ignore silencieusement, pas de blocage
    return await res.json();
  } catch (err) {
    console.warn(`[dataSources] échec fetch ${url}: ${err.message}`);
    return null;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Récupère le calendrier/structure d'une compétition depuis openfootball.
 * Gère les deux formats de schéma rencontrés dans les dépôts openfootball
 * (rounds imbriqués ou liste de matchs à plat).
 */
export async function fetchOpenFootballFixtures(competition, date = new Date()) {
  const season = currentSeasonFolder(date);
  const url = `${OPENFOOTBALL_RAW_BASE}/${competition.ofRepo}/master/${season}/${competition.ofFile}.json`;
  const raw = await safeFetchJson(url);
  if (!raw) return [];

  const flatMatches = [];
  const rounds = raw.rounds || raw.matchdays || [];
  if (Array.isArray(rounds) && rounds.length) {
    for (const round of rounds) {
      const matches = round.matches || [];
      for (const m of matches) flatMatches.push(normalizeOpenFootballMatch(m, competition, round.name));
    }
  } else if (Array.isArray(raw.matches)) {
    for (const m of raw.matches) flatMatches.push(normalizeOpenFootballMatch(m, competition));
  }
  return flatMatches.filter(Boolean);
}

function normalizeOpenFootballMatch(m, competition, roundName) {
  if (!m || !m.team1 || !m.team2 || !m.date) return null;
  return {
    source: 'openfootball',
    competitionId: competition.id,
    competitionLabel: competition.label,
    round: roundName || m.round || null,
    date: m.date, // format YYYY-MM-DD
    time: m.time || null,
    homeTeam: m.team1,
    awayTeam: m.team2,
    fullTimeScore: m.score?.ft || null, // [home, away] si le match est joué
    status: m.score?.ft ? 'FINISHED' : 'SCHEDULED',
  };
}

/**
 * Complète/rafraîchit avec football-data.org (scores en direct, calendrier
 * à jour). Nécessite FOOTBALL_DATA_API_KEY côté serveur uniquement -
 * ne jamais appeler cette fonction depuis le navigateur.
 */
export async function fetchFootballDataMatches({ dateFrom, dateTo, competitionCode }) {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) {
    console.warn('[dataSources] FOOTBALL_DATA_API_KEY absente : on continue avec openfootball seul.');
    return [];
  }
  const params = new URLSearchParams({ dateFrom, dateTo });
  if (competitionCode) params.set('competitions', competitionCode);

  const data = await safeFetchJson(`${FOOTBALL_DATA_BASE}/matches?${params}`, {
    headers: { 'X-Auth-Token': apiKey },
  });
  if (!data || !Array.isArray(data.matches)) return [];

  return data.matches.map((m) => ({
    source: 'football-data.org',
    matchId: m.id, // requis pour le H2H natif de l'API
    competitionId: m.competition?.code,
    competitionLabel: m.competition?.name,
    date: m.utcDate?.slice(0, 10),
    time: m.utcDate?.slice(11, 16),
    homeTeam: m.homeTeam?.name,
    homeTeamId: m.homeTeam?.id, // nécessaire pour scoringEngine (forme, etc.)
    awayTeam: m.awayTeam?.name,
    awayTeamId: m.awayTeam?.id,
    homeCrest: m.homeTeam?.crest || null,
    awayCrest: m.awayTeam?.crest || null,
    fullTimeScore:
      m.score?.fullTime?.home != null ? [m.score.fullTime.home, m.score.fullTime.away] : null,
    status: m.status,
  }));
}

/**
 * Fusionne les deux sources pour une fenêtre de dates donnée, sur toutes
 * les compétitions configurées. Déduplique par (équipes + date).
 */
export async function getMatchesForWindow(dateFrom, dateTo) {
  const results = [];

  const fdMatches = await fetchFootballDataMatches({ dateFrom, dateTo });
  results.push(...fdMatches);

  // openfootball sert surtout la structure de saison / logos ; on ne
  // l'interroge en complément que si football-data.org est indisponible
  // ou pour enrichir les compétitions non couvertes par la clé API.
  if (fdMatches.length === 0) {
    for (const comp of COMPETITIONS) {
      const ofMatches = await fetchOpenFootballFixtures(comp);
      const inWindow = ofMatches.filter((m) => m.date >= dateFrom && m.date <= dateTo);
      results.push(...inWindow);
    }
  }

  const seen = new Set();
  const deduped = [];
  for (const m of results) {
    const key = `${m.date}|${(m.homeTeam || '').toLowerCase()}|${(m.awayTeam || '').toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    // Identifiant de routage utilisé par /api/match/[id] : nécessite les
    // ids football-data.org (absents pour un match issu uniquement
    // d'openfootball, qui ne pourra alors pas ouvrir la fiche détaillée).
    const routeId = m.homeTeamId && m.awayTeamId ? `${m.homeTeamId}-${m.awayTeamId}-${m.matchId || ''}` : key;
    deduped.push({ ...m, id: routeId });
  }
  return deduped;
}

/**
 * Historique récent d'une équipe (forme, domicile/extérieur, H2H) via
 * football-data.org. Retourne [] proprement si indisponible.
 */
export async function fetchTeamRecentMatches(teamId, limit = 10) {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey || !teamId) return [];
  const data = await safeFetchJson(
    `${FOOTBALL_DATA_BASE}/teams/${teamId}/matches?status=FINISHED&limit=${limit}`,
    { headers: { 'X-Auth-Token': apiKey } }
  );
  return data?.matches || [];
}

export async function fetchHeadToHead(matchId, limit = 10) {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey || !matchId) return [];
  const data = await safeFetchJson(
    `${FOOTBALL_DATA_BASE}/matches/${matchId}/head2head?limit=${limit}`,
    { headers: { 'X-Auth-Token': apiKey } }
  );
  return data?.matches || [];
}
