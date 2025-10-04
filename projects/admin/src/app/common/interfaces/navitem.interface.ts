
import { Schema } from "../../../../../../amplify/data/resource";

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
    // SIDEBAR = 'Sidebar',
    BRAND = 'Brand',
    SUBMENU = 'Submenu',

}

export interface NavItem {
    id: string;
    top: boolean;
    parent_id?: string;
    position: NAVITEM_POSITION;
    label: string;
    link: string;
    type: NAVITEM_TYPE;
    createdAt?: string;
    updatedAt?: string;
}

export type NavItem_input = Omit<Schema['NavItem']['type'], 'id' | 'createdAt' | 'updatedAt'>;

