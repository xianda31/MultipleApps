import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditGameCardComponent } from './edit-game-card.component';

describe('EditGameCardComponent', () => {
  let component: EditGameCardComponent;
  let fixture: ComponentFixture<EditGameCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditGameCardComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EditGameCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
