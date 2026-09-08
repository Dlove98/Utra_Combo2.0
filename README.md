# Ultra Combo

Application de pronostics football (BTTS, 1X2, +2,5 buts, -3,5 buts) sur plusieurs championnats,
basée sur des données réelles : calendriers/logos openfootball (GitHub) + résultats/formes en direct
via football-data.org.

## Démarrage local

```bash
npm install
cp .env.example .env.local
# éditez .env.local et renseignez FOOTBALL_DATA_API_KEY
npm run dev
```

## Déploiement Vercel

1. Poussez ce dossier sur un dépôt GitHub (le `.gitignore` exclut déjà `.env.local`,
   donc votre clé API ne sera jamais commitée).
2. Importez le dépôt sur [vercel.com/new](https://vercel.com/new).
3. Dans **Project Settings → Environment Variables**, ajoutez `FOOTBALL_DATA_API_KEY`
   (et éventuellement `NEXT_PUBLIC_ANALYSIS_WINDOW_DAYS`, `NEXT_PUBLIC_MAX_COMBO_CANDIDATES`).
4. Déployez.

**Ne mettez jamais la clé API directement dans le code source**, même en `.env` commité :
un dépôt GitHub, même privé au départ, peut devenir public ou être forké.

## Limites connues (transparence sur la méthodologie)

- Sur les 12 critères d'analyse demandés, **6 sont calculés à partir de données réelles**
  (forme, domicile/extérieur, H2H, calendrier de repos, stats offensives, stats défensives).
  Les 6 autres (effectif/blessures, marché des bookmakers, compositions probables, conditions
  de match, et partiellement motivation/style de jeu) nécessitent des sources de données
  payantes non configurées ici — le système ne les invente pas, il les ignore et l'ajuste
  dans le score de fiabilité (`reliability`) affiché sur chaque match.
- Le plan gratuit de football-data.org limite les requêtes (~10/min). Le fichier
  `pages/api/matches.js` limite le nombre de matchs analysés par requête et introduit une
  pause entre les appels. Pour un usage en production avec beaucoup de compétitions, ajoutez
  un cache (ISR Next.js ou cron) plutôt que de recalculer à chaque visite.
- Les correspondances entre les identifiants d'équipes openfootball et football-data.org ne
  sont pas garanties automatiquement : les matchs sans identifiant football-data.org
  s'affichent dans le calendrier mais sans score de confiance ni fiche détaillée.
- Les "cotes totales estimées" des combinés sont des cotes *statistiquement justes* dérivées
  des probabilités du modèle (1 / probabilité), **pas** des cotes de bookmaker réelles,
  puisqu'aucun flux de cotes n'est configuré.
- L'onglet Combinés du Jour construit plusieurs tickets de tailles différentes (3, 5 et 8
  sélections) à partir du pool des 25 meilleurs matchs, plutôt qu'un unique ticket à 25
  sélections : au-delà de quelques sélections combinées, la probabilité de gain d'un unique
  ticket géant devient extrêmement faible même si chaque sélection individuelle semble sûre.

## Structure

```
lib/dataSources.js     Récupération openfootball + football-data.org
lib/scoringEngine.js   12 critères, calcul du score de confiance /100
lib/markets.js         Probabilités BTTS / 1X2 / +2,5 / -3,5 (modèle de Poisson)
lib/comboBuilder.js    Génération des tickets combinés
pages/index.js         Programme du jour / J+1 / J+2
pages/combines.js      Combinés du jour
pages/api/matches.js   API : calendrier + scoring de la fenêtre d'analyse
pages/api/match/[id].js API : détail d'un match (12 critères, H2H)
```
