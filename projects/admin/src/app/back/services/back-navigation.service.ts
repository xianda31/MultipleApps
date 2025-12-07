import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BACK_ROUTE_ABS_PATHS } from '../routes/back-route-paths';

@Injectable({ providedIn: 'root' })
export class BackNavigationService {
  constructor(private router: Router) {}

  goToShop() {
  this.router.navigate([BACK_ROUTE_ABS_PATHS['Shop']]);
  }
  goToFeesCollector() {
  this.router.navigate([BACK_ROUTE_ABS_PATHS['FeesCollector']]);
  }
  goToProducts() {
  this.router.navigate([BACK_ROUTE_ABS_PATHS['Products']]);
  }
  goToMembersDatabase() {
  this.router.navigate([BACK_ROUTE_ABS_PATHS['MembersDatabase']]);
  }
  goToGameCardsEditor() {
  this.router.navigate([BACK_ROUTE_ABS_PATHS['GameCardsEditor']]);
  }
  goToMemberSales() {
  this.router.navigate([BACK_ROUTE_ABS_PATHS['MemberSales']]);
  }
  goToCashBoxStatus() {
  this.router.navigate([BACK_ROUTE_ABS_PATHS['CashBoxStatus']]);
  }
  goToBankReconciliation() {
  this.router.navigate([BACK_ROUTE_ABS_PATHS['BankReconciliation']]);
  }
  goToExpenseAndRevenue() {
  this.router.navigate([BACK_ROUTE_ABS_PATHS['ExpenseAndRevenue']]);
  }
  goToExpenseAndRevenueDetails(params?: any) {
  this.router.navigate([BACK_ROUTE_ABS_PATHS['ExpenseAndRevenueDetails']], { queryParams: params });
  }
  goToBooksEditor() {
  this.router.navigate([BACK_ROUTE_ABS_PATHS['BooksEditor']]);
  }
  goToBalance() {
  this.router.navigate([BACK_ROUTE_ABS_PATHS['Balance']]);
  }
  goToBooksOverview() {
  this.router.navigate([BACK_ROUTE_ABS_PATHS['BooksOverview']]);
  }
  goToBooksList() {
  this.router.navigate([BACK_ROUTE_ABS_PATHS['BooksList']]);
  }
  goToBooksEditorFull(id?: string) {
    if (id) {
      this.router.navigate([BACK_ROUTE_ABS_PATHS['BooksEditorFull'], id]);
    } else {
      this.router.navigate([BACK_ROUTE_ABS_PATHS['BooksEditorFull']]);
    }
  }
  goToSysConf() {
  this.router.navigate([BACK_ROUTE_ABS_PATHS['SysConf']]);
  }
  goToImportExcel() {
  this.router.navigate([BACK_ROUTE_ABS_PATHS['ImportExcel']]);
  }
  goToGroupsList() {
  this.router.navigate([BACK_ROUTE_ABS_PATHS['GroupsList']]);
  }
  goToCloneDB() {
  this.router.navigate([BACK_ROUTE_ABS_PATHS['CloneDB']]);
  }
  goToSnippets() {
  this.router.navigate([BACK_ROUTE_ABS_PATHS['Snippets']]);
  }
  goToRootVolume() {
  this.router.navigate([BACK_ROUTE_ABS_PATHS['RootVolume']]);
  }
  goToFilemgrWindows(root_folder?: string) {
    if (root_folder) {
      this.router.navigate([BACK_ROUTE_ABS_PATHS['RootVolume'], root_folder]);
    } else {
      this.router.navigate([BACK_ROUTE_ABS_PATHS['RootVolume']]);
    }
  }
  goToPagesEditor() {
  this.router.navigate([BACK_ROUTE_ABS_PATHS['PagesEditor']]);
  }
  goToPageEditor(pageId: string, queryParams?: { from?: string }) {
    const basePath = BACK_ROUTE_ABS_PATHS['PagesEditor'];
    this.router.navigate([basePath.replace('pages', 'pages-editor'), pageId], { queryParams });
  }
  goToHome() {
  this.router.navigate([BACK_ROUTE_ABS_PATHS['Home']]);
  }
}
