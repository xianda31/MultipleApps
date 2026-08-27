import { Injectable } from '@angular/core';
import { generateClient } from 'aws-amplify/api';
import { catchError, from, lastValueFrom, map, Observable, of, switchMap, tap, filter } from 'rxjs';
import { safeGetCurrentUser$ } from '../authentification/safe-auth';
import { Member, Member_input } from '../interfaces/member.interface';
import { BookEntry } from '../interfaces/accounting.interface';
import { Schema } from '../../../../../../amplify/data/resource';
import { Product, Product_input } from '../../back/products/product.interface';
import { StripeProduct, StripeProductInput } from '../../back/products/stripe-product.interface';
import { PlayBook, PlayBook_input } from '../../back/game-cards/game-card.interface';
import { Page, Page_input, Snippet, Snippet_input } from '../interfaces/page_snippet.interface';
import { Game, GameCheckIn, GameFeeConfiguration, Game_input } from '../../back/fees/fees.interface';
import { NavItem, NavItem_input } from '../interfaces/navitem.interface';
import { AssistanceRequest, AssistanceRequestInput } from '../interfaces/assistance-request.interface';
import { MailingList, MailingListInput } from '../../back/mailing/mailing-list.interface';

@Injectable({
  providedIn: 'root'
})
export class DBhandler {
  constructor(
  ) { }

  private sanitizeSaleItemInput(product: Partial<Product>): any {
    const {
      productCode,
      createdAt,
      updatedAt,
      ...rest
    } = product as any;

    const normalizedCode = productCode ?? null;

    return {
      ...rest,
      productCode: normalizedCode,
    };
  }


  private _authMode(): Observable<'userPool' | 'identityPool'> {
    return safeGetCurrentUser$().pipe(
      map((user) => { return user !== null ? 'userPool' : 'identityPool' }),
      catchError(() => of('identityPool' as const))
    );
  }

  private isUnauthorizedGraphQLError(error: unknown): boolean {
    const entries = Array.isArray(error) ? error : [error];
    return entries.some((entry: any) => {
      const message = String(entry?.message ?? '').toLowerCase();
      const errorType = String(entry?.errorType ?? entry?.extensions?.errorType ?? '').toLowerCase();
      return (
        message.includes('unauthorized') ||
        message.includes('not authorized') ||
        errorType.includes('unauthorized')
      );
    });
  }



  // PAGE SERVICE

  // PAGE CREATE PROMISE
  async createPage(page: Page_input): Promise<Page> {
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode: authMode });
    const { data: pageData, errors } = await client.models.Page.create(page);
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

  private readonly memberSelectionSet = [
    'id',
    'license_number',
    'email',
    'gender',
    'firstname',
    'lastname',
    'birthdate',
    'city',
    'phone_one',
    'orga_license_name',
    'is_sympathisant',
    'license_status',
    'license_taken_at',
    'register_date',
    'accept_mailing',
    'membership_date',
    'person_id',
    'memberStatus',
    'iv',
    'iv_code',
    'createdAt',
    'updatedAt',
  ] as const;

  private normalizeMemberEmail<T extends { email?: string | null }>(member: T): T {
    if (!member || typeof member.email !== 'string') {
      return member;
    }
    return {
      ...member,
      email: member.email.trim().toLowerCase(),
    };
  }

  // MEMBER CREATE PROMISE
  async createMember(member: Member_input): Promise<Member> {
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode: authMode });
    const normalizedMember = this.normalizeMemberEmail(member);
    const { data, errors } = await client.models.Member.create(normalizedMember, {
      selectionSet: this.memberSelectionSet,
    });
    if (errors) throw errors;
    return data as unknown as Member;
  }

  // MEMBER READ (single) PROMISE
  async readMember(id: string): Promise<Member | null> {
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode: authMode });
    const { data, errors } = await client.models.Member.get({ id }, {
      selectionSet: this.memberSelectionSet,
    });
    if (errors) throw errors;
    return data as unknown as Member;
  }

  // MEMBER UPDATE PROMISE
  async updateMember(member: Member): Promise<Member> {
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode: authMode });
    const normalizedMember = this.normalizeMemberEmail(member);
    const { data, errors } = await client.models.Member.update(normalizedMember, {
      selectionSet: this.memberSelectionSet,
    });
    if (errors) throw errors;
    return data as unknown as Member;
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
          client.models.Member.list({
            limit: 300,
            selectionSet: this.memberSelectionSet,
          })
            .then(({ data, errors }) => {
              if (errors) {
                console.error('Member.list error', errors);
                return [];
              }
              return data as unknown as Member[];
            })
        );
      })
    )
  }

  // MAILING LIST SERVICE

  async createMailingList(mailingList: MailingListInput): Promise<MailingList> {
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode });
    const { data, errors } = await client.models.MailingList.create(mailingList);
    if (errors) throw errors;
    return data as unknown as MailingList;
  }

  async readMailingList(id: string): Promise<MailingList | null> {
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode });
    const { data, errors } = await client.models.MailingList.get({ id });
    if (errors) throw errors;
    return data as unknown as MailingList | null;
  }

  async updateMailingList(mailingList: MailingList): Promise<MailingList> {
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode });
    const { data, errors } = await client.models.MailingList.update(mailingList);
    if (errors) throw errors;
    return data as unknown as MailingList;
  }

  async deleteMailingList(id: string): Promise<boolean> {
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode });
    const { errors } = await client.models.MailingList.delete({ id });
    if (errors) throw errors;
    return true;
  }

  listMailingLists(): Observable<MailingList[]> {
    return this._authMode().pipe(
      switchMap((authMode) => {
        const client = generateClient<Schema>({ authMode });
        return from(
          client.models.MailingList.list({ limit: 300 })
            .then(({ data, errors }) => {
              if (errors) throw errors;
              return (data as unknown as MailingList[])
                .sort((left, right) => left.title.localeCompare(right.title, 'fr', { sensitivity: 'base' }));
            })
        );
      })
    );
  }

  // MEMBER SEARCH BY LICENSE NUMBER
  async searchMemberByLicense(license_number: string): Promise<Member | null> {
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode: authMode });
    const { data, errors } = await client.models.Member.list({
      filter: { license_number: { eq: license_number } },
      limit: 300
    });
    if (errors) {
      console.error(errors);
      return null;
    }
    return data[0] as unknown as Member;   // array of only one element, hopefully !!!
  }

  // MEMBER SEARCH BY EMAIL
  async searchMemberByEmail(email: string): Promise<Member | null> {
    const normalizedEmail = email.trim().toLowerCase();
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode: authMode });
    
    let nextToken: string | null | undefined = undefined;
    do {
      const page: any = await client.models.Member.list({
        filter: { email: { eq: normalizedEmail } },
        limit: 300,
        nextToken: nextToken || undefined,
      } as any);

      if (page.errors) {
        console.error(page.errors);
        throw new Error('MemberSearchByEmailQueryFailed');
      }

      if (Array.isArray(page.data) && page.data.length > 0) {
        return page.data[0] as unknown as Member;
      }

      nextToken = page.nextToken;
    } while (nextToken);

    // Fallback pour données héritage non-normalisées : recherche case-insensitive
    nextToken = undefined;
    do {
      const page: any = await client.models.Member.list({
        limit: 300,
        nextToken: nextToken || undefined,
      } as any);

      if (page.errors) {
        console.error(page.errors);
        throw new Error('MemberSearchByEmailFallbackFailed');
      }

      const member = ((page.data as unknown as Member[]) || []).find((m) =>
        String(m?.email || '').trim().toLowerCase() === normalizedEmail
      );

      if (member) {
        console.warn('[DB] Member found via case-insensitive fallback', { 
          storedEmail: member.email, 
          searchedEmail: normalizedEmail 
        });
        return member;
      }

      nextToken = page.nextToken;
    } while (nextToken);

    return null;
  }


  // ASSISTANCE REQUESTS SERVICE

  // CREATE
  async createAssistanceRequest(input: AssistanceRequestInput): Promise<AssistanceRequest> {
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode });
    const { data, errors } = await client.models.AssistanceRequest.create(input);
    if (errors) throw errors;
    return data as unknown as AssistanceRequest;
  }

  // READ (single)
  async readAssistanceRequest(id: string): Promise<AssistanceRequest> {
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode });
    const { data, errors } = await client.models.AssistanceRequest.get({ id });
    if (errors) throw errors;
    return data as unknown as AssistanceRequest;
  }

  // UPDATE
  async updateAssistanceRequest(request: AssistanceRequest): Promise<AssistanceRequest> {
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode });
    const { data, errors } = await client.models.AssistanceRequest.update(request);
    if (errors) throw errors;
    return data as unknown as AssistanceRequest;
  }

  // DELETE
  async deleteAssistanceRequest(id: string): Promise<boolean> {
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode });
    const { errors } = await client.models.AssistanceRequest.delete({ id });
    if (errors) throw errors;
    return true;
  }

  // LIST (all)
  listAssistanceRequests(): Observable<AssistanceRequest[]> {
    return this._authMode().pipe(
      switchMap((authMode) => {
        // Assistance list is restricted to authenticated groups; skip guest mode.
        if (authMode === 'identityPool') {
          return of([] as AssistanceRequest[]);
        }

        const client = generateClient<Schema>({ authMode });
        return from(
          client.models.AssistanceRequest.list({ limit: 300 })
            .then(({ data, errors }) => {
              if (errors) {
                console.error('AssistanceRequest.list error', errors);
                return [];
              }
              return data as unknown as AssistanceRequest[];
            })
        );
      })
    );
  }

  // VISIT TRACKING SERVICE

  async createVisitSession(input: {
    sessionId: string;
    date: string;
    yearMonth: string;
    firstSeenAt: string;
    lastSeenAt: string;
    pageViewCount: number;
    authenticated: boolean;
    memberId?: string;
    section: string;
  }): Promise<void> {
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode });
    const { errors } = await client.models.VisitSession.create(input);
    if (errors) throw errors;
  }

  async readVisitSession(sessionId: string): Promise<{
    sessionId: string;
    date: string;
    yearMonth: string;
    firstSeenAt: string;
    lastSeenAt: string;
    pageViewCount: number;
    authenticated: boolean;
    memberId?: string | null;
    section: string;
  } | null> {
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode });
    const { data, errors } = await client.models.VisitSession.get({ sessionId });
    if (errors) throw errors;
    return (data as unknown as {
      sessionId: string;
      date: string;
      yearMonth: string;
      firstSeenAt: string;
      lastSeenAt: string;
      pageViewCount: number;
      authenticated: boolean;
      memberId?: string | null;
      section: string;
    }) || null;
  }

  async updateVisitSession(input: {
    sessionId: string;
    lastSeenAt: string;
    pageViewCount: number;
    authenticated: boolean;
    memberId?: string;
    section?: string;
  }): Promise<void> {
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode });
    const { errors } = await client.models.VisitSession.update(input);
    if (errors) throw errors;
  }

  async createVisitDailyStat(input: {
    date: string;
    section: string;
    yearMonth: string;
    totalSessions: number;
    authenticatedSessions: number;
    anonymousSessions: number;
    pageViews: number;
  }): Promise<void> {
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode });
    const { errors } = await client.models.VisitDailyStat.create(input);
    if (errors) throw errors;
  }

  async readVisitDailyStat(date: string, section: string): Promise<{
    date: string;
    section: string;
    yearMonth: string;
    totalSessions: number;
    authenticatedSessions: number;
    anonymousSessions: number;
    pageViews: number;
  } | null> {
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode });
    const { data, errors } = await client.models.VisitDailyStat.get({ date, section });
    if (errors) throw errors;
    return (data as unknown as {
      date: string;
      section: string;
      yearMonth: string;
      totalSessions: number;
      authenticatedSessions: number;
      anonymousSessions: number;
      pageViews: number;
    }) || null;
  }

  async updateVisitDailyStat(input: {
    date: string;
    section: string;
    totalSessions: number;
    authenticatedSessions: number;
    anonymousSessions: number;
    pageViews: number;
  }): Promise<void> {
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode });
    const { errors } = await client.models.VisitDailyStat.update(input);
    if (errors) throw errors;
  }

  listVisitDailyStats(): Observable<{
    date: string;
    section: string;
    yearMonth: string;
    totalSessions: number;
    authenticatedSessions: number;
    anonymousSessions: number;
    pageViews: number;
  }[]> {
    return this._authMode().pipe(
      switchMap((authMode) => {
        const client = generateClient<Schema>({ authMode });
        return from(
          client.models.VisitDailyStat.list({ limit: 5000 })
            .then(({ data, errors }) => {
              if (errors) {
                console.error('VisitDailyStat.list error', errors);
                return [];
              }
              return data as unknown as {
                date: string;
                section: string;
                yearMonth: string;
                totalSessions: number;
                authenticatedSessions: number;
                anonymousSessions: number;
                pageViews: number;
              }[];
            })
        );
      })
    );
  }

  // SNIPPETS SERVICE

  // SNIPPET CREATE PROMISE
  async createSnippet(snippet: Snippet_input): Promise<Snippet> {
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode: authMode });
    const { data, errors } = await client.models.Snippet.create(snippet);
    if (errors) throw errors;
    return data as unknown as Snippet;
  }

  // SNIPPET READ (single) PROMISE
  async readSnippet(id: string): Promise<Snippet> {
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode: authMode });
    const { data, errors } = await client.models.Snippet.get({ id });
    if (errors) throw errors;
    return data as unknown as Snippet;
  }

  // SNIPPET UPDATE PROMISE
  async updateSnippet(snippet: Snippet): Promise<Snippet> {
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode: authMode });
    const { data, errors } = await client.models.Snippet.update(snippet);
    if (errors) throw errors;
    return data as unknown as Snippet;
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
              return data as unknown as Snippet[];
            })
        );
      })
    );
  }


 // STRIPE PRODUCT SERVICE

  // CREATE

  async createStripeProduct(product: StripeProductInput): Promise<StripeProduct> {
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode });
    const input = this.sanitizeSaleItemInput(product as any);
    const { data, errors } = await client.models.SaleItem.create(input as any);
    if (errors) throw errors;
    return data as unknown as StripeProduct;
  }

  // READ (single)

  async readStripeProduct(id: string): Promise<StripeProduct> {
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode });
    const { data, errors } = await client.models.SaleItem.get({ id });
    if (errors) throw errors;
    return data as unknown as StripeProduct;
  }

  // UPDATE

  async updateStripeProduct(product: StripeProduct & { id: string }): Promise<StripeProduct> {
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode });
    const input = this.sanitizeSaleItemInput(product as any);
    const { data, errors } = await client.models.SaleItem.update(input as any);
    if (errors) throw errors;
    return data as unknown as StripeProduct;
  }

  // DELETE

  async deleteStripeProduct(id: string): Promise<boolean> {
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode });
    const { errors } = await client.models.SaleItem.delete({ id });
    if (errors) throw errors;
    return true;
  }

  // LIST (active + stripeEnabled)
  listStripeProducts(): Observable<StripeProduct[]> {
    return this._authMode().pipe(
      switchMap((authMode) => {
        const client = generateClient<Schema>({ authMode });
        return from(client.models.SaleItem.list({ limit: 300 })).pipe(
          map(({ data, errors }) => {
            if (errors) {
              console.error('SaleItem.list (stripe) error', errors);
              return [];
            }
            return (data as unknown as StripeProduct[]).filter((p: any) => p.stripeEnabled && p.active);
          })
        );
      })
    );
  }


  // STRIPE TRANSACTION SERVICE

  async listUnprocessedStripeTransactions(): Promise<any[]> {
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode });
    const { data, errors } = await client.models.StripeTransaction.list({ limit: 300 });
    if (errors?.length) console.error('StripeTransaction.list (unprocessed) partial errors', errors);
    // Filtrer les items null (violation de champ requis côté AppSync sur des
    // enregistrements corrompus) avant tout accès aux propriétés.
    return ((data as any[] | null) ?? []).filter(Boolean).filter((t: any) => t.status === 'completed' && !t.processed);
  }

  async listUnpayoutedStripeTransactions(): Promise<any[]> {
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode });
    const { data, errors } = await client.models.StripeTransaction.list({ limit: 300 });
    if (errors?.length) console.error('StripeTransaction.list (unpayouted) partial errors', errors);
    return ((data as any[] | null) ?? []).filter(Boolean).filter((t: any) => t.status === 'completed' && !t.payoutId);
  }

  async listAbandonedStripeTransactions(): Promise<any[]> {
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode });
    const { data, errors } = await client.models.StripeTransaction.list({ limit: 300 });
    if (errors?.length) console.error('StripeTransaction.list (abandoned) partial errors', errors);
    return ((data as any[] | null) ?? []).filter(Boolean).filter((t: any) => ['abandoned', 'canceled', 'incomplete', 'expired'].includes(t.status));
  }

  async markStripeTransactionProcessed(id: string): Promise<void> {
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode });
    const { errors } = await client.models.StripeTransaction.update({ id, processed: true } as any);
    if (errors && errors.length > 0) {
      if (this.isUnauthorizedGraphQLError(errors)) {
        // Expected in member online flow: member role has read-only on StripeTransaction.
        console.info('[Stripe] markStripeTransactionProcessed ignored (unauthorized for current role).');
        return;
      }
      throw errors;
    }
  }

  async listProcessedUnpayoutedStripeTransactions(): Promise<any[]> {
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode });
    const { data, errors } = await client.models.StripeTransaction.list({ limit: 300 });
    if (errors?.length) console.error('StripeTransaction.list (processed/unpayouted) partial errors', errors);
    return ((data as any[] | null) ?? []).filter(Boolean).filter((t: any) => t.processed === true && !t.payoutId);
  }

  async updateStripeTransactionPayout(id: string, payoutId: string, reconciledAt: string): Promise<void> {
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode });
    const { errors } = await client.models.StripeTransaction.update({ id, payoutId, reconciledAt } as any);
    if (errors) throw errors;
  }

  async resetStripeTransactionPayout(id: string): Promise<void> {
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode });
    const { errors } = await client.models.StripeTransaction.update({ id, payoutId: null, reconciledAt: null } as any);
    if (errors) throw errors;
  }

  async listStripeTransactionsByPayoutId(payoutId: string): Promise<any[]> {
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode });
    const { data, errors } = await client.models.StripeTransaction.list({ limit: 300 });
    if (errors?.length) console.error('StripeTransaction.list (by payoutId) partial errors', errors);
    return ((data as any[] | null) ?? []).filter(Boolean).filter((t: any) => t.payoutId === payoutId);
  }





  // PRODUCTS SERVICE

  // PRODUCT  CREATE PROMISE
  async createProduct(product: Product_input): Promise<Product> {
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode: authMode });
    const input = this.sanitizeSaleItemInput(product as any);
    const { data, errors } = await client.models.SaleItem.create(input as any);
    if (errors) throw errors;
    return data as unknown as Product;
  }

  // PRODUCT  READ (single) PROMISE
  async readProduct(id: string): Promise<Product> {
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode: authMode });
    const { data, errors } = await client.models.SaleItem.get({ id });
    if (errors) throw errors;
    return data as unknown as Product;
  }

  // PRODUCT UPDATE PROMISE
  async updateProduct(product: Product): Promise<Product> {
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode: authMode });
    const input = this.sanitizeSaleItemInput(product as any);
    const { data, errors } = await client.models.SaleItem.update(input as any);
    if (errors) throw errors;
    return data as unknown as Product;
  }

  // PRODUCT DELETE PROMISE (userPool authMode only)
  async deleteProduct(id: string): Promise<boolean> {
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode: authMode });
    const { errors } = await client.models.SaleItem.delete({ id });
    if (errors) throw errors;
    return true;
  }

  // PRODUCT LIST (all) OBSERVABLE
  listProducts(): Observable<Product[]> {
    return this._authMode().pipe(
      switchMap((authMode) => {
        const client = generateClient<Schema>({ authMode: authMode });
        return from(
          client.models.SaleItem.list({ limit: 300 })
            .then(({ data, errors }) => {
              if (errors) {
                console.error('Product.list error', errors);
                return [];
              }
              return data as unknown as Product[];
            })
        );
      })
    );
  }


  // GAME SERVICE

  create_custom_key(season: string, trn_id: number): string {
    return season + '_' + trn_id;
  }

  // CREATE PROMISE   ! validated
  async createGame(game: Game): Promise<Game> {
    const game_id = this.create_custom_key(game.season, game.tournament!.id);

    let game_input: Game_input = {
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
    const { data: game_output_raw, errors } = await client.models.Game.create(game_input);
    if (errors) throw errors;
    const game_output = game_output_raw as any;
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
    return created_game as unknown as Game;
  }

  async readGame(season: string, trn_id: number): Promise<Game | null> {
    let game_id = this.create_custom_key(season, trn_id);
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode: authMode });
    const { data: game_output_raw, errors } = await client.models.Game.get({ gameId: game_id });
    // console.log('Game.read output:', game_output);
    if (errors) throw errors;
    const game_output = game_output_raw as any;
    let read_game = game_output
      ? {
        ...game_output,
        gamers: typeof game_output.gamers === 'string'
          ? JSON.parse(game_output.gamers)
          : game_output.gamers,
        fee_rate: (game_output.fee_rate === null ? 'standard' : game_output.fee_rate) as Game['fee_rate']
      }
      : null;
    return read_game as unknown as Game | null;
  }

  async updateGame(game: Game): Promise<Game> {
    const game_id = this.create_custom_key(game.season, game.tournament!.id);
    let game_input: Game_input = {
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
    const { data: game_output_raw, errors } = await client.models.Game.update(game_input);
    if (errors) throw errors;
    const game_output = game_output_raw as any;
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
    return updated_game as unknown as Game;
  }

  async deleteGame(season: string, trn_id: number): Promise<boolean> {
    let game_id = this.create_custom_key(season, trn_id);
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode: authMode });
    const { errors } = await client.models.Game.delete({ gameId: game_id });
    if (errors) throw errors;
    return true;
  }

  async upsertGameCheckIn(checkIn: Omit<GameCheckIn, 'updatedAt'>): Promise<GameCheckIn> {
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode });
    const model = client.models.GameCheckIn;
    const key = { gameId: checkIn.gameId, license: checkIn.license };
    const { data: existing, errors: readErrors } = await model.get(key);
    if (readErrors) throw readErrors;

    const write = existing
      ? model.update(checkIn)
      : model.create(checkIn);
    let { data, errors } = await write;

    if (errors && !existing) {
      const retry = await model.update(checkIn);
      data = retry.data;
      errors = retry.errors;
    }
    if (errors) throw errors;
    if (!data) throw new Error('GameCheckIn upsert returned no data');
    return data as unknown as GameCheckIn;
  }

  async listGameCheckIns(gameId: string): Promise<GameCheckIn[]> {
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode });
    const { data, errors } = await client.models.GameCheckIn.list({
      filter: { gameId: { eq: gameId } },
      limit: 300,
    });
    if (errors) throw errors;
    return (data ?? []) as unknown as GameCheckIn[];
  }

  async readGameCheckIn(gameId: string, license: string): Promise<GameCheckIn | null> {
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode });
    const { data, errors } = await client.models.GameCheckIn.get({ gameId, license });
    if (errors) throw errors;
    return data as unknown as GameCheckIn | null;
  }

  observeGameCheckIns(gameId: string): Observable<GameCheckIn[]> {
    return this._authMode().pipe(
      switchMap((authMode) => {
        const client = generateClient<Schema>({ authMode });
        return client.models.GameCheckIn.observeQuery({
          filter: { gameId: { eq: gameId } },
        }).pipe(
          map(({ items }) => items as unknown as GameCheckIn[]),
        );
      }),
    );
  }

  async deleteGameCheckIns(gameId: string): Promise<void> {
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode });
    const checkIns = await this.listGameCheckIns(gameId);
    await Promise.all(checkIns.map(async ({ license }) => {
      const { errors } = await client.models.GameCheckIn.delete({ gameId, license });
      if (errors) throw errors;
    }));
  }

  async initializeGameFeeConfiguration(
    configuration: Omit<GameFeeConfiguration, 'updatedAt'>,
  ): Promise<GameFeeConfiguration> {
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode });
    const model = client.models.GameFeeConfiguration;
    const { data: existing, errors: readErrors } = await model.get({ gameId: configuration.gameId });
    if (readErrors) throw readErrors;
    if (existing) return existing as unknown as GameFeeConfiguration;

    const { data, errors } = await model.create(configuration);
    if (data && !errors) return data as unknown as GameFeeConfiguration;

    const { data: winner, errors: retryErrors } = await model.get({ gameId: configuration.gameId });
    if (retryErrors) throw retryErrors;
    if (winner) return winner as unknown as GameFeeConfiguration;
    throw errors ?? new Error('Unable to initialize GameFeeConfiguration');
  }

  async updateGameFeeConfiguration(
    configuration: Omit<GameFeeConfiguration, 'updatedAt'>,
  ): Promise<GameFeeConfiguration> {
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode });
    const { data, errors } = await client.models.GameFeeConfiguration.update(configuration);
    if (errors) throw errors;
    if (!data) throw new Error('GameFeeConfiguration update returned no data');
    return data as unknown as GameFeeConfiguration;
  }

  async readGameFeeConfiguration(gameId: string): Promise<GameFeeConfiguration | null> {
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode });
    const { data, errors } = await client.models.GameFeeConfiguration.get({ gameId });
    if (errors) throw errors;
    return data as unknown as GameFeeConfiguration | null;
  }

  observeGameFeeConfiguration(gameId: string): Observable<GameFeeConfiguration[]> {
    return this._authMode().pipe(
      switchMap((authMode) => {
        const client = generateClient<Schema>({ authMode });
        return client.models.GameFeeConfiguration.observeQuery({
          filter: { gameId: { eq: gameId } },
        }).pipe(
          map(({ items }) => items as unknown as GameFeeConfiguration[]),
        );
      }),
    );
  }

  async deleteGameFeeConfiguration(gameId: string): Promise<void> {
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode });
    const { errors } = await client.models.GameFeeConfiguration.delete({ gameId });
    if (errors) throw errors;
  }

  async readGameSettlementStatus(gameId: string): Promise<string | null> {
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode });
    const { data, errors } = await client.models.GameSettlement.get({ gameId });
    if (errors) throw errors;
    return data?.status ?? null;
  }

  async acquireGameSettlement(
    gameId: string,
    lockedBy: string,
  ): Promise<'acquired' | 'closing' | 'completed' | 'failed'> {
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode });
    const { data: existing, errors: readErrors } = await client.models.GameSettlement.get({ gameId });
    if (readErrors) throw readErrors;
    if (existing) return existing.status as 'closing' | 'completed' | 'failed';

    const { data, errors } = await client.models.GameSettlement.create({
      gameId,
      status: 'closing',
      lockedBy,
    });
    if (data && !errors) return 'acquired';

    const { data: winner, errors: retryErrors } = await client.models.GameSettlement.get({ gameId });
    if (retryErrors) throw retryErrors;
    if (winner) return winner.status as 'closing' | 'completed' | 'failed';
    throw errors ?? new Error('Unable to acquire GameSettlement lock');
  }

  async completeGameSettlement(gameId: string): Promise<void> {
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode });
    const { errors } = await client.models.GameSettlement.update({
      gameId,
      status: 'completed',
      error: null,
    });
    if (errors) throw errors;
  }

  async failGameSettlement(gameId: string, error: string): Promise<void> {
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode });
    const { errors } = await client.models.GameSettlement.update({
      gameId,
      status: 'failed',
      error,
    });
    if (errors) throw errors;
  }

  async deleteGameSettlement(gameId: string): Promise<void> {
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode });
    const { errors } = await client.models.GameSettlement.delete({ gameId });
    if (errors) throw errors;
  }

  // PLAYBOOK SERVICE

  // CREATE PROMISE   ! validated
  async createPlayBook(playBook: PlayBook_input): Promise<PlayBook> {
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode: authMode });
    const { data, errors } = await client.models.PlayBook.create(playBook);
    if (errors) throw errors;
    return data as unknown as PlayBook;
  }

  // READ (single) PROMISE
  async readPlayBook(id: string): Promise<PlayBook> {
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode: authMode });
    const { data, errors } = await client.models.PlayBook.get({ id });
    if (errors) throw errors;
    return data as unknown as PlayBook;
  }

  // UPDATE PROMISE
  async updatePlayBook(playBook: PlayBook): Promise<PlayBook> {
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode: authMode });
    const { data, errors } = await client.models.PlayBook.update(playBook);
    if (errors) throw errors;
    return data as unknown as PlayBook;
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
              return data as unknown as PlayBook[];
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
        const stream = (client.models.PlayBook as any).observeQuery();
        return (onlySynced
          ? stream.pipe(filter((payload: any) => payload?.isSynced === true))
          : stream
        ).pipe(map(({ items }: any) => items as PlayBook[])) as Observable<PlayBook[]>;
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
    return this.parsed_entry(data as unknown as BookEntry);
  }

  // READ (single)
  async readBookEntry(id: string): Promise<BookEntry> {
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode: authMode });
    const { data, errors } = await client.models.BookEntry.get(
      { id: id },
      { selectionSet: ['id', 'season', 'tag', 'stripeTag', 'date', 'amounts', 'operations.*', 'transaction_id', 'cheque_ref', 'deposit_ref', 'bank_report', 'invoice_ref'] }

    );
    if (errors) throw errors;
    return this.parsed_entry(data as unknown as BookEntry);
  }

  // UPDATE PROMISE (userPool authMode only)   !validated
  async updateBookEntry(entry: BookEntry): Promise<BookEntry> {
    const authMode = await lastValueFrom(this._authMode());
    const client = generateClient<Schema>({ authMode: authMode });
    let jsonified_entry = this.jsonified_entry(entry);
    const { data, errors } = await client.models.BookEntry.update(jsonified_entry);
    if (errors) return Promise.reject(errors);
    return this.parsed_entry(data as unknown as BookEntry);
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
