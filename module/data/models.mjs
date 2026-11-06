/**
 * Modèles de données des Acteurs et Objets.
 */
import { PS } from "../config.mjs";

const fields = foundry.data.fields;

const essenceField = (initial = 1, options = {}) => new fields.NumberField({
  required: true, nullable: false, integer: true, min: 1, max: 6, initial, ...options
});

/* -------------------------------------------- */
/*  Sorcière                                    */
/* -------------------------------------------- */

export class WitchData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      archetype: new fields.StringField({ required: true, blank: false, initial: "custom", choices: Object.keys(PS.ARCHETYPES) }),
      essence: essenceField(2),
      pronouns: new fields.StringField({ initial: "" }),
      look: new fields.StringField({ initial: "" }),
      dream: new fields.StringField({ initial: "" }),
      paths: new fields.StringField({ initial: "" }),
      traits: new fields.ArrayField(new fields.SchemaField({
        question: new fields.StringField({ initial: "" }),
        name: new fields.StringField({ initial: "" }),
        level: new fields.NumberField({ required: true, nullable: false, integer: true, min: 1, max: PS.TRAIT_MAX, initial: 1 }),
        used: new fields.BooleanField({ initial: false })
      }), { initial: () => PS.TRAIT_QUESTIONS.map(question => ({ question, name: "", level: 1, used: false })) }),
      study: new fields.SchemaField({
        essence: new fields.NumberField({ required: false, nullable: true, integer: true, min: 1, max: 6, initial: null }),
        method: new fields.StringField({ initial: "" })
      }),
      biography: new fields.HTMLField({ initial: "" }),
      realization: new fields.HTMLField({ initial: "" }),
      notes: new fields.HTMLField({ initial: "" })
    };
  }

  /** @override Les Traits créés avant la v0.2 reçoivent la question de leur position. */
  static migrateData(source) {
    if ( Array.isArray(source.traits) ) {
      source.traits.forEach((t, i) => {
        if ( t && (typeof t === "object") && (t.question === undefined) ) t.question = PS.TRAIT_QUESTIONS[i] ?? "";
      });
    }
    return super.migrateData(source);
  }

  /** Traits renseignés, avec leur index d'origine. */
  get namedTraits() {
    return this.traits.map((t, index) => ({ ...t, index })).filter(t => t.name?.trim());
  }
}

/* -------------------------------------------- */
/*  Café (et sa Source)                         */
/* -------------------------------------------- */

export class CafeData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      vibe: new fields.NumberField({ required: true, nullable: false, integer: true, min: 0, max: PS.VIBE_MAX, initial: PS.START.vibe }),
      magic: new fields.NumberField({ required: true, nullable: false, integer: true, min: 0, initial: PS.START.magic }),
      incident: new fields.NumberField({ required: true, nullable: false, integer: true, min: 0, initial: PS.START.incident }),
      day: new fields.NumberField({ required: true, nullable: false, integer: true, min: 1, initial: 1 }),
      location: new fields.StringField({ initial: "" }),
      style: new fields.StringField({ initial: "" }),
      description: new fields.HTMLField({ initial: "" }),
      decorations: new fields.HTMLField({ initial: "" }),
      history: new fields.HTMLField({ initial: "" }),
      notes: new fields.HTMLField({ initial: "" })
    };
  }
}

/* -------------------------------------------- */
/*  Médium                                      */
/* -------------------------------------------- */

export class MediumData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      occupation: new fields.StringField({ initial: "" }),
      desires: new fields.StringField({ initial: "" }),
      countdown: new fields.NumberField({ required: true, nullable: false, integer: true, min: 0, initial: 0 }),
      bonded: new fields.BooleanField({ initial: false }),
      visits: new fields.NumberField({ required: true, nullable: false, integer: true, min: 0, initial: 0 }),
      description: new fields.HTMLField({ initial: "" }),
      notes: new fields.HTMLField({ initial: "" })
    };
  }
}

/* -------------------------------------------- */
/*  Sort                                        */
/* -------------------------------------------- */

export class SpellData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      spellType: new fields.StringField({ initial: "generic" }),
      cost: new fields.NumberField({ required: true, nullable: false, integer: true, min: 0, initial: 1 }),
      essences: new fields.StringField({ initial: "" }),
      altEssences: new fields.StringField({ initial: "" }),
      conditions: new fields.HTMLField({ initial: "" }),
      description: new fields.HTMLField({ initial: "" })
    };
  }
}

/* -------------------------------------------- */
/*  Ingrédient                                  */
/* -------------------------------------------- */

export class IngredientData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      essence: essenceField(1),
      quantity: new fields.NumberField({ required: true, nullable: false, integer: true, min: 0, initial: 3 }),
      base: new fields.BooleanField({ initial: false }),
      description: new fields.HTMLField({ initial: "" })
    };
  }
}
