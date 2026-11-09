import { Component, OnDestroy } from '@angular/core';
import { firstValueFrom, take } from 'rxjs';
import { Expense, PurchaseStatementEntry, Revenue } from '../../common/interfaces/accounting.interface';
import { SystemDataService } from '../../common/services/system-data.service';
import { BookService } from '../services/book.service';
import { Member } from '../../common/interfaces/member.interface';
import { InputMemberComponent } from '../input-member/input-member.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MembersService } from '../../common/services/members.service';
import { Revenue_and_expense_definition } from '../../common/interfaces/system-conf.interface';
import { LicenseesService } from '../../common/services/licensees.service';
import { MemberSyncService } from '../../common/services/member-sync.service';
import { PurchaseStatementComponent } from '../../common/components/purchase-statement/purchase-statement.component';
import { PurchaseAccountViewComponent } from '../../common/components/purchase-account-view/purchase-account-view.component';

interface Payment { [key: string]: number };

@Component({
  selector: 'app-member-sales',
  standalone: true,
  imports: [CommonModule, FormsModule, InputMemberComponent, PurchaseStatementComponent, PurchaseAccountViewComponent],
  templateUrl: './member-sales.component.html',
  styleUrl: './member-sales.component.scss'
})
export class MemberSalesComponent implements OnDestroy {
  loaded: boolean = false;
  loadingProgress: number = 0;
  loadingMessage: string = 'Préparation de la synthèse';
  loadingError: string = '';
  private loadingProgressLimit: number = 0;
  private loadingAnimation?: ReturnType<typeof setInterval>;
  season: string = '';
  operations: (Revenue | Expense)[] = [];
  revenues: Revenue[] = [];
  purchase_entries: PurchaseStatementEntry[] = [];
  avoirs: number = 0;
  debt: number = 0;
  productDescriptions: ReadonlyMap<string, string> = new Map();

  accounts: Revenue_and_expense_definition[] = [];
  selected_account: Revenue_and_expense_definition | null = null;
  payments: { [key: string]: Payment } = {};

  collectedLicenses: string[] = [];
  missingMembership: string[] = [];
  membersNotDeclaredAtFFB: { full_name: string; license_number: string }[] = [];
  membersToBeDeclaredAtFFB_nbr : number = 0;
  buyWithoutMembership: string[] = [];



  members: Member[] = [];
  ffbBaseReferences: ReadonlySet<number | string> = new Set<number | string>();
  selected_member: Member | null = null;
  truncature = '1.2-2';  // '1.0-0';// '1.2-2';  //
  constructor(
    private bookService: BookService,
    private systemDataService: SystemDataService,
    private memberService: MembersService,
    private licenseesService: LicenseesService,
    private memberSyncService: MemberSyncService

  ) { }
  ngOnInit() {
    this.loaded = false;
    this.loadingError = '';
    this.updateLoading(5, 'Chargement initial : 0/3 sources disponibles', 84);
    this.startLoadingAnimation();

    void (async () => {
      try {
        let initialLoadsCompleted = 0;
        const trackInitialLoad = async <T>(promise: Promise<T>): Promise<T> => {
          const result = await promise;
          initialLoadsCompleted += 1;
          const completedProgress = [25, 45, 85][initialLoadsCompleted - 1];
          this.updateLoading(
            completedProgress,
            `Chargement initial : ${initialLoadsCompleted}/3 sources disponibles`,
          );
          return result;
        };

        const [members, conf, licensees] = await Promise.all([
          trackInitialLoad(this.memberSyncService.ensureMembersSynchronized()),
          trackInitialLoad(firstValueFrom(this.systemDataService.get_configuration().pipe(take(1)))),
          trackInitialLoad(firstValueFrom(this.licenseesService.getClubMembers$().pipe(take(1)))),
        ]);
        await this.allowProgressRendering(150);

        this.members = members;
        this.selected_member = null;
        this.season = conf.season!;
        this.accounts = conf.revenue_and_expense_tree.revenues;
        this.productDescriptions = new Map(
          conf.revenue_and_expense_tree.revenues.map(product => [product.key, product.description] as const)
        );
        this.ffbBaseReferences = this.memberService.buildFfbBaseReferences(licensees);

        this.updateLoading(86, 'Chargement des écritures comptables', 90);
        await firstValueFrom(this.bookService.list_book_entries().pipe(take(1)));

        this.updateLoading(91, 'Préparation des opérations adhérents', 93);
        await this.allowProgressRendering();
        this.operations = this.bookService.get_revenues_from_members();

        this.updateLoading(94, 'Contrôle des licences perçues');
        await this.allowProgressRendering();
        this.checkLicenseDeclared();

        this.updateLoading(96, 'Contrôle des adhésions');
        await this.allowProgressRendering();
        this.checkMembershipPaid();

        this.updateLoading(98, 'Contrôle des achats');
        await this.allowProgressRendering();
        this.checkBuyWithoutMembership();

        this.updateLoading(99, 'Comparaison avec les déclarations FFB');
        await this.allowProgressRendering();
        this.checkMembersNotDeclaredAtFFB();
        this.updateLoading(100, 'Synthèse terminée');
        await this.allowProgressRendering(150);
        this.stopLoadingAnimation();
        this.loaded = true;
      } catch (err) {
        console.error('Error loading member sales data:', err);
        this.stopLoadingAnimation();
        this.loadingError = 'La synthèse n’a pas pu être chargée. Réessayez en rouvrant cette page.';
      }
    })();
  }

  ngOnDestroy(): void {
    this.stopLoadingAnimation();
  }

  private updateLoading(progress: number, message: string, progressLimit: number = progress): void {
    this.loadingProgress = Math.max(this.loadingProgress, progress);
    this.loadingProgressLimit = Math.max(this.loadingProgressLimit, progressLimit);
    this.loadingMessage = message;
  }

  private startLoadingAnimation(): void {
    this.stopLoadingAnimation();
    this.loadingAnimation = setInterval(() => {
      if (this.loadingProgress < this.loadingProgressLimit) {
        this.loadingProgress += 1;
      }
    }, 400);
  }

  private stopLoadingAnimation(): void {
    if (this.loadingAnimation !== undefined) {
      clearInterval(this.loadingAnimation);
      this.loadingAnimation = undefined;
    }
  }

  private allowProgressRendering(delay: number = 0): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  checkBuyWithoutMembership() {
    this.buyWithoutMembership = this.memberService.getBuyWithoutMembership(this.members, this.operations);
  }

  checkMembershipPaid() {
    this.missingMembership = this.memberService.getMissingMembership(this.members, this.operations);
  }

  checkMembersNotDeclaredAtFFB() {
    const membersOutsideFfbClub = this.memberService.getMembersOutsideFfbClub(this.members, this.ffbBaseReferences);

    this.membersNotDeclaredAtFFB = membersOutsideFfbClub
      .map((member) => {
        const full_name = this.memberService.full_name(member);
        const showLicense = !this.memberService.hasNoLicenseIdentifier(member);
        return {
          full_name,
          license_number: showLicense ? member.license_number : 'none',
        };
      })
      .sort((a, b) => a.full_name.localeCompare(b.full_name, 'fr', { sensitivity: 'base' }));

    this.membersToBeDeclaredAtFFB_nbr = this.membersNotDeclaredAtFFB.filter((m) => m.license_number !== 'none').length;
  }

  checkLicenseDeclared() {
    this.collectedLicenses = this.memberService.getCollectedLicenses(this.members, this.operations);
  }

  getPaiements(accountKey: string | null): { [key: string]: Payment } {
    if (!accountKey) {
      return {};
    }
    const paiements: { [key: string]: { [month: number]: number } } = {};
    this.members.forEach((member) => {
      let full_name = this.memberService.full_name(member);
      const ops = this.operations
        .filter((op) => op.member === full_name)
        .filter((op) => op.values[accountKey] != null);
      const monthMap: { [month: number]: number } = {};
      ops.forEach((op) => {
        const dateObj = new Date(op.date);
        const month = dateObj.getMonth() + 1;
        const amount = Number(op.values[accountKey]);
        monthMap[month] = (monthMap[month] || 0) + amount;
      });
      if (Object.keys(monthMap).length > 0) {
        paiements[full_name] = monthMap;
      }
    });
    return paiements;
  }

  memberSelected() {
    if (this.selected_member) {
      let full_name = this.memberService.full_name(this.selected_member);
      this.purchase_entries = this.bookService.get_member_purchase_statement(
        full_name,
        this.productDescriptions,
        { memberOperationsOnly: true },
      );
      this.avoirs = this.bookService.find_assets(full_name);
      this.debt = this.bookService.find_member_debt(full_name);
    }
  }

  memberClear() {
    this.selected_member = null;
    this.purchase_entries = [];
    this.avoirs = 0;
    this.debt = 0;
    this.revenues = [];
  }

  onAccountKeyChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    select.blur();
    const account = this.selected_account;
    this.payments = this.getPaiements(this.selected_account?.key || null);
  }
}
