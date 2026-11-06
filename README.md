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
- Mise en page calquée sur la fiche papier :
  - **Qui suis-je ?** : portrait en polaroïd, nom, allure, la Sorcière que je rêve d'être ;
  - **Ma magie** : type de Sorcière, Essences (l'Essence liée est entourée, un clic pour la changer), voies ;
  - **Traits** sur un presse-papiers : six feuillets, chacun avec sa question (*Tu te vois comme…*, *Tu étudies la Magie pour…*, *Ta Magie…*, *Ton Familier…*, *Dans la vie de tous les jours…*, *Les autres te voient comme…*), la case « Utilisé » et les niveaux 1 à 3 à cocher. Traits libres en plus.
- Un clic sur le bouton d'un Trait lance le test (1d6 + 1d6 par niveau) ; test sans Trait (1d6), test collectif, Dé d'Essence.
- Onglets **Sorts** (Sorts connus, rappel de la Source et de la règle de Magie), **Accomplissement** (Essence étudiée, méthode, journal) et **Biographie** (pronoms, biographie, notes).

### Tests
- **Agir seule** : choix du Trait, des Essences requises (fixées par la Guide) et de la conséquence.
- **Agir ensemble** : une Sorcière mène, les autres apportent les dés de leur Trait.
- Carte de chat : Essences obtenues et requises, résultat **Favorable** / **Défavorable**.
- Bouton **Magie** : 1 point de la Source pour changer un dé en l'Essence de la Sorcière, ou un dé de son Essence en n'importe quelle autre. Seules les transformations permises sont proposées ; utilisable plusieurs fois, par chaque participante.
- Bouton d'**Ambiance** : applique la conséquence (±1 pour agir seule, +1 ou −1 par Essence manquante pour le Coup de feu).

### Fiche de Café (fiche partagée du coven)
- Mise en page calquée sur la fiche papier, en trois colonnes :
  - nom du Café et lieu, **Source de Magie**, **Ambiance** (six citrouilles cliquables), **Incident Magique** (tasses de 4 à 0, cliquables) ;
  - **Garde-manger** : tableau des Ingrédients avec une colonne colorée par Essence et la quantité. L'Essence des 6 Ingrédients de base est fixée par le livre ; celle des Ingrédients créés à la table se change d'un clic, par la Guide (MJ) uniquement ;
  - **Café** : description du lieu et **histoire du Café**.
- Onglet **Carte** (le dos de la fiche, en dépliant) : boissons chaudes avec leurs prix, invitation (slogan, adresse, philosophie du Café), couverture (image du Café, pastille « Grande inauguration »), spécialités avec une petite phrase et leurs Essences. Devise au choix. Une carte de départ est fournie : les boissons classiques et six spécialités originales, une par Ingrédient de base. Tout se modifie. Envoi dans le chat de toute la carte ou d'une spécialité (« Un client commande… »).
- Onglet **Moments** : Journée, Dé d'Essence, Grande inauguration, Agir ensemble, Coup de feu, Médium, É.M.I., Fin de la Journée ; le coven et ses Sorts.
- Onglet **Notes** : mobilier et décoration, notes libres.
- 3 doses de chaque Ingrédient de base à la création.
- Bandeau permanent en haut de l'écran : Magie, Ambiance, compte à rebours d'Incident.

### Médiums et Breuvages
- Fiche de Médium : la Guide tire en secret les 3 Essences recherchées (message privé), avec des pistes pour l'incarner.
- Compte à rebours d'interactions (1 + Ambiance), annoncé dans le chat.
- **Préparer un Breuvage** : 3 Ingrédients du garde-manger. La Guide clique sur **Servir** : doses consommées, +1 Magie par Essence juste, +1d6 pour un Breuvage parfait, lien noué avec la Source.
- Une fois le Breuvage servi, la Guide peut l'**ajouter à la carte** du Café : il devient une spécialité avec ses 3 Essences et le nom du Médium.

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

## Crédits

Polices sous licence SIL Open Font License 1.1 (textes de licence dans `assets/fonts/`) :
- [Lobster](https://github.com/impallari/The-Lobster-Font) © The Lobster Project Authors ;
- [Patrick Hand](https://github.com/google/fonts/tree/main/ofl/patrickhand) © Patrick Wagesreiter ;
- [Caveat](https://github.com/googlefonts/caveat) © The Caveat Project Authors.

## Développement

```
npm install
npm run gen:packs    # régénère packs-src/ depuis tools/gen-packs.mjs
npm run build:packs  # compile packs-src/ en compendiums LevelDB dans packs/
tools/release.sh v0.1.0 "Titre" "Notes"
```
