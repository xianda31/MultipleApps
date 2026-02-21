import { Group_priorities } from "../../common/authentification/group.interface";
import { BACK_ROUTE_PATHS } from "../routes/back-route-paths";

export
    interface NavbarMenu {
    label: string;
    key?: string;
    icon?: string;
    route?: string;
    minLevel?: number;
    adminOnly?: boolean;
    subMenus?: NavbarMenu[];
    isDev?: boolean;
    isSystem?: boolean;
    isUser?: boolean;
}


