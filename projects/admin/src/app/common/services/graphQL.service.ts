
import { Injectable } from '@angular/core';
import { generateClient } from 'aws-amplify/api';
import { catchError, from, lastValueFrom, map, Observable, of, switchMap, tap, filter } from 'rxjs';
import { getCurrentUser } from 'aws-amplify/auth';
import { Member, Member_input } from '../interfaces/member.interface';
import { BookEntry } from '../interfaces/accounting.interface';
import { Schema } from '../../../../../../amplify/data/resource';
import { Product, Product_input } from '../../back/products/product.interface';
import { PlayBook, PlayBook_input } from '../../back/game-cards/game-card.interface';
import {  Page, Page_input, Snippet, Snippet_input } from '../interfaces/page_snippet.interface';
import { Game, Game_input } from '../../back/fees/fees.interface';
import { NavItem, NavItem_input } from '../interfaces/navitem.interface';


@Injectable({
  providedIn: 'root'
})
export class DBhandler {
  constructor(
  ) { }

  private _authMode(): Observable<'userPool' | 'identityPool'> {
    return from(getCurrentUser()).pipe(
      map((user) => { return user !== null ? 'userPool' : 'identityPool' }),
      catchError(() => { return from(['identityPool' as const]); })
    );
  }



  // PAGE SERVICE

// PAGE CREATE PROMISE
async createPage(page: Page_input): Promise<Page> {
  const authMode = await lastValueFrom(this._authMode());
  const client = generateClient<Schema>({ authMode: authMode });
  const { data : pageData, errors } = await client.models.Page.create(page);
  if (errors) throw errors;
  return pageData as unknown as Page;
}

// PAGE READ (single) PROMISE
async readPage(id: string): Promise<Page> {
  const authMode = await lastValueFrom(this._authMode());
  const client = generateClient<Schema>({ authMode: authMode });
  const { data: pageData, errors } = await client.models.Page.get({ id });
  if (errors) throw errors;
  return pageData as unknown as Page;
}

// PAGE UPDATE PROMISE
async updatePage(page: Page): Promise<Page> {
  const authMode = await lastValueFrom(this._authMode());
  const client = generateClient<Schema>({ authMode: authMode });
  const { data: updatedPage, errors } = await client.models.Page.update(page);
  if (errors) throw errors;
  return updatedPage as unknown as Page;
}

// PAGE DELETE PROMISE
async deletePage(id: string): Promise<boolean> {
  const authMode = await lastValueFrom(this._authMode());
  const client = generateClient<Schema>({ authMode: authMode });
  const { errors } = await client.models.Page.delete({ id });
  if (errors) throw errors;
  return true;
}

// PAGE LIST (all) OBSERVABLE
listPages(): Observable<Page[]> {
  return this._authMode().pipe(
    switchMap((authMode) => {
      const client = generateClient<Schema>({ authMode: authMode });
      return from(
        client.models.Page.list({ limit: 300 })
          .then(({ data, errors }) => {
            if (errors) {
              console.error('Page.list error', errors);
              return [];
            }
            return data as unknown as Page[];
          })
      );
    })
  );
}


// MENU SERVICE

  // NAVITEM LIST (all) OBSERVABLE
  listNavItems(): Observable<NavItem[]> {
    return this._authMode().pipe(
      switchMap((authMode) => {
        const client = generateClient<Schema>({ authMode: authMode });
        return from(
          client.models.NavItem.list({ limit: 300 })
            .then(({ data, errors }) => {
              if (errors) {
                console.error('NavItem.list error', errors);
                return [];
              }
              return data as unknown as NavItem[];
            })
        );
      })
    );
  }

  // NAVITEM CREATE PROMISE
  async createNavItem(navItem: NavItem_input): Promise<NavItem> {
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode: authMode });
    const { data: navItemData, errors } = await client.models.NavItem.create(navItem);
    if (errors) throw errors;
    return navItemData as unknown as NavItem;
  }

  // NAVITEM READ (single) PROMISE
  async readNavItem(id: string): Promise<NavItem> {
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode: authMode });
    const { data: navItemData, errors } = await client.models.NavItem.get({ id });
    if (errors) throw errors;
    return navItemData as unknown as NavItem;
  }

  // NAVITEM UPDATE PROMISE
  async updateNavItem(navItem: NavItem): Promise<NavItem> {
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode: authMode });
    const { data: updatedNavItem, errors } = await client.models.NavItem.update(navItem);
    if (errors) throw errors;
    return updatedNavItem as unknown as NavItem;
  }

  // NAVITEM DELETE PROMISE
  async deleteNavItem(id: string): Promise<boolean> {
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode: authMode });
    const { errors } = await client.models.NavItem.delete({ id });
    if (errors) throw errors;
    return true;
  }


  // Members Service

  // MEMBER CREATE PROMISE
  async createMember(member: Member_input): Promise<Member> {
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode: authMode });
    const { data, errors } = await client.models.Member.create(member);
    if (errors) throw errors;
    return data as Member;
  }

  // MEMBER READ (single) PROMISE
  async readMember(id: string): Promise<Member | null> {
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode: authMode });
    const { data, errors } = await client.models.Member.get({ id });
    if (errors) throw errors;
    return data as Member;
  }

  // MEMBER UPDATE PROMISE
  async updateMember(member: Member): Promise<Member> {
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode: authMode });
    const { data, errors } = await client.models.Member.update(member);
    if (errors) throw errors;
    return data as Member;
  }

  // MEMBER DELETE
  async deleteMember(id: string): Promise<boolean> {
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode: authMode });
    const { errors } = await client.models.Member.delete({ id });
    if (errors) throw errors;
    return true;
  }

  // MEMBER LIST (all) OBSERVABLE
  listMembers(): Observable<Member[]> {
    return this._authMode().pipe(
      switchMap((authMode) => {
        const client = generateClient<Schema>({ authMode: authMode });
        return from(
          client.models.Member.list({ limit: 300 })
            .then(({ data, errors }) => {
              if (errors) {
                console.error('Member.list error', errors);
                return [];
              }
              return data as Member[];
            })
        );
      })
    )
  }

  // MEMBER SEARCH BY LICENSE NUMBER
  async searchMemberByLicense(license_number: string): Promise<Member | null> {
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode: authMode });
    const { data, errors } = await client.models.Member.list({
      filter: { license_number: { eq: license_number } },
      limit : 300
    });
    if (errors) {
      console.error(errors);
      return null;
    }
    return data[0] as Member;   // array of only one element, hopefully !!!
  }

  // MEMBER SEARCH BY EMAIL
  async searchMemberByEmail(email: string): Promise<Member | null> {
    const normalizedEmail = email.trim().toLowerCase();
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode: authMode });
    const { data, errors } = await client.models.Member.list({
      filter: { email: { eq: normalizedEmail } },
      limit :300
    });
    if (errors) {
      console.error(errors);
      return null;
    }
    if (data.length === 0) {
      return null; // No member found with the given email
    }
    return data[0] as Member;   // array of only one element, hopefully !!!
  }


  // SNIPPETS SERVICE

  // SNIPPET CREATE PROMISE
  async createSnippet(snippet: Snippet_input): Promise<Snippet> {
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode: authMode });
    const { data, errors } = await client.models.Snippet.create(snippet);
    if (errors) throw errors;
    return data as Snippet;
  }

  // SNIPPET READ (single) PROMISE
  async readSnippet(id: string): Promise<Snippet> {
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode: authMode });
    const { data, errors } = await client.models.Snippet.get({ id });
    if (errors) throw errors;
    return data as Snippet;
  }

  // SNIPPET UPDATE PROMISE
  async updateSnippet(snippet: Snippet): Promise<Snippet> {
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode: authMode });
    const { data, errors } = await client.models.Snippet.update(snippet);
    if (errors) throw errors;
    return data as Snippet;
  }

  // SNIPPET DELETE PROMISE
  async deleteSnippet(id: string): Promise<boolean> {
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode: authMode });
    const { errors } = await client.models.Snippet.delete({ id });
    if (errors) throw errors;
    return true;
  }

  // SNIPPET LIST (all) OBSERVABLE
  listSnippets(): Observable<Snippet[]> {
    return this._authMode().pipe(
      switchMap((authMode) => {
        const client = generateClient<Schema>({ authMode: authMode });
        return from(
          client.models.Snippet.list({ limit: 300 })
            .then(({ data, errors }) => {
              if (errors) {
                console.error('Snippet.list error', errors);
                return [];
              }
              return data as Snippet[];
            })
        );
      })
    );
  }







  // PRODUCTS SERVICE

  // PRODUCT  CREATE PROMISE
  async createProduct(product: Product_input): Promise<Product> {
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode: authMode });
    const { data, errors } = await client.models.Product.create(product);
    if (errors) throw errors;
    if (data && 'info1' in data && data.info1 === null) {
      data.info1 = null;
    }
    return data as Product;
  }

  // PRODUCT  READ (single) PROMISE
  async readProduct(id: string): Promise<Product> {
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode: authMode });
    const { data, errors } = await client.models.Product.get({ id });
    if (errors) throw errors;
    return data as Product;
  }

  // PRODUCT UPDATE PROMISE
  async updateProduct(product: Product): Promise<Product> {
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode: authMode });
    const { data, errors } = await client.models.Product.update(product);
    if (errors) throw errors;
    return data as Product;
  }

  // PRODUCT DELETE PROMISE (userPool authMode only) 
  async deleteProduct(id: string): Promise<boolean> {
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode: authMode });
    const { errors } = await client.models.Product.delete({ id });
    if (errors) throw errors;
    return true;
  }

  // PRODUCT LIST (all) OBSERVABLE
  listProducts(): Observable<Product[]> {
    return this._authMode().pipe(
      switchMap((authMode) => {
        const client = generateClient<Schema>({ authMode: authMode });
        return from(
          client.models.Product.list({ limit: 300 })
            .then(({ data, errors }) => {
              if (errors) {
                console.error('Product.list error', errors);
                return [];
              }
              return data as Product[];
            })
        );
      })
    );
  }


  // GAME SERVICE

create_custom_key(season : string, trn_id:number) : string{
  return season + '_' + trn_id;
}

   // CREATE PROMISE   ! validated
  async createGame(game: Game): Promise<Game> {
    const game_id = this.create_custom_key(game.season, game.tournament!.id);

    let game_input : Game_input = {
      gameId: game_id,
      season: game.season,
      member_trn_price: game.member_trn_price,
      non_member_trn_price: game.non_member_trn_price,
      fees_doubled: game.fees_doubled,
      fee_rate: game.fee_rate,
      alphabetic_sort: game.alphabetic_sort,
      tournament: game.tournament,
      gamers: JSON.stringify(game.gamers)
    };
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode: authMode });
    const { data : game_output, errors } = await client.models.Game.create(game_input);
    if (errors) throw errors;
    let created_game = game_output
      ? {
          ...game_output,
          gamers: typeof game_output.gamers === 'string'
            ? JSON.parse(game_output.gamers)
            : game_output.gamers,
          fee_rate: (game_output.fee_rate === null ? 'standard' : game_output.fee_rate) as Game['fee_rate']
        }
      : null;
    if (!created_game) throw new Error('Game creation failed: game_output is null');
    return created_game;
  }

  async  readGame(season : string, trn_id:number): Promise<Game | null> {
    let game_id = this.create_custom_key(season, trn_id);
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode: authMode });
    const { data : game_output, errors } = await client.models.Game.get({ gameId: game_id });
    // console.log('Game.read output:', game_output);
    if (errors) throw errors;
    let read_game = game_output
      ? {
          ...game_output,
          gamers: typeof game_output.gamers === 'string'
            ? JSON.parse(game_output.gamers)
            : game_output.gamers,
          fee_rate: (game_output.fee_rate === null ? 'standard' : game_output.fee_rate) as Game['fee_rate']
        }
      : null;
    return read_game;
  }

  async updateGame(game: Game): Promise<Game> {
    const game_id = this.create_custom_key(game.season, game.tournament!.id);
    let game_input : Game_input = {
      gameId: game_id,
      season: game.season,
      fee_rate: game.fee_rate,
      member_trn_price: game.member_trn_price,
      non_member_trn_price: game.non_member_trn_price,
      fees_doubled: game.fees_doubled,
      alphabetic_sort: game.alphabetic_sort,
      tournament: game.tournament,
      gamers: JSON.stringify(game.gamers)
    };
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode: authMode });
    const { data : game_output, errors } = await client.models.Game.update( game_input);
    if (errors) throw errors;
    let updated_game = game_output
      ? {
          ...game_output,
          gamers: typeof game_output.gamers === 'string'
            ? JSON.parse(game_output.gamers)
            : game_output.gamers,
          fee_rate: (game_output.fee_rate === null ? 'standard' : game_output.fee_rate) as Game['fee_rate']
        }
      : null;
    if (!updated_game) throw new Error('Game update failed: game_output is null');
    return updated_game;
  }

  async deleteGame(season : string, trn_id:number): Promise<boolean> {
    let  game_id = this.create_custom_key(season, trn_id);
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode: authMode });
    const { errors } = await client.models.Game.delete({ gameId: game_id });
    if (errors) throw errors;
    return true;
  }

  // PLAYBOOK SERVICE

  // CREATE PROMISE   ! validated
  async createPlayBook(playBook: PlayBook_input): Promise<PlayBook> {
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode: authMode });
    const { data, errors } = await client.models.PlayBook.create(playBook);
    if (errors) throw errors;
    return data as PlayBook;
  }

  // READ (single) PROMISE
  async readPlayBook(id: string): Promise<PlayBook> {
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode: authMode });
    const { data, errors } = await client.models.PlayBook.get({ id });
    if (errors) throw errors;
    return data as PlayBook;
  }

  // UPDATE PROMISE
  async updatePlayBook(playBook: PlayBook): Promise<PlayBook> {
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode: authMode });
    const { data, errors } = await client.models.PlayBook.update(playBook);
    if (errors) throw errors;
    return data as PlayBook;
  }

  // DELETE PROMISE
  async deletePlayBook(playBook: PlayBook): Promise<boolean> {
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode: authMode });
    const { errors } = await client.models.PlayBook.delete({ id: playBook.id });
    if (errors) return Promise.reject(errors);
    return true;
  }

  // LIST (all) OBSERVABLE
  listPlayBooks(): Observable<PlayBook[]> {
    return this._authMode().pipe(
      switchMap((authMode) => {
        const client = generateClient<Schema>({ authMode: authMode });
        return from(
          client.models.PlayBook.list({ limit: 300 })
            .then(({ data, errors }) => {
              if (errors) {
                // Mask error, return empty array
                return [];
              }
              return data as PlayBook[];
            })
        );
      }),
      catchError(() => {
        // Suppress error, return empty array
        return of([] as PlayBook[]);
      })
    );
  }
  // QUERY (all) OBSERVABLE
  // onlySynced=true: skip the initial partial page and emit when fully synced; keeps live updates
  // onlySynced=false: emit immediately with partial results and continue with updates
  queryPlayBooks(onlySynced: boolean = true): Observable<PlayBook[]> {
    return this._authMode().pipe(
      switchMap((authMode) => {
        const client = generateClient<Schema>({ authMode: authMode });
        const stream = client.models.PlayBook.observeQuery();
        return (onlySynced
          ? stream.pipe(filter((payload: any) => payload?.isSynced === true))
          : stream
        ).pipe(map(({ items }: any) => items as PlayBook[]));
      })
    );
  }

  // BOOKINGS SERVICE
  private jsonified_entry(entry: BookEntry): any {
    const replacer = (key: string, value: any) => {
      if (key === 'amounts' || key === 'values') {
        return JSON.stringify(value);
      }
      return value;
    }

    let stringified = JSON.stringify(entry, replacer);
    let parsed = JSON.parse(stringified);
    // Remove 'id' if it exists, as it is not part of the input type
    return parsed;
  }

  private parsed_entry(entry: BookEntry): BookEntry {
    const replacer = (key: string, value: any) => {
      if (key === 'amounts' || key === 'values') {
        return JSON.parse(value);
      }
      return value
    }

    let destringified = JSON.stringify(entry, replacer);
    return JSON.parse(destringified) as BookEntry;

  }
  // CREATE PROMISE    !validated
  async createBookEntry(book_entry: BookEntry): Promise<BookEntry> {
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode: authMode });
    let jsonified_entry = this.jsonified_entry(book_entry);
    delete jsonified_entry.id; // Ensure id is not included in the input type
    const { data, errors } = await client.models.BookEntry.create(jsonified_entry);
    if (errors) return Promise.reject(errors);
    return this.parsed_entry(data as BookEntry);
  }

  // READ (single)
  async readBookEntry(id: string): Promise<BookEntry> {
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode: authMode });
    const { data, errors } = await client.models.BookEntry.get(
      { id: id },
      { selectionSet: ['id', 'season', 'tag', 'date', 'amounts', 'operations.*', 'transaction_id', 'cheque_ref', 'deposit_ref', 'bank_report'] }

    );
    if (errors) throw errors;
    return this.parsed_entry(data as BookEntry);
  }

  // UPDATE PROMISE (userPool authMode only)   !validated
  async updateBookEntry(entry: BookEntry): Promise<BookEntry> {
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode: authMode });
    let jsonified_entry = this.jsonified_entry(entry);
    const { data, errors } = await client.models.BookEntry.update(jsonified_entry);
    if (errors) return Promise.reject(errors);
    return this.parsed_entry(data as BookEntry);
  }

  // DELETE PROMISE  
  async deleteBookEntry(entry_id: string): Promise<string> {
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode: authMode });
    const { data, errors } = await client.models.BookEntry.delete({ id: entry_id });
    if (errors) return Promise.reject(errors);
    return entry_id;
  }

  // LIST (all) OBSERVABLE  

  private fetchBookentries = async (authMode: 'userPool' | 'identityPool', _season: string): Promise<BookEntry[]> => {
    let failed = false;
    let entries: BookEntry[] = [];
    try {
      const client = generateClient<Schema>({ authMode: authMode });
      let token: any = null;
      let nbloops = 0;
      do {
        const { data, nextToken, errors } = await client.models.BookEntry.list({
          filter: { season: { eq: _season } },
          limit: 300,
          nextToken: token,
        });
        if (errors) {
          console.error('client.models.BookEntry.list failed !! : ', errors);
          failed = true;
          throw new Error(JSON.stringify(errors));
        }
        let new_jsoned_entries = data as unknown as BookEntry[];
        entries = [...entries, ...new_jsoned_entries.map((entry) => this.parsed_entry(entry))];
        token = nextToken;

      } while (token !== null && nbloops++ < 10 && !failed)


      if (token !== null) {
        console.warn('listBookEntries : too many entries to load, only %s loaded', entries.length);
        // this.toastService.showWarning('base comptabilité', 'beaucoup trop d\'entrées à charger , veuillez répeter l\'opération');
      }
      return entries;
    }
    catch (error) {
      throw new Error(error instanceof Error ? error.message : String(error));
    }
  }

  listBookEntries(season: string): Observable<BookEntry[]> {
    return this._authMode().pipe(
      switchMap((authMode) => {
        return from(this.fetchBookentries(authMode, season))
      })
    );
  }

  bulkDeleteBookEntries(season: string): Observable<number> {
    return this._authMode().pipe(
      switchMap((authMode) => {
        return from(this.fetchBookentries(authMode, season)).pipe(
          switchMap((entries) => {
            if (entries.length === 0) {
              return of(0);
            }
            const client = generateClient<Schema>({ authMode: authMode });
            return from(
              Promise.all(entries.map((entry) => client.models.BookEntry.delete({ id: entry.id })))
                .then(() => entries.length)
                .catch((error) => {
                  console.error('Error deleting book entries:', error);
                  return 0;
                })
            );
          })
        );
      })
    );
  }


  
}
