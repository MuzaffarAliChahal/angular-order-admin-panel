import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', title: 'Overview · Order Admin', loadComponent: () => import('./pages/overview').then((m) => m.OverviewPage) },
  { path: 'orders', title: 'Orders · Order Admin', loadComponent: () => import('./pages/orders').then((m) => m.OrdersPage) },
  { path: 'orders/new', title: 'New order · Order Admin', loadComponent: () => import('./pages/new-order').then((m) => m.NewOrderPage) },
  { path: 'orders/:id', title: 'Order · Order Admin', loadComponent: () => import('./pages/order-detail').then((m) => m.OrderDetailPage) },
  { path: 'notifications', title: 'Notifications · Order Admin', loadComponent: () => import('./pages/notifications').then((m) => m.NotificationsPage) },
  { path: '**', redirectTo: '' },
];
