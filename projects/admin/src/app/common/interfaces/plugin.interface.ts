import { Type } from "@angular/core";
import { TournamentsComponent } from "../tournaments/tournaments/tournaments.component";
import { SettingsComponent } from "../members/settings/settings.component";
import { PurchasesComponent } from "../../front/purchases/purchases.component";
import { GameCardsOwnedComponent } from "../../front/game-cards-owned/game-cards-owned.component";
import { Routes } from "@angular/router";
import { ConnexionPageComponent } from "../authentification/connexion-page/connexion-page.component";
import { IframeComponent } from "../../front/front/iframe/iframe";
import { HomePage } from "../../front/front/pages/home-page/home-page";
import { TournamentComponent } from "../tournaments/tournament/tournament.component";
import { Carousel } from "../../front/carousel/carousel";

export enum NAVITEM_PLUGIN {
  TOURNAMENTS = 'tournaments',
  SETTINGS = 'settings',
  PURCHASES = 'purchases',
  GAME_CARDS_OWNED = 'game_cards_owned',
  AUTHENTICATION = 'authentication',
  IFRAME = 'iframe',
  HOME = 'homePage',
};

export enum EMBEDDED_PLUGIN {
  CAROUSEL='carousel',
  TOURNAMENT = 'tournament',
}

// UI-level command catalog for DirectCall items
export enum NAVITEM_COMMAND {
  SIGN_OUT = 'signout',
}
// UI-level special labels that the navbar can transform at render time
export enum LABEL_TRANSFORMERS {
  USERNAME = 'prénom_automatique',
};
export const PLUGINS: { [key in NAVITEM_PLUGIN | EMBEDDED_PLUGIN]: Type<any> } = {
  [NAVITEM_PLUGIN.TOURNAMENTS]: TournamentsComponent,
  [NAVITEM_PLUGIN.SETTINGS]: SettingsComponent,
  [NAVITEM_PLUGIN.PURCHASES]: PurchasesComponent,
  [NAVITEM_PLUGIN.GAME_CARDS_OWNED]: GameCardsOwnedComponent,
  [NAVITEM_PLUGIN.AUTHENTICATION]: ConnexionPageComponent,
  [NAVITEM_PLUGIN.IFRAME]: IframeComponent,
  [NAVITEM_PLUGIN.HOME]: HomePage,
  [EMBEDDED_PLUGIN.CAROUSEL]: Carousel,
  [EMBEDDED_PLUGIN.TOURNAMENT]: TournamentComponent,
};


export const plugin_routes: Routes = [];