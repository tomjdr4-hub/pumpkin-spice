/**
 * La Carte du Café (dos de la fiche du Café) : boissons chaudes, invitation, couverture, spécialités.
 */
import { SYSTEM_ID, essenceIcon, essenceLabel, formatEssences, parseEssences } from "./config.mjs";
import { applyChatMode, getCafe } from "./fount.mjs";

const { DialogV2 } = foundry.applications.api;
const t = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));
const esc = s => foundry.utils.escapeHTML(String(s ?? ""));

/** Devises affichées avant le prix ($4.50) ; les autres après (4,50 €). */
const PREFIX_CURRENCIES = new Set(["$", "£", "¥"]);

/** « 4,50 » + « € » → « 4,50 € » ; « 4.50 » + « $ » → « $4.50 ». */
export function formatPrice(price, currency) {
  const p = String(price ?? "").trim();
  if ( !p ) return "";
  const c = String(currency ?? "").trim();
  if ( !c ) return p;
  return PREFIX_CURRENCIES.has(c) ? `${c}${p}` : `${p} ${c}`;
}

const num = n => n.toLocaleString(game.i18n.lang, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Carte de départ : boissons classiques et 6 spécialités originales, une par Ingrédient de base. */
export function defaultMenu() {
  const brews = [1.5, 2, 3, 3.5, 3, 3.5, 4, 3].map((price, i) => ({ name: t(`PS.MenuDefault.brew${i + 1}`), price: num(price) }));
  const specials = [4.5, 4.5, 4.5, 4, 5, 5].map((price, i) => ({
    name: t(`PS.MenuDefault.special${i + 1}`), text: t(`PS.MenuDefault.special${i + 1}Text`),
    price: num(price), essences: String(i + 1), medium: ""
  }));
  return {
    seeded: true,
    currency: t("PS.Menu.defaultCurrency"),
    opening: true,
    slogan: t("PS.MenuDefault.slogan"),
    address: "",
    invitation: t("PS.MenuDefault.invitation"),
    philosophy: "",
    brewsNote: t("PS.MenuDefault.brewsNote"),
    specialsNote: t("PS.MenuDefault.specialsNote"),
    brews,
    specials
  };
}

/** Remplit la carte d'un Café qui n'en a jamais eu (création, ou Cafés d'avant la v0.6). */
export async function seedMenu(cafe) {
  const menu = cafe?.system.menu;
  if ( !menu || menu.seeded ) return;
  if ( menu.brews.length || menu.specials.length ) return cafe.update({ "system.menu.seeded": true });
  return cafe.update({ "system.menu": defaultMenu() });
}

/* -------------------------------------------- */
/*  Chat                                        */
/* -------------------------------------------- */

const icons = essences => parseEssences(essences)
  .map(e => `<img class="ps-essence small" src="${essenceIcon(e)}" title="${essenceLabel(e)}" alt="${e}">`).join("");

function specialHTML(s, currency) {
  return `<li class="ps-menu-special">
    <div class="ps-menu-line"><b>${esc(s.name)}</b><span class="ps-menu-dots"></span><span>${esc(formatPrice(s.price, currency))}</span></div>
    ${s.text ? `<p>${esc(s.text)}</p>` : ""}
    ${(s.essences || s.medium) ? `<p class="ps-menu-meta">${icons(s.essences)}${s.medium ? ` <i>${esc(t("PS.Menu.createdFor", { name: s.medium }))}</i>` : ""}</p>` : ""}
  </li>`;
}

function post(cafe, content) {
  const msg = { speaker: ChatMessage.getSpeaker({ actor: cafe }), content: `<div class="pumpkin-spice ps-menu-msg">${content}</div>` };
  applyChatMode(msg);
  return ChatMessage.create(msg);
}

/** Toute la carte dans le chat. */
export function postMenu(cafe) {
  const m = cafe.system.menu;
  if ( !m.brews.length && !m.specials.length ) return ui.notifications.warn("PS.Menu.empty", { localize: true });
  const brews = m.brews.filter(b => b.name).map(b =>
    `<li><div class="ps-menu-line"><span>${esc(b.name)}</span><span class="ps-menu-dots"></span><span>${esc(formatPrice(b.price, m.currency))}</span></div></li>`).join("");
  const specials = m.specials.filter(s => s.name).map(s => specialHTML(s, m.currency)).join("");
  return post(cafe, `<header><h3>${esc(t("PS.Menu.menuOf", { name: cafe.name }))}</h3>${m.slogan ? `<p class="ps-menu-slogan">${esc(m.slogan)}</p>` : ""}</header>
    ${brews ? `<h4>${t("PS.Menu.brews")}</h4><ul>${brews}</ul>${m.brewsNote ? `<p class="ps-menu-note">${esc(m.brewsNote)}</p>` : ""}` : ""}
    ${specials ? `<h4>${t("PS.Menu.specials")}</h4><ul>${specials}</ul>${m.specialsNote ? `<p class="ps-menu-note">${esc(m.specialsNote)}</p>` : ""}` : ""}`);
}

/** Une seule spécialité : « Un client commande… ». */
export function postSpecial(cafe, index) {
  const m = cafe.system.menu;
  const s = m.specials[index];
  if ( !s ) return;
  return post(cafe, `<header><h3><i class="fa-solid fa-mug-hot"></i> ${t("PS.Menu.order")}</h3></header><ul>${specialHTML(s, m.currency)}</ul>`);
}

/* -------------------------------------------- */
/*  Breuvage servi → spécialité                 */
/* -------------------------------------------- */

/**
 * La Guide inscrit un Breuvage servi à la carte, avec ses 3 Essences et le nom du Médium.
 * @returns {Promise<string|undefined>}  Le nom du Café si la spécialité a été ajoutée
 */
export async function addBeverageToMenu(message) {
  const state = message.getFlag(SYSTEM_ID, "beverage");
  if ( !state?.result || state.menuAdded || !game.user.isGM ) return;
  const cafe = game.actors.get(state.cafeId) ?? getCafe();
  if ( !cafe ) return ui.notifications.warn("PS.Warn.NoCafe", { localize: true });
  const names = state.ingredients.map(i => i.name);
  const list = new Intl.ListFormat(game.i18n.lang, { type: "conjunction" }).format(names);
  const data = await DialogV2.prompt({
    window: { title: t("PS.Menu.addTitle"), icon: "fa-solid fa-book-open" },
    classes: ["pumpkin-spice", "ps-dialog"],
    position: { width: 440 },
    content: `<div class="form-group"><label>${t("PS.Menu.name")}</label><input type="text" name="name" value="${esc(t("PS.Menu.beverageName", { name: state.mediumName }))}" autofocus></div>
      <div class="form-group"><label>${t("PS.Menu.price")}</label><input type="text" name="price" value="${esc(num(5))}"></div>
      <div class="form-group stacked"><label>${t("PS.Menu.text")}</label><textarea name="text" rows="2">${esc(t("PS.Menu.madeWith", { list }))}</textarea></div>`,
    ok: { label: t("PS.Menu.addToMenu"), icon: "fa-solid fa-plus", callback: (event, button) => new foundry.applications.ux.FormDataExtended(button.form).object },
    rejectClose: false
  });
  if ( !data ) return;
  const specials = cafe.system.toObject().menu.specials;
  specials.push({
    name: data.name || t("PS.Menu.beverageName", { name: state.mediumName }),
    price: String(data.price ?? ""), text: data.text ?? "",
    essences: formatEssences(state.ingredients.map(i => i.essence)), medium: state.mediumName ?? ""
  });
  await cafe.update({ "system.menu.specials": specials, "system.menu.seeded": true });
  ui.notifications.info(t("PS.Menu.addedToMenu", { cafe: cafe.name }));
  return cafe.name;
}
