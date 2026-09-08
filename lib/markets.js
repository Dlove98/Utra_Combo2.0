/**
 * lib/markets.js
 * -------------------------------------------------------------------------
 * Le système est volontairement restreint à 4 marchés (aucun autre,
 * notamment pas de "1.5 buts") :
 *   - BTTS  : les deux équipes marquent
 *   - 1X2   : victoire d'une équipe (issue sèche la plus probable)
 *   - OV25  : plus de 2,5 buts dans le match
 *   - UN35  : moins de 3,5 buts dans le match
 *
 * Les probabilités sont dérivées des moyennes de buts marqués/encaissés
 * réelles (recent.home / recent.away), pas de valeurs inventées. Si les
 * données sont insuffisantes, le marché renvoie null plutôt qu'un chiffre
 * fabriqué.
 * -------------------------------------------------------------------------
 */

export const MARKETS = [
  { key: 'BTTS', label: 'Les deux équipes marquent' },
  { key: 'WINNER', label: 'Victoire (1X2)' },
  { key: 'OVER_25', label: 'Plus de 2,5 buts' },
  { key: 'UNDER_35', label: 'Moins de 3,5 buts' },
];

// Approximation de Poisson pour P(buts d'une équipe = k), à partir d'une
// moyenne de buts observée sur les matchs récents réels.
function poissonProb(lambda, k) {
  if (lambda == null || lambda < 0) return null;
  return (Math.exp(-lambda) * Math.pow(lambda, k)) / factorial(k);
}
function factorial(n) {
  return n <= 1 ? 1 : n * factorial(n - 1);
}

export function computeMarketProbabilities({ avgGoalsHomeFor, avgGoalsAwayFor, homeWinRate, awayWinRate }) {
  if (avgGoalsHomeFor == null || avgGoalsAwayFor == null) {
    return { BTTS: null, WINNER: null, OVER_25: null, UNDER_35: null };
  }

  const maxGoals = 6;
  let pBothScore = 0;
  let pOver25 = 0;
  let pUnder35 = 0;
  let pHomeWin = 0;
  let pAwayWin = 0;
  let pDraw = 0;

  for (let h = 0; h <= maxGoals; h++) {
    for (let a = 0; a <= maxGoals; a++) {
      const pH = poissonProb(avgGoalsHomeFor, h);
      const pA = poissonProb(avgGoalsAwayFor, a);
      if (pH == null || pA == null) continue;
      const p = pH * pA;
      const total = h + a;

      if (h > 0 && a > 0) pBothScore += p;
      if (total > 2.5) pOver25 += p;
      if (total < 3.5) pUnder35 += p;
      if (h > a) pHomeWin += p;
      else if (h < a) pAwayWin += p;
      else pDraw += p;
    }
  }

  const winner =
    pHomeWin >= pAwayWin && pHomeWin >= pDraw
      ? { outcome: 'DOMICILE', probability: round2(pHomeWin) }
      : pAwayWin >= pDraw
      ? { outcome: 'EXTERIEUR', probability: round2(pAwayWin) }
      : { outcome: 'NUL', probability: round2(pDraw) };

  return {
    BTTS: round2(pBothScore),
    WINNER: winner,
    OVER_25: round2(pOver25),
    UNDER_35: round2(pUnder35),
  };
}

function round2(p) {
  return p == null ? null : Math.round(p * 1000) / 10; // en %
}

/**
 * Cote "juste" implicite (1 / probabilité), utile pour estimer la cote
 * totale d'un combiné. Ce n'est PAS une cote de bookmaker réelle - le
 * système n'a pas de flux de cotes configuré (voir scoringEngine.js,
 * critère "marché des bookmakers" = non disponible).
 */
export function impliedFairOdds(probabilityPercent) {
  if (!probabilityPercent) return null;
  return Math.round((100 / probabilityPercent) * 100) / 100;
}
