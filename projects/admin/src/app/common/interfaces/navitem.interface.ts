
import { Schema } from "../../../../../../amplify/data/resource";
import { NAVITEM_PLUGIN, NAVITEM_COMMAND } from "./plugin.interface";

export enum NAVITEM_TYPE {
    DROPDOWN = 'Dropdown',
    EXTERNAL_REDIRECT = 'ExternalRedirect',
    PLUGIN = 'PlugIn',
    INTERNAL_LINK = 'InternalLink',
    DIRECT_CALL = 'DirectCall',
    CUSTOM_PAGE = 'CustomPage',
}

// UI-level command catalog for DirectCall items (not persisted in backend)

export enum NAVITEM_LOGGING_CRITERIA {
    ANY = 'Any',
    LOGGED_ONLY = 'LoggedOnly',
    UNLOGGED_ONLY = 'UnloggedOnly',
}

export enum NAVITEM_POSITION {
    NAVBAR = 'Navbar',
    FOOTER = 'Footer',
    BRAND = 'Brand',
}

export interface NavItem {
    id: string;
    sandbox: boolean;
    type: NAVITEM_TYPE;
    label: string;
    slug: string;
    path: string;
    rank: number;
    logging_criteria: NAVITEM_LOGGING_CRITERIA;
    group_level: number;
    position: NAVITEM_POSITION;
    // runtime-only convenience, not persisted
    page_title?: string;
    // UI-only command for DirectCall; persisted as slug for compatibility
    command_name?: NAVITEM_COMMAND;
    // optional params
    pre_label: 'icon' | 'avatar' | null;
    parent_id?: string;
    page_id?: string;
    external_url?: string;
    plugin_name?: NAVITEM_PLUGIN;
    // meta data
    createdAt?: string;
    updatedAt?: string;
}

export type NavItem_input = Omit<Schema['NavItem']['type'], 'id' | 'createdAt' | 'updatedAt'>;


export interface MenuStructure { [key: string]: { parent: NavItem, childs: NavItem[] } }