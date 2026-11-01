import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, OnDestroy, inject } from '@angular/core';
import { Observable, catchError, defer, delay, of, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { Notification, Order, PlaceOrderRequest } from './models';

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/** What the pages depend on. Live implementation calls the api-gateway; demo runs the saga in the browser. */
export abstract class OrderApi {
  abstract readonly mode: 'live' | 'demo';
  abstract list(customerId?: string): Observable<Order[]>;
  abstract get(id: number): Observable<Order>;
  abstract place(request: PlaceOrderRequest): Observable<Order>;
  abstract notifications(customerId?: string): Observable<Notification[]>;
}

/** Calls the Spring Cloud Gateway in front of order-service and notification-service. */
@Injectable()
export class HttpOrderApi extends OrderApi {
  readonly mode = 'live' as const;
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  list(customerId?: string) {
    const params = customerId ? new HttpParams().set('customerId', customerId) : undefined;
    return this.http.get<Order[]>(`${this.base}/api/orders`, { params }).pipe(catchError(toApiError));
  }
  get(id: number) {
    return this.http.get<Order>(`${this.base}/api/orders/${id}`).pipe(catchError(toApiError));
  }
  place(request: PlaceOrderRequest) {
    return this.http.post<Order>(`${this.base}/api/orders`, request).pipe(catchError(toApiError));
  }
  notifications(customerId?: string) {
    const params = customerId ? new HttpParams().set('customerId', customerId) : undefined;
    return this.http.get<Notification[]>(`${this.base}/api/notifications`, { params }).pipe(catchError(toApiError));
  }
}

function toApiError(err: HttpErrorResponse): Observable<never> {
  const detail = (err.error as { detail?: string } | null)?.detail;
  return throwError(() => new ApiError(detail ?? (err.status === 0 ? 'Cannot reach the API gateway' : `Request failed (${err.status})`), err.status));
}

export const PAYMENT_LIMIT = 1000;

const CATALOG: [string, number][] = [
  ['Mechanical keyboard', 60], ['27" 4K monitor', 329], ['Noise-cancelling headphones', 249],
  ['USB-C dock', 139], ['Ergonomic chair', 459], ['Laptop stand', 45], ['Webcam 1080p', 79], ['Standing desk', 589],
];

/**
 * In-browser simulation of the choreographed saga: an order is saved as PENDING, the "payment
 * service" charges it after a short delay (limit 1000.00), and the order becomes CONFIRMED or
 * CANCELLED. Notifications are recorded like notification-service does for both topics.
 */
@Injectable()
export class DemoOrderApi extends OrderApi implements OnDestroy {
  readonly mode = 'demo' as const;
  private readonly orders: Order[] = [];
  private readonly sent: Notification[] = [];
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private trafficTimer: ReturnType<typeof setInterval> | null = null;
  private nextId = 1;

  constructor() {
    super();
    const now = Date.now();
    const seed: [string, number, number][] = [
      ['cust-17', 0, 2], ['cust-42', 1, 1], ['cust-08', 2, 3], ['cust-42', 4, 3], ['cust-23', 3, 4],
      ['cust-17', 5, 2], ['cust-31', 7, 2], ['cust-08', 6, 1], ['cust-23', 1, 5], ['cust-31', 2, 1],
    ];
    seed.forEach(([customerId, item, quantity], i) => {
      const at = new Date(now - (seed.length - i) * 47 * 60_000);
      const order = this.create({ customerId, product: CATALOG[item][0], unitPrice: CATALOG[item][1], quantity }, at);
      this.settle(order, new Date(at.getTime() + 1800));
    });
  }

  list(customerId?: string) {
    return defer(() => of(this.orders.filter((o) => !customerId || o.customerId === customerId).map((o) => ({ ...o })))).pipe(delay(environment.demoLatencyMs));
  }

  get(id: number) {
    return defer(() => {
      const found = this.orders.find((o) => o.id === id);
      return found ? of({ ...found }) : throwError(() => new ApiError(`Order ${id} not found`, 404));
    }).pipe(delay(environment.demoLatencyMs));
  }

  place(request: PlaceOrderRequest) {
    return defer(() => {
      const order = this.create(request, new Date());
      const t = setTimeout(() => {
        this.timers.delete(t);
        this.settle(order, new Date());
      }, environment.paymentDelayMs);
      this.timers.add(t);
      return of({ ...order });
    }).pipe(delay(environment.demoLatencyMs));
  }

  notifications(customerId?: string) {
    return defer(() => of(this.sent.filter((n) => !customerId || n.customerId === customerId).slice(0, 50))).pipe(delay(environment.demoLatencyMs));
  }

  /** Places a random order every few seconds, so the live views have something to show. */
  setTraffic(on: boolean) {
    if (on && !this.trafficTimer) {
      this.trafficTimer = setInterval(() => {
        const [product, unitPrice] = CATALOG[Math.floor(Math.random() * CATALOG.length)];
        const customerId = `cust-${String(10 + Math.floor(Math.random() * 30)).padStart(2, '0')}`;
        this.place({ customerId, product, unitPrice, quantity: 1 + Math.floor(Math.random() * 4) }).subscribe();
      }, 4000);
    } else if (!on && this.trafficTimer) {
      clearInterval(this.trafficTimer);
      this.trafficTimer = null;
    }
  }

  get trafficOn() {
    return this.trafficTimer !== null;
  }

  ngOnDestroy() {
    this.setTraffic(false);
    this.timers.forEach(clearTimeout);
  }

  private create(req: PlaceOrderRequest, at: Date): Order {
    const order: Order = {
      id: this.nextId++,
      customerId: req.customerId.trim(),
      product: req.product.trim(),
      quantity: req.quantity,
      unitPrice: req.unitPrice,
      total: Math.round(req.quantity * req.unitPrice * 100) / 100,
      status: 'PENDING',
      failureReason: null,
      createdAt: at.toISOString(),
      updatedAt: at.toISOString(),
    };
    this.orders.unshift(order);
    this.notify('ORDER_RECEIVED', order, `We received order #${order.id} for ${order.quantity} × ${order.product}.`, at);
    return order;
  }

  /** What payment-service + order-service do when the payment event arrives. Idempotent: only PENDING changes. */
  private settle(order: Order, at: Date) {
    if (order.status !== 'PENDING') return;
    if (order.total <= PAYMENT_LIMIT) {
      order.status = 'CONFIRMED';
      this.notify('ORDER_CONFIRMED', order, `Payment of ${order.total.toFixed(2)} succeeded. Order #${order.id} is confirmed.`, at);
    } else {
      order.status = 'CANCELLED';
      order.failureReason = `payment declined: ${order.total.toFixed(2)} exceeds the limit of ${PAYMENT_LIMIT.toFixed(2)}`;
      this.notify('ORDER_CANCELLED', order, `Order #${order.id} was cancelled: ${order.failureReason}.`, at);
    }
    order.updatedAt = at.toISOString();
  }

  private notify(type: string, order: Order, message: string, at: Date) {
    this.sent.unshift({ type, orderId: order.id, customerId: order.customerId, message, sentAt: at.toISOString() });
  }
}
