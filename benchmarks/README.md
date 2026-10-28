# Mesures de migration

Mesures locales du 28 octobre 2026 dans Chrome headless 156 sur le même ordinateur. Le code historique est conservé dans `legacy/visualizer-v2.html`. Les chiffres sont des cadences de la boucle de rendu, pas des mesures GPU de présentation ni une garantie sur une autre machine.

| Scénario                         | Ancien Canvas 2D |                              Nouveau WebGL |
| -------------------------------- | ---------------: | -----------------------------------------: |
| Signal fort, fenêtre 1920 × 1080 |         28,1 FPS | 60 FPS, qualité haute (canvas 1918 × 1078) |
| Signal fort, fenêtre 3840 × 2160 |          6,9 FPS |   60 FPS, qualité auto (canvas 1491 × 838) |
| Prévisualisation des six scènes  |                — |                        60 FPS pour chacune |

La comparaison 4K met volontairement en évidence la politique de résolution : le nouveau moteur ne rend pas en 4K natif. L’effet Orbital a été réimplémenté en shader et n’est pas une reproduction pixel à pixel du Canvas d’origine.

## Protocole

Ancien moteur : 10 secondes de chauffe, 5 secondes de mesure par scénario, valeurs FFT constantes à 170 ou 240, effets activés par défaut. Le résultat à 28,1 FPS inclut les post-effets. Sans dédoublement et saturation, il montait à 49,1 FPS. Les deux post-effets totalisaient environ 41,7 ms par déclenchement en 1080p et 172,2 ms en 4K.

Nouveau moteur : démo générée puis réellement analysée pour les tests fonctionnels et les scènes. Spectre forcé à 240 pour les essais de charge, avec analyse du signal temporel de la démo conservée. Échantillons de cadence à une seconde d’intervalle, sur environ 10 secondes en mode auto et 8 secondes en qualité haute / affichage 4K. Les premiers échantillons peuvent inclure un redimensionnement. La propriété `ms` mesure uniquement le temps CPU de soumission du rendu WebGL ; ce n’est **pas** le temps d’exécution GPU.

`original.json` contient les résultats historiques. `webgl.json` contient les résultats de la migration et les contrôles fonctionnels effectués. Pour relancer les tests de la nouvelle version : démarrer `npm run dev`, puis `npm run test:browser`. Les tests de microphone utilisent une source simulée du navigateur, pas le micro réel.

La détection du tempo a retrouvé 124 BPM sur la démo à 124 BPM. Ce cas contrôlé ne valide pas une détection universelle sur tous les styles musicaux.

## Restauration du rendu Orbital

Après la première migration, Orbital a été repris à partir des équations du fichier historique : transformations par couche, aplatissement, rebond, ADN hélicoïdal, couleurs arc-en-ciel, iris plein et ondes de choc. La géométrie est dessinée en un lot de triangles WebGL dans une texture GPU ; le dédoublement et la saturation sont composités par shader. Les mesures précédentes de `webgl.json` correspondent à la première version plus sobre d’Orbital.

Le test ciblé `tests/orbital.cjs` mesure **60,0 FPS à 1920 × 1080 natifs**, avec un intervalle entre images au 95e percentile de **16,8 ms**. À la fin du test, le lot contient environ 40 700 sommets et trois vagues visibles. Ces résultats sont dans `orbital-restored.json`. Test de six secondes en Chrome headless sur la même machine, spectre de basses fort et constant. Les couleurs, le gel, le mode noir, les couches indépendantes et le nettoyage des anciennes vagues sont également vérifiés.

La palette Neon utilise les couleurs du fichier d’origine. Les réglages Relief 3D et Psychédélisme valent 100 % par défaut. La géométrie, l’anticrénelage et le traitement audio diffèrent encore du Canvas original : il s’agit d’une reprise fidèle de ses formes et mouvements, pas d’une identité pixel à pixel.
