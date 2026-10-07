import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should show the LocalMarket brand and header navigation', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.logo-text')?.textContent).toContain('LocalMarket');
    const links = Array.from(compiled.querySelectorAll('nav a')).map((a) =>
      a.textContent?.trim()
    );
    expect(links).toContain('Inicio');
    expect(links).toContain('Promociones');
    expect(links).toContain('Mi negocio');
  });
});