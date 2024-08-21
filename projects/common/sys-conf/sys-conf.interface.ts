export interface SiteConf {
    color?: string
    web_site_menus: MenuItem[]
}

// navbar :
//  si "!menu.has_submenu" => menu = label:menu.label link:menu.page.link, 
// sinon => menu = label:menu.label + loop sur submenus

interface EndItem {
    label: string
    link: string   // router : { path: link, data: { pageId: id }, component: ... }
    pageId: string
}


export interface MenuItem {
    label?: string
    has_submenu: boolean, // true => submenu! ; false => page!
    endItems: EndItem[]
    // submenus?: MenuItem[]
}