/**
 * Fiches d'Acteurs et d'Objets (ApplicationV2).
 */
import { PS, SYSTEM_ID, SYSTEM_PATH, essenceIcon, essenceLabel, essenceOptions, parseEssences } from "./config.mjs";
import { getCafe } from "./fount.mjs";
import { castSpell, openCovenDialog, openTestDialog, rollNarrative, startRushHour } from "./tests.mjs";
import { interact, prepareBeverage, rollDesires, startCountdown } from "./medium.mjs";

const { HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;
const { ActorSheetV2, ItemSheetV2 } = foundry.applications.sheets;
const TextEditorImpl = () => foundry.applications.ux.TextEditor.implementation;
const T = `${SYSTEM_PATH}/templates`;
const t = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));

async function enrich(doc, fields) {
  const out = {};
  for ( const f of fields ) {
    out[f] = await TextEditorImpl().enrichHTML(doc.system[f] ?? "", { relativeTo: doc, secrets: doc.isOwner });
  }
  return out;
}

/** Sorcière de l'utilisateur : son personnage, sinon une Sorcière qu'il possède (au choix). */
export async function pickWitch() {
  const own = game.user.character;
  if ( own?.type === "witch" ) return own;
  const witches = game.actors.filter(a => (a.type === "witch") && a.isOwner);
  if ( witches.length === 1 ) return witches[0];
  if ( !witches.length ) {
    ui.notifications.warn("PS.Warn.NoWitch", { localize: true });
    return null;
  }
  const id = await DialogV2.prompt({
    window: { title: t("PS.Witch.Pick") },
    content: `<div class="form-group"><label>${t("TYPES.Actor.witch")}</label><select name="witch">${
      witches.map(w => `<option value="${w.id}">${foundry.utils.escapeHTML(w.name)}</option>`).join("")}</select></div>`,
    ok: { callback: (event, button) => button.form.elements.witch.value },
    rejectClose: false
  });
  return game.actors.get(id) ?? null;
}

/* -------------------------------------------- */
/*  Base                                        */
/* -------------------------------------------- */

class PSActorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["pumpkin-spice", "sheet", "actor"],
    window: { resizable: true },
    form: { submitOnChange: true },
    actions: {
      editItem: PSActorSheet.#onEditItem,
      deleteItem: PSActorSheet.#onDeleteItem,
      createItem: PSActorSheet.#onCreateItem,
      castSpell: PSActorSheet.#onCastSpell,
      castTogether: PSActorSheet.#onCastTogether,
      postItem: PSActorSheet.#onPostItem
    }
  };

  static HTML_FIELDS = [];

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = this.actor;
    Object.assign(context, {
      actor,
      system: actor.system,
      source: actor.system._source ?? actor._source.system,
      editable: this.isEditable,
      isGM: game.user.isGM,
      enriched: await enrich(actor, this.constructor.HTML_FIELDS),
      spells: actor.items.filter(i => i.type === "spell").sort((a, b) => a.name.localeCompare(b.name)).map(i => ({
        id: i.id, name: i.name, img: i.img, cost: i.system.cost,
        essences: parseEssences(i.system.essences).map(e => ({ icon: essenceIcon(e), label: essenceLabel(e) }))
      }))
    });
    return context;
  }

  /** @override */
  async _preparePartContext(partId, context, options) {
    context = await super._preparePartContext(partId, context, options);
    if ( context.tabs?.[partId] ) context.tab = context.tabs[partId];
    return context;
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    // Champs d'objets modifiables directement depuis la fiche (quantités…).
    this.element.querySelectorAll("[data-item-field]").forEach(input => {
      input.addEventListener("change", event => {
        event.stopPropagation();
        const item = this.actor.items.get(input.closest("[data-item-id]")?.dataset.itemId);
        const value = input.type === "number" ? Number(input.value) : input.value;
        item?.update({ [input.dataset.itemField]: value });
      });
    });
  }

  _item(target) {
    return this.actor.items.get(target.closest("[data-item-id]")?.dataset.itemId);
  }

  static #onEditItem(event, target) {
    this._item(target)?.sheet.render(true);
  }

  static async #onDeleteItem(event, target) {
    const item = this._item(target);
    if ( !item ) return;
    const ok = await DialogV2.confirm({
      window: { title: t("PS.Sheet.Delete") },
      content: `<p>${t("PS.Sheet.DeleteConfirm", { name: foundry.utils.escapeHTML(item.name) })}</p>`,
      rejectClose: false
    });
    if ( ok ) await item.delete();
  }

  static async #onCreateItem(event, target) {
    const type = target.dataset.type;
    const [item] = await this.actor.createEmbeddedDocuments("Item", [{ name: t(`TYPES.Item.${type}`), type }]);
    item?.sheet.render(true);
  }

  static #onCastSpell(event, target) {
    const item = this._item(target);
    if ( !item ) return;
    if ( this.actor.type === "witch" ) return castSpell(item, this.actor);
    return castSpell(item, null, { together: true });
  }

  static #onCastTogether(event, target) {
    const item = this._item(target);
    if ( item ) castSpell(item, this.actor.type === "witch" ? this.actor : null, { together: true });
  }

  static async #onPostItem(event, target) {
    const item = this._item(target);
    if ( !item ) return;
    const description = await TextEditorImpl().enrichHTML(item.system.description ?? "", { relativeTo: item });
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div class="pumpkin-spice ps-item-msg"><header><img src="${item.img}"><h3>${foundry.utils.escapeHTML(item.name)}</h3></header>${description}</div>`
    });
  }
}

/* -------------------------------------------- */
/*  Sorcière                                    */
/* -------------------------------------------- */

export class WitchSheet extends PSActorSheet {
  static DEFAULT_OPTIONS = {
    classes: ["witch"],
    position: { width: 720, height: 760 },
    actions: {
      rollTrait: WitchSheet.#onRollTrait,
      rollNoTrait: WitchSheet.#onRollNoTrait,
      covenTest: WitchSheet.#onCovenTest,
      setLevel: WitchSheet.#onSetLevel,
      addTrait: WitchSheet.#onAddTrait,
      removeTrait: WitchSheet.#onRemoveTrait,
      openCafe: () => getCafe()?.sheet.render(true),
      narrative: () => rollNarrative(1)
    }
  };

  static HTML_FIELDS = ["biography", "realization", "notes"];

  static PARTS = {
    header: { template: `${T}/actor/witch-header.hbs` },
    tabs: { template: "templates/generic/tab-navigation.hbs" },
    traits: { template: `${T}/actor/witch-traits.hbs`, scrollable: [""] },
    realization: { template: `${T}/actor/witch-realization.hbs`, scrollable: [""] },
    biography: { template: `${T}/actor/witch-biography.hbs`, scrollable: [""] }
  };

  static TABS = {
    primary: {
      tabs: [
        { id: "traits", icon: "fa-solid fa-hat-wizard" },
        { id: "realization", icon: "fa-solid fa-seedling" },
        { id: "biography", icon: "fa-solid fa-book-open" }
      ],
      initial: "traits",
      labelPrefix: "PS.Tab"
    }
  };

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const s = this.actor.system;
    const cafe = getCafe();
    Object.assign(context, {
      essenceIcon: essenceIcon(s.essence),
      essenceLabel: essenceLabel(s.essence),
      essences: essenceOptions(),
      studyEssences: [{ value: "", label: "—" }, ...essenceOptions()],
      archetypes: Object.keys(PS.ARCHETYPES).map(k => ({ value: k, label: t(`PS.Archetype.${k}`) })),
      traits: s.traits.map((tr, index) => ({
        ...tr, index,
        questions: [{ value: "", label: t("PS.Witch.Question.none") },
          ...PS.TRAIT_QUESTIONS.map(q => ({ value: q, label: t(`PS.Witch.Question.${q}`) }))],
        pips: Array.from({ length: PS.TRAIT_MAX }, (_, i) => ({ value: i + 1, on: i < tr.level })),
        dice: 1 + tr.level
      })),
      cafe: cafe ? { name: cafe.name, magic: cafe.system.magic, vibe: cafe.system.vibe } : null,
      magicRule: t("PS.Witch.MagicRule", { essence: essenceLabel(s.essence), n: s.essence })
    });
    return context;
  }

  /** @override */
  _processFormData(event, form, formData) {
    const data = super._processFormData(event, form, formData);
    const sys = data.system ?? {};
    // Traits : objet indexé → tableau.
    if ( sys.traits && !Array.isArray(sys.traits) ) {
      const current = this.actor.system.toObject().traits;
      for ( const [k, v] of Object.entries(sys.traits) ) current[Number(k)] = { ...current[Number(k)], ...v };
      sys.traits = current;
    }
    // Choisir un type de Sorcière fixe son Essence.
    if ( sys.archetype && (sys.archetype !== this.actor.system.archetype) && PS.ARCHETYPES[sys.archetype] ) {
      sys.essence = PS.ARCHETYPES[sys.archetype];
    }
    if ( sys.study && (sys.study.essence === "") ) sys.study.essence = null;
    return data;
  }

  static #onRollTrait(event, target) {
    const index = Number(target.closest("[data-index]").dataset.index);
    const trait = this.actor.system.traits[index];
    if ( !trait?.name?.trim() ) return ui.notifications.warn("PS.Warn.EmptyTrait", { localize: true });
    openTestDialog(this.actor, { traitIndex: index });
  }

  static #onRollNoTrait() {
    openTestDialog(this.actor, { traitIndex: -1 });
  }

  static #onCovenTest() {
    openCovenDialog({ leaderId: this.actor.id });
  }

  static async #onSetLevel(event, target) {
    const index = Number(target.closest("[data-index]").dataset.index);
    const traits = this.actor.system.toObject().traits;
    traits[index].level = Number(target.dataset.value);
    await this.actor.update({ "system.traits": traits });
  }

  static async #onAddTrait() {
    const traits = this.actor.system.toObject().traits;
    traits.push({ question: "", name: "", level: 1, used: false });
    await this.actor.update({ "system.traits": traits });
  }

  static async #onRemoveTrait(event, target) {
    const index = Number(target.closest("[data-index]").dataset.index);
    const traits = this.actor.system.toObject().traits;
    traits.splice(index, 1);
    await this.actor.update({ "system.traits": traits });
  }
}

/* -------------------------------------------- */
/*  Café                                        */
/* -------------------------------------------- */

export class CafeSheet extends PSActorSheet {
  static DEFAULT_OPTIONS = {
    classes: ["cafe"],
    position: { width: 1180, height: 820 },
    actions: {
      setVibe: CafeSheet.#onSetVibe,
      setIncident: CafeSheet.#onSetIncident,
      setIngredientEssence: CafeSheet.#onSetIngredientEssence,
      adjust: CafeSheet.#onAdjust,
      setActive: CafeSheet.#onSetActive,
      quantity: CafeSheet.#onQuantity,
      narrative: CafeSheet.#onNarrative,
      opening: CafeSheet.#onOpening,
      rush: () => startRushHour(),
      together: () => openCovenDialog(),
      newMedium: CafeSheet.#onNewMedium,
      beverage: () => prepareBeverage(),
      ume: CafeSheet.#onUME,
      endDay: CafeSheet.#onEndDay
    }
  };

  static HTML_FIELDS = ["description", "history", "decorations", "notes"];

  static PARTS = {
    tabs: { template: "templates/generic/tab-navigation.hbs" },
    sheet: { template: `${T}/actor/cafe-sheet.hbs`, scrollable: [".ps-panel-pantry", ".ps-panel-right"] },
    moments: { template: `${T}/actor/cafe-moments.hbs`, scrollable: [""] },
    notes: { template: `${T}/actor/cafe-notes.hbs`, scrollable: [""] }
  };

  static TABS = {
    primary: {
      tabs: [
        { id: "sheet", icon: "fa-solid fa-mug-saucer" },
        { id: "moments", icon: "fa-solid fa-clock" },
        { id: "notes", icon: "fa-solid fa-feather" }
      ],
      initial: "sheet",
      labelPrefix: "PS.Tab"
    }
  };

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const s = this.actor.system;
    const activeId = game.settings.get(SYSTEM_ID, "activeCafe");
    const ingredients = this.actor.items.filter(i => i.type === "ingredient")
      .sort((a, b) => (a.system.essence - b.system.essence) || a.name.localeCompare(b.name));
    Object.assign(context, {
      pumpkins: Array.from({ length: PS.VIBE_MAX }, (_, i) => ({ value: i + 1, on: i + 1 <= s.vibe, current: i + 1 === s.vibe })),
      incidentSteps: CafeSheet.#incidentSteps(s.incident),
      isActive: (activeId === this.actor.id) || (!game.actors.get(activeId) && getCafe()?.id === this.actor.id),
      fountEmpty: s.magic <= 0,
      incidentNow: s.incident <= 0,
      mediumInteractions: 1 + s.vibe,
      locations: [{ value: "", label: "—" }, ...PS.LOCATIONS.map(l => ({ value: l, label: t(`PS.Location.${l}`) }))],
      essenceColumns: [1, 2, 3, 4, 5, 6].map(e => ({ value: e, icon: essenceIcon(e), label: essenceLabel(e) })),
      pantryRows: ingredients.map(i => ({
        id: i.id, name: i.name, quantity: i.system.quantity,
        cells: [1, 2, 3, 4, 5, 6].map(e => ({ value: e, on: e === i.system.essence }))
      })),
      fillerRows: Array.from({ length: Math.max(CafeSheet.PANTRY_ROWS - ingredients.length, 1) }, (_, i) => ({ add: (i === 0) && this.isEditable })),
      witches: game.actors.filter(a => a.type === "witch").map(w => ({ id: w.id, name: w.name, img: w.img, essenceIcon: essenceIcon(w.system.essence) })),
      mediums: game.actors.filter(a => (a.type === "medium") && a.visible).map(m => ({ id: m.id, name: m.name, img: m.img, bonded: m.system.bonded }))
    });
    return context;
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    this.element.querySelectorAll("[data-open-actor]").forEach(el => {
      el.addEventListener("click", () => game.actors.get(el.dataset.openActor)?.sheet.render(true));
    });
  }

  /** Nombre de lignes du garde-manger, comme sur la fiche papier. */
  static PANTRY_ROWS = 20;

  /** Cases du compte à rebours d'Incident : 4 → 0 (ou plus si le compteur dépasse 4). */
  static #incidentSteps(incident) {
    const top = Math.max(PS.START.incident, incident);
    return Array.from({ length: top + 1 }, (_, i) => {
      const value = top - i;
      return { value, current: value === incident, past: value > incident, last: value === 0, fill: `${Math.round((value / top) * 100)}%` };
    });
  }

  static async #onSetIncident(event, target) {
    await this.actor.update({ "system.incident": Number(target.dataset.value) });
  }

  static async #onSetIngredientEssence(event, target) {
    const item = this._item(target);
    if ( item ) await item.update({ "system.essence": Number(target.dataset.value) });
  }

  static async #onSetVibe(event, target) {
    const value = Number(target.dataset.value);
    await this.actor.update({ "system.vibe": value === this.actor.system.vibe ? Math.max(value - 1, 0) : value });
  }

  static async #onAdjust(event, target) {
    const { field, delta } = target.dataset;
    const min = field === "day" ? 1 : 0;
    const current = foundry.utils.getProperty(this.actor.system, field);
    await this.actor.update({ [`system.${field}`]: Math.max(current + Number(delta), min) });
  }

  static async #onSetActive() {
    if ( !game.user.isGM ) return;
    await game.settings.set(SYSTEM_ID, "activeCafe", this.actor.id);
    ui.notifications.info(t("PS.Cafe.NowActive", { name: this.actor.name }));
    this.render();
  }

  static async #onQuantity(event, target) {
    const item = this._item(target);
    if ( item ) await item.update({ "system.quantity": Math.max(item.system.quantity + Number(target.dataset.delta), 0) });
  }

  static async #onNarrative() {
    const n = await DialogV2.prompt({
      window: { title: t("PS.Card.Narrative") },
      content: `<div class="form-group"><label>${t("PS.Cafe.HowMany")}</label><input type="number" name="n" value="1" min="1" max="12"></div>`,
      ok: { callback: (event, button) => button.form.elements.n.valueAsNumber },
      rejectClose: false
    });
    if ( n ) rollNarrative(n);
  }

  static async #onOpening() {
    const witch = await pickWitch();
    if ( witch ) openTestDialog(witch, { consequence: "alone", title: t("PS.Moment.opening") });
  }

  static async #onNewMedium() {
    if ( !game.user.isGM ) return;
    const medium = await Actor.implementation.create({ name: t("PS.Medium.New"), type: "medium" });
    medium?.sheet.render(true);
  }

  static async #onUME() {
    const ok = await DialogV2.confirm({
      window: { title: t("PS.Moment.ume") },
      content: `<p>${t("PS.UME.Confirm")}</p>`,
      rejectClose: false
    });
    if ( !ok ) return;
    const incident = Math.max(this.actor.system.incident - 1, 0);
    await this.actor.update({ "system.incident": incident });
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div class="pumpkin-spice ps-fount-msg"><p class="ps-reason">${t("PS.UME.Failed")}</p><p>${t("PS.Cafe.incident")} → <b>${incident}</b></p>${
        incident <= 0 ? `<p class="ps-warn">${t("PS.Warn.Incident")}</p>` : ""}</div>`
    });
  }

  static async #onEndDay() {
    const ok = await DialogV2.confirm({
      window: { title: t("PS.Moment.endDay") },
      content: `<p>${t("PS.EndDay.Confirm", { day: this.actor.system.day })}</p>`,
      rejectClose: false
    });
    if ( !ok ) return;
    const day = this.actor.system.day;
    await this.actor.update({ "system.day": day + 1 });
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div class="pumpkin-spice ps-end-day"><h3>${t("PS.EndDay.Title", { day })}</h3>
        <ul><li>${t("PS.EndDay.Q1")}</li><li>${t("PS.EndDay.Q2")}</li></ul></div>`
    });
  }
}

/* -------------------------------------------- */
/*  Médium                                      */
/* -------------------------------------------- */

export class MediumSheet extends PSActorSheet {
  static DEFAULT_OPTIONS = {
    classes: ["medium"],
    position: { width: 620, height: 720 },
    actions: {
      rollDesires: MediumSheet.#onRollDesires,
      startCountdown: MediumSheet.#onStart,
      interact: MediumSheet.#onInteract,
      inspiration: () => rollNarrative(1, t("PS.Medium.WhoIs")),
      beverage: MediumSheet.#onBeverage
    }
  };

  static HTML_FIELDS = ["description", "notes"];

  static PARTS = {
    body: { template: `${T}/actor/medium.hbs`, scrollable: [""] }
  };

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const desires = parseEssences(this.actor.system.desires);
    Object.assign(context, {
      desires: desires.map(e => ({ icon: essenceIcon(e), label: essenceLabel(e) })),
      prompts: Object.entries(PS.ESSENCES).map(([e, c]) => ({ icon: essenceIcon(e), label: essenceLabel(e), text: t(`PS.MediumPrompt.${c.key}`) })),
      interactions: 1 + (getCafe()?.system.vibe ?? 0)
    });
    return context;
  }

  static #onRollDesires() {
    return rollDesires(this.actor);
  }

  static #onStart() {
    return startCountdown(this.actor);
  }

  static #onInteract() {
    return interact(this.actor);
  }

  static #onBeverage() {
    return prepareBeverage({ mediumId: this.actor.id });
  }
}

/* -------------------------------------------- */
/*  Objets                                      */
/* -------------------------------------------- */

class PSItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["pumpkin-spice", "sheet", "item"],
    position: { width: 520, height: 560 },
    window: { resizable: true },
    form: { submitOnChange: true }
  };

  static HTML_FIELDS = ["description"];

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const item = this.item;
    Object.assign(context, {
      item, system: item.system, editable: this.isEditable,
      essences: essenceOptions(),
      essenceIcon: essenceIcon(item.system.essence ?? 1),
      enriched: await enrich(item, this.constructor.HTML_FIELDS)
    });
    return context;
  }
}

export class SpellSheet extends PSItemSheet {
  static DEFAULT_OPTIONS = {
    classes: ["spell"],
    actions: { cast: SpellSheet.#onCast }
  };

  static HTML_FIELDS = ["description", "conditions"];
  static PARTS = { body: { template: `${T}/item/spell.hbs`, scrollable: [""] } };

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const icons = list => parseEssences(list).map(e => ({ icon: essenceIcon(e), label: essenceLabel(e) }));
    context.essenceIcons = icons(this.item.system.essences);
    context.altIcons = icons(this.item.system.altEssences);
    context.types = ["generic", "personal"].map(v => ({ value: v, label: t(`PS.Spell.type.${v}`) }));
    return context;
  }

  static #onCast() {
    const owner = this.item.parent;
    castSpell(this.item, owner?.type === "witch" ? owner : null, { together: owner?.type !== "witch" });
  }
}

export class IngredientSheet extends PSItemSheet {
  static PARTS = { body: { template: `${T}/item/ingredient.hbs`, scrollable: [""] } };
}
