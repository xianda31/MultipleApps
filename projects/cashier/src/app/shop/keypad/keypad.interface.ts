import { PaymentMode } from "../../../../../common/new_sales.interface";

export interface Payment_key {
    title: string;
    icon: string;
    class: string;
    payment_mode: PaymentMode;
}


export const PAYMENT_KEYS: Payment_key[] = [
    { title: 'ESPECES', icon: 'bi bi-cash-coin', class: 'm-1 card nice_shadow bigger-on-hover bg-primary text-white', payment_mode: PaymentMode.CASH },
    { title: 'CHEQUE', icon: 'bi bi-bank', class: 'm-1 card nice_shadow bigger-on-hover bg-primary text-white', payment_mode: PaymentMode.CHEQUE },
    { title: 'VIREMENT', icon: 'bi bi-globe', class: 'm-1 card nice_shadow bigger-on-hover bg-primary text-white', payment_mode: PaymentMode.TRANSFER },
    { title: 'CREDIT', icon: 'bi bi-sticky', class: 'm-1 card nice_shadow bigger-on-hover bg-warning', payment_mode: PaymentMode.CREDIT },
    { title: 'AVOIR', icon: 'bi bi-gift', class: 'm-1 card nice_shadow bigger-on-hover bg-success text-white', payment_mode: PaymentMode.ASSETS },
]

