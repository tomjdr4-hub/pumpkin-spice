/**
 * Génère les sources JSON des compendiums dans packs-src/<pack>/ (identifiants stables).
 * Usage : node tools/gen-packs.mjs
 */
import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";

const PS_QUESTIONS = ["self", "study", "magic", "familiar", "mundane", "others"];
const SYS = "systems/pumpkin-spice";
const ESS = n => `${SYS}/assets/essences/${n}.svg`;
const id = seed => {
  const h = createHash("sha1").update(`pumpkin-spice:${seed}`).digest();
  const abc = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from(h.subarray(0, 16), b => abc[b % abc.length]).join("");
};
const p = (...lines) => lines.map(l => `<p>${l}</p>`).join("");
const ul = items => `<ul>${items.map(i => `<li>${i}</li>`).join("")}</ul>`;

/* -------------------------------------------- */
/*  Sorcières prétirées                          */
/* -------------------------------------------- */

const WITCHES = [
  {
    name: "Sorcière Verte", archetype: "green", essence: 2,
    traits: ["Ne faire qu'un avec la nature", "Protéger mes proches", "Soigner le corps", "Curieuse", "Amie des animaux", "Imprévisible"],
    bio: "Elle sent la Magie partout où pousse quelque chose de vivant, et ne se lasse jamais de s'en émerveiller."
  },
  {
    name: "Sorcière de Coven", archetype: "coven", essence: 3,
    traits: ["Âme de la fête", "Combattre la corruption de la planète", "Apaiser les gens", "Charismatique", "À l'écoute", "Bienveillante"],
    bio: "Élevée au milieu d'autres Sorcières, elle ne conçoit la Magie qu'à plusieurs : la vie de coven est sa force."
  },
  {
    name: "Sorcière Séculière", archetype: "secular", essence: 5,
    traits: ["Bricoleuse habile", "Comprendre la vraie beauté", "Créer des merveilles", "", "Artiste renommée", "Mystérieuse"],
    bio: "Pour elle, la sorcellerie est un artisanat : elle aime ce qui se fabrique de ses mains, avec un soupçon de Magie."
  },
  {
    name: "Sorcière Traditionnelle", archetype: "traditional", essence: 6,
    traits: ["Chercheuse méthodique", "Faire honneur à mon nom", "Transmettre la vérité", "Indépendante", "Oratrice éloquente", "Patiente"],
    bio: "Vieux grimoires, nuits blanches et ciel étoilé : elle apprend à l'ancienne, page après page."
  }
];

const witches = WITCHES.map((w, i) => {
  const _id = id(`witch-${w.archetype}`);
  return {
    _id, _key: `!actors!${_id}`, name: w.name, type: "witch", img: `${SYS}/assets/icons/witch.svg`,
    system: {
      archetype: w.archetype, essence: w.essence, pronouns: "", look: "",
      traits: w.traits.map((name, i) => ({ question: PS_QUESTIONS[i], name, level: 1, used: false })),
      study: { essence: null, method: "" },
      biography: p(w.bio, "<em>Donnez-lui un nom, et imaginez ce que chaque Trait dit de son passé.</em>"),
      realization: "", notes: ""
    },
    prototypeToken: { name: w.name, actorLink: true, texture: { src: `${SYS}/assets/icons/witch.svg` } },
    items: [], effects: [], folder: null, sort: i * 100, flags: {}
  };
});

/* -------------------------------------------- */
/*  Sorts                                        */
/* -------------------------------------------- */

const glamourId = id("spell-glamour");
const spells = [{
  _id: glamourId, _key: `!items!${glamourId}`, name: "Glamour", type: "spell", img: "icons/magic/symbols/rune-sigil-black-pink.webp",
  system: {
    spellType: "generic", cost: 1, essences: "2 4", altEssences: "2 4 6 6",
    conditions: p("Le Sort touche une petite zone, ou une ou plusieurs cibles proches les unes des autres. Sinon, il faut obtenir 2 4 6 6."),
    description: p("Renforce les enchantements naturels qui cachent la Magie aux yeux des gens ordinaires : effets magiques et créatures deviennent invisibles et presque imperceptibles.", "Le meilleur moyen d'éviter un Incident Magique !")
  },
  effects: [], folder: null, sort: 0, flags: {}
}];

/* -------------------------------------------- */
/*  Ingrédients                                  */
/* -------------------------------------------- */

const INGREDIENTS = [
  [1, "Gingembre Étoilé", "Une racine piquante qui scintille comme un ciel d'hiver."],
  [2, "Menthe Énergisée", "Des feuilles vives qui fourmillent sous les doigts."],
  [3, "Curcuma Ensoleillé", "Une poudre dorée, chaude comme un après-midi d'été."],
  [4, "Camomille Évanescente", "De petites fleurs qui semblent s'effacer quand on les regarde trop longtemps."],
  [5, "Cannelle Pourpre", "Des bâtons d'un rouge profond, au parfum de rêverie."],
  [6, "Lavande Lunaire", "Des épis argentés qu'on récolte, dit-on, à la pleine lune."]
];
const ingredients = INGREDIENTS.map(([e, name, desc]) => {
  const _id = id(`ingredient-${e}`);
  return {
    _id, _key: `!items!${_id}`, name, type: "ingredient", img: ESS(e),
    system: { essence: e, quantity: 3, description: p(desc) },
    effects: [], folder: null, sort: e * 100, flags: {}
  };
});

/* -------------------------------------------- */
/*  Tables                                       */
/* -------------------------------------------- */

const table = (seed, name, description, rows, img) => {
  const _id = id(`table-${seed}`);
  return {
    _id, _key: `!tables!${_id}`, name, img, description, formula: `1d${rows.length}`, replacement: true, displayRoll: true,
    results: rows.map(([title, text], i) => {
      const rid = id(`table-${seed}-${i}`);
      return {
        _id: rid, _key: `!tables.results!${_id}.${rid}`, type: "text", name: title, description: text,
        img: ESS(i + 1), weight: 1, range: [i + 1, i + 1], drawn: false, flags: {}
      };
    }),
    folder: null, sort: 0, flags: {}
  };
};

const tables = [
  table("medium-needs", "Pistes de Médium", "Ce qui tracasse un Médium, selon l'Essence tirée.", [
    ["Autorité", "N'ose pas s'affirmer, et en souffre ou s'aigrit."],
    ["Nature", "Étouffe sous la technologie ou la vie en ville."],
    ["Empathie", "Reste distant, a du mal à aller vers les autres."],
    ["Quiétude", "Vit pour le regard des autres au lieu d'écouter son cœur."],
    ["Imagination", "S'ennuie dans la routine, manque d'élan créatif."],
    ["Sagesse", "Doute de son savoir (ou s'y fie trop) et manque de recul."]
  ], `${SYS}/assets/icons/medium.svg`),
  table("medium-who", "Qui est ce Médium ?", "Une idée de départ ; la personne qui lance le dé a le dernier mot.", [
    ["Autorité", "Une avocate pressée, un chef d'entreprise, une agente de police…"],
    ["Nature", "Un jardinier, une randonneuse, une vétérinaire…"],
    ["Empathie", "Une infirmière, un animateur de quartier, une serveuse…"],
    ["Quiétude", "Un écrivain solitaire, une veilleuse de nuit, un moine…"],
    ["Imagination", "Une musicienne, un graphiste, une inventrice…"],
    ["Sagesse", "Un étudiant, une professeure à lunettes, un archiviste…"]
  ], `${SYS}/assets/icons/medium.svg`)
];

/* -------------------------------------------- */
/*  Aide de jeu                                  */
/* -------------------------------------------- */

const page = (jid, seed, name, content, sort) => {
  const pid = id(`page-${seed}`);
  return {
    _id: pid, _key: `!journal.pages!${jid}.${pid}`, name, type: "text",
    text: { content, format: 1 }, title: { show: true, level: 1 }, sort, flags: {}
  };
};

const jid = id("journal-aide");
const journal = {
  _id: jid, _key: `!journal!${jid}`, name: "Pumpkin Spice — Aide de jeu", folder: null, sort: 0, flags: {},
  pages: [
    page(jid, "foundry", "Utiliser le système", [
      "<h2>Mise en place</h2>",
      ul([
        "Créez un acteur <b>Café</b> : c'est la fiche partagée du coven. Il démarre avec 10 Magie, 3 en Ambiance, un compte à rebours d'Incident à 4 et 3 doses de chaque Ingrédient de base. Tous les joueurs peuvent la modifier.",
        "Importez les <b>Sorcières prétirées</b> (ou créez les vôtres) et attribuez-les aux joueurs (Configuration de l'utilisateur → Personnage).",
        "Importez le Sort <b>Glamour</b> sur la fiche du Café (Sorts du coven) ou d'une Sorcière.",
        "Le bandeau en haut de l'écran affiche en permanence la Magie de la Source, l'Ambiance et le compte à rebours d'Incident."
      ]),
      "<h2>Tests</h2>",
      ul([
        "<b>Agir seule</b> : sur la fiche de Sorcière, cliquez sur le bouton de dés d'un Trait. Indiquez les Essences fixées par la Guide et la conséquence (aucune, Ambiance ±1, Coup de feu).",
        "<b>Agir ensemble</b> : choisissez qui mène et le Trait de chacune ; tous les dés sont lancés ensemble.",
        "Sur la carte du jet, le bouton <b>Magie</b> dépense 1 point de la Source pour transformer un dé selon l'Essence de la Sorcière. Chaque participante peut l'utiliser, plusieurs fois.",
        "Le bouton d'<b>Ambiance</b> applique la conséquence au Café (une seule fois ; la Magie n'est plus utilisable ensuite).",
        "Commande de chat <code>/essence 3</code> : lance 3 Dés d'Essence narratifs."
      ]),
      "<h2>Médiums et Breuvages</h2>",
      ul([
        "La Guide crée un <b>Médium</b> (onglet Moments du Café), tire en secret ses 3 Essences et lance le compte à rebours (1 + Ambiance).",
        "Les Sorcières préparent le <b>Breuvage</b> avec 3 Ingrédients ; la Guide clique sur <b>Servir</b> : doses consommées, Magie gagnée, 1d6 en plus pour un Breuvage parfait."
      ])
    ].join(""), 100),
    page(jid, "rules", "Les règles en bref", [
      "<h2>Les Essences</h2>",
      p("Chaque face du d6 est une Essence : 1 Autorité, 2 Nature, 3 Empathie, 4 Quiétude, 5 Imagination, 6 Sagesse. On n'additionne jamais : on regarde quelles Essences sortent."),
      "<h2>Tests</h2>",
      ul([
        "La Sorcière décrit ce qu'elle fait et choisit un Trait ; la Guide choisit la ou les Essences requises.",
        "On lance 1d6 + 1d6 par niveau du Trait (1 à 3). Sans Trait adapté : 1d6 seulement.",
        "Toutes les Essences requises sont obtenues : <b>Favorable</b>. Sinon : <b>Défavorable</b>. Le résultat oriente l'histoire ; celle qui lance raconte."
      ]),
      "<h2>La Source et la Magie</h2>",
      ul([
        "La Source a des points de Magie partagés par tout le coven (10 au départ). À 0, elle risque de s'éteindre.",
        "Après un jet, pour 1 point : changer un dé en l'Essence de la Sorcière, ou changer un dé de son Essence en n'importe quelle autre. Autant de fois qu'on veut payer.",
        "Les Sorts coûtent de la Magie et demandent une combinaison d'Essences."
      ]),
      "<h2>L'Ambiance</h2>",
      p("De 0 à 6 (3 au départ) : à quel point le Café est accueillant. Elle fixe notamment le nombre d'interactions possibles avec un Médium (1 + Ambiance).")
    ].join(""), 200),
    page(jid, "day", "La première Journée", [
      p("Le kit de démarrage enchaîne quatre Moments. Le système propose un bouton pour chacun dans l'onglet <b>Moments</b> du Café."),
      "<h3>1. Grande inauguration</h3>",
      p("Chacune agit seule pour réussir l'ouverture. Conséquence <b>Ambiance ±1</b> sur chaque test."),
      "<h3>2. Coup de feu !</h3>",
      p("La Guide lance 1d6 + 1d6 par Sorcière : l'humeur des clients et les Essences à obtenir. Le coven agit ensemble. Favorable : +1 Ambiance ; Défavorable : −1 par Essence manquante."),
      "<h3>3. Le premier Médium</h3>",
      p("On imagine le Médium (un Dé d'Essence peut aider), la Guide tire en secret ses 3 Essences. Les Sorcières lui parlent, puis préparent un Breuvage : +1 Magie par Essence juste, +1d6 si tout est juste."),
      "<h3>4. Le premier É.M.I.</h3>",
      p("Un Événement Magique Inattendu : souvent des objectifs préliminaires (un test chacune), puis un Sort lancé ensemble. En cas d'échec, le compte à rebours d'Incident baisse ; à 0, le prochain Moment est un Incident Magique."),
      "<h3>Fin de la Journée</h3>",
      p("Chaque Sorcière se demande quel Trait a compté (et s'il mérite d'être réécrit), et quelle Essence elle veut étudier, et comment.")
    ].join(""), 300),
    page(jid, "ume-cats", "É.M.I. : les chats esprits", [
      p("Attirés par le réveil de la Source, des chats esprits facétieux deviennent à moitié visibles et sèment la pagaille dans le Café, sous les yeux des derniers clients."),
      ul([
        "Il y a <b>1 chat pour chaque tranche de 3 Magie</b> dans la Source.",
        "<b>Objectif préliminaire</b> — rassembler les chats. Un test par Sorcière, agir seule. Essences : 2 ou 1 (ou autre selon l'action). Si tous les chats ne sont pas regroupés, le Glamour devient plus difficile (2 4 6 6).",
        "<b>Résolution</b> — lancer <b>Glamour</b> ensemble (coût 1, Essences 2 4)."
      ]),
      p("<b>Favorable</b> : les chats redeviennent invisibles aux gens ordinaires et continuent de jouer en paix."),
      p("<b>Défavorable</b> : les chats restent tangibles, les clients s'amusent et en parleront longtemps… Le compte à rebours d'Incident passe de 4 à 3 (bouton « Échec : Incident −1 »).")
    ].join(""), 400)
  ]
};

/* -------------------------------------------- */

const PACKS = { sorcieres: witches, sorts: spells, ingredients, tables, aide: [journal] };
for ( const [pack, docs] of Object.entries(PACKS) ) {
  const dir = `packs-src/${pack}`;
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  for ( const doc of docs ) {
    const slug = doc.name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    await writeFile(`${dir}/${slug}_${doc._id}.json`, `${JSON.stringify(doc, null, 2)}\n`);
  }
  console.log(`${dir} : ${docs.length} document(s)`);
}
