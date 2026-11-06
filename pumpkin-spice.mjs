/**
 * Pumpkin Spice — système Foundry VTT (V13 / V14).
 * JdR cosy : un coven de Sorcières tient un Café magique bâti sur une Source de Magie.
 */
import { PS, SYSTEM_ID, SYSTEM_PATH, essenceIcon, essenceLabel, isBaseIngredient } from "./module/config.mjs";
import { CafeData, IngredientData, MediumData, SpellData, WitchData } from "./module/data/models.mjs";
import { PSActor, PSItem } from "./module/documents.mjs";
import { CafeSheet, IngredientSheet, MediumSheet, SpellSheet, WitchSheet, pickWitch } from "./module/sheets.mjs";
import { changeCafe, getCafe, registerSocket } from "./module/fount.mjs";
import * as tests from "./module/tests.mjs";
import * as medium from "./module/medium.mjs";

Hooks.once("init", () => {
  CONFIG.PS = PS;
  game.pumpkinSpice = {
    config: PS, getCafe, changeCafe, pickWitch,
    rollNarrative: tests.rollNarrative,
    rollTest: tests.openTestDialog,
    rollTogether: tests.openCovenDialog,
    rushHour: tests.startRushHour,
    castSpell: tests.castSpell,
    prepareBeverage: medium.prepareBeverage
  };

  CONFIG.Actor.documentClass = PSActor;
  CONFIG.Item.documentClass = PSItem;
  CONFIG.Actor.dataModels = { witch: WitchData, cafe: CafeData, medium: MediumData };
  CONFIG.Item.dataModels = { spell: SpellData, ingredient: IngredientData };
  CONFIG.Actor.trackableAttributes = {
    cafe: { bar: [], value: ["magic", "vibe", "incident"] },
    witch: { bar: [], value: [] },
    medium: { bar: [], value: ["countdown"] }
  };

  game.settings.register(SYSTEM_ID, "activeCafe", {
    scope: "world", config: false, type: String, default: ""
  });
  game.settings.register(SYSTEM_ID, "showFount", {
    name: "PS.Settings.ShowFount", hint: "PS.Settings.ShowFountHint",
    scope: "client", config: true, type: Boolean, default: true,
    onChange: () => renderFountHUD()
  });

  const { Actors, Items } = foundry.documents.collections;
  const { ActorSheet, ItemSheet } = foundry.appv1?.sheets ?? {};
  if ( ActorSheet ) Actors.unregisterSheet("core", ActorSheet);
  if ( ItemSheet ) Items.unregisterSheet("core", ItemSheet);
  Actors.registerSheet(SYSTEM_ID, WitchSheet, { types: ["witch"], makeDefault: true, label: "PS.Sheet.Witch" });
  Actors.registerSheet(SYSTEM_ID, CafeSheet, { types: ["cafe"], makeDefault: true, label: "PS.Sheet.Cafe" });
  Actors.registerSheet(SYSTEM_ID, MediumSheet, { types: ["medium"], makeDefault: true, label: "PS.Sheet.Medium" });
  Items.registerSheet(SYSTEM_ID, SpellSheet, { types: ["spell"], makeDefault: true, label: "PS.Sheet.Spell" });
  Items.registerSheet(SYSTEM_ID, IngredientSheet, { types: ["ingredient"], makeDefault: true, label: "PS.Sheet.Ingredient" });

  Handlebars.registerHelper("psEssence", (e, options) => {
    const cls = options?.hash?.class ?? "";
    return new Handlebars.SafeString(`<img class="ps-essence ${cls}" src="${essenceIcon(e)}" title="${essenceLabel(e)}" alt="${e}">`);
  });
  Handlebars.registerHelper("psEssenceLabel", e => essenceLabel(e));

  foundry.applications.handlebars.loadTemplates([
    `${SYSTEM_PATH}/templates/chat/test-card.hbs`,
    `${SYSTEM_PATH}/templates/chat/beverage-card.hbs`,
    `${SYSTEM_PATH}/templates/dialog/targets.hbs`,
    `${SYSTEM_PATH}/templates/actor/spell-list.hbs`
  ]);
});

Hooks.once("ready", () => {
  registerSocket();
  renderFountHUD();
  markBaseIngredients();
});

/** Cafés créés avant la v0.4 : marquer les Ingrédients de base, dont l'Essence est fixée par le livre. */
async function markBaseIngredients() {
  if ( game.user !== game.users.activeGM ) return;
  for ( const cafe of game.actors.filter(a => a.type === "cafe") ) {
    const updates = cafe.items.filter(i => (i.type === "ingredient") && !i.system.base && isBaseIngredient(i))
      .map(i => ({ _id: i.id, "system.base": true }));
    if ( updates.length ) await cafe.updateEmbeddedDocuments("Item", updates);
  }
}

/* Boutons des cartes de chat. */
Hooks.on("renderChatMessageHTML", (message, html) => {
  tests.onRenderChatMessage(message, html);
  medium.onRenderBeverageMessage(message, html);
});

/* Commande de chat : /essence [n] lance n Dés d'Essence narratifs. */
Hooks.on("chatMessage", (log, content) => {
  const m = content.trim().match(/^\/(essence|ess)\s*(\d*)$/i);
  if ( !m ) return true;
  tests.rollNarrative(Math.min(Number(m[2]) || 1, 20));
  return false;
});

/* Dice So Nice : dés d'Essence à symboles. */
Hooks.once("diceSoNiceReady", dice3d => {
  dice3d.addSystem({ id: SYSTEM_ID, name: "Pumpkin Spice" }, "preferred");
  dice3d.addColorset({
    name: SYSTEM_ID, description: "Pumpkin Spice", category: "Pumpkin Spice",
    foreground: "#fff6e9", background: "#d9822b", outline: "#5a3f6b", edge: "#b86a1f", texture: "none"
  }, "preferred");
  dice3d.addDicePreset({
    type: "d6", system: SYSTEM_ID, colorset: SYSTEM_ID,
    labels: [1, 2, 3, 4, 5, 6].map(e => essenceIcon(e))
  });
});

/* -------------------------------------------- */
/*  Bandeau de la Source                        */
/* -------------------------------------------- */

/** Petit bandeau permanent : Magie de la Source, Ambiance, compte à rebours d'Incident. */
function renderFountHUD() {
  document.getElementById("ps-fount-hud")?.remove();
  if ( !game.ready || !game.settings.get(SYSTEM_ID, "showFount") ) return;
  const cafe = getCafe();
  if ( !cafe ) return;
  const s = cafe.system;
  const el = document.createElement("div");
  el.id = "ps-fount-hud";
  el.classList.add("pumpkin-spice");
  el.innerHTML = `
    <span class="ps-hud-name"><i class="fa-solid fa-mug-hot"></i> ${foundry.utils.escapeHTML(cafe.name)}</span>
    <span class="ps-hud-stat ${s.magic <= 0 ? "danger" : ""}" data-tooltip="${game.i18n.localize("PS.Cafe.magic")}"><i class="fa-solid fa-droplet"></i> ${s.magic}</span>
    <span class="ps-hud-stat" data-tooltip="${game.i18n.localize("PS.Cafe.vibe")}"><i class="fa-solid fa-heart"></i> ${s.vibe}/${PS.VIBE_MAX}</span>
    <span class="ps-hud-stat ${s.incident <= 0 ? "danger" : ""}" data-tooltip="${game.i18n.localize("PS.Cafe.incident")}"><i class="fa-solid fa-cat"></i> ${s.incident}</span>`;
  el.addEventListener("click", () => cafe.sheet.render(true));
  document.body.appendChild(el);
}

Hooks.on("updateActor", actor => {
  if ( actor.type === "cafe" ) renderFountHUD();
});
Hooks.on("createActor", actor => {
  if ( actor.type === "cafe" ) renderFountHUD();
});
Hooks.on("deleteActor", actor => {
  if ( actor.type === "cafe" ) renderFountHUD();
});
Hooks.on("updateSetting", setting => {
  if ( setting.key === `${SYSTEM_ID}.activeCafe` ) renderFountHUD();
});
