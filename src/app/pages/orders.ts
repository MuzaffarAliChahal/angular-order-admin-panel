import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { debounceTime, switchMap } from 'rxjs';
import { ORDER_STATUSES, OrderStatus } from '../core/models';
import { OrderApi } from '../core/order-api';
import { poll } from '../core/poll';
import { OrderStatusBadge, STATUS_LABEL } from '../shared/order-status-badge';

@Component({
  selector: 'app-orders',
  imports: [CurrencyPipe, DatePipe, FormsModule, RouterLink, OrderStatusBadge],
  template: `
    <div class="toolbar" style="justify-content: space-between">
      <div><h1>Orders</h1><p class="subtitle" style="margin: 0">Live list from <code>GET /api/orders</code>, refreshed every few seconds.</p></div>
      <a routerLink="/orders/new"><button class="primary">Place order</button></a>
    </div>

    <div class="card" style="margin-top: 16px">
      <div class="toolbar">
        <input type="search" placeholder="Customer id, e.g. cust-42" [ngModel]="customer()" (ngModelChange)="customer.set($event)" aria-label="Customer id" />
        <select [ngModel]="status()" (ngModelChange)="status.set($event)" aria-label="Status">
          <option value="">All statuses</option>
          @for (s of statuses; track s) { <option [value]="s">{{ labels[s] }}</option> }
        </select>
        @if (error()) { <span class="error">{{ error() }}</span> } @else { <span class="hint">{{ rows().length }} orders</span> }
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>#</th><th>Customer</th><th>Product</th><th class="num">Qty</th><th class="num">Total</th><th>Status</th><th>Placed</th><th>Updated</th></tr></thead>
          <tbody>
            @for (o of rows(); track o.id) {
              <tr class="clickable" (click)="open(o.id)">
                <td>{{ o.id }}</td>
                <td>{{ o.customerId }}</td>
                <td>{{ o.product }}</td>
                <td class="num">{{ o.quantity }}</td>
                <td class="num">{{ o.total | currency: 'USD' }}</td>
                <td><app-order-status [status]="o.status" /></td>
                <td>{{ o.createdAt | date: 'MMM d, HH:mm:ss' }}</td>
                <td>{{ o.updatedAt | date: 'HH:mm:ss' }}</td>
              </tr>
            } @empty {
              <tr><td colspan="8" class="empty">No orders match.</td></tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
})
export class OrdersPage {
  private readonly api = inject(OrderApi);
  private readonly router = inject(Router);

  protected readonly statuses = ORDER_STATUSES;
  protected readonly labels = STATUS_LABEL;
  protected readonly customer = signal('');
  protected readonly status = signal<OrderStatus | ''>('');

  /** The customer filter goes to the API (as order-service supports it); status is filtered locally. */
  private readonly polled = toSignal(
    toObservable(this.customer).pipe(
      debounceTime(300),
      switchMap((c) => poll(() => this.api.list(c.trim() || undefined))),
    ),
  );
  protected readonly error = computed(() => this.polled()?.error ?? null);
  protected readonly rows = computed(() => {
    const s = this.status();
    return (this.polled()?.value ?? []).filter((o) => !s || o.status === s);
  });

  protected open(id: number) {
    this.router.navigate(['/orders', id]);
  }
}
