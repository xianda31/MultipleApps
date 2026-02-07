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
import { AssistanceComponent } from "../../front/front/assistance/assistance.component";
import { AlbumComponent } from "../../front/album/album.component";
import { CompetitionsComponent } from "../../back/competitions/competitions";
import { ComiteeBookletViewerComponent } from "../../back/comitee-booklet-viewer/comitee-booklet-viewer.component";

export enum NAVITEM_PLUGIN {
  TOURNAMENTS = 'tournaments',
  COMPETITIONS = 'competitions',
  SETTINGS = 'settings',
  PURCHASES = 'purchases',
  GAME_CARDS_OWNED = 'game_cards_owned',
  AUTHENTICATION = 'authentication',
  IFRAME = 'iframe',
  HOME = 'homePage',
  ASSISTANCE = 'assistance',
  COMITEE_BOOKLET_VIEWER = 'comitee_booklet_viewer',
  // ALBUM = 'album',
};

export type PluginRouteTemplate = {
  suffix?: string; // appended to navitem.path
  when?: 'always' | 'album' | 'none';
  component?: Type<any>; // optional override for the extra route's component
};

export type PluginMeta = {
  component?: Type<any>;
  extraRoutes?: PluginRouteTemplate[];
  providesBrand?: boolean;
  requiresAuth?: boolean;
  requiresExternalUrl?: boolean; // when true, route data will include external_url from navitem
};

// UI-level command catalog for DirectCall items
export enum NAVITEM_COMMAND {
  SIGN_OUT = 'signout',
}
// UI-level special labels that the navbar can transform at render time
export enum LABEL_TRANSFORMERS {
  USERNAME = 'prénom_automatique',
};
export const PLUGINS: Record<string, Type<any>> = {
  [NAVITEM_PLUGIN.TOURNAMENTS]: TournamentsComponent,
  [NAVITEM_PLUGIN.COMPETITIONS]: CompetitionsComponent,
  [NAVITEM_PLUGIN.SETTINGS]: SettingsComponent,
  [NAVITEM_PLUGIN.PURCHASES]: PurchasesComponent,
  [NAVITEM_PLUGIN.GAME_CARDS_OWNED]: GameCardsOwnedComponent,
  [NAVITEM_PLUGIN.AUTHENTICATION]: ConnexionPageComponent,
  [NAVITEM_PLUGIN.IFRAME]: IframeComponent,
  [NAVITEM_PLUGIN.HOME]: HomePage,
  [NAVITEM_PLUGIN.ASSISTANCE]: AssistanceComponent,
  ['les_albums']: AlbumComponent,
  ['tournament']: TournamentComponent,
  [NAVITEM_PLUGIN.COMITEE_BOOKLET_VIEWER]: ComiteeBookletViewerComponent,
};


export const PLUGINS_META: Record<string, PluginMeta> = {
  [NAVITEM_PLUGIN.TOURNAMENTS]: { component: TournamentComponent, extraRoutes: [{ suffix: '/:tournament_id', when: 'always' }], requiresAuth: false },
  [NAVITEM_PLUGIN.SETTINGS]: { component: SettingsComponent, requiresAuth: true },
  [NAVITEM_PLUGIN.PURCHASES]: { component: PurchasesComponent, requiresAuth: true },
  [NAVITEM_PLUGIN.GAME_CARDS_OWNED]: { component: GameCardsOwnedComponent, requiresAuth: true },
  [NAVITEM_PLUGIN.AUTHENTICATION]: { component: ConnexionPageComponent, requiresAuth: false },
  [NAVITEM_PLUGIN.IFRAME]: { component: IframeComponent, requiresAuth: false, requiresExternalUrl: true },
  [NAVITEM_PLUGIN.HOME]: { component: HomePage, providesBrand: true,
     extraRoutes: [{ suffix: '/:tournament_id', when: 'always', component: TournamentComponent }] },
     
  ['PAGE_ALBUM']: { component: AlbumComponent, extraRoutes: [{ suffix: '/:snippet_id', when: 'always', component: AlbumComponent }] },
};

export const plugin_routes: Routes = []; 