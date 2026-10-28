# On bloque l'extrême droite

Extension Chrome (MV3). Charge une liste de pseudos (URL ou texte collé) et les bloque
depuis votre session X/Twitter ou Instagram déjà connectée.

## Installer
`chrome://extensions` → Mode développeur → « Charger l'extension non empaquetée » → ce dossier.

## Utiliser
1. Ouvrez x.com ou instagram.com (connecté) dans l'onglet actif.
2. Cliquez sur l'icône, collez une liste ou donnez une URL (texte, un pseudo par ligne, ou JSON groupé par réseau `{"instagram": ["a"], "x": ["b"]}` — voir `examples/liste.json` —, ou simple tableau `["a","b"]`).
3. « Bloquer ». Un blocage toutes les 1,5–4 s (X) ou 8–16 s (Instagram) ; pause automatique sur limite (429).

## Ajouter une plateforme
Créer `platforms/<nom>.js` exposant `block(handle)` (voir `platforms/x.js`) et l'ajouter au manifest.

## Notes
- Instagram : l'extension navigue de profil en profil et clique « … » → Bloquer → confirmer, comme vous le feriez. Laissez l'onglet ouvert et au premier plan ; la page change à chaque compte. Si Instagram affiche « réessayez plus tard », l'exécution s'arrête.
- Utilise l'endpoint web interne de X (`blocks/create.json`) : non officiel, peut changer ; l'automatisation peut contrevenir aux CGU.
- Garder l'onglet x.com ouvert pendant l'exécution. Après un arrêt en cours de route, relancer la même liste reprend là où elle s'était arrêtée ; une liste terminée est oubliée.
