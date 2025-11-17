import { Type } from "@angular/core";
import { TournamentsComponent } from "../tournaments/tournaments/tournaments.component";
import { SettingsComponent } from "../members/settings/settings.component";
import { PurchasesComponent } from "../../front/purchases/purchases.component";
import { GameCardsOwnedComponent } from "../../front/game-cards-owned/game-cards-owned.component";
import { Routes } from "@angular/router";
import { ConnexionPageComponent } from "../authentification/connexion-page/connexion-page.component";
import { IframeComponent } from "../../front/front/iframe/iframe";

export enum NAVITEM_PLUGIN {
   TOURNAMENTS = 'tournaments',
   SETTINGS = 'settings',
   PURCHASES = 'purchases',
   GAME_CARDS_OWNED = 'game_cards_owned',
   AUTHENTICATION = 'authentication',
   IFRAME = 'iframe'
};

// UI-level command catalog for DirectCall items
export enum NAVITEM_COMMAND {
  SIGN_OUT = 'signout',
}
// UI-level special labels that the navbar can transform at render time
export enum LABEL_TRANSFORMERS {
  USERNAME = 'prénom_automatique',
};
export const PLUGINS: { [key in NAVITEM_PLUGIN]: Type<any> } = {
    [NAVITEM_PLUGIN.TOURNAMENTS]: TournamentsComponent,
    [NAVITEM_PLUGIN.SETTINGS]: SettingsComponent,
    [NAVITEM_PLUGIN.PURCHASES]: PurchasesComponent,
    [NAVITEM_PLUGIN.GAME_CARDS_OWNED]: GameCardsOwnedComponent,
    [NAVITEM_PLUGIN.AUTHENTICATION]: ConnexionPageComponent,
    [NAVITEM_PLUGIN.IFRAME]: IframeComponent, 

};

export function push_plugin_route(path: string, plugin: NAVITEM_PLUGIN) {
  plugin_routes.push({ path: path, component: PLUGINS[plugin] });
}

export function reset_plugin_routes() {
  plugin_routes.length = 0;
}

export const plugin_routes: Routes = [];