# Pumpkin Spice — système Foundry VTT

Système [Foundry Virtual Tabletop](https://foundryvtt.com) pour **Pumpkin Spice**, le JdR cosy d'Acheron Games : un coven de Sorcières tient un Café magique bâti sur une Source de Magie, et prépare des Breuvages pour les Médiums qui passent la porte.

Compatible **Foundry V13 et V14**. Interface en français et en anglais.

> Projet non officiel, réalisé par un fan. Pumpkin Spice © Acheron Games, tous droits réservés. Ce système ne contient ni le texte ni les illustrations du jeu : il automatise les règles du kit de démarrage. Procurez-vous le jeu sur [acheron.it/pumpkinspice-rpg](https://www.acheron.it/pumpkinspice-rpg) pour jouer.

## Installation

Dans Foundry : **Systèmes de jeu → Installer un système**, puis coller l'URL du manifeste :

```
https://github.com/tomjdr4-hub/pumpkin-spice/releases/latest/download/system.json
```

## Fonctionnalités

### Dés d'Essence
- Les six Essences (Autorité, Nature, Empathie, Quiétude, Imagination, Sagesse) s'affichent avec leurs symboles sur les cartes de chat.
- Avec **Dice So Nice**, les d6 portent les symboles d'Essence.
- Commande de chat `/essence 3` : lance 3 Dés d'Essence narratifs, avec un rappel de ce qu'évoque chaque Essence.

### Fiche de Sorcière
- Type de Sorcière (Verte, de Coven, Séculière, Traditionnelle ou autre) et Essence liée.
- Six Traits, chacun répondant à une question de la fiche (*Tu te vois comme…*, *Tu étudies la Magie pour…*, *Ta Magie…*, *Ton Familier…*, *Dans la vie de tous les jours…*, *Les autres te voient comme…*), plus des Traits libres.
- Niveau d'Accomplissement de 1 à 3 et case « Utilisé » pour chaque Trait ; un clic lance le test (1d6 + 1d6 par niveau).
- Test sans Trait (1d6), test collectif, Sorts connus.
- Accomplissement : Essence étudiée, méthode, journal de progression.
- Rappel de la Magie de la Source et de l'Ambiance du Café.

### Tests
- **Agir seule** : choix du Trait, des Essences requises (fixées par la Guide) et de la conséquence.
- **Agir ensemble** : une Sorcière mène, les autres apportent les dés de leur Trait.
- Carte de chat : Essences obtenues et requises, résultat **Favorable** / **Défavorable**.
- Bouton **Magie** : 1 point de la Source pour changer un dé en l'Essence de la Sorcière, ou un dé de son Essence en n'importe quelle autre. Seules les transformations permises sont proposées ; utilisable plusieurs fois, par chaque participante.
- Bouton d'**Ambiance** : applique la conséquence (±1 pour agir seule, +1 ou −1 par Essence manquante pour le Coup de feu).

### Fiche de Café (fiche partagée du coven)
- Ambiance (0 à 6), Magie de la Source, compte à rebours d'Incident Magique, Journée.
- Onglet **Moments** : Dé d'Essence, Grande inauguration, Agir ensemble, Coup de feu, Médium, É.M.I., Fin de la Journée.
- Garde-manger : Ingrédients et doses (3 doses de chaque Ingrédient de base à la création).
- Sorts du coven, lieu de la Source, style, mobilier et décoration.
- Bandeau permanent en haut de l'écran : Magie, Ambiance, compte à rebours d'Incident.

### Médiums et Breuvages
- Fiche de Médium : la Guide tire en secret les 3 Essences recherchées (message privé), avec des pistes pour l'incarner.
- Compte à rebours d'interactions (1 + Ambiance), annoncé dans le chat.
- **Préparer un Breuvage** : 3 Ingrédients du garde-manger. La Guide clique sur **Servir** : doses consommées, +1 Magie par Essence juste, +1d6 pour un Breuvage parfait, lien noué avec la Source.

### Sorts
- Coût en Magie, Essences requises, Essences si les conditions ne sont pas réunies (le système demande au lancement).

### Compendiums
- Les quatre Sorcières prétirées du kit de démarrage.
- Le Sort Glamour.
- Les six Ingrédients de base.
- Tables : pistes de Médium, idées de Médium.
- Aide de jeu : utiliser le système, règles en bref, la première Journée, l'É.M.I. des chats esprits.

### Multijoueur
Les joueurs peuvent utiliser la Magie sur un jet collectif lancé par quelqu'un d'autre : l'action passe par la Guide (MJ) connectée.

## Développement

```
npm install
npm run gen:packs    # régénère packs-src/ depuis tools/gen-packs.mjs
npm run build:packs  # compile packs-src/ en compendiums LevelDB dans packs/
tools/release.sh v0.1.0 "Titre" "Notes"
```
