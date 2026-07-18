import { TestBed } from '@angular/core/testing';
import {
  FIRST_USEFUL_INACTIVITY_VIEW,
  ProductTelemetryService,
} from './product-telemetry.service';

describe('ProductTelemetryService', () => {
  let service: ProductTelemetryService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ProductTelemetryService);
    service.resetForTests();
  });

  it('registra eventos genéricos via track', () => {
    service.track('custom_event', { foo: 1 });
    expect(service.getRecordedEvents()).toEqual([
      jasmine.objectContaining({ name: 'custom_event', props: { foo: 1 } }),
    ]);
  });

  it('emite first_useful_inactivity_view uma única vez por sessão', () => {
    expect(service.trackFirstUsefulInactivityView('dashboard', { trackedTotal: 3 })).toBeTrue();
    expect(service.trackFirstUsefulInactivityView('inactivity_report')).toBeFalse();

    const events = service.getRecordedEvents();
    expect(events.length).toBe(1);
    expect(events[0].name).toBe(FIRST_USEFUL_INACTIVITY_VIEW);
    expect(events[0].props).toEqual(jasmine.objectContaining({ source: 'dashboard', trackedTotal: 3 }));
  });
});
