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
import { PdfViewerComponent } from "../../back/pdf-viewer/pdf-viewer.component";

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
  PDF_VIEWER = 'pdf_viewer',
  ALBUM = 'les_albums',
};

export type PluginRouteTemplate = {
  suffix?: string; // appended to navitem.path
  when?: 'always' | 'album' | 'none';
  component?: Type<any>; // optional override for the extra route's component
};

// Definition of a parameter required by a plugin (stored in extra_parameter field)
export type PluginParamDef = {
  label: string; // UI label for the form input
  placeholder?: string; // placeholder for the input
  inputType?: 'url' | 'text'; // input type (default: text)
  dataKey: string; // key name for route.data, stored in extra_parameter_label
};

export type PluginMeta = {
  component?: Type<any>;
  extraRoutes?: PluginRouteTemplate[];
  providesBrand?: boolean;
  requiresAuth?: boolean;
  param?: PluginParamDef; // single optional parameter for this plugin
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
  [NAVITEM_PLUGIN.ALBUM]: AlbumComponent,
  [NAVITEM_PLUGIN.PDF_VIEWER]: PdfViewerComponent,
};


export const PLUGINS_META: Record<string, PluginMeta> = {
  // Plugins avec extraRoutes ou configuration spéciale
  [NAVITEM_PLUGIN.TOURNAMENTS]: { 
    component: TournamentComponent,  // Composant différent pour le détail (vs liste)
    extraRoutes: [{ suffix: '/:tournament_id', when: 'always' }],
  },
  [NAVITEM_PLUGIN.HOME]: { 
    providesBrand: true,
    extraRoutes: [{ suffix: '/:tournament_id', when: 'always', component: TournamentComponent }],
  },
  [NAVITEM_PLUGIN.ALBUM]: { 
    extraRoutes: [{ suffix: '/:snippet_id', when: 'always' }],
  },
  [NAVITEM_PLUGIN.IFRAME]: { 
    param: { label: 'URL externe', placeholder: 'https://...', inputType: 'url', dataKey: 'external_url' },
  },
  [NAVITEM_PLUGIN.PDF_VIEWER]: { 
    param: { label: 'Fichier PDF', placeholder: 'nom_du_fichier.pdf', inputType: 'text', dataKey: 'pdf_src' },
  },
  
  // Plugins nécessitant authentification (component récupéré de PLUGINS)
  [NAVITEM_PLUGIN.SETTINGS]: { requiresAuth: true },
  [NAVITEM_PLUGIN.PURCHASES]: { requiresAuth: true },
  [NAVITEM_PLUGIN.GAME_CARDS_OWNED]: { requiresAuth: true },
};

export const plugin_routes: Routes = []; 