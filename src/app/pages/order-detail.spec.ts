import { describe, expect, it } from 'vitest';
import { Order } from '../core/models';
import { sagaSteps } from './order-detail';

const base: Order = {
  id: 1, customerId: 'c', product: 'p', quantity: 1, unitPrice: 10, total: 10, status: 'PENDING',
  failureReason: null, createdAt: '2026-10-01T10:00:00Z', updatedAt: '2026-10-01T10:00:00Z',
};

describe('sagaSteps', () => {
  it('shows payment in progress while PENDING', () => {
    expect(sagaSteps(base).map((s) => s.state)).toEqual(['done', 'current', 'todo']);
  });

  it('completes every step when CONFIRMED', () => {
    expect(sagaSteps({ ...base, status: 'CONFIRMED' }).map((s) => s.state)).toEqual(['done', 'done', 'done']);
  });

  it('marks payment and the last step failed when CANCELLED, with the reason', () => {
    const steps = sagaSteps({ ...base, status: 'CANCELLED', failureReason: 'payment declined' });
    expect(steps.map((s) => s.state)).toEqual(['done', 'failed', 'failed']);
    expect(steps[2].detail).toBe('payment declined');
  });
});
