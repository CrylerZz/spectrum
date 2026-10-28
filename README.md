# Spectrum — Live visual studio

Studio local de visuels musicaux : interface Vue 3, analyse Web Audio et rendu WebGL indépendant. La scène **Orbital** reprend le cercle, les courbes ADN, la grille, les ondes et l’œil du visualiseur original. Cinq autres scènes sont disponibles : Hyperdrive, Aurora, Terrain, Liquid et Stardust.

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

- `1` à `6` : scènes ; `→` : scène suivante.
- `F` : plein écran ; `Échap` : quitter le plein écran.
- `Espace` : figer le mouvement et les données visuelles, sans arrêter la musique.
- `B` : écran noir immédiat, sans arrêter le son.
- `A` : auto-pilote, avec changement de scène à intervalle choisi.
- `?` : aide.

Les palettes, sensibilité, intensité, vitesse, halo, transitions et couches Orbital sont réglables. Pour retrouver le rendu d’origine, choisir **Orbital**, la palette **Neon**, **Relief 3D à 100 %** et **Psychédélisme à 100 %**. Ces deux réglages peuvent monter à 150 %. Les anciens presets les reçoivent automatiquement à 100 %. Les BPM sont une estimation basée sur les impulsions de basses, pas une synchronisation DJ garantie. L’auto-pilote est temporisé, pas un détecteur de drops.

Les réglages et jusqu’à 30 presets sont enregistrés dans le navigateur. Un preset peut être exporté/importé en JSON. Les états « figé » et « noir » ne sont pas restaurés au redémarrage.

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

Le script utilise Chrome headless via le protocole DevTools. Sur macOS, il cherche l’installation standard de Chrome. Ailleurs, définir `CHROME_PATH` ; `SPECTRUM_URL` peut remplacer l’URL locale. Les captures micro sont simulées par Chrome : aucun micro réel n’est ouvert. Les fichiers de test, captures et résultats sont écrits dans le répertoire temporaire `/tmp`.

Le test ciblé `SPECTRUM_URL=http://127.0.0.1:5173 node tests/orbital.cjs` vérifie aussi la géométrie Orbital, les couches indépendantes, les palettes, le gel et les durées de vie bornées des vagues. Il produit des captures et une mesure à 1920 × 1080 dans `/tmp`.

Les tests couvrent les six scènes, la démo, la lecture d’un vrai WAV local, pause/reprise, les presets, le cycle de vie d’une capture simulée, l’absence de son partagé, la projection et le format mobile. Les mesures headless sont un diagnostic reproductible, pas une garantie de FPS sur une autre machine ou de compatibilité avec une table physique.

L’interface ne contacte aucun serveur pour l’audio. Les polices Google Fonts peuvent être téléchargées par le navigateur ; les polices système prennent le relais hors ligne. Le build de production ne dépend pas d’un CDN JavaScript.
