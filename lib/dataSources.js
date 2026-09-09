/**
 * lib/dataSources.js - Correctif de robustesse anti-blocage
 */

const FOOTBALL_DATA_BASE = 'https://api.football-data.org/v4';

export async function getMatchesForWindow(dateFrom, dateTo) {
  let matches = [];
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;

  // 1. Interrogation de l'API principale football-data.org
  if (apiKey) {
    try {
      const response = await fetch(`${FOOTBALL_DATA_BASE}/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`, {
        headers: { 'X-Auth-Token': apiKey }
      });
      const data = await response.json();
      if (data && Array.isArray(data.matches)) {
        matches = data.matches.map((m) => ({
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
    } catch (e) {
      console.warn("Erreur lors de la récupération des matchs en direct:", e);
    }
  }

  // 2. Si l'API ne renvoie rien (quota ou pas de match dans le filtre strict), 
  // on génère une liste de secours ou on s'assure de ne pas retourner un tableau totalement vide 
  // pour que l'interface affiche des matchs de test ou du jour.
  if (matches.length === 0) {
    matches.push({
      id: 'fallback-match-1',
      matchId: 99999,
      competitionLabel: 'Match de démonstration / Global',
      date: dateFrom,
      time: '20:00',
      homeTeam: 'Équipe Domicile',
      awayTeam: 'Équipe Extérieur',
      homeTeamId: null,
      awayTeamId: null,
      status: 'SCHEDULED'
    });
  }

  return matches;
}

export async function fetchTeamRecentMatches(teamId, limit = 10) {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey || !teamId || String(teamId).startsWith('fallback')) return [];
  try {
    const res = await fetch(`${FOOTBALL_DATA_BASE}/teams/${teamId}/matches?status=FINISHED&limit=${limit}`, {
      headers: { 'X-Auth-Token': apiKey }
    });
    const data = await res.json();
    return data?.matches || [];
  } catch (e) {
    return [];
  }
}

export async function fetchHeadToHead(matchId, limit = 10) {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey || !matchId || String(matchId).includes('fallback')) return [];
  try {
    const res = await fetch(`${FOOTBALL_DATA_BASE}/matches/${matchId}/head2head?limit=${limit}`, {
      headers: { 'X-Auth-Token': apiKey }
    });
    const data = await res.json();
    return data?.matches || [];
  } catch (e) {
    return [];
  }
}
