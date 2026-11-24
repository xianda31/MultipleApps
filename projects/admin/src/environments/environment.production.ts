import buildInfo from './commitHash.json';
import type { BuildInfo } from './build-info.interface';
import { maintenanceTargets } from './maintenance-targets';

export const environment = {
    production: true,
    buildInfo: buildInfo as BuildInfo,
    tpe_location_id: 'tml_GgoOpQdSXARzTR',
    tpe_simulated: false,  // TPE physique requis en production
    tpe_isTest: false,
    region: 'eu-west-3',
    aws_access_key_id: '',
    aws_secret_access_key: '',
    ...maintenanceTargets,
    s3_prod_bucket: '',
    s3_sandbox_bucket: '',
    back_guard: true,
    low_game_card_message: true,
    nfc_card_advance_enabled: false,
    quick_sale_tpe_enabled: false,
    tpe_shared_enabled: false,
    ffbProxyPathOverrides: {}

};
