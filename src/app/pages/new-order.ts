import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { OrderApi, PAYMENT_LIMIT } from '../core/order-api';

@Component({
  selector: 'app-new-order',
  imports: [ReactiveFormsModule, CurrencyPipe],
  template: `
    <h1>Place order</h1>
    <p class="subtitle"><code>POST /api/orders</code> returns 202 Accepted with a PENDING order. You'll see it settle on the next page.</p>

    <form class="card" style="max-width: 640px" [formGroup]="form" (ngSubmit)="submit()">
      <div class="form-grid">
        <div class="field">
          <label for="customerId">Customer id</label>
          <input id="customerId" formControlName="customerId" [class.invalid]="invalid('customerId')" />
          @if (invalid('customerId')) { <span class="error">Required, up to 64 characters</span> }
        </div>
        <div class="field">
          <label for="product">Product</label>
          <input id="product" formControlName="product" [class.invalid]="invalid('product')" />
          @if (invalid('product')) { <span class="error">Required</span> }
        </div>
        <div class="field">
          <label for="quantity">Quantity</label>
          <input id="quantity" type="number" formControlName="quantity" [class.invalid]="invalid('quantity')" />
          @if (invalid('quantity')) { <span class="error">Between 1 and 1000</span> }
        </div>
        <div class="field">
          <label for="unitPrice">Unit price</label>
          <input id="unitPrice" type="number" step="0.01" formControlName="unitPrice" [class.invalid]="invalid('unitPrice')" />
          @if (invalid('unitPrice')) { <span class="error">At least 0.01</span> }
        </div>
      </div>
      <p>
        Total <strong>{{ total() | currency: 'USD' }}</strong>
        @if (total() > limit) { <span class="badge bad" style="margin-left: 8px">above the {{ limit | currency: 'USD' }} payment limit, will be declined</span> }
      </p>
      @if (error()) { <p class="error">{{ error() }}</p> }
      <div class="actions">
        <button class="primary" type="submit" [disabled]="busy()">{{ busy() ? 'Placing…' : 'Place order' }}</button>
      </div>
    </form>
  `,
})
export class NewOrderPage {
  private readonly api = inject(OrderApi);
  private readonly router = inject(Router);
  protected readonly limit = PAYMENT_LIMIT;
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  readonly form = inject(FormBuilder).nonNullable.group({
    customerId: ['cust-42', [Validators.required, Validators.maxLength(64)]],
    product: ['Mechanical keyboard', [Validators.required, Validators.maxLength(255)]],
    quantity: [2, [Validators.required, Validators.min(1), Validators.max(1000)]],
    unitPrice: [60, [Validators.required, Validators.min(0.01)]],
  });
  private readonly value = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  protected readonly total = computed(() => Math.round((this.value().quantity ?? 0) * (this.value().unitPrice ?? 0) * 100) / 100);

  protected invalid(name: keyof typeof this.form.controls) {
    const c = this.form.controls[name];
    return c.invalid && (c.touched || c.dirty);
  }

  submit() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.busy.set(true);
    this.error.set(null);
    this.api.place(this.form.getRawValue()).subscribe({
      next: (order) => this.router.navigate(['/orders', order.id]),
      error: (e: Error) => {
        this.busy.set(false);
        this.error.set(e.message);
      },
    });
  }
}
