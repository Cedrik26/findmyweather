import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SidenavComponent } from './sidenav.component';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';

describe('SidenavComponent', () => {
  let component: SidenavComponent;
  let fixture: ComponentFixture<SidenavComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SidenavComponent, NoopAnimationsModule]
    }).compileComponents();

    fixture = TestBed.createComponent(SidenavComponent);
    component = fixture.componentInstance;
    // Don't call detectChanges here to allow setting initial @Input or state if needed
  });

  // FE10: Button-Enablement: Jahre Pflicht
  it('FE10: (Button-Enablement) should disable lookup button if startYear or endYear is missing', async () => {
    // Initial: startYear/endYear might be undefined or null depending on initialization
    component.startYear = null;
    component.endYear = new Date(2026, 0, 1);

    fixture.detectChanges();
    await fixture.whenStable();

    const btn = fixture.debugElement.query(By.css('button.cta'));
    expect(btn.nativeElement.disabled).toBe(true);

    // Update
    component.startYear = new Date(2020, 0, 1);
    component.endYear = null;

    fixture.detectChanges();
    await fixture.whenStable();

    expect(btn.nativeElement.disabled).toBe(true);

    // Valid
    component.startYear = new Date(2020, 0, 1);
    component.endYear = new Date(2026, 0, 1);

    fixture.detectChanges();
    await fixture.whenStable();

    expect(btn.nativeElement.disabled).toBe(false);
  });

  // FE11: Toggle “Alle Wetterstationen” steuert Count-Slider
  it('FE11: (Toggle) logic verification', async () => {
    // Initial Render (Standard: true)
    fixture.detectChanges();
    await fixture.whenStable();

    // Selector: look for the input inside the slider
    let sliderInput = fixture.debugElement.query(By.css('input[name="weatherStationCount"]'));
    expect(sliderInput).toBeNull(); // *ngIf="!selectAllStations" -> hidden

    // Switch to false
    component.selectAllStations = false;

    try {
        fixture.detectChanges();
    } catch(e) { /* ignore */ }
    await fixture.whenStable();

    // Verify logic
    expect(component.selectAllStations).toBe(false);

    // Verify DOM
    sliderInput = fixture.debugElement.query(By.css('input[name="weatherStationCount"]'));
    expect(sliderInput).not.toBeNull();
  });

  // FE12: Radius-Change Event feuert
  it('FE12: (Radius-Change) should emit radiusChange event when onRadiusChange is called', () => {
    fixture.detectChanges();
    const spy = vi.spyOn(component.radiusChange, 'emit');
    const newRadius = 25;

    // Simulate the slider change event handler
    component.onRadiusChange(newRadius);

    expect(spy).toHaveBeenCalledWith(newRadius);
  });
});
