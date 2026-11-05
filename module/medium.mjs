/**
 * Médiums : désirs secrets, compte à rebours d'interactions, préparation et service du Breuvage.
 */
import { SYSTEM_ID, SYSTEM_PATH, essenceIcon, essenceLabel, formatEssences, matchEssences, parseEssences } from "./config.mjs";
import { applyChatMode, exec, getCafe, registerHandler } from "./fount.mjs";

const { DialogV2 } = foundry.applications.api;
const renderTemplate = (...args) => foundry.applications.handlebars.renderTemplate(...args);
const t = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));
const CARD = `${SYSTEM_PATH}/templates/chat/beverage-card.hbs`;
const DIALOG = `${SYSTEM_PATH}/templates/dialog/beverage.hbs`;

/* -------------------------------------------- */
/*  Outils de la Guide                          */
/* -------------------------------------------- */

/** La Guide tire en secret 3d6 : les Essences recherchées par le Médium. */
export async function rollDesires(medium) {
  const roll = await new Roll("3d6").evaluate();
  const values = roll.dice[0].results.map(r => r.result).sort();
  await medium.update({ "system.desires": formatEssences(values) });
  const icons = values.map(v => `<img class="ps-essence" src="${essenceIcon(v)}" title="${essenceLabel(v)}">`).join("");
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: medium }),
    whisper: ChatMessage.getWhisperRecipients("GM").map(u => u.id),
    blind: true,
    rolls: [roll],
    content: `<div class="pumpkin-spice ps-fount-msg"><p class="ps-reason">${t("PS.Medium.SecretDesires", { name: medium.name })}</p><p class="ps-dice-row">${icons}</p></div>`
  });
}

/** Début de la conversation : 1 + Ambiance du Café interactions. */
export async function startCountdown(medium) {
  const vibe = getCafe()?.system.vibe ?? 0;
  const countdown = 1 + vibe;
  await medium.update({ "system.countdown": countdown });
  return announceCountdown(medium, countdown);
}

/** Une interaction de plus avec le Médium. */
export async function interact(medium) {
  const countdown = Math.max(medium.system.countdown - 1, 0);
  await medium.update({ "system.countdown": countdown });
  return announceCountdown(medium, countdown);
}

async function announceCountdown(medium, countdown) {
  const text = countdown > 0 ? t("PS.Medium.CountdownLeft", { name: medium.name, n: countdown }) : t("PS.Medium.CountdownDone", { name: medium.name });
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: medium }),
    content: `<div class="pumpkin-spice ps-fount-msg"><p><i class="fa-solid fa-mug-hot"></i> ${text}</p></div>`
  });
}

/* -------------------------------------------- */
/*  Préparer le Breuvage                        */
/* -------------------------------------------- */

/** Les Sorcières choisissent 3 Ingrédients du garde-manger (le même peut servir plusieurs fois). */
export async function prepareBeverage({ mediumId = null } = {}) {
  const cafe = getCafe();
  if ( !cafe ) return ui.notifications.warn("PS.Warn.NoCafe", { localize: true });
  const pantry = cafe.items.filter(i => i.type === "ingredient").sort((a, b) => (a.system.essence - b.system.essence) || a.name.localeCompare(b.name));
  if ( !pantry.length ) return ui.notifications.warn("PS.Warn.EmptyPantry", { localize: true });
  const mediums = game.actors.filter(a => (a.type === "medium") && a.visible);
  const options = pantry.map(i => ({ id: i.id, label: `${i.name} — ${essenceLabel(i.system.essence)} (${i.system.quantity})`, disabled: i.system.quantity < 1 }));
  const content = await renderTemplate(DIALOG, {
    slots: [0, 1, 2].map(n => ({ n: n + 1, name: `ing${n}`, options })),
    mediums: mediums.map(m => ({ id: m.id, name: m.name, selected: m.id === mediumId }))
  });
  const data = await DialogV2.prompt({
    window: { title: t("PS.Beverage.Title"), icon: "fa-solid fa-mug-hot" },
    classes: ["pumpkin-spice", "ps-dialog"],
    position: { width: 460 },
    content,
    ok: { label: t("PS.Beverage.Prepare"), icon: "fa-solid fa-mortar-pestle", callback: (event, button) => new foundry.applications.ux.FormDataExtended(button.form).object },
    rejectClose: false
  });
  if ( !data ) return null;

  const chosen = [data.ing0, data.ing1, data.ing2].map(id => cafe.items.get(id)).filter(Boolean);
  if ( chosen.length !== 3 ) return ui.notifications.warn("PS.Warn.ThreeIngredients", { localize: true });
  const needed = {};
  for ( const i of chosen ) needed[i.id] = (needed[i.id] ?? 0) + 1;
  if ( Object.entries(needed).some(([id, n]) => cafe.items.get(id).system.quantity < n) ) {
    return ui.notifications.warn("PS.Warn.NotEnoughDoses", { localize: true });
  }
  const medium = game.actors.get(data.medium);
  const state = {
    cafeId: cafe.id,
    mediumId: medium?.id ?? null,
    mediumName: medium?.name ?? (data.mediumName || t("PS.Medium.Unknown")),
    ingredients: chosen.map(i => ({ id: i.id, name: i.name, essence: i.system.essence })),
    result: null
  };
  const msg = {
    speaker: ChatMessage.getSpeaker(),
    content: await renderBeverage(state),
    flags: { [SYSTEM_ID]: { beverage: state } }
  };
  applyChatMode(msg);
  return ChatMessage.create(msg);
}

async function renderBeverage(state) {
  return renderTemplate(CARD, {
    ...state,
    ingredients: state.ingredients.map(i => ({ ...i, icon: essenceIcon(i.essence), label: essenceLabel(i.essence) })),
    desires: state.result?.desires.map((e, k) => ({ icon: essenceIcon(e), label: essenceLabel(e), met: state.result.met[k] })),
    isGM: game.user.isGM
  });
}

/* -------------------------------------------- */
/*  Servir (Guide)                              */
/* -------------------------------------------- */

async function serve(message) {
  const state = message.getFlag(SYSTEM_ID, "beverage");
  if ( !state || state.result ) return;
  let mediumId = state.mediumId;
  if ( !game.actors.get(mediumId) ) {
    const mediums = game.actors.filter(a => a.type === "medium");
    if ( !mediums.length ) return ui.notifications.warn("PS.Warn.NoMedium", { localize: true });
    mediumId = await DialogV2.prompt({
      window: { title: t("PS.Beverage.Serve") },
      content: `<div class="form-group"><label>${t("PS.Medium.Label")}</label><select name="medium">${
        mediums.map(m => `<option value="${m.id}">${foundry.utils.escapeHTML(m.name)}</option>`).join("")}</select></div>`,
      ok: { callback: (event, button) => button.form.elements.medium.value },
      rejectClose: false
    });
    if ( !mediumId ) return;
  }
  return exec("serveBeverage", { messageId: message.id, mediumId }, true);
}

registerHandler("serveBeverage", async ({ messageId, mediumId }) => {
  const message = game.messages.get(messageId);
  const state = foundry.utils.deepClone(message?.getFlag(SYSTEM_ID, "beverage"));
  const medium = game.actors.get(mediumId);
  const cafe = game.actors.get(state?.cafeId) ?? getCafe();
  if ( !state || state.result || !medium || !cafe ) return;
  const desires = parseEssences(medium.system.desires);
  if ( !desires.length ) return ui.notifications.warn("PS.Warn.NoDesires", { localize: true });

  // Consomme les doses.
  const updates = {};
  for ( const ing of state.ingredients ) {
    const item = cafe.items.get(ing.id);
    if ( !item ) continue;
    updates[item.id] = (updates[item.id] ?? item.system.quantity) - 1;
  }
  await cafe.updateEmbeddedDocuments("Item", Object.entries(updates).map(([_id, q]) => ({ _id, "system.quantity": Math.max(q, 0) })));

  // Chaque Essence juste : +1 Magie ; Breuvage parfait : +1d6 en plus.
  const match = matchEssences(state.ingredients.map(i => i.essence), desires);
  const correct = match.met.filter(Boolean).length;
  const perfect = match.missing === 0;
  let bonus = 0;
  let roll = null;
  if ( perfect ) {
    roll = await new Roll("1d6").evaluate();
    bonus = roll.total;
  }
  const gain = correct + bonus;
  await cafe.update({ "system.magic": cafe.system.magic + gain });
  await medium.update({
    "system.countdown": 0,
    "system.visits": medium.system.visits + 1,
    ...(perfect ? { "system.bonded": true } : {})
  });

  state.mediumId = medium.id;
  state.mediumName = medium.name;
  state.result = { desires, met: match.met, correct, perfect, bonus, gain, magic: cafe.system.magic };
  const update = { content: await renderBeverage(state), [`flags.${SYSTEM_ID}.beverage`]: state };
  if ( roll ) update.rolls = [...message.rolls, roll].map(r => JSON.stringify(r.toJSON()));
  await message.update(update);
  if ( roll && game.dice3d ) game.dice3d.showForRoll(roll, game.user, true);
});

export function onRenderBeverageMessage(message, html) {
  if ( !message.getFlag(SYSTEM_ID, "beverage") ) return;
  html.querySelectorAll("[data-ps-action=serve]").forEach(button => {
    if ( !game.user.isGM ) {
      button.remove();
      return;
    }
    button.addEventListener("click", event => {
      event.preventDefault();
      serve(message);
    });
  });
}
