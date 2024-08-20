export interface SiteConf {
    color?: string
    web_site_menus: MenuItem[]
}

interface Route {
    path: string
    componentEnum: string  // pointe sur un composant prédéfini compilé
    name: string
}


export interface MenuItem {
    label: string
    has_submenu: boolean,
    route?: Route
    submenus?: MenuItem[]
}