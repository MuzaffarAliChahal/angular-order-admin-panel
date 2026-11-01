import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ORDER_STATUSES } from '../core/models';
import { OrderApi } from '../core/order-api';
import { poll } from '../core/poll';
import { STATUS_LABEL, STATUS_TONE } from '../shared/order-status-badge';

@Component({
  selector: 'app-overview',
  imports: [CurrencyPipe, DatePipe, RouterLink],
  template: `
    <h1>Overview</h1>
    <p class="subtitle">Refreshes every few seconds. Orders start as PENDING and are settled by the payment service through Kafka.</p>

    <div class="grid kpis">
      <div class="card"><div class="kpi-label">Orders</div><div class="kpi-value">{{ orders().length }}</div><div class="kpi-note">latest 50</div></div>
      <div class="card"><div class="kpi-label">Awaiting payment</div><div class="kpi-value">{{ count('PENDING') }}</div><div class="kpi-note">PENDING right now</div></div>
      <div class="card"><div class="kpi-label">Confirmed revenue</div><div class="kpi-value">{{ revenue() | currency: 'USD' : 'symbol' : '1.0-0' }}</div><div class="kpi-note">sum of CONFIRMED totals</div></div>
      <div class="card"><div class="kpi-label">Cancellation rate</div><div class="kpi-value">{{ cancelRate() }}%</div><div class="kpi-note">declined by payment-service</div></div>
    </div>

    <div class="grid two-col" style="align-items: start">
      <div class="card">
        <h2>Orders by status</h2>
        <div class="bars">
          @for (row of byStatus(); track row.status) {
            <div class="bar-row">
              <span>{{ row.label }}</span>
              <div class="bar-track"><div [class]="'bar-fill ' + row.tone" [style.width.%]="row.share"></div></div>
              <span class="num">{{ row.count }}</span>
            </div>
          }
        </div>
        <h2 style="margin-top: 22px">Top customers</h2>
        <table>
          <thead><tr><th>Customer</th><th class="num">Orders</th><th class="num">Confirmed spend</th></tr></thead>
          <tbody>
            @for (c of topCustomers(); track c.customerId) {
              <tr><td>{{ c.customerId }}</td><td class="num">{{ c.orders }}</td><td class="num">{{ c.spend | currency: 'USD' }}</td></tr>
            }
          </tbody>
        </table>
      </div>

      <div class="card">
        <div class="toolbar" style="justify-content: space-between">
          <h2 style="margin: 0">Event feed</h2>
          <a routerLink="/notifications">All notifications →</a>
        </div>
        <ul class="feed">
          @for (n of feed(); track n.sentAt + n.type + n.orderId) {
            <li>
              <span [class]="'dot ' + tone(n.type)"></span>
              <div>
                <div><strong>{{ n.type }}</strong> · <a [routerLink]="['/orders', n.orderId]">order #{{ n.orderId }}</a> · {{ n.customerId }}</div>
                <div class="hint">{{ n.message }}</div>
              </div>
              <span class="hint">{{ n.sentAt | date: 'HH:mm:ss' }}</span>
            </li>
          } @empty {
            <li class="empty">No events yet.</li>
          }
        </ul>
      </div>
    </div>
  `,
  styles: `
    .feed { list-style: none; margin: 0; padding: 0; }
    .feed li { display: grid; grid-template-columns: 12px 1fr auto; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--border); align-items: start; }
    .dot { width: 9px; height: 9px; border-radius: 50%; margin-top: 5px; background: var(--muted); }
    .dot.ok { background: var(--ok); } .dot.bad { background: var(--bad); } .dot.neutral { background: var(--accent); }
  `,
})
export class OverviewPage {
  private readonly api = inject(OrderApi);
  private readonly ordersPoll = toSignal(poll(() => this.api.list()));
  private readonly feedPoll = toSignal(poll(() => this.api.notifications()));

  protected readonly orders = computed(() => this.ordersPoll()?.value ?? []);
  protected readonly feed = computed(() => (this.feedPoll()?.value ?? []).slice(0, 8));

  protected count(status: string) {
    return this.orders().filter((o) => o.status === status).length;
  }
  protected readonly revenue = computed(() => this.orders().filter((o) => o.status === 'CONFIRMED').reduce((s, o) => s + o.total, 0));
  protected readonly cancelRate = computed(() => {
    const settled = this.orders().filter((o) => o.status !== 'PENDING');
    return settled.length ? Math.round((100 * settled.filter((o) => o.status === 'CANCELLED').length) / settled.length) : 0;
  });
  protected readonly byStatus = computed(() => {
    const list = this.orders();
    return ORDER_STATUSES.map((status) => {
      const count = list.filter((o) => o.status === status).length;
      return { status, label: STATUS_LABEL[status], tone: STATUS_TONE[status], count, share: list.length ? (100 * count) / list.length : 0 };
    });
  });
  protected readonly topCustomers = computed(() => {
    const map = new Map<string, { customerId: string; orders: number; spend: number }>();
    for (const o of this.orders()) {
      const c = map.get(o.customerId) ?? { customerId: o.customerId, orders: 0, spend: 0 };
      c.orders++;
      if (o.status === 'CONFIRMED') c.spend += o.total;
      map.set(o.customerId, c);
    }
    return [...map.values()].sort((a, b) => b.spend - a.spend).slice(0, 5);
  });

  protected tone(type: string) {
    return type.endsWith('CONFIRMED') ? 'ok' : type.endsWith('CANCELLED') ? 'bad' : 'neutral';
  }
}
