import { Member } from "../../../../../common/member.interface";
import { SaleItem } from "../sales.interface";

export interface CartItem extends SaleItem {
    payee: Member | null;
}




