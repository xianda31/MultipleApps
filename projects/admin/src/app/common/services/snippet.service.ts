import { Injectable } from '@angular/core';
import { BehaviorSubject, map, Observable, of, switchMap, tap } from 'rxjs';
import { SystemDataService } from './system-data.service';
import { ToastService } from '../services/toast.service';
import { DBhandler } from './graphQL.service';
import { Snippet, Snippet_input } from '../interfaces/page_snippet.interface';
import { FileService } from './files.service';
import { AuthentificationService } from '../authentification/authentification.service';
import { FargatePlatformVersion } from 'aws-cdk-lib/aws-ecs';

@Injectable({
    providedIn: 'root'
})
export class SnippetService {
    private _snippets!: Snippet[];
    private _snippets$ = new BehaviorSubject<Snippet[]>([]);
    snippets_keys: string[] = [];
    logged: boolean = false;

    constructor(
        private systemDataService: SystemDataService,
        private auth : AuthentificationService,
        private fileService: FileService,
        private toastService: ToastService,
        private dbHandler: DBhandler
    ) {
        this.auth.logged_member$.subscribe(user => {
            if (user) {
                this.logged=true;
                if(this._snippets) this._snippets$.next(this._snippets.filter((s) => s.public || this.logged));

            } else {
                // console.log('not logged');
            }
        });
    }

    // CL(R)UD Snippet

    async createSnippet(snippet: Snippet): Promise<Snippet> {
        const { id, ...snippet_input } = snippet;
        try {
            let createdSnippet = await this.dbHandler.createSnippet(snippet_input as Snippet_input);
            createdSnippet = this.add_image_url(createdSnippet);
            this._snippets.push(createdSnippet as Snippet);
            this._snippets$.next(this._snippets.filter((s) => s.public || this.logged));
            return createdSnippet;
        } catch (errors) {
            if (Array.isArray(errors) && errors.length > 0 && typeof errors[0] === 'object' && errors[0] !== null && 'errorType' in errors[0]) {
                if ((errors[0] as any).errorType === 'Unauthorized') {
                    this.toastService.showErrorToast('Gestion des snippets', 'Vous n\'êtes pas autorisé à créer un snippet');
                    return Promise.reject('Unauthorized');
                }
            }
            this.toastService.showErrorToast('Gestion des snippets', 'Une erreur est survenue lors de la création d\'un snippet');
            return Promise.reject('Error creating snippet');
        }
    }

    listSnippets(): Observable<Snippet[]> {
        const _listSnippets = this.dbHandler.listSnippets().pipe(
            map((snippets) => snippets),
            switchMap((snippets) => this.sorted_snippets(snippets)),
            map((snippets) => {
                this._snippets = snippets.map(snippet => this.add_image_url(snippet));
                this._snippets$.next(this._snippets.filter((s) => s.public || this.logged));
            }),
            switchMap(() => this._snippets$.asObservable())
        );
        return this._snippets ? this._snippets$.asObservable() : _listSnippets;
    }

    sorted_snippets(snippets: Snippet[]): Observable<Snippet[]> {
        // Adapter selon le besoin métier
        return of(snippets);
    }

    async updateSnippet(snippet: Snippet): Promise<Snippet> {
        if(snippet.image_url) delete snippet.image_url; // Remove image_url if it exists to avoid sending it to the backend
        try {
            let updatedSnippet = await this.dbHandler.updateSnippet(snippet);
            updatedSnippet = this.add_image_url(updatedSnippet);
            this._snippets = this._snippets.filter((s) => s.id !== updatedSnippet.id);
            this._snippets.push(updatedSnippet as Snippet);
            this._snippets$.next(this._snippets.filter((s) => s.public || this.logged));
            return Promise.resolve(updatedSnippet);
        } catch (errors) {
            if (Array.isArray(errors) && errors.length > 0 && typeof errors[0] === 'object' && errors[0] !== null && 'errorType' in errors[0]) {
                if ((errors[0] as any).errorType === 'Unauthorized') {
                    this.toastService.showErrorToast('Gestion des snippets', 'Vous n\'êtes pas autorisé à modifier un snippet');
                    return Promise.reject('Update not authorized');
                }
            }
            this.toastService.showErrorToast('Gestion des snippets', 'Une erreur est survenue lors de la modification d\'un snippet');
            return Promise.reject('Error updating snippet');
        }
    }

    deleteSnippet(snippet: Snippet): Promise<boolean> {
        try {
            let done = this.dbHandler.deleteSnippet(snippet.id);
            this._snippets = this._snippets.filter((s) => s.id !== snippet.id);
            this._snippets$.next(this._snippets.filter((s) => s.public || this.logged));
            return Promise.resolve(true);
        } catch (errors) {
            if (Array.isArray(errors) && errors.length > 0 && typeof errors[0] === 'object' && errors[0] !== null && 'errorType' in errors[0]) {
                if ((errors[0] as any).errorType === 'Unauthorized') {
                    this.toastService.showErrorToast('Gestion des snippets', 'Vous n\'êtes pas autorisé à supprimer un snippet');
                    return Promise.reject('Delete not authorized');
                }
            }
            this.toastService.showErrorToast('Gestion des snippets', 'Une erreur est survenue lors de la suppression d\'un snippet');
            return Promise.reject('Error deleting snippet');
        }
    }

    getSnippet(snippet_id: string): Snippet {
        return this._snippets.find((snippet) => snippet.id === snippet_id) as Snippet;
    }

    add_image_url(snippet: Snippet): Snippet {
        if(snippet.image) {
            return {...snippet, image_url: this.fileService.getPresignedUrl(snippet.image)};
        }
        return snippet;
    }
}
