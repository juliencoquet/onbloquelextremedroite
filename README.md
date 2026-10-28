# On bloque l'extrême droite

Extension Chrome (MV3). Charge une liste de pseudos (URL ou texte collé) et les bloque
depuis votre session X/Twitter ou Instagram déjà connectée.

## Installer
`chrome://extensions` → Mode développeur → « Charger l'extension non empaquetée » → ce dossier.

## Utiliser
1. Ouvrez x.com ou instagram.com (connecté) dans l'onglet actif.
2. Cliquez sur l'icône, collez une liste ou donnez une URL (texte, un pseudo par ligne, ou JSON `["a","b"]`).
3. « Bloquer ». Un blocage toutes les 1,5–4 s (X) ou 8–16 s (Instagram) ; pause automatique sur limite (429).

## Ajouter une plateforme
Créer `platforms/<nom>.js` exposant `block(handle)` (voir `platforms/x.js`) et l'ajouter au manifest.

## Notes
- Instagram est très strict : si une vérification est demandée, l'exécution s'arrête. Préférez de petites listes.
- Utilise l'endpoint web interne de X (`blocks/create.json`) : non officiel, peut changer ; l'automatisation peut contrevenir aux CGU.
- Garder l'onglet x.com ouvert pendant l'exécution. L'état est conservé : relancer ignore les comptes déjà bloqués.
