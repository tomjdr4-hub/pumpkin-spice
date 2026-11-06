/**
 * Constantes et utilitaires du système Pumpkin Spice.
 */
export const SYSTEM_ID = "pumpkin-spice";
export const SYSTEM_PATH = `systems/${SYSTEM_ID}`;

export const PS = {
  /** Les six Essences : numéro du d6 → clé de traduction, couleur, symbole. */
  ESSENCES: {
    1: { key: "authority", color: "#c2553f" },
    2: { key: "nature", color: "#5b9a4a" },
    3: { key: "empathy", color: "#d99a22" },
    4: { key: "stillness", color: "#5677b0" },
    5: { key: "imagination", color: "#a8559a" },
    6: { key: "wisdom", color: "#3a8585" }
  },

  /** Types de Sorcière du kit de démarrage et Essence associée. */
  ARCHETYPES: {
    green: 2,
    coven: 3,
    secular: 5,
    traditional: 6,
    custom: null
  },

  /** Où se trouve la Source. */
  LOCATIONS: ["countryside", "village", "city"],

  /** Ingrédients de base : Essence → clé de traduction. */
  BASE_INGREDIENTS: {
    1: "starryGinger",
    2: "energizedMint",
    3: "sunlitTurmeric",
    4: "evanescentChamomile",
    5: "crimsonCinnamon",
    6: "lunarLavender"
  },

  /** Valeurs de départ. */
  START: { magic: 10, vibe: 3, incident: 4, doses: 3 },
  VIBE_MAX: 6,
  TRAIT_MAX: 3,

  /** Question à laquelle répond chaque Trait, dans l'ordre de la fiche ("" : Trait libre). */
  TRAIT_QUESTIONS: ["self", "study", "magic", "familiar", "mundane", "others"],

  /** Conséquences mécaniques possibles d'un test. */
  CONSEQUENCES: ["none", "alone", "rush"],

  ICONS: {
    witch: `${SYSTEM_PATH}/assets/icons/witch.svg`,
    cafe: `${SYSTEM_PATH}/assets/icons/cafe.svg`,
    medium: `${SYSTEM_PATH}/assets/icons/medium.svg`,
    spell: "icons/magic/symbols/rune-sigil-black-pink.webp"
  }
};

/** Chemin de l'image d'une Essence. */
export function essenceIcon(e) {
  return `${SYSTEM_PATH}/assets/essences/${e}.svg`;
}

/** Nom traduit d'une Essence (1–6). */
export function essenceLabel(e) {
  const key = PS.ESSENCES[e]?.key;
  return key ? game.i18n.localize(`PS.Essence.${key}`) : "?";
}

/** Nom traduit de l'Ingrédient de base associé à une Essence. */
export function baseIngredientLabel(e) {
  return game.i18n.localize(`PS.Ingredient.${PS.BASE_INGREDIENTS[e]}`);
}

/** Ingrédient de base du kit (Essence fixée par le livre) : marqué, ou reconnu à son nom et son Essence. */
export function isBaseIngredient(item) {
  if ( item?.type !== "ingredient" ) return false;
  if ( item.system.base ) return true;
  const key = PS.BASE_INGREDIENTS[item.system.essence];
  return !!key && (item.name === baseIngredientLabel(item.system.essence));
}

/** L'Essence d'un Ingrédient : fixe pour les Ingrédients de base, sinon décidée par la Guide (MJ). */
export function canChangeIngredientEssence(item, user = game.user) {
  return !!user?.isGM && !isBaseIngredient(item);
}

/** « 2 4, 6-6 » → [2, 4, 6, 6]. */
export function parseEssences(value) {
  if ( Array.isArray(value) ) return value.map(Number).filter(e => e >= 1 && e <= 6);
  return String(value ?? "").match(/[1-6]/g)?.map(Number) ?? [];
}

/** [2, 4] → "2 4". */
export function formatEssences(list) {
  return (list ?? []).join(" ");
}

/** Liste d'options {value, label} pour les six Essences. */
export function essenceOptions() {
  return Object.keys(PS.ESSENCES).map(e => ({ value: Number(e), label: `${e} — ${essenceLabel(e)}`, icon: essenceIcon(e) }));
}

/**
 * Compare les dés obtenus aux Essences requises (multiensemble).
 * @param {number[]} values   Résultats des dés
 * @param {number[]} targets  Essences requises
 * @returns {{used: boolean[], met: boolean[], missing: number, favorable: boolean}}
 */
export function matchEssences(values, targets) {
  const used = values.map(() => false);
  const met = targets.map(t => {
    const i = values.findIndex((v, j) => !used[j] && (v === t));
    if ( i < 0 ) return false;
    used[i] = true;
    return true;
  });
  const missing = met.filter(m => !m).length;
  return { used, met, missing, favorable: targets.length > 0 && missing === 0 };
}

export function clamp(v, min, max) {
  return Math.min(Math.max(Number(v) || 0, min), max);
}
