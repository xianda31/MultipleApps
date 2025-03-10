import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProfitAndLossComponent } from './profit-and-loss.component';

describe('ProfitAndLossComponent', () => {
  let component: ProfitAndLossComponent;
  let fixture: ComponentFixture<ProfitAndLossComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProfitAndLossComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProfitAndLossComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
