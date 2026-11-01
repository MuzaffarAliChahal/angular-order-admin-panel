import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { debounceTime, switchMap } from 'rxjs';
import { OrderApi } from '../core/order-api';
import { poll } from '../core/poll';

@Component({
  selector: 'app-notifications',
  imports: [DatePipe, FormsModule, RouterLink],
  template: `
    <h1>Notifications</h1>
    <p class="subtitle">From notification-service, which consumes both Kafka topics. Latest 50, newest first.</p>
    <div class="card">
      <div class="toolbar">
        <input type="search" placeholder="Customer id" [ngModel]="customer()" (ngModelChange)="customer.set($event)" aria-label="Customer id" />
      </div>
      <table>
        <thead><tr><th>Sent</th><th>Type</th><th>Order</th><th>Customer</th><th>Message</th></tr></thead>
        <tbody>
          @for (n of rows(); track n.sentAt + n.type + n.orderId) {
            <tr>
              <td>{{ n.sentAt | date: 'MMM d, HH:mm:ss' }}</td>
              <td><span class="badge" [class.ok]="n.type.endsWith('CONFIRMED')" [class.bad]="n.type.endsWith('CANCELLED')" [class.neutral]="n.type.endsWith('RECEIVED')">{{ n.type }}</span></td>
              <td><a [routerLink]="['/orders', n.orderId]">#{{ n.orderId }}</a></td>
              <td>{{ n.customerId }}</td>
              <td>{{ n.message }}</td>
            </tr>
          } @empty {
            <tr><td colspan="5" class="empty">No notifications.</td></tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class NotificationsPage {
  private readonly api = inject(OrderApi);
  protected readonly customer = signal('');
  private readonly polled = toSignal(
    toObservable(this.customer).pipe(debounceTime(300), switchMap((c) => poll(() => this.api.notifications(c.trim() || undefined)))),
  );
  protected readonly rows = computed(() => this.polled()?.value ?? []);
}
