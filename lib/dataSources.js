/**
 * lib/dataSources.js - Version propre, transparente et sans faux match de démo
 */

const FOOTBALL_DATA_BASE = 'https://api.football-data.org/v4';

/**
 * Fonction de fetch sécurisée avec journalisation explicite des erreurs API
 */
async function safeFetchJson(url, options = {}) {
  try {
    const response = await fetch(url, options);
    
    if (!response.ok) {
      console.error(`[API Error] Status ${response.status} sur l'URL: ${url}`);
      const errorBody = await response.text();
      console.error(`[API Error Details]:`, errorBody);
      return null;
    }

    return await response.json();
  } catch (e) {
    console.error(`[Network Error] Échec de la requête vers ${url}:`, e);
    return null;
  }
}

export async function getMatchesForWindow(dateFrom, dateTo) {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;

  if (!apiKey) {
    console.warn("Attention : FOOTBALL_DATA_API_KEY est manquante dans les variables d'environnement.");
    return [];
  }

  const url = `${FOOTBALL_DATA_BASE}/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`;
  const data = await safeFetchJson(url, {
    headers: { 'X-Auth-Token': apiKey },
    next: { revalidate: 60 }
  });

  if (!data || !Array.isArray(data.matches)) {
    return [];
  }

  return data.matches.map((m) => ({
    id: `${m.homeTeam?.id}-${m.awayTeam?.id}-${m.id}`,
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
    status: m.status,
  }));
}

export async function fetchTeamRecentMatches(teamId, limit = 10) {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey || !teamId) return [];

  const url = `${FOOTBALL_DATA_BASE}/teams/${teamId}/matches?status=FINISHED&limit=${limit}`;
  const data = await safeFetchJson(url, {
    headers: { 'X-Auth-Token': apiKey }
  });

  return data?.matches || [];
}

export async function fetchHeadToHead(matchId, limit = 10) {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey || !matchId) return [];

  const url = `${FOOTBALL_DATA_BASE}/matches/${matchId}/head2head?limit=${limit}`;
  const data = await safeFetchJson(url, {
    headers: { 'X-Auth-Token': apiKey }
  });

  return data?.matches || [];
}
