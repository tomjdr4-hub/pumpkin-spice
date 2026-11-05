/**
 * Café actif, Source de Magie et relais MJ.
 * Les joueurs ne peuvent pas toujours modifier le Café ou les messages des autres :
 * ces opérations passent alors par la Guide (MJ) connectée via le socket du système.
 */
import { PS, SYSTEM_ID, clamp } from "./config.mjs";

const SOCKET = `system.${SYSTEM_ID}`;
const HANDLERS = {};

/** Enregistre une opération exécutable par le MJ. */
export function registerHandler(name, fn) {
  HANDLERS[name] = fn;
}

/**
 * Exécute une opération localement si possible, sinon la confie au MJ actif.
 * @param {string} name
 * @param {object} args
 * @param {boolean} local  L'utilisateur a-t-il les droits nécessaires ?
 */
export async function exec(name, args, local = false) {
  if ( local || game.user.isGM ) return HANDLERS[name]({ ...args, userId: game.user.id });
  const gm = game.users.activeGM;
  if ( !gm ) {
    ui.notifications.warn("PS.Warn.NoGM", { localize: true });
    return null;
  }
  game.socket.emit(SOCKET, { name, args: { ...args, userId: game.user.id }, gm: gm.id });
  return null;
}

export function registerSocket() {
  game.socket.on(SOCKET, async payload => {
    if ( payload?.gm !== game.user.id ) return;
    try {
      await HANDLERS[payload.name]?.(payload.args);
    } catch(err) {
      console.error(`${SYSTEM_ID} | ${payload.name}`, err);
    }
  });
}

/* -------------------------------------------- */
/*  Café actif                                  */
/* -------------------------------------------- */

/** Le Café du coven : celui choisi par la Guide, sinon le premier trouvé. */
export function getCafe() {
  const id = game.settings.get(SYSTEM_ID, "activeCafe");
  return game.actors.get(id) ?? game.actors.find(a => a.type === "cafe") ?? null;
}

/** Applique des variations à l'Ambiance, à la Source, au compte à rebours d'Incident ou au Jour. */
registerHandler("cafeDelta", async ({ cafeId, vibe = 0, magic = 0, incident = 0, day = 0, reason = "" }) => {
  const cafe = game.actors.get(cafeId) ?? getCafe();
  if ( !cafe ) return null;
  const s = cafe.system;
  const update = {};
  if ( vibe ) update["system.vibe"] = clamp(s.vibe + vibe, 0, PS.VIBE_MAX);
  if ( magic ) update["system.magic"] = Math.max(s.magic + magic, 0);
  if ( incident ) update["system.incident"] = Math.max(s.incident + incident, 0);
  if ( day ) update["system.day"] = Math.max(s.day + day, 1);
  if ( foundry.utils.isEmpty(update) ) return cafe;
  await cafe.update(update);
  if ( reason ) await postFountMessage(cafe, { vibe, magic, incident, reason });
  return cafe;
});

/**
 * Modifie le Café actif (via le MJ si nécessaire).
 * @param {object} delta  {vibe, magic, incident, day, reason}
 */
export async function changeCafe(delta) {
  const cafe = getCafe();
  if ( !cafe ) {
    ui.notifications.warn("PS.Warn.NoCafe", { localize: true });
    return null;
  }
  return exec("cafeDelta", { cafeId: cafe.id, ...delta }, cafe.isOwner);
}

/** Petit message récapitulant une variation de la Source ou de l'Ambiance. */
async function postFountMessage(cafe, { vibe, magic, incident, reason }) {
  const s = cafe.system;
  const parts = [];
  const sign = n => (n > 0 ? `+${n}` : `${n}`);
  if ( vibe ) parts.push(`${game.i18n.localize("PS.Cafe.vibe")} ${sign(vibe)} → <b>${s.vibe}</b>`);
  if ( magic ) parts.push(`${game.i18n.localize("PS.Cafe.magic")} ${sign(magic)} → <b>${s.magic}</b>`);
  if ( incident ) parts.push(`${game.i18n.localize("PS.Cafe.incident")} ${sign(incident)} → <b>${s.incident}</b>`);
  let warn = "";
  if ( magic && (s.magic <= 0) ) warn += `<p class="ps-warn">${game.i18n.localize("PS.Warn.FountEmpty")}</p>`;
  if ( incident && (s.incident <= 0) ) warn += `<p class="ps-warn">${game.i18n.localize("PS.Warn.Incident")}</p>`;
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: cafe }),
    content: `<div class="pumpkin-spice ps-fount-msg"><p class="ps-reason">${reason}</p><p>${parts.join(" · ")}</p>${warn}</div>`
  });
}

/** Applique le mode de message par défaut (v14 : messageMode ; v13 : rollMode). */
export function applyChatMode(data) {
  if ( typeof ChatMessage.applyMode === "function" ) return ChatMessage.applyMode(data);
  return ChatMessage.applyRollMode(data, game.settings.get("core", "rollMode"));
}
