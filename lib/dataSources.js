/**
 * lib/dataSources.js - Intégration de RapidAPI et Football-Data
 */

const FOOTBALL_DATA_BASE = 'https://api.football-data.org/v4';
const RAPID_API_HOST = 'football-prediction-api.p.rapidapi.com'; // Remplace par le host exact de l'API choisie sur RapidAPI
const RAPID_API_BASE = 'https://football-prediction-api.p.rapidapi.com';

export async function getMatchesForWindow(dateFrom, dateTo) {
  let matches = [];
  const rapidApiKey = process.env.RAPID_API_KEY; // Ta clé récupérée sur RapidAPI à stocker dans Vercel

  // 1. Interrogation via RapidAPI
  if (rapidApiKey) {
    try {
      const response = await fetch(`${RAPID_API_BASE}/api/v2/predictions?iso_date=${dateFrom}`, {
        headers: {
          'x-rapidapi-key': rapidApiKey,
          'x-rapidapi-host': RAPID_API_HOST
        }
      });
      const data = await response.json();
      
      // Adaptation selon la structure de réponse renvoyée par ton API RapidAPI
      if (data && Array.isArray(data.result || data)) {
        const list = data.result || data;
        const mapped = list.map((m, index) => ({
          id: `rapid-${index}`,
          matchId: m.id || index,
          competitionLabel: m.competition_name || 'Championnat International',
          date: dateFrom,
          time: m.time || '20:00',
          homeTeam: m.home_team || m.homeTeam,
          awayTeam: m.away_team || m.awayTeam,
          status: 'SCHEDULED',
          source: 'rapid-api'
        }));
        matches.push(...mapped);
      }
    } catch (e) {
      console.warn("Erreur lors de la récupération via RapidAPI:", e);
    }
  }

  // 2. Fallback de sécurité si la liste est vide
  if (matches.length === 0) {
    matches.push({
      id: 'fallback-match-1',
      matchId: 99999,
      competitionLabel: 'Match de démonstration / Global',
      date: dateFrom,
      time: '20:00',
      homeTeam: 'Équipe Domicile',
      awayTeam: 'Équipe Extérieur',
      status: 'SCHEDULED',
      source: 'fallback'
    });
  }

  return matches;
}

export async function fetchTeamRecentMatches(teamId, limit = 10) {
  return [];
}

export async function fetchHeadToHead(matchId, limit = 10) {
  return [];
}
