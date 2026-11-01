import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { DemoOrderApi, OrderApi } from '../core/order-api';
import { NewOrderPage } from './new-order';

describe('NewOrderPage', () => {
  function setup() {
    TestBed.configureTestingModule({
      imports: [NewOrderPage],
      providers: [provideRouter([]), { provide: OrderApi, useClass: DemoOrderApi }],
    });
    const fixture = TestBed.createComponent(NewOrderPage);
    fixture.detectChanges();
    return fixture;
  }

  it('warns when the total is above the payment limit', async () => {
    const fixture = setup();
    fixture.componentInstance.form.patchValue({ quantity: 20, unitPrice: 60 });
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('will be declined');
  });

  it('blocks submission with an invalid quantity', () => {
    const fixture = setup();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');
    fixture.componentInstance.form.patchValue({ quantity: 0 });
    fixture.componentInstance.submit();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('navigates to the new order after placing it', async () => {
    const fixture = setup();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture.componentInstance.submit();
    await new Promise((r) => setTimeout(r, 300));
    expect(navigate).toHaveBeenCalledWith(['/orders', 11]);
  });
});
