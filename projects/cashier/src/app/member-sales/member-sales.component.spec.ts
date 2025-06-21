import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MemberSalesComponent } from './member-sales.component';

describe('MemberSalesComponent', () => {
  let component: MemberSalesComponent;
  let fixture: ComponentFixture<MemberSalesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MemberSalesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MemberSalesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
