import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { DemoOrderApi, OrderApi } from './core/order-api';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="shell">
      <aside class="sidebar">
        <div class="brand"><span class="brand-mark">O</span> Order Admin</div>
        @for (item of nav; track item.path) {
          <a class="nav-link" [routerLink]="item.path" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: item.exact }">{{ item.label }}</a>
        }
        <div class="sidebar-foot">Angular 21 · Kafka microservices</div>
      </aside>
      <main class="main">
        @if (demo) {
          <div class="demo-banner toolbar" style="justify-content: space-between; margin-bottom: 20px">
            <span>Demo mode: the order → payment → confirmation saga runs in your browser. Orders above 1,000.00 are declined.</span>
            <label style="display: flex; gap: 8px; align-items: center; font-weight: 600">
              <input type="checkbox" [checked]="traffic()" (change)="toggleTraffic()" /> Simulate live traffic
            </label>
          </div>
        }
        <router-outlet />
      </main>
    </div>
  `,
})
export class App {
  private readonly api = inject(OrderApi);
  protected readonly demo = this.api instanceof DemoOrderApi;
  protected readonly traffic = signal(false);
  protected readonly nav = [
    { path: '/', label: 'Overview', exact: true },
    { path: '/orders', label: 'Orders', exact: true },
    { path: '/orders/new', label: 'Place order', exact: true },
    { path: '/notifications', label: 'Notifications', exact: true },
  ];

  protected toggleTraffic() {
    if (this.api instanceof DemoOrderApi) {
      this.api.setTraffic(!this.traffic());
      this.traffic.set(this.api.trafficOn);
    }
  }
}
