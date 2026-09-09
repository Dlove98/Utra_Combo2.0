/**
 * Extension de lib/dataSources.js pour intégrer l'historique open-source GitHub
 */

// URL de base pour les historiques de matchs openfootball par saison et par ligue
const OPENFOOTBALL_HISTORY_BASE = 'https://raw.githubusercontent.com/openfootball';

export async function fetchTeamRecentMatches(teamId, limit = 10) {
  // 1. On essaie d'abord l'API principale si le teamId est un nombre valide de football-data
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (apiKey && teamId && !String(teamId).startsWith('gh-')) {
    try {
      const res = await fetch(`https://api.football-data.org/v4/teams/${teamId}/matches?status=FINISHED&limit=${limit}`, {
        headers: { 'X-Auth-Token': apiKey }
      });
      const data = await res.json();
      if (data && Array.isArray(data.matches) && data.matches.length > 0) {
        return data.matches;
      }
    } catch (e) {
      console.warn("Échec API pour l'historique, bascule sur les fichiers GitHub openfootball...");
    }
  }

  // 2. Fallback GitHub : Récupération des archives de résultats open-source (ex: Premier League / Ligues majeures)
  try {
    // On charge le fichier JSON officiel de la saison en cours depuis le dépôt GitHub openfootball
    const seasonFileUrl = `${OPENFOOTBALL_HISTORY_BASE}/football.json/main/2026-27/en.1.json`;
    const res = await fetch(seasonFileUrl);
    const data = await res.json();

    if (data && Array.isArray(data.matches)) {
      // Filtrer les matchs déjà joués qui impliquent l'équipe recherchée
      const teamNameQuery = String(teamId).toLowerCase();
      const finishedMatches = data.matches.filter(m => 
        m.score && m.score.ft && 
        (m.team1.toLowerCase().includes(teamNameQuery) || m.team2.toLowerCase().includes(teamNameQuery))
      );

      // Transformer au format attendu par ton moteur de score (scoringEngine)
      return finishedMatches.slice(-limit).map(m => ({
        homeTeam: { name: m.team1, id: m.team1 },
        awayTeam: { name: m.team2, id: m.team2 },
        score: {
          fullTime: {
            home: m.score.ft[0],
            away: m.score.ft[1]
          }
        },
        utcDate: m.date
      }));
    }
  } catch (err) {
    console.error("Erreur lors de la lecture de l'historique GitHub openfootball:", err);
  }

  return [];
}
