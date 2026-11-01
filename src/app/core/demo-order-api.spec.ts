import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { environment } from '../../environments/environment';
import { ApiError, DemoOrderApi } from './order-api';

describe('DemoOrderApi saga', () => {
  let api: DemoOrderApi;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [DemoOrderApi] });
    api = TestBed.inject(DemoOrderApi);
  });

  afterEach(() => {
    api.ngOnDestroy();
    vi.useRealTimers();
  });

  it('starts with settled sample orders', async () => {
    const orders = await firstValueFrom(api.list());
    expect(orders.length).toBe(10);
    expect(orders.every((o) => o.status !== 'PENDING')).toBe(true);
  });

  it('places an order as PENDING, then confirms it when within the payment limit', async () => {
    vi.useFakeTimers();
    const placing = firstValueFrom(api.place({ customerId: 'cust-1', product: 'Keyboard', quantity: 2, unitPrice: 60 }));
    await vi.advanceTimersByTimeAsync(environment.demoLatencyMs);
    const order = await placing;
    expect(order.status).toBe('PENDING');
    expect(order.total).toBe(120);

    await vi.advanceTimersByTimeAsync(environment.paymentDelayMs);
    const getting = firstValueFrom(api.get(order.id));
    await vi.advanceTimersByTimeAsync(environment.demoLatencyMs);
    expect((await getting).status).toBe('CONFIRMED');
  });

  it('cancels an order above the limit with a reason and sends notifications', async () => {
    vi.useFakeTimers();
    const placing = firstValueFrom(api.place({ customerId: 'cust-9', product: 'Desk', quantity: 3, unitPrice: 589 }));
    await vi.advanceTimersByTimeAsync(environment.demoLatencyMs + environment.paymentDelayMs);
    const order = await placing;

    const getting = firstValueFrom(api.get(order.id));
    const notesP = firstValueFrom(api.notifications('cust-9'));
    await vi.advanceTimersByTimeAsync(environment.demoLatencyMs);
    const settled = await getting;
    expect(settled.status).toBe('CANCELLED');
    expect(settled.failureReason).toContain('exceeds the limit');
    expect((await notesP).map((n) => n.type)).toEqual(['ORDER_CANCELLED', 'ORDER_RECEIVED']);
  });

  it('filters orders by customer', async () => {
    const orders = await firstValueFrom(api.list('cust-42'));
    expect(orders.length).toBeGreaterThan(0);
    expect(orders.every((o) => o.customerId === 'cust-42')).toBe(true);
  });

  it('returns a 404 for an unknown order', async () => {
    await expect(firstValueFrom(api.get(999))).rejects.toBeInstanceOf(ApiError);
  });
});
