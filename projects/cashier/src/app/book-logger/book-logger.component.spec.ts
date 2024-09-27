import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BookLoggerComponent } from './book-logger.component';

describe('BookLoggerComponent', () => {
  let component: BookLoggerComponent;
  let fixture: ComponentFixture<BookLoggerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BookLoggerComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BookLoggerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
