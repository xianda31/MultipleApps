import { Injectable } from '@angular/core';
import { BehaviorSubject, map, Observable, of, switchMap, tap } from 'rxjs';
import { SystemDataService } from './system-data.service';
import { ToastService } from '../services/toast.service';
import { DBhandler } from './graphQL.service';
import { Snippet, Snippet_input } from '../interfaces/snippet.interface';

@Injectable({
    providedIn: 'root'
})
export class SnippetService {
    private _snippets!: Snippet[];
    private _snippets$ = new BehaviorSubject<Snippet[]>([]);
    snippets_keys: string[] = [];

    constructor(
        private systemDataService: SystemDataService,
        private toastService: ToastService,
        private dbHandler: DBhandler
    ) { }

    // CL(R)UD Snippet

    async createSnippet(snippet: Snippet): Promise<Snippet> {
        const { id, ...snippet_input } = snippet;
        try {
            const createdSnippet = await this.dbHandler.createSnippet(snippet_input as Snippet_input);
            this._snippets.push(createdSnippet as Snippet);
            this._snippets$.next(this._snippets);
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
                this._snippets = snippets;
                this._snippets$.next(snippets);
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
        try {
            const updatedSnippet = await this.dbHandler.updateSnippet(snippet);
            this._snippets = this._snippets.filter((s) => s.id !== updatedSnippet.id);
            this._snippets.push(updatedSnippet as Snippet);
            this._snippets$.next(this._snippets);
            return updatedSnippet;
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
            this._snippets$.next(this._snippets);
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
}
