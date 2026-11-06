/**
 * Classes de documents : valeurs par défaut à la création.
 */
import { PS, SYSTEM_ID, baseIngredientLabel, canChangeIngredientEssence, essenceIcon } from "./config.mjs";
import { seedMenu } from "./menu.mjs";

const OWNER = CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
const OBSERVER = CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER;
const DEFAULT_ICONS = new Set(["icons/svg/mystery-man.svg", "icons/svg/item-bag.svg", "", null, undefined]);

export class PSActor extends Actor {
  /** @override */
  async _preCreate(data, options, user) {
    if ( (await super._preCreate(data, options, user)) === false ) return false;
    const changes = {};
    if ( DEFAULT_ICONS.has(data.img) ) changes.img = PS.ICONS[this.type];
    // Le Café est une fiche partagée : tout le coven peut la modifier.
    // (Un import de compendium arrive avec default = 0 : on le relève aussi.)
    const current = data.ownership?.default ?? 0;
    if ( (this.type === "cafe") && (current < OWNER) ) changes["ownership.default"] = OWNER;
    // Les Sorcières du coven se voient entre elles (pour agir ensemble).
    if ( (this.type === "witch") && (current < OBSERVER) ) changes["ownership.default"] = OBSERVER;
    if ( this.type !== "medium" ) {
      changes["prototypeToken.actorLink"] = true;
      if ( this.type === "cafe" ) changes["prototypeToken.disposition"] = CONST.TOKEN_DISPOSITIONS.FRIENDLY;
    }
    if ( changes.img ) changes["prototypeToken.texture.src"] = changes.img;
    this.updateSource(changes);
  }

  /** @override */
  async _onCreate(data, options, userId) {
    await super._onCreate(data, options, userId);
    if ( (this.type !== "cafe") || (game.user.id !== userId) ) return;
    // Garde-manger de départ : 3 doses de chaque Ingrédient de base.
    if ( !this.items.size && !options.fromCompendium && !data.items?.length ) {
      const items = Object.keys(PS.BASE_INGREDIENTS).map(e => ({
        name: baseIngredientLabel(e), type: "ingredient", img: essenceIcon(e),
        system: { essence: Number(e), quantity: PS.START.doses, base: true }
      }));
      await this.createEmbeddedDocuments("Item", items);
    }
    // Carte de départ (dos de la fiche du Café).
    await seedMenu(this);
    // Premier Café du monde : il devient le Café actif.
    if ( game.user.isGM && !game.actors.get(game.settings.get(SYSTEM_ID, "activeCafe")) ) {
      await game.settings.set(SYSTEM_ID, "activeCafe", this.id);
    }
  }
}

export class PSItem extends Item {
  /** @override */
  async _preCreate(data, options, user) {
    if ( (await super._preCreate(data, options, user)) === false ) return false;
    if ( !DEFAULT_ICONS.has(data.img) ) return;
    if ( this.type === "ingredient" ) this.updateSource({ img: essenceIcon(this.system.essence) });
    else if ( this.type === "spell" ) this.updateSource({ img: PS.ICONS.spell });
  }

  /** @override L'Essence d'un Ingrédient de base est fixe ; celle des autres est réservée à la Guide. */
  async _preUpdate(changes, options, user) {
    if ( (await super._preUpdate(changes, options, user)) === false ) return false;
    if ( this.type !== "ingredient" ) return;
    const u = (typeof user === "string" ? game.users.get(user) : user) ?? game.user;
    const essence = foundry.utils.getProperty(changes, "system.essence");
    if ( (essence !== undefined) && (Number(essence) !== this.system.essence) && !canChangeIngredientEssence(this, u) ) {
      delete changes.system.essence;
      ui.notifications.warn("PS.Warn.IngredientEssenceLocked", { localize: true });
    }
    if ( (foundry.utils.getProperty(changes, "system.base") === false) && this.system.base && !u.isGM ) delete changes.system.base;
  }
}
