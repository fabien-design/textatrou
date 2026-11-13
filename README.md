# TEXTATROU

Application web (PWA) en français. La voix est synthétisée dans le navigateur avec Kokoro-82M, entièrement hors-ligne.

## Installation

```bash
npm install
npm run fetch-model
```

`npm run fetch-model` télécharge environ 90 Mo (modèle Kokoro) plus onnxruntime et eSpeak-NG dans `public/models/`, `public/ort/` et `public/espeak/` (dossiers ignorés par git). Option `--webgpu` pour récupérer aussi le modèle fp32.

En cas d'échec (réseau, proxy), le script indique le fichier et l'URL en cause. Derrière un proxy, Node a besoin de `NODE_USE_ENV_PROXY=1` (et au besoin de `NODE_EXTRA_CA_CERTS=<ca.pem>`) :

```bash
NODE_USE_ENV_PROXY=1 npm run fetch-model
```

Sans modèle, l'application retombe sur la voix système du téléphone.

## Lancer

```bash
npm run dev
```

## Tester sur téléphone (USB)

### Android

1. Activer Options développeur → Débogage USB sur le téléphone, puis le brancher.
2. Lancer `npm run dev` sur l'ordinateur.
3. Au choix :
   - Dans Chrome sur l'ordinateur, ouvrir `chrome://inspect`, activer Port forwarding : `5173` → `localhost:5173` ;
   - ou lancer `adb reverse tcp:5173 tcp:5173`.
4. Ouvrir `http://localhost:5173` dans Chrome sur le téléphone.

`localhost` est un contexte sécurisé : le microphone fonctionne et la PWA peut être installée (menu ⋮ → Installer l'application), sans HTTPS.

### iPhone

Safari n'offre pas de redirection de port USB. Mettre iPhone et ordinateur sur le même Wi-Fi, puis lancer `npm run dev:https` et ouvrir l'adresse https affichée (accepter le certificat auto-signé), ou utiliser un tunnel HTTPS.

## Tests

```bash
npm test        # tests unitaires et d'intégration (vitest)
npm run e2e     # tests de bout en bout (Playwright)
```

## Voix

Une seule voix Kokoro, `ff_siwis` (français). Les différents personnages (Narrateur, Robot, Écureuil, Mamie, Commentateur) sont obtenus par la vitesse et des effets audio (modulation en anneau, trémolo, hauteur, filtre radio). Si le modèle n'est pas chargé, l'application retombe sur la synthèse vocale du navigateur.

## Licence

eSpeak-NG (phonémisation) est sous licence GPL-3.0 : voir `docs/BACKLOG.md`.
