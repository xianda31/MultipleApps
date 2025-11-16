import { Injectable } from '@angular/core';
import { AuthentificationService } from '../authentification/authentification.service';
import { NAVITEM_COMMAND, LABEL_TRANSFORMERS } from '../interfaces/plugin.interface';
import { firstValueFrom } from 'rxjs';
import { map } from 'rxjs/operators';


@Injectable({ providedIn: 'root' })
export class CommandRegistryService {
    constructor(private auth: AuthentificationService) { }

    private readonly navitem_commands: Record<NAVITEM_COMMAND, () => void | Promise<void>> =
        {
            [NAVITEM_COMMAND.SIGN_OUT]: this.signout.bind(this)
        };

    private readonly label_transformers: Record<LABEL_TRANSFORMERS, () => string | Promise<string>> =
        {
            [LABEL_TRANSFORMERS.USERNAME]: this.getFirstname.bind(this)
        };


    private async signout(): Promise<void> {
        try {
            sessionStorage.clear();
            await this.auth.signOut();
        } catch (e) {
            console.error('Error during signOut command:', e);
        }
    }
    async getFirstname(): Promise<string > {
        return firstValueFrom(this.auth.logged_member$.pipe(
            map(member => member ? member.firstname : '')
        ));
    }

    async label_transform(label: string): Promise<string> {
        const transformer = this.label_transformers[label as LABEL_TRANSFORMERS];
        if (!transformer) {
            return label;
        }
        const result = await Promise.resolve(transformer());
        return result;
    }

    async execute(key: NAVITEM_COMMAND): Promise<void> {
        const handler = this.navitem_commands[key];
        if (!handler) {
            console.warn('Unknown command:', key);
            return;
        }
        await Promise.resolve(handler());
    }

}
