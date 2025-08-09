import { Injectable } from '@angular/core';
import { generateClient } from 'aws-amplify/api';
import { catchError, from, lastValueFrom, map, Observable, of, switchMap, tap } from 'rxjs';
import { getCurrentUser } from 'aws-amplify/auth';
import { Member, Member_input } from '../interfaces/member.interface';
import { BookEntry } from '../interfaces/accounting.interface';
import { Schema } from '../../../../../../amplify/data/resource';
import { Product, Product_input } from '../../back/products/product.interface';
import { Snippet, Snippet_input } from '../../back/snippets/snippet.interface';
import { PlayBook, PlayBook_input } from '../../back/game-cards/game-card.interface';


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
