# Spectrum — Live visual studio

Studio local de visuels musicaux : interface Vue 3, analyse Web Audio et rendu WebGL indépendant. La scène **Orbital** reprend le cercle, les courbes ADN, la grille, les ondes et l’œil du visualiseur original. La bibliothèque comporte maintenant **33 scènes**, dont Orbital original conservé et une variante Orbital Overdrive.

## Démarrer

Node.js 20.19+ et npm sont nécessaires.

```sh
npm install
npm run dev
```

Ouvrir **http://127.0.0.1:5173** dans Chrome ou Edge de préférence. Le serveur reste local à l’ordinateur. Ne pas ouvrir `index.html` directement : l’application utilise des modules compilés par Vite. Les captures nécessitent localhost ou HTTPS.

### Tester sans matériel

- **Lancer la démo** : une boucle musicale synthétique à 124 BPM est générée localement et réellement analysée. Le volume règle son écoute.
- **Fichier** : déposer un morceau (MP3, WAV, FLAC, OGG, M4A selon les codecs du navigateur). Lecture, pause, position et volume intégrés. Le fichier reste local.
- **Onglet** : sélectionner un onglet musical dans la fenêtre du navigateur et cocher le partage du son. Un partage sans piste audio affiche une explication et libère la capture.
- **Entrée** : autoriser le microphone, puis choisir le micro ou l’interface audio. Les noms de périphériques sont disponibles après autorisation. Cliquer sur « Reconnecter cette entrée » après avoir changé de périphérique.

Le bouton carré arrête la source et libère toutes ses pistes. Les entrées et captures ne sont jamais renvoyées vers les enceintes, afin d’éviter le larsen. Le volume interne agit uniquement sur la démo et les fichiers ; régler le volume des onglets dans leur lecteur.

Pour une table Denon autonome, il faudra connaître le modèle et ses sorties pour choisir une liaison compatible avec l’ordinateur (USB audio si disponible, ou interface audio externe). Le son d’un logiciel dépend des fonctions de partage du système ou d’un périphérique de routage audio virtuel. L’application peut sélectionner une telle entrée lorsqu’elle est exposée au navigateur.

## Projection

**Ouvrir la projection** crée une deuxième fenêtre, qui affiche uniquement les visuels. Déplacer cette fenêtre sur un écran étendu, puis activer le plein écran. Cela convient à un écran HDMI/DisplayPort ou à un écran étendu sans fil configuré dans le système.

L’analyse audio et les réglages sont transmis entre les deux fenêtres avec `BroadcastChannel` ; les fichiers audio ne sont pas transférés. Le poste de contrôle doit rester ouvert. Un navigateur peut ralentir les tâches d’un onglet masqué ; pour un live, garder le contrôle visible sur le premier écran et la projection visible sur le second. Le rendu de prévisualisation réduit sa résolution lorsqu’une projection est ouverte.

**Ce n’est pas du casting réseau autonome** : pas de découverte de TV par IP, ni de récepteur Chromecast intégré. Un autre appareil sur le réseau ne peut pas rejoindre la session avec ce mécanisme.

## Contrôles

- `1` à `9`, puis `0` : les dix premières scènes ; `→` : parcourir les 33 scènes. Toutes sont sélectionnables dans la galerie.
- `F` : plein écran ; `Échap` : quitter le plein écran.
- `Espace` : figer le mouvement et les données visuelles, sans arrêter la musique.
- `B` : écran noir immédiat, sans arrêter le son.
- `A` : auto-pilote, avec changement de scène à intervalle choisi.
- `?` : aide.

Les palettes, sensibilité, intensité, vitesse, halo, transitions et couches Orbital sont réglables. Pour retrouver le rendu d’origine, choisir **Orbital**, la palette **Neon**, **Relief 3D à 100 %** et **Psychédélisme à 100 %**. Ces deux réglages peuvent monter à 150 %. Les anciens presets les reçoivent automatiquement à 100 %. Les BPM sont une estimation basée sur les impulsions de basses, pas une synchronisation DJ garantie. L’auto-pilote est temporisé, pas un détecteur de drops.

Les réglages et jusqu’à 30 presets sont enregistrés dans le navigateur. Un preset peut être exporté/importé en JSON. Les états « figé » et « noir » ne sont pas restaurés au redémarrage.

### Mix au démarrage

Le mix, la scène, la palette et la calibration sont restaurés au lancement. Le bouton « Réinitialiser » du mix restaure uniquement les réglages visuels : la source, la calibration, la sensibilité audio et la scène choisie restent conservées. Les commandes temporaires (noir, gel et mode live) sont désactivées au redémarrage.

La bibliothèque propose des aperçus issus du moteur de rendu, une recherche insensible aux accents, cinq familles et des favoris enregistrés localement. Les filtres ne changent pas les raccourcis numériques ni le parcours de l’auto-pilote. « Mode scène » masque les panneaux latéraux pour agrandir le rendu.

Trois profils de mix auto règlent ensemble son amplitude, son relâchement et ses flashs : **Subtil**, **Équilibré** et **Impact**. Les réglages restent modifiables après sélection. Les Prismes adaptatifs utilisent également le détail pour doser leurs couches et évitent le calcul des couches invisibles.

## Scènes et commandes

Vortex parcourt un tunnel de cubes en relief ; Matrice devient une sculpture de blocs mobiles. Plasma, Prisme, Orbital original et Gyroscope gardent leurs compositions de référence.

Le panneau **Sculpter la scène** (ancien Mode Rave) pilote automatiquement les scènes autres qu’Orbital original. Quatre curseurs dosent **Énergie**, **Coup de sub · profondeur**, **Psychédélisme** et **Flashs sur les frappes**. Les frappes et attaques de basses déclenchent une impulsion de profondeur avec recul amorti, des fronts lumineux et des flashs brefs. Les flashs suivent le son, sans stroboscope périodique ; leur curseur à zéro les supprime. Les transformations de perspective sont procédurales dans le shader.

**Tourner uniquement sur les basses** conserve la rotation par impulsions. Les curseurs Sensibilité audio, Réponse des basses, Intensité, Mouvement, Détail et Halo restent accessibles directement. Seuls les réglages détaillés de chorégraphie sont repliés ; **Utiliser mes réglages manuels** réactive les choix de rotation, déformation, déplacement, force, inertie et seuil. Les anciens réglages manuels restent enregistrés mais ne pilotent plus le mouvement tant que cette option n'est pas activée. Les niveaux basses/médiums/aigus et BPM sont des indicateurs de lecture, désormais regroupés sous **Détails du signal audio**.

Ces réglages sont communs aux nouvelles scènes, enregistrés dans les presets et transmis à la projection avec les phases de mouvement. Orbital conserve son animation d'origine. Les presets des scènes retirées reviennent à Orbital, en conservant leur palette et leurs autres réglages. Les identifiants des scènes conservées restent stables.

### Bibliothèque de 33 scènes

Orbital, Vortex, Plasma, Orbital Overdrive, Prisme, Prisme Dentelle, Prisme Couronnes, Prisme Éclats, Prisme Spirale, Prisme Cristal, Gyroscope, Matrice, Plasma Cyclone, Plasma Fission, Prisme Abyssal, Prisme Fracture, Faille dimensionnelle, Métal liquide, Matrix Rain, Data Tunnel, Circuit, Interférences, Orage, Dunes néon, Tectonique, Aurore boréale, Lampe à lave, Nébuleuse, Résonance rétro, Soie moirée, Courants, Drapés acides, Abysse liquide.

Les touches 1 à 9 puis 0 sélectionnent les dix premières scènes du catalogue. La flèche droite et le mode automatique parcourent uniquement les scènes disponibles. Les transitions et les commandes live restent disponibles sur toutes les scènes.

### Calibration en direct

Sous « Détails du signal audio », ouvrir **Calibrer le signal**. Chaque bande (basses, médiums, aigus) dispose de limites en Hz, d’un gain de 0 à 4× et d’un seuil de bruit. Les jauges affichent les niveaux après calibration. Les plages peuvent se chevaucher ; leurs limites sont ramenées aux fréquences analysables par la source. Les champs en Hz conservent la saisie pendant le rafraîchissement des jauges : toute valeur valide s’applique immédiatement. Une saisie incomplète reste éditable ; Entrée ou la sortie du champ valide les limites. Les curseurs s’appliquent immédiatement.

**Activer la détection automatique** analyse six secondes de signal réel, puis ajuste les plages en Hz, les gains, les seuils de bruit et le niveau minimum des frappes. L’analyse continue par fenêtres de six secondes pour suivre la musique. Les bandes sans signal restent inchangées ; silence et pause ne produisent aucun réglage. Changer de source recommence l’analyse. Le bouton d’arrêt conserve les derniers réglages ; éditer un paramètre revient au mode manuel. Les valeurs restent sauvegardées, mais l’adaptation automatique doit être réactivée après rechargement.

Les trois boutons **Basses**, **Médiums** et **Aigus** activent les bandes indépendamment : toutes les combinaisons sont possibles. Couper une bande met immédiatement sa jauge à zéro et la retire du spectre utilisé par les visuels ; le niveau global du mix suit les bandes restantes. Le son écouté n’est pas modifié. Le gain et le seuil sont mémorisés ; réactiver une bande dont le gain était à zéro le remet à 1×. Si la bande servant aux frappes est coupée, la détection passe à une bande encore active. Tout couper suspend les réactions audio. L’auto-calibration respecte les bandes coupées ; le choix est sauvegardé dans les réglages et presets.

L’attaque, le relâchement et le lissage règlent la réactivité. Pour les frappes, choisir la bande écoutée, la sensibilité, le niveau minimum en dB et l’espacement minimum. Cette détection utilise le signal avant les gains visuels et les seuils de bruit ; elle pilote les impacts et flashs automatiques ainsi que le BPM estimé. En mode live, les impacts et flashs restent manuels. Les affectations des mouvements aux bandes restent dans les réglages avancés des mouvements.

La calibration ne modifie pas le volume d’écoute. Elle est sauvegardée au prochain lancement, incluse dans les presets et conservée lors d’un changement de source. **Réinitialiser la calibration** restaure uniquement ces paramètres. Le spectre « Signal entrant » reste une vue d’ensemble du signal, tandis que les trois jauges montrent les bandes calibrées.

### Cinq nouveaux Prismes musicaux

**Prisme Dentelle**, **Prisme Couronnes**, **Prisme Éclats**, **Prisme Spirale** et **Prisme Cristal** proposent cinq géométries distinctes. Le Prisme original, Abyssal et Fracture conservent leur rendu.

Chaque nouveau Prisme possède cinq niveaux : **Éveil**, **Dentelle**, **Éclat**, **Expansion**, **Apogée**. Dans le panneau de mix, **Progression** permet de suivre automatiquement la musique ou de choisir un niveau. Les couches apparaissent progressivement : les médiums développent les facettes, les aigus ajoutent les ornements fins et les basses ouvrent les couches imposantes. Le dernier niveau demande une présence des basses ; un passage uniquement aigu ne suffit pas. Le retour au calme est lissé. Cette progression fonctionne indépendamment de Mix auto, respecte les bandes coupées et se transmet à la projection. Le choix du niveau est sauvegardé dans les presets.

### Niveaux et détection audio

**Réponse des basses** ajuste le poids visuel des basses sans changer le volume d'écoute. Les niveaux utilisent une compression douce au lieu d'un écrêtage brutal, avec une retombée plus rapide. La détection des frappes travaille séparément, sur les variations du spectre flottant et l'enveloppe audio brute : les gains visuels ne peuvent plus supprimer les variations utilisées par le détecteur. Un compteur de frappes accompagne l'enveloppe pour transmettre les événements à la projection. Les BPM restent une estimation.

## Mix visuel automatique

Dans « Mix visuel », activer **MIX AUTO** pour suivre l’énergie de la musique. Les passages forts accentuent l’intensité, la vitesse du mouvement, le détail, le halo, le relief et le psychédélisme ; les passages légers les réduisent progressivement. L’enveloppe combine le niveau sonore, les trois bandes calibrées et les frappes. Une référence minimale empêche un passage silencieux de devenir artificiellement intense.

**Amplitude** dose l’écart autour des curseurs de base ; **Retour au calme** règle la durée du relâchement. Les indications **En direct** affichent les valeurs réellement envoyées au rendu. Les curseurs restent éditables et conservent leurs valeurs ; désactiver l’auto les rétablit exactement. Le relief, le psychédélisme, le halo et l’intensité ont désormais des cibles fortes sur les passages intenses, même si leur base est faible. Une vitesse à zéro reste arrêtée. **Flashs auto** dose séparément les flashs ajoutés sur les frappes fortes ; à zéro, seuls les flashs réglés manuellement subsistent. Le mode live suspend cette modulation et le gel conserve l’enveloppe. La projection reçoit le même mix effectif que l’aperçu. Le choix du mode, son amplitude et son relâchement sont sauvegardés et inclus dans les presets.

**Couleurs auto** fait évoluer le rendu entre deux couleurs personnalisables : **Calme** et **Ça tabasse**. Le passage suit l’énergie musicale, avec un mélange de teintes qui conserve leur saturation. Le niveau lumineux baisse sur les passages calmes. Désactiver cette option restaure la palette choisie. Les réglages de couleurs et de flashs sont inclus dans les presets.

Les mouvements automatiques utilisent les frappes détectées, au lieu de relancer une impulsion à chaque variation des basses. Le détecteur exige aussi une hausse d’énergie : un simple transfert entre plusieurs notes graves de même niveau ne suffit plus. Pour **Vortex** et **Data Tunnel**, les impulsions de déplacement sont courtes, ne s’accumulent pas et l’avance est réduite. Le curseur **Avancée du tunnel** dans Mix auto permet de la doser, jusqu’à zéro ; les réglages avancés manuels de mouvement gardent la priorité lorsqu’ils sont activés.

## Pilotage live optionnel

Le commutateur **MODE LIVE**, en haut du mix visuel, prend la main sur les déclenchements. Désactivé, les réactions automatiques et les réglages existants sont conservés. Activé, les scènes continuent d'évoluer et de réagir aux niveaux sonores, mais les frappes, flashs et explosions attendent les commandes du pupitre. Cela fonctionne sur les 33 scènes, y compris Orbital, même sans source audio.

- **J / Frappe** : impulsion de profondeur et de mouvement, sans flash imposé.
- **K / Flash** : éclair bref, dosé par le réglage Flashs de « Sculpter la scène ».
- **L / Explosion** : dispersion, déformation et poussée amplifiée.
- **U maintenu / Boost** : accélération et énergie supplémentaires ; relâcher revient progressivement au niveau initial.

Les pads fonctionnent à la souris et au toucher. Au clavier, les raccourcis n'interceptent pas la saisie dans les champs. Le bouton Boost accepte aussi Espace ou Entrée maintenus lorsqu'il a le focus. La perte de focus, un changement de scène, le gel ou l'écran noir libèrent le boost ; les pads sont désactivés pendant le gel et l'écran noir. La projection reçoit les commandes immédiatement et l'état du mouvement avec les images suivantes.

Désactiver le mode live rend les déclenchements à l'audio sans changer les curseurs ni les réglages de chorégraphie. Le mode est propre à la session : le rechargement démarre en automatique ; charger un preset pendant une session conserve le choix live/auto en cours. Les actions et boosts ne sont pas enregistrés dans les presets.

## Chargement graphique

Les 33 scènes sont préparées dès le démarrage, une par une, avec une progression réelle dans l'aperçu et la projection. La scène sélectionnée passe en priorité ; son rendu démarre dès qu'elle est prête pendant que le reste se prépare. Tous les programmes préparés sont conservés pour les changements suivants. Si une scène demandée n'est pas encore prête, l'ancienne reste affichée pendant l'attente.

Chaque programme ne contient que la scène concernée et ses fonctions nécessaires. `KHR_parallel_shader_compile`, lorsqu'il est disponible, permet de surveiller la compilation sans attendre de façon bloquante. Sans cette extension, le travail est fractionné mais un pilote peut encore bloquer brièvement sur une compilation individuelle. Les fondus composent deux programmes séparés ; ils ne recompilent pas toutes les scènes. Les scènes les plus lourdes ont un budget de pixels inférieur, y compris au premier rendu. La restauration du contexte relance le préchargement.

## Performance et architecture

```text
AudioEngine → analyse FFT / Features → Renderer WebGL → canvas
                    ↓                       ↑
              compteurs UI             réglages Vue
                    └──── projection BroadcastChannel ────┘
```

- Une seule boucle `requestAnimationFrame`, sans l’ancien limiteur qui jetait des images.
- Les scènes procédurales utilisent un triangle plein écran. **Orbital** reprend les transformations, l’ADN hélicoïdal, les couches du cercle, l’œil et les ondes du fichier original dans un lot de triangles WebGL. Le dédoublement et la saturation sont appliqués par un shader à une texture GPU. Pas de `getImageData`, ni de recopie du canvas côté CPU.
- Les vagues Orbital sont supprimées dès qu’elles quittent la scène ; les ondes de choc expirent au bout de 1,9 seconde. Les autres scènes calculent leurs motifs directement dans le shader.
- Spectre GPU limité à 64 valeurs ; buffers audio réutilisés ; UI actualisée à 10 Hz.
- Analyse du spectre complet : basses, médiums et aigus. Aucun filtre passe-bas global qui supprime voix et aigus.
- Transitions entre deux scènes calculées seulement pendant le fondu.
- Résolution indépendante de celle de l’écran : **Auto** ajuste un budget initial de 1,25 million de pixels ; **Éco** vise 520 000 ; **Haute** plafonne à 2 073 600. Un écran 4K n’impose donc pas 8 millions de pixels par image.
- Gestion de la perte/restauration du contexte WebGL. Un navigateur avec accélération graphique est nécessaire ; il n’y a pas de moteur Canvas 2D de secours.

`src/audio/` contient la capture et l’analyse ; `src/visuals/` contient les scènes, shaders et moteur ; `App.vue` contient le poste de contrôle. Le moteur ne dépend pas de Vue. Le « moteur séparé » est un module indépendant dans l’application, pas un deuxième logiciel à installer.

Les mesures avant/après sont conservées dans [benchmarks/README.md](benchmarks/README.md).

L’original exact avant migration est conservé dans `legacy/visualizer-v2.html`.

## Vérifier et construire

```sh
npm test
npm run build
npm run preview
```

Tests navigateur (avec `npm run dev` actif) :

```sh
npm run test:browser
```

Les scripts navigateur utilisent Chrome headless via le protocole DevTools, avec la sortie sonore désactivée (`--mute-audio`) : l’analyse audio reste active pour les tests. Sur macOS, il cherche l’installation standard de Chrome. Ailleurs, définir `CHROME_PATH` ; `SPECTRUM_URL` peut remplacer l’URL locale. Les captures micro sont simulées par Chrome : aucun micro réel n’est ouvert. Les fichiers de test, captures et résultats sont écrits dans le répertoire temporaire `/tmp`.

Le test ciblé `SPECTRUM_URL=http://127.0.0.1:5173 node tests/orbital.cjs` vérifie aussi la géométrie Orbital, les couches indépendantes, les palettes, le gel et les durées de vie bornées des vagues. Il produit des captures et une mesure à 1920 × 1080 dans `/tmp`.

La suite existante a été écrite pour les six scènes initiales, la démo, la lecture d’un vrai WAV local, pause/reprise, les presets, le cycle de vie d’une capture simulée, l’absence de son partagé, la projection et le format mobile. Les mesures headless sont un diagnostic reproductible, pas une garantie de FPS sur une autre machine ou de compatibilité avec une table physique.

L’interface ne contacte aucun serveur pour l’audio. Les polices Google Fonts peuvent être téléchargées par le navigateur ; les polices système prennent le relais hors ligne. Le build de production ne dépend pas d’un CDN JavaScript.

### Validation du 29 octobre 2026

La demande de ne pas lancer les tests a ensuite été levée. Les vérifications suivantes ont été exécutées avec succès sur la version à 33 scènes :

- `npm test` : 9 tests, dont analyse audio, mode live, arrêt du boost et migration des presets.
- `npm run build` : build de production Vite.
- `npm run test:browser` : préchargement des 33 programmes, parcours des 33 scènes, audio démo/fichier, captures simulées, presets, projection, plein écran, gel, écran noir, restauration du contexte et mise en page mobile.
- `npm run test:browser -- --live-only` : raccourcis frappe/flash/explosion, boost maintenu et relâchement sur perte de focus.
- `SPECTRUM_URL=http://127.0.0.1:5173 node tests/orbital.cjs` : pixels non noirs pour les 33 scènes, aucune erreur WebGL, couches Orbital indépendantes, palettes, gel et durées de vie bornées des effets.

Les mesures de parcours dans Chrome headless étaient généralement de 54 à 60 FPS ; Champ magnétique a atteint 44 FPS sur un échantillon. Orbital a tenu environ 60 FPS dans le contrôle ciblé à 1920 × 1080. Ces mesures ne garantissent pas les mêmes performances sur d'autres appareils, ni la qualité artistique de chaque scène. Les résultats détaillés et captures du passage sont dans `/tmp/spectrum-browser-results.json`, `/tmp/spectrum-desktop.png`, `/tmp/spectrum-mobile.png` et `/tmp/orbital-restored.png`.

### Vingt scènes supplémentaires

Supernova, Orage, Océan électrique, Dunes néon, Rubans cinétiques, Méduse, Essaim mécanique, Möbius, Mur de caissons, Tectonique, Aurore boréale, Spirographe, Astéroïdes, Feux d’artifice, Chute de lumière, Lampe à lave, Op Art, Tissage, Compression, Nébuleuse.

Ces scènes utilisent les palettes, les réglages audio et le mode live existants. Elles sont incluses dans le préchargement progressif ; les compositions les plus coûteuses utilisent une résolution réduite. Les scènes précédentes et leurs identifiants sont conservés. Aucun test ni build lancé pour cet ajout, à la demande de l’utilisateur.

### Résonance rétro

Scène inspirée de la référence Windows Media Player : noyau blanc et vert doré, rayons fins et couronnes électriques inclinées. Les basses pilotent la pulsation et les mouvements ; les aigus ajoutent un frémissement aux filaments. La couleur conserve une base rétro modulée par la palette choisie. Incluse dans le préchargement et le mode live. Aucun test ni build lancé pour cet ajout.

### Remplissage du cadre

Les scènes disposent de couches de fond adaptées à leur famille : filaments en plusieurs plans, particules, facettes, structures, matière fluide, lignes ondulées, brume ou fumée de scène. Elles occupent aussi les côtés des formats larges. Les visuels déjà denses reçoivent un apport plus discret ; les détails lumineux au premier plan masquent le fond pour garder du contraste. Le réglage Détail / densité dose ces couches. Orbital original reste intact. Aucun anneau de choc commun n’est ajouté.

Chaque programme ne compile que sa famille de fond, sans rendre une deuxième fois la scène complète. Aucun test ni build lancé pour cette modification.

### Onze références visuelles

Soie moirée, Courants, Drapés acides, Kaléidoscope mécanique, Citadelle cyan, Turbine industrielle, Machines néon, Galaxies néon, Rosace spectrale, Octogone mécanique, Abysse liquide.

Onze compositions procédurales inspirées des images fournies. Les nappes fluides remplissent le cadre. Les cinq scènes mécaniques utilisent des surfaces 3D, normales, reflets et éléments émissifs ; chaque programme ne conserve que son propre modèle de géométrie. Les nouvelles scènes gèrent leurs déformations directement, sans superposition du fond commun ni distorsion globale de la structure. Elles utilisent les contrôles audio, le mode live, les palettes et le préchargement existants. Les couleurs de référence sont dominantes, avec une contribution de la palette choisie.

Aucun test, build ou aperçu lancé : la fidélité visuelle et les performances de ces nouvelles compositions restent à évaluer dans le navigateur.

Les anciens tunnels Vortex, Data Tunnel et Portails ont également été renforcés : progression plus rapide, détails et passages lumineux sur les parois, blocs plus saillants sur les basses dans Vortex, et davantage de cadres épais dans Portails. Les blocs restent ancrés dans le cylindre courbe de Vortex.

### Densification des références

Kaléidoscope mécanique, Citadelle cyan, Turbine industrielle, Machines néon et Octogone mécanique possèdent désormais des assemblages à bords arrondis avec logements évidés, grilles, fixations et liserés, ainsi que des détails spécifiques (denture, conduites, cages et plaques). Le réglage de détail dose les finitions et certaines couronnes supplémentaires. Rosace spectrale superpose trois plans de dentelle polygonale, avec croisillons et points lumineux.

Les galaxies ont chacune une dérive orbitale, une rotation, un changement d’aplatissement et des bras qui se déforment ; les basses accentuent leur dilatation. Le rendu inclut les cellules voisines pour éviter de couper les galaxies à leurs frontières. Le budget de résolution des scènes coûteuses s’applique aussi à Galaxies néon et Rosace spectrale. Aucun test, build ou aperçu lancé pour cette révision.

Mainstage a été retirée du catalogue et du préchargement. Ses anciens presets redirigent vers Laser Show, en conservant les autres réglages. Pour Citadelle cyan et Kaléidoscope mécanique, les grilles et fixations fines sont désormais calculées dans le matériau visible plutôt que dans la géométrie à chaque pas du rayon ; les volumes principaux et les liserés restent en 3D. Aucun test ni build lancé ; le gain de fluidité reste à mesurer.

### Stabilité audio et projection

Le tempo attend plusieurs intervalles cohérents avant de proposer une estimation, affiche sa stabilité et s’efface après trois secondes sans frappe. Les ajustements de seuil conservent l’historique ; changer la bande de détection le réinitialise. La calibration applique une première proposition après six secondes, puis limite ses corrections suivantes et ignore les petites variations.

Si la projection ne reçoit plus de données pendant trois secondes, elle fige la dernière image ; elle reprend à la réception de nouvelles données.

Pour régénérer les 33 aperçus avec le moteur réel, démarrer `npm run dev`, puis lancer `npm run render:covers` (Chrome requis). Les JPEG sont enregistrés dans `public/scenes` et inclus dans le build.

### Validation du 3 novembre 2026

- `npm test` : 38 tests réussis, dont tempo, calibration progressive, sélection des bandes, mix dynamique et bibliothèque.
- `npm run test:browser` : 33 scènes, recherche/familles/favoris, profils du mix, mode scène, audio, projection et mobile vérifiés avec la sortie sonore désactivée.
- `npm run test:browser -- --settings-only` : restauration du mix et des favoris après rechargement ; réinitialisation visuelle conservant scène, calibration et sensibilité.
- `npm run build` : compilation de production réussie.

Les captures des scènes sont livrées dans `public/scenes`. Les mesures headless de ce passage sont dans `/tmp/spectrum-browser-results.json` ; elles ne remplacent pas une écoute et une appréciation visuelle sur les morceaux utilisés en live.

## Atelier live et direction musicale

Les commandes Figer et Noir restent sous le lecteur, à côté du rendu. La sensibilité audio se trouve dans le panneau du signal. Les réglages fins du mix, les transitions/qualité et les presets sont repliables. Les commandes propres à Orbital sont affichées uniquement pour Orbital et Overdrive.

Le mix sépare les accents brefs de l’énergie soutenue. Une frappe produit un accent immédiat ; la densité, les couleurs et les effets suivent une enveloppe plus lente. L’indicateur distingue introduction, montée, break, drop, passage intense et silence. Ce sont des estimations causales à partir du signal calibré, pas une reconnaissance de la structure du morceau. Les couleurs ont leur propre lissage, et le changement de source remet l’analyse de passage à zéro.

L’auto-pilote attend la durée choisie, puis une frontière musicale estimée (groupe de quatre frappes détectées, drop ou break). Il attend au maximum huit secondes supplémentaires en l’absence de rythme fiable. La sélection manuelle reste immédiate. Deux styles de passage sont proposés : fondu simple et ouverture progressive. Figer suspend aussi la progression d’un fondu en cours.

Les 33 scènes ont une direction explicite dans `src/visuals/sceneDirection.js` : rythme de rotation/déformation/déplacement, exposition, fond atmosphérique et dose de profondeur/psychédélisme. Le détail pilote des éléments propres à chaque composition (couches, gravures, fragments, densité des lignes). Les médiums déforment les formes sans piloter l’avancée des tunnels. Une courte indication sous la palette explique le comportement de la scène active.

### Contrôles de cette passe

- `npm test` : 43 tests, dont passages musicaux, accent isolé, transitions musicales et simulation d’une heure d’historique.
- `npm run test:render` : compare les pixels pour détail, halo, relief et psychédélisme sur les 33 scènes (132 comparaisons). Le rapport est écrit dans `/tmp/spectrum-art-review.json`.
- `npm run test:browser -- --projection-only` : coupe les messages de projection, vérifie le gel après trois secondes puis la reprise automatique.
- `npm run test:browser -- --lifecycle-only` : alterne 24 démarrages/arrêts démo et capture simulée, vérifie la libération des pistes.
- `npm run test:soak` : dix minutes **réelles** de rendu, avec changements de scène, passages calmes/intenses et mix automatique. Le script mesure les FPS et la mémoire après collecte, vérifie les ressources bornées et les erreurs WebGL. Le rapport progressif est écrit dans `/tmp/spectrum-soak-results.json`. `SOAK_SECONDS` permet de modifier cette durée (minimum 60 secondes).

Tous les scripts navigateur utilisent `--mute-audio`. La capture micro est simulée. Les mesures headless caractérisent cette machine et cette configuration ; elles ne constituent pas une garantie de performance sur un autre appareil.

Pour isoler les contrôles longs de l’utilisation de Chrome, fournir un exécutable **Chrome Headless Shell** avec `CHROME_PATH`. Exemple : `CHROME_PATH=/chemin/vers/chrome-headless-shell npm run test:soak`. Les FPS de ce navigateur de test peuvent différer de Chrome avec l’accélération graphique habituelle ; la stabilité de la mémoire et les erreurs sont contrôlées séparément.

Le contrôle `npm run test:browser -- --keyboard-only` vérifie que la touche Espace ouvre les panneaux repliables sans déclencher le gel global.

Validation d’endurance retenue : arrêt à la demande après plus de dix minutes sur Chrome Headless Shell avec accélération matérielle AMD Metal. Les relevés étaient à 60 FPS, la mémoire JavaScript autour de 1,9–2,0 Mo, sans erreur WebGL. La durée d’une heure n’a pas été validée ; le test dure désormais dix minutes par défaut.
