/**
 * Tests d'Essence (agir seule / agir ensemble), Sorts, jets narratifs, Coup de feu,
 * cartes de chat et usage de la Magie pour transformer les dés.
 */
import { PS, SYSTEM_ID, SYSTEM_PATH, essenceIcon, essenceLabel, essenceOptions, matchEssences, parseEssences } from "./config.mjs";
import { applyChatMode, changeCafe, exec, getCafe, registerHandler } from "./fount.mjs";

const { DialogV2 } = foundry.applications.api;
const renderTemplate = (...args) => foundry.applications.handlebars.renderTemplate(...args);
const TEMPLATES = {
  card: `${SYSTEM_PATH}/templates/chat/test-card.hbs`,
  test: `${SYSTEM_PATH}/templates/dialog/test.hbs`,
  coven: `${SYSTEM_PATH}/templates/dialog/coven.hbs`,
  magic: `${SYSTEM_PATH}/templates/dialog/magic.hbs`
};
const t = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));

/* -------------------------------------------- */
/*  Carte de chat                               */
/* -------------------------------------------- */

/** Prépare l'affichage d'une carte à partir de son état. */
function cardContext(state) {
  const values = state.dice.map(d => d.value);
  const targets = state.targets ?? [];
  const match = matchEssences(values, targets);
  const hasTargets = targets.length > 0;
  const ctx = {
    ...state,
    hasTargets,
    favorable: match.favorable,
    missing: match.missing,
    dice: state.dice.map((d, i) => ({
      ...d, index: i, icon: essenceIcon(d.value), label: essenceLabel(d.value),
      used: hasTargets && match.used[i], changed: d.value !== d.original,
      originalIcon: essenceIcon(d.original)
    })),
    targetList: targets.map((e, i) => ({ value: e, icon: essenceIcon(e), label: essenceLabel(e), met: match.met[i] })),
    leader: state.participants?.find(p => p.leader),
    helpers: state.participants?.filter(p => !p.leader) ?? [],
    canMagic: hasTargets && !state.applied && (state.participants?.length > 0),
    narrative: state.kind === "narrative",
    rushSetup: state.kind === "rush-setup",
    hints: state.kind === "narrative" ? [...new Set(values)].sort().map(v => ({
      icon: essenceIcon(v), label: essenceLabel(v), hint: t(`PS.EssenceHint.${PS.ESSENCES[v].key}`)
    })) : []
  };
  // Conséquence sur l'Ambiance.
  if ( hasTargets && (state.consequence !== "none") ) {
    const delta = consequenceDelta(state, match);
    ctx.consequenceDelta = delta;
    ctx.consequenceLabel = t(delta >= 0 ? "PS.Card.VibeUp" : "PS.Card.VibeDown", { n: Math.abs(delta) });
  }
  return ctx;
}

/** Variation d'Ambiance due au test : ±1 (agir seule), +1 / −Essences manquantes (Coup de feu). */
function consequenceDelta(state, match) {
  if ( state.consequence === "alone" ) return match.favorable ? 1 : -1;
  if ( state.consequence === "rush" ) return match.favorable ? 1 : -match.missing;
  return 0;
}

async function renderCard(state) {
  return renderTemplate(TEMPLATES.card, cardContext(state));
}

/** Crée le message de chat d'un test. */
async function postCard(state, { roll, speaker } = {}) {
  const data = {
    speaker: speaker ?? ChatMessage.getSpeaker(),
    content: await renderCard(state),
    flags: { [SYSTEM_ID]: { card: state } }
  };
  if ( roll ) data.rolls = [roll];
  applyChatMode(data);
  return ChatMessage.create(data);
}

/** Lance n dés d'Essence et renvoie le jet et les résultats. */
async function rollDice(n) {
  const roll = await new Roll(`${Math.max(n, 1)}d6`).evaluate();
  const dice = roll.dice[0].results.map(r => ({ value: r.result, original: r.result }));
  return { roll, dice };
}

/* -------------------------------------------- */
/*  Jets                                        */
/* -------------------------------------------- */

/**
 * Effectue un test d'Essence et publie la carte.
 * @param {object} opts
 * @param {object[]} opts.participants  [{actorId, name, img, essence, trait, level, leader}]
 * @param {number[]} opts.targets       Essences requises
 * @param {string} opts.consequence     none | alone | rush
 * @param {object} [opts.spell]         {name, cost}
 */
export async function rollEssenceTest({ title, participants, targets = [], consequence = "none", spell = null }) {
  // Sort : on dépense d'abord le coût en Magie.
  if ( spell?.cost ) {
    const cafe = getCafe();
    if ( cafe && (cafe.system.magic < spell.cost) ) {
      ui.notifications.warn("PS.Warn.NotEnoughMagic", { localize: true });
      return null;
    }
    await changeCafe({ magic: -spell.cost, reason: t("PS.Card.SpellCost", { name: spell.name }) });
  }
  const n = 1 + participants.reduce((s, p) => s + (p.level || 0), 0);
  const { roll, dice } = await rollDice(n);
  const leader = participants.find(p => p.leader) ?? participants[0];
  const actor = game.actors.get(leader?.actorId);
  const state = {
    kind: "test", title, participants, dice, targets, consequence,
    together: participants.length > 1, spell, applied: null, log: []
  };
  return postCard(state, { roll, speaker: ChatMessage.getSpeaker({ actor }) });
}

/** Jet narratif de n Dés d'Essence (inspiration). */
export async function rollNarrative(n = 1, title = null) {
  const { roll, dice } = await rollDice(n);
  const state = { kind: "narrative", title: title ?? t("PS.Card.Narrative"), dice, targets: [], participants: [], consequence: "none", log: [] };
  return postCard(state, { roll });
}

/** Coup de feu : la Guide lance 1d6 + 1d6 par Sorcière en jeu. */
export async function startRushHour() {
  const witches = defaultCoven();
  const count = await DialogV2.prompt({
    window: { title: t("PS.Rush.Title") },
    content: `<p>${t("PS.Rush.Hint")}</p><div class="form-group"><label>${t("PS.Rush.Witches")}</label>
      <input type="number" name="count" value="${witches.length || 4}" min="1" max="12"></div>`,
    ok: { label: t("PS.Rush.Roll"), callback: (event, button) => button.form.elements.count.valueAsNumber },
    rejectClose: false
  });
  if ( !count ) return null;
  const { roll, dice } = await rollDice(1 + count);
  const state = {
    kind: "rush-setup", title: t("PS.Rush.Title"), dice, targets: dice.map(d => d.value),
    participants: [], consequence: "rush", log: []
  };
  return postCard(state, { roll });
}

/* -------------------------------------------- */
/*  Fenêtres de test                            */
/* -------------------------------------------- */

/** Données communes : compteurs d'Essences requises et conséquences. */
function targetContext(targets = [], consequence = "none") {
  const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  for ( const e of targets ) counts[e] += 1;
  return {
    essences: essenceOptions().map(o => ({ ...o, count: counts[o.value] })),
    consequences: PS.CONSEQUENCES.map(c => ({ value: c, label: t(`PS.Consequence.${c}`), selected: c === consequence }))
  };
}

function readTargets(data) {
  const targets = [];
  for ( let e = 1; e <= 6; e++ ) {
    const n = Math.max(0, Number(data[`t${e}`]) || 0);
    for ( let i = 0; i < n; i++ ) targets.push(e);
  }
  return targets;
}

function witchParticipant(actor, traitIndex, leader = false) {
  const trait = actor.system.traits[traitIndex];
  const named = trait?.name?.trim();
  return {
    actorId: actor.id, name: actor.name, img: actor.img, essence: actor.system.essence,
    trait: named ? trait.name : t("PS.Test.NoTrait"), level: named ? trait.level : 0, leader
  };
}

function traitOptions(actor, selected = null) {
  const opts = actor.system.namedTraits.map(tr => ({
    value: tr.index, label: `${tr.name} (${tr.level})`, selected: tr.index === selected
  }));
  opts.push({ value: -1, label: t("PS.Test.NoTraitOption"), selected: selected === -1 });
  return opts;
}

/** Agir seule : choisir le Trait, les Essences visées, la conséquence. */
export async function openTestDialog(actor, { traitIndex = null, targets = [], consequence = "none", title = null, spell = null } = {}) {
  const content = await renderTemplate(TEMPLATES.test, {
    traits: traitOptions(actor, traitIndex), spell, ...targetContext(targets, consequence)
  });
  const data = await DialogV2.prompt({
    window: { title: title ?? t("PS.Test.Title", { name: actor.name }), icon: "fa-solid fa-dice-d6" },
    classes: ["pumpkin-spice", "ps-dialog"],
    position: { width: 460 },
    content,
    ok: { label: t("PS.Test.Roll"), icon: "fa-solid fa-dice", callback: (event, button) => new foundry.applications.ux.FormDataExtended(button.form).object },
    rejectClose: false
  });
  if ( !data ) return null;
  const idx = Number(data.trait);
  return rollEssenceTest({
    title: title ?? (spell ? spell.name : t("PS.Test.Alone")),
    participants: [witchParticipant(actor, idx, true)],
    targets: readTargets(data),
    consequence: data.consequence,
    spell
  });
}

/** Sorcières proposées par défaut : celles attribuées aux utilisateurs, sinon toutes. */
function defaultCoven() {
  const witches = game.actors.filter(a => a.type === "witch");
  const assigned = witches.filter(a => game.users.some(u => u.character?.id === a.id));
  return assigned.length ? assigned : witches;
}

/** Agir ensemble : une Sorcière mène, les autres apportent les dés de leur Trait. */
export async function openCovenDialog({ targets = [], consequence = "none", title = null, spell = null, leaderId = null } = {}) {
  const witches = game.actors.filter(a => a.type === "witch").sort((a, b) => a.name.localeCompare(b.name));
  if ( !witches.length ) {
    ui.notifications.warn("PS.Warn.NoWitch", { localize: true });
    return null;
  }
  const defaults = new Set(defaultCoven().map(a => a.id));
  const leader = leaderId ?? game.user.character?.id ?? witches.find(w => defaults.has(w.id))?.id;
  const content = await renderTemplate(TEMPLATES.coven, {
    witches: witches.map(w => ({
      id: w.id, name: w.name, img: w.img, essence: w.system.essence, essenceIcon: essenceIcon(w.system.essence),
      checked: defaults.has(w.id) || (w.id === leader), leader: w.id === leader, traits: traitOptions(w)
    })),
    spell, ...targetContext(targets, consequence)
  });
  const data = await DialogV2.prompt({
    window: { title: title ?? t("PS.Coven.Title"), icon: "fa-solid fa-people-group" },
    classes: ["pumpkin-spice", "ps-dialog"],
    position: { width: 560 },
    content,
    ok: { label: t("PS.Test.Roll"), icon: "fa-solid fa-dice", callback: (event, button) => new foundry.applications.ux.FormDataExtended(button.form).object },
    rejectClose: false
  });
  if ( !data ) return null;
  const participants = [];
  for ( const w of witches ) {
    const isLeader = data.leader === w.id;
    if ( !data[`on.${w.id}`] && !isLeader ) continue;
    participants.push(witchParticipant(w, Number(data[`trait.${w.id}`]), isLeader));
  }
  if ( !participants.length ) return null;
  if ( !participants.some(p => p.leader) ) participants[0].leader = true;
  participants.sort((a, b) => b.leader - a.leader);
  return rollEssenceTest({
    title: title ?? (spell ? spell.name : t("PS.Test.Together")),
    participants, targets: readTargets(data), consequence: data.consequence, spell
  });
}

/** Lance un Sort (seule si une Sorcière est donnée, sinon ensemble). */
export async function castSpell(item, actor = null, { together = false } = {}) {
  const s = item.system;
  const alt = parseEssences(s.altEssences);
  let targets = parseEssences(s.essences);
  if ( alt.length ) {
    const ideal = await DialogV2.wait({
      window: { title: item.name, icon: "fa-solid fa-wand-sparkles" },
      classes: ["pumpkin-spice", "ps-dialog"],
      content: `<p>${t("PS.Spell.ConditionsAsk")}</p><div class="ps-conditions">${s.conditions || ""}</div>`,
      buttons: [
        { action: "ideal", label: t("PS.Spell.Ideal"), default: true },
        { action: "hard", label: t("PS.Spell.NotIdeal") }
      ],
      rejectClose: false
    });
    if ( !ideal ) return null;
    if ( ideal === "hard" ) targets = alt;
  }
  const spell = { name: item.name, cost: s.cost, uuid: item.uuid };
  if ( actor && !together ) return openTestDialog(actor, { targets, spell, title: item.name });
  return openCovenDialog({ targets, spell, title: item.name, leaderId: actor?.id });
}

/* -------------------------------------------- */
/*  Magie : transformer un dé                   */
/* -------------------------------------------- */

/** Une Sorcière liée à E peut changer un dé en E, ou un dé E en n'importe quelle Essence. */
export function allowedTransforms(witchEssence, dieValue) {
  if ( dieValue === witchEssence ) return [1, 2, 3, 4, 5, 6].filter(e => e !== dieValue);
  return [witchEssence];
}

async function openMagicDialog(message) {
  const state = message.getFlag(SYSTEM_ID, "card");
  if ( !state ) return;
  const cafe = getCafe();
  if ( !cafe ) return ui.notifications.warn("PS.Warn.NoCafe", { localize: true });
  if ( cafe.system.magic < 1 ) return ui.notifications.warn("PS.Warn.NotEnoughMagic", { localize: true });
  const witches = state.participants.filter(p => {
    const a = game.actors.get(p.actorId);
    return a && (game.user.isGM || a.isOwner);
  });
  if ( !witches.length ) return ui.notifications.warn("PS.Warn.NotParticipant", { localize: true });

  const content = await renderTemplate(TEMPLATES.magic, {
    magic: cafe.system.magic,
    witches: witches.map((w, i) => ({ ...w, essenceIcon: essenceIcon(w.essence), checked: i === 0 })),
    dice: state.dice.map((d, i) => ({ index: i, value: d.value, icon: essenceIcon(d.value), label: essenceLabel(d.value) })),
    essences: essenceOptions()
  });

  const result = await DialogV2.prompt({
    window: { title: t("PS.Magic.Title"), icon: "fa-solid fa-sparkles" },
    classes: ["pumpkin-spice", "ps-dialog", "ps-magic-dialog"],
    position: { width: 480 },
    content,
    ok: { label: t("PS.Magic.Spend"), icon: "fa-solid fa-wand-magic-sparkles", callback: (event, button) => new foundry.applications.ux.FormDataExtended(button.form).object },
    render: (event, dialog) => bindMagicDialog(dialog.element, state, witches),
    rejectClose: false
  });
  if ( !result ) return;
  const witch = witches.find(w => w.actorId === result.witch);
  const index = Number(result.die);
  const value = Number(result.value);
  if ( !witch || !state.dice[index] || !allowedTransforms(witch.essence, state.dice[index].value).includes(value) ) {
    return ui.notifications.warn("PS.Warn.IllegalMagic", { localize: true });
  }
  return exec("magicTransform", { messageId: message.id, actorId: witch.actorId, index, value },
    message.isOwner && cafe.isOwner);
}

/** Met à jour dynamiquement les Essences autorisées selon la Sorcière et le dé choisis. */
function bindMagicDialog(root, state, witches) {
  const form = root.querySelector("form") ?? root;
  const refresh = () => {
    const witchId = form.querySelector("[name=witch]:checked")?.value;
    const witch = witches.find(w => w.actorId === witchId);
    const index = Number(form.querySelector("[name=die]:checked")?.value ?? -1);
    const die = state.dice[index];
    const allowed = (witch && die) ? allowedTransforms(witch.essence, die.value) : [];
    let first = null;
    for ( const input of form.querySelectorAll("[name=value]") ) {
      const ok = allowed.includes(Number(input.value));
      input.disabled = !ok;
      input.closest("label")?.classList.toggle("disabled", !ok);
      if ( !ok ) input.checked = false;
      else first ??= input;
    }
    if ( first && !form.querySelector("[name=value]:checked") ) first.checked = true;
  };
  form.addEventListener("change", refresh);
  refresh();
}

registerHandler("magicTransform", async ({ messageId, actorId, index, value, userId }) => {
  const message = game.messages.get(messageId);
  const state = foundry.utils.deepClone(message?.getFlag(SYSTEM_ID, "card"));
  if ( !state || state.applied ) return;
  const user = game.users.get(userId);
  const actor = game.actors.get(actorId);
  const participant = state.participants.find(p => p.actorId === actorId);
  if ( !actor || !participant || !actor.testUserPermission(user, "OWNER") ) return;
  const die = state.dice[index];
  if ( !die || !allowedTransforms(participant.essence, die.value).includes(value) ) return;
  const cafe = getCafe();
  if ( !cafe || (cafe.system.magic < 1) ) {
    ui.notifications.warn("PS.Warn.NotEnoughMagic", { localize: true });
    return;
  }
  state.log.push({ name: participant.name, from: die.value, to: value, fromIcon: essenceIcon(die.value), toIcon: essenceIcon(value) });
  die.value = value;
  await cafe.update({ "system.magic": cafe.system.magic - 1 });
  await message.update({ content: await renderCard(state), [`flags.${SYSTEM_ID}.card`]: state });
  if ( cafe.system.magic <= 0 ) {
    await ChatMessage.create({ content: `<div class="pumpkin-spice"><p class="ps-warn">${t("PS.Warn.FountEmpty")}</p></div>` });
  }
});

/* -------------------------------------------- */
/*  Conséquences                                */
/* -------------------------------------------- */

registerHandler("applyConsequence", async ({ messageId }) => {
  const message = game.messages.get(messageId);
  const state = foundry.utils.deepClone(message?.getFlag(SYSTEM_ID, "card"));
  if ( !state || state.applied ) return;
  const match = matchEssences(state.dice.map(d => d.value), state.targets);
  const vibe = consequenceDelta(state, match);
  state.applied = { vibe };
  await message.update({ content: await renderCard(state), [`flags.${SYSTEM_ID}.card`]: state });
  const cafe = getCafe();
  if ( cafe && vibe ) {
    const s = cafe.system;
    await cafe.update({ "system.vibe": Math.min(Math.max(s.vibe + vibe, 0), PS.VIBE_MAX) });
  }
});

/* -------------------------------------------- */
/*  Boutons des cartes                          */
/* -------------------------------------------- */

export function onRenderChatMessage(message, html) {
  const state = message.getFlag(SYSTEM_ID, "card");
  if ( !state ) return;
  html.querySelectorAll("[data-ps-action]").forEach(button => {
    button.addEventListener("click", async event => {
      event.preventDefault();
      const cafe = getCafe();
      switch ( button.dataset.psAction ) {
        case "magic":
          return openMagicDialog(message);
        case "consequence":
          if ( !game.user.isGM && !message.isOwner ) return ui.notifications.warn("PS.Warn.NotYours", { localize: true });
          return exec("applyConsequence", { messageId: message.id }, message.isOwner && !!cafe?.isOwner);
        case "rushTogether":
          return openCovenDialog({ targets: state.targets, consequence: "rush", title: t("PS.Rush.Title") });
      }
    });
  });
}
