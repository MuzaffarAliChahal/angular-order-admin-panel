export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED';

export const ORDER_STATUSES: OrderStatus[] = ['PENDING', 'CONFIRMED', 'CANCELLED'];

/** Mirrors OrderResponse from order-service. */
export interface Order {
  id: number;
  customerId: string;
  product: string;
  quantity: number;
  unitPrice: number;
  total: number;
  status: OrderStatus;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Mirrors PlaceOrderRequest (POST /api/orders, answered with 202 Accepted). */
export interface PlaceOrderRequest {
  customerId: string;
  product: string;
  quantity: number;
  unitPrice: number;
}

/** Mirrors Notification from notification-service, which consumes the "orders" and "payments" topics. */
export interface Notification {
  type: string;
  orderId: number;
  customerId: string;
  message: string;
  sentAt: string;
}
