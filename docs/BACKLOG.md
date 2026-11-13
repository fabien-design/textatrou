# Backlog TEXTATROU (hors MVP)

- **Enregistrer la voix des joueurs** : capter les mots criés par les joueurs et les rejouer lors de la relecture finale de l'histoire (fonction payante).
- **Voix cloud premium** : voix de synthèse haut de gamme (Azure ou ElevenLabs), appelée via une fonction serveur pour protéger les clés.
- **Achats réels** : brancher les vrais achats in-app des packs via les stores (Capacitor ou Expo).
- **Portage app native** : version iOS et Android empaquetée à partir de l'app web.

## Licence à revoir avant publication
- **Phonémiseur eSpeak-NG (GPL-3.0)** : la voix Kokoro française s'appuie sur eSpeak-NG compilé en WebAssembly pour convertir le texte en phonèmes. Avant une diffusion commerciale (stores, packs payants), décider : publier le code sous licence compatible GPL, pré-calculer les phonèmes des histoires au build (seules les données sont distribuées) avec un phonémiseur maison pour les mots dynamiques, ou passer à un moteur sous licence permissive.
