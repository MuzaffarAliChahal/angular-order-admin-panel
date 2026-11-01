import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { map, switchMap, takeWhile } from 'rxjs';
import { Order } from '../core/models';
import { OrderApi } from '../core/order-api';
import { poll } from '../core/poll';
import { OrderStatusBadge } from '../shared/order-status-badge';

interface Step {
  title: string;
  detail: string;
  state: 'done' | 'current' | 'failed' | 'todo';
  at?: string;
}

@Component({
  selector: 'app-order-detail',
  imports: [CurrencyPipe, DatePipe, RouterLink, OrderStatusBadge],
  template: `
    <p><a routerLink="/orders">← All orders</a></p>
    @if (error()) {
      <div class="card empty">{{ error() }}</div>
    } @else if (order(); as o) {
      <div class="toolbar" style="justify-content: space-between">
        <div>
          <h1>Order #{{ o.id }}</h1>
          <p class="subtitle" style="margin: 0">{{ o.quantity }} × {{ o.product }} for {{ o.customerId }}</p>
        </div>
        <app-order-status [status]="o.status" />
      </div>

      <div class="grid kpis" style="margin-top: 16px">
        <div class="card"><div class="kpi-label">Unit price</div><div class="kpi-value">{{ o.unitPrice | currency: 'USD' }}</div></div>
        <div class="card"><div class="kpi-label">Total</div><div class="kpi-value">{{ o.total | currency: 'USD' }}</div></div>
        <div class="card"><div class="kpi-label">Placed</div><div class="kpi-value" style="font-size: 18px">{{ o.createdAt | date: 'MMM d, HH:mm:ss' }}</div></div>
        <div class="card"><div class="kpi-label">Last update</div><div class="kpi-value" style="font-size: 18px">{{ o.updatedAt | date: 'HH:mm:ss' }}</div></div>
      </div>

      <div class="grid two-col" style="align-items: start">
        <div class="card">
          <h2>Saga progress</h2>
          <ol class="timeline">
            @for (step of steps(); track step.title) {
              <li [class]="step.state">
                <span class="marker"></span>
                <div>
                  <strong>{{ step.title }}</strong>
                  <div class="hint">{{ step.detail }}</div>
                  @if (step.at) { <div class="hint">{{ step.at | date: 'HH:mm:ss' }}</div> }
                </div>
              </li>
            }
          </ol>
          @if (o.status === 'PENDING') { <p class="hint">Waiting for the payment event… this page updates by itself.</p> }
        </div>
        <div class="card">
          <h2>Notifications sent</h2>
          @for (n of notifications(); track n.sentAt + n.type) {
            <div style="padding: 9px 0; border-bottom: 1px solid var(--border)">
              <strong>{{ n.type }}</strong><span class="hint">&nbsp;· {{ n.sentAt | date: 'HH:mm:ss' }}</span>
              <div>{{ n.message }}</div>
            </div>
          } @empty {
            <p class="hint">None yet.</p>
          }
        </div>
      </div>
    } @else {
      <div class="card empty">Loading…</div>
    }
  `,
  styles: `
    .timeline { list-style: none; margin: 0; padding: 0; }
    .timeline li { display: grid; grid-template-columns: 22px 1fr; gap: 10px; padding-bottom: 18px; position: relative; }
    .timeline li:not(:last-child)::after { content: ''; position: absolute; left: 7px; top: 18px; bottom: 0; width: 2px; background: var(--border); }
    .marker { width: 16px; height: 16px; border-radius: 50%; border: 2px solid #cfd6e1; background: #fff; margin-top: 2px; }
    .done .marker { background: var(--ok); border-color: var(--ok); }
    .current .marker { border-color: var(--accent); background: var(--accent-soft); }
    .failed .marker { background: var(--bad); border-color: var(--bad); }
    .todo strong { color: var(--muted); }
  `,
})
export class OrderDetailPage {
  private readonly api = inject(OrderApi);
  readonly id = input.required<string>();

  /** Polls the order until it leaves PENDING (inclusive), then stops. */
  private readonly polled = toSignal(
    toObservable(this.id).pipe(
      switchMap((id) => poll(() => this.api.get(Number(id))).pipe(takeWhile((p) => p.value?.status === 'PENDING' && !p.error, true))),
    ),
  );
  private readonly notesPolled = toSignal(
    toObservable(this.id).pipe(
      switchMap((id) => poll(() => this.api.notifications()).pipe(map((p) => (p.value ?? []).filter((n) => n.orderId === Number(id))))),
    ),
  );

  protected readonly order = computed(() => this.polled()?.value ?? null);
  protected readonly error = computed(() => this.polled()?.error ?? null);
  protected readonly notifications = computed(() => [...(this.notesPolled() ?? [])].reverse());
  protected readonly steps = computed(() => (this.order() ? sagaSteps(this.order()!) : []));
}

export function sagaSteps(o: Order): Step[] {
  const settled = o.status !== 'PENDING';
  return [
    { title: 'Order saved', detail: 'order-service stored it as PENDING and published OrderCreatedEvent to "orders" after commit', state: 'done', at: o.createdAt },
    {
      title: 'Payment',
      detail: settled ? 'payment-service published a PaymentEvent to "payments"' : 'payment-service is charging the order',
      state: settled ? (o.status === 'CANCELLED' ? 'failed' : 'done') : 'current',
      at: settled ? o.updatedAt : undefined,
    },
    o.status === 'CANCELLED'
      ? { title: 'Cancelled', detail: o.failureReason ?? 'payment declined', state: 'failed', at: o.updatedAt }
      : { title: 'Confirmed', detail: 'order-service applied the payment result', state: o.status === 'CONFIRMED' ? 'done' : 'todo', at: o.status === 'CONFIRMED' ? o.updatedAt : undefined },
  ];
}
