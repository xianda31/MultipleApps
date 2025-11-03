
import { Schema } from "../../../../../../amplify/data/resource";
import { NAVITEM_PLUGIN } from "./plugin.interface";

export enum NAVITEM_TYPE {
    DROPDOWN = 'Dropdown',
    EXTERNAL_REDIRECT = 'ExternalRedirect',
    PLUGIN = 'PlugIn',
    INTERNAL_LINK = 'InternalLink',
    CUSTOM_PAGE = 'CustomPage',
}

export enum NAVITEM_POSITION {
    NAVBAR = 'Navbar',
    FOOTER = 'Footer',
    BRAND = 'Brand',
}

export type NAVITEM_TYPE_ICONS = { [key in NAVITEM_TYPE]: string };
export const NAVITEM_TYPE_ICONS: NAVITEM_TYPE_ICONS = {
    [NAVITEM_TYPE.DROPDOWN]: 'bi bi-chevron-down',
    [NAVITEM_TYPE.EXTERNAL_REDIRECT]: 'bi bi-globe2',
    [NAVITEM_TYPE.PLUGIN]: 'bi bi-gear-fill',
    [NAVITEM_TYPE.INTERNAL_LINK]: 'bi bi-link-45deg',
    [NAVITEM_TYPE.CUSTOM_PAGE]: 'bi bi-file-richtext',
};



export interface NavItem {
    id: string;
    label: string;
    top: boolean;
    root:string;
    path: string;
    position: NAVITEM_POSITION;
    type: NAVITEM_TYPE;
    // optional params
    parent_id?: string;
    page_id?: string;
    external_url?: string;
    plugin_name?: NAVITEM_PLUGIN;
    // meta data
    createdAt?: string;
    updatedAt?: string;
}

export type NavItem_input = Omit<Schema['NavItem']['type'], 'id' | 'createdAt' | 'updatedAt'>;

