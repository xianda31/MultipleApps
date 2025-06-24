import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LiquidityDetailsComponent } from './liquidity-details.component';

describe('LiquidityDetailsComponent', () => {
  let component: LiquidityDetailsComponent;
  let fixture: ComponentFixture<LiquidityDetailsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LiquidityDetailsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LiquidityDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
