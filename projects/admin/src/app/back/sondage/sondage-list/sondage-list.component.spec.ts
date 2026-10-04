import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { SondageService } from '../sondage.service';
import { SondageListComponent } from './sondage-list.component';

describe('SondageListComponent deletion guard', () => {
  let component: SondageListComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: {} },
        { provide: SondageService, useValue: {} },
        { provide: NgbModal, useValue: {} },
      ],
    });
    component = TestBed.runInInjectionContext(() => new SondageListComponent());
  });

  it('prevents deletion while the survey is active', () => {
    expect(component.canDelete({
      status: 'active',
      closingDate: '2999-12-31',
    } as any)).toBeFalse();
  });

  it('allows deletion when the displayed status is closed', () => {
    expect(component.canDelete({
      status: 'closed',
      closingDate: '2999-12-31',
    } as any)).toBeTrue();
    expect(component.canDelete({
      status: 'active',
      closingDate: '2000-01-01',
    } as any)).toBeTrue();
  });
});