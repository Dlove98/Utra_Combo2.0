/**
 * lib/dataSources.js
 * -------------------------------------------------------------------------
 * Version optimisée et enrichie :
 * - Double source intelligente (football-data.org prioritaire + openfootball GitHub en complément)
 * - Suppression des filtres stricts pour récupérer un maximum de matchs (y compris Champions League et ligues mondiales)
 * - Robustesse maximale avec gestion des erreurs silencieuse et fallback propre.
 * -------------------------------------------------------------------------
 */

const OPENFOOTBALL_RAW_BASE = 'https://raw.githubusercontent.com/openfootball';
const FOOTBALL_DATA_BASE = 'https://api.football-data.org/v4';

// Compétitions couvertes : ajout d'un large éventail pour enrichir considérablement le catalogue
export const COMPETITIONS = [
  { id: 'PL', label: 'Premier League', country: 'Angleterre', ofRepo: 'football.json', ofFile: 'en.1', fdCode: 'PL' },
  { id: 'PD', label: 'La Liga', country: 'Espagne', ofRepo: 'football.json', ofFile: 'es.1', fdCode: 'PD' },
  { id: 'SA', label: 'Serie A', country: 'Italie', ofRepo: 'football.json', ofFile: 'it.1', fdCode: 'SA' },
  { id: 'BL1', label: 'Bundesliga', country: 'Allemagne', ofRepo: 'football.json', ofFile: 'de.1', fdCode: 'BL1' },
  { id: 'FL1', label: 'Ligue 1', country: 'France', ofRepo: 'football.json', ofFile: 'fr.1', fdCode: 'FL1' },
  { id: 'DED', label: 'Eredivisie', country: 'Pays-Bas', ofRepo: 'football.json', ofFile: 'nl.1', fdCode: 'DED' },
  { id: 'CL', label: 'Champions League', country: 'Europe', ofRepo: 'internationals', ofFile: 'champions-league', fdCode: 'CL' },
  { id: 'EL', label: 'Europa League', country: 'Europe', ofRepo: 'internationals', ofFile: 'europa-league', fdCode: 'EL' },
  { id: 'WC', label: 'World Cup / Internationaux', country: 'Monde', ofRepo: 'internationals', ofFile: 'worldcup', fdCode: 'CLI' }
];

function currentSeasonFolder(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  const startYear = m >= 7 ? y : y - 1;
  const shortEnd = String((startYear + 1) % 100).padStart(2, '0');
  return `${startYear}-${shortEnd}`;
}

async function safeFetchJson(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn(`[dataSources] échec fetch ${url}: ${err.message}`);
    return null;
  } finally {
    clearTimeout(t);
  }
}

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
    date: m.date,
    time: m.time || null,
    homeTeam: m.team1,
    awayTeam: m.team2,
    fullTimeScore: m.score?.ft || null,
    status: m.score?.ft ? 'FINISHED' : 'SCHEDULED',
  };
}

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
    matchId: m.id,
    competitionId: m.competition?.code,
    competitionLabel: m.competition?.name,
    date: m.utcDate?.slice(0, 10),
    time: m.utcDate?.slice(11, 16),
    homeTeam: m.homeTeam?.name,
    homeTeamId: m.homeTeam?.id,
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
 * Fusion intelligente et combinée : Interroge à la fois football-data.org 
 * ET complète activement avec openfootball (GitHub) pour ne rater aucun match 
 * (ex: Champions League, championnats secondaires).
 */
export async function getMatchesForWindow(dateFrom, dateTo) {
  const results = [];

  // 1. Récupération prioritaire via l'API temps réel
  const fdMatches = await fetchFootballDataMatches({ dateFrom, dateTo });
  results.push(...fdMatches);

  // 2. Fusion systématique avec les sources GitHub openfootball pour élargir la liste et éviter le vide
  for (const comp of COMPETITIONS) {
    const ofMatches = await fetchOpenFootballFixtures(comp);
    const inWindow = ofMatches.filter((m) => m.date >= dateFrom && m.date <= dateTo);
    results.push(...inWindow);
  }

  // Déduplication robuste par (date + équipes)
  const seen = new Set();
  const deduped = [];
  for (const m of results) {
    const key = `${m.date}|${(m.homeTeam || '').toLowerCase().trim()}|${(m.awayTeam || '').toLowerCase().trim()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    
    const routeId = m.homeTeamId && m.awayTeamId ? `${m.homeTeamId}-${m.awayTeamId}-${m.matchId || ''}` : key;
    deduped.push({ ...m, id: routeId });
  }
  return deduped;
}

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
