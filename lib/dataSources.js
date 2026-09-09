/**
 * lib/dataSources.js - Version anti-cache et dynamique absolue
 */

const FOOTBALL_DATA_BASE = 'https://api.football-data.org/v4';

export async function getMatchesForWindow(dateFrom, dateTo) {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) {
    console.error("ERREUR CRITIQUE : FOOTBALL_DATA_API_KEY est introuvable par Vercel !");
    return [];
  }

  // URL avec un paramètre anti-cache pour forcer l'API à répondre en direct
  const url = `${FOOTBALL_DATA_BASE}/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`;
  
  try {
    const response = await fetch(url, {
      headers: { 'X-Auth-Token': apiKey },
      cache: 'no-store' // Désactive tout cache Next.js / Vercel
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Erreur API ${response.status}:`, errorText);
      return [];
    }

    const data = await response.json();
    if (!data || !Array.isArray(data.matches)) return [];

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
  } catch (e) {
    console.error("Exception réseau attrapée :", e);
    return [];
  }
}
