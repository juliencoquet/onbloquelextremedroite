# Fiche Chrome Web Store (brouillon)

## Nom
On bloque l'extrême droite

## Description courte (≤132 car., = manifest)
Bloquez l'extrême droite sur X et Instagram : le profil affiché, ou une liste de pseudos saisie ou importée.

## Description détaillée
Bloquez en quelques clics des comptes d'extrême droite sur X et Instagram, depuis votre propre compte.

• « Bloquer ce profil » : bloque le profil affiché dans l'onglet.
• Liste : saisissez ou collez des pseudos, ou importez une liste depuis une adresse (texte ou JSON, groupée par réseau).
• Le réseau est détecté automatiquement ; seules les entrées du réseau ouvert sont utilisées.
• Rythme volontairement lent, arrêt automatique si le réseau demande de ralentir, bouton Stop pour tout annuler.

Aucune donnée n'est collectée ni envoyée. Tout se passe dans votre navigateur, avec votre session connectée.
Les blocages sont réalisés en votre nom : vérifiez les listes que vous importez.

## Objectif unique (single purpose)
Bloquer, depuis le compte connecté de l'utilisateur, des profils X et Instagram désignés par lui (profil affiché ou liste de pseudos).

## Justification des permissions
- storage : conserver localement la file de pseudos et la progression pendant l'exécution.
- Accès à x.com / twitter.com / www.instagram.com (host permissions + content scripts) : bloquer des comptes sur ces sites depuis la session de l'utilisateur ; détecter le site de l'onglet actif.
- Pas de code distant : tout le code est dans le paquet.

## Divulgation des données (formulaire « Pratiques de confidentialité »)
Aucune donnée utilisateur collectée. Cocher : ne pas vendre, ne pas utiliser hors objectif unique, ne pas utiliser pour le crédit/prêt.
Politique de confidentialité : https://github.com/juliencoquet/onbloquelextremedroite/blob/main/PRIVACY.md

## Catégorie
Réseaux sociaux (ou Outils)

## À fournir à la main
- Au moins 1 capture d'écran 1280×800 (ou 640×400), idéalement 3–5 (popup sur Instagram, popup sur X, résultat).
- Icône 128×128 : icons/icon128.png (déjà dans le paquet).
- Optionnel : tuile promo 440×280.
