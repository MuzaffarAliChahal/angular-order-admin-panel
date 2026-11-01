import { Component, computed, input } from '@angular/core';
import { OrderStatus } from '../core/models';

export const STATUS_TONE: Record<OrderStatus, string> = { PENDING: 'neutral', CONFIRMED: 'ok', CANCELLED: 'bad' };
export const STATUS_LABEL: Record<OrderStatus, string> = { PENDING: 'Pending payment', CONFIRMED: 'Confirmed', CANCELLED: 'Cancelled' };

@Component({
  selector: 'app-order-status',
  template: `<span [class]="'badge ' + tone()">@if (status() === 'PENDING') {<span class="pulse"></span>}{{ label() }}</span>`,
  styles: `
    .pulse { display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: var(--accent); margin-right: 6px; animation: pulse 1s infinite alternate; }
    @keyframes pulse { from { opacity: 0.25; } to { opacity: 1; } }
  `,
})
export class OrderStatusBadge {
  readonly status = input.required<OrderStatus>();
  protected readonly tone = computed(() => STATUS_TONE[this.status()]);
  protected readonly label = computed(() => STATUS_LABEL[this.status()]);
}
