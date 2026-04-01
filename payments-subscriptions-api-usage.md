# Payments Subscriptions API Usage Guide

This file explains how to consume the `payments-subscriptions-api` from a frontend app or from another LLM/client.

It is based on the actual Express routes, validators, controllers, services, and DB-backed response shapes in this repository.

## 1. Quick Summary

- Base API URL: `http://localhost:<PORT>/api/v1`
- Default local port from code: `3002`
- Response format is consistent across the API:
  - success:
    ```json
    {
      "success": true,
      "message": "Human readable message",
      "data": {},
      "meta": {},
      "timestamp": "2026-03-31T12:00:00.000Z"
    }
    ```
  - error:
    ```json
    {
      "success": false,
      "message": "Error message",
      "errors": [],
      "timestamp": "2026-03-31T12:00:00.000Z"
    }
    ```
- Auth styles:
  - Public routes: no auth
  - User routes: `Authorization: Bearer <jwt>`
  - Admin routes: same JWT, but token must include `role: "admin"`
  - Internal service routes: `X-Internal-API-Key: <INTERNAL_API_KEY>`

## 2. What This API Does

This service manages:

- subscription tiers
- discount codes
- the current user subscription state
- payments through Razorpay, Stripe, and PayPal
- refunds
- internal limit-checking for another backend service

For frontend work, the most important areas are:

1. list tiers
2. validate a discount
3. create a payment session/order
4. confirm payment success
5. fetch the user subscription
6. fetch payment/refund history

## 3. Headers You Should Send

### JSON requests

```http
Content-Type: application/json
Accept: application/json
```

### Authenticated user requests

```http
Authorization: Bearer <access_token>
```

The API also supports `access_token` cookie auth, but Bearer token is the clearest option for frontend integrations.

### Recommended request ID

You can send:

```http
X-Request-Id: any-safe-unique-id
```

If you do not send it, the API generates one and returns it in the response headers.

## 4. JWT Requirements

User routes expect a JWT issued by the auth system that contains at least:

```json
{
  "userId": "uuid",
  "role": "user"
}
```

Important detail:

- Stripe session creation also expects `req.user.email`
- so the JWT used for `POST /payments/stripe/create-session` should include `email`

If `email` is missing, Stripe session creation will fail with `401 Unauthorized`.

## 5. Public Endpoints

These endpoints are safe to call before login.

### 5.1 Get active tiers

`GET /tiers`

Query params:

- `page` number, default `1`
- `limit` number, default `20`, max `100`
- `search` string, optional
- `isActive` string, optional, usually not needed on public calls

Example:

```http
GET /api/v1/tiers?page=1&limit=10
```

Typical response `data` item:

```json
{
  "id": "tier-uuid",
  "name": "Pro",
  "description": "For growing users",
  "benefits": ["10 APIs", "Priority support"],
  "price": "499.00",
  "limit": 10,
  "permission": "SCRUDQ",
  "isActive": true,
  "createdAt": "2026-03-16T10:00:00.000Z",
  "updatedAt": "2026-03-16T10:00:00.000Z"
}
```

The response also includes pagination metadata in `meta`.

### 5.2 Get one tier

`GET /tiers/:id`

Use this when you already know the tier UUID.

### 5.3 Get many tiers by IDs

`POST /tiers/by-ids`

Body:

```json
{
  "ids": ["tier-uuid-1", "tier-uuid-2"]
}
```

Rules:

- minimum 1 ID
- maximum 50 IDs
- only active tiers are returned

### 5.4 Validate a discount code

`GET /discounts/validate?code=CODE&tierId=<tier-uuid>`

Example:

```http
GET /api/v1/discounts/validate?code=LAUNCH50&tierId=8d2d0b2e-1111-2222-3333-444444444444
```

Typical response:

```json
{
  "success": true,
  "message": "Discount code is valid!",
  "data": {
    "discount": {
      "id": "discount-uuid",
      "tierId": "tier-uuid",
      "code": "LAUNCH50",
      "discountPercentage": "50.00",
      "finalPrice": "249.50",
      "validFrom": "2026-03-01T00:00:00.000Z",
      "validUntil": "2026-04-01T00:00:00.000Z",
      "maxUses": 100,
      "usedCount": 3,
      "isActive": true,
      "createdAt": "2026-03-01T00:00:00.000Z",
      "updatedAt": "2026-03-01T00:00:00.000Z"
    },
    "finalPrice": "249.50",
    "originalPrice": "499.00"
  }
}
```

Use `finalPrice` for display. Keep in mind provider payment endpoints may convert to paise/cents internally.

## 6. Authenticated User Endpoints

These require a valid JWT.

### 6.1 Get current user subscription

`GET /subscriptions/me`

This endpoint is important because:

- it returns the current subscription
- if no subscription exists yet, the backend auto-creates a free-tier subscription row

Typical response `data`:

```json
{
  "id": "subscription-uuid",
  "userId": "user-uuid",
  "isSubscribed": false,
  "tierId": "free-tier-uuid",
  "status": "active",
  "expiresAt": null,
  "limitLeft": 3,
  "autoRenew": false,
  "cancelledAt": null,
  "createdAt": "2026-03-31T12:00:00.000Z",
  "updatedAt": "2026-03-31T12:00:00.000Z",
  "tier": {
    "id": "free-tier-uuid",
    "name": "Free",
    "permission": "SCRUD",
    "limit": 3,
    "benefits": ["3 APIs"],
    "price": "0.00"
  }
}
```

### 6.2 Razorpay flow

Best when your frontend supports Razorpay checkout directly.

#### Step 1: create order

`POST /payments/razorpay/create-order`

Body:

```json
{
  "tierId": "tier-uuid",
  "discountCode": "LAUNCH50",
  "currency": "INR",
  "notes": {
    "source": "web-app"
  }
}
```

Response `data`:

```json
{
  "payment": {
    "id": "payment-uuid",
    "userId": "user-uuid",
    "tierId": "tier-uuid",
    "status": "pending",
    "razorpayOrderId": "order_xxx",
    "razorpayPaymentId": null,
    "razorpaySignature": null,
    "amount": 49900,
    "currency": "INR",
    "discountId": "discount-uuid",
    "notes": {
      "source": "web-app"
    },
    "failureReason": null,
    "refundedAmount": null,
    "refundedAt": null,
    "isPartialRefund": false,
    "createdAt": "2026-03-31T12:00:00.000Z",
    "updatedAt": "2026-03-31T12:00:00.000Z"
  },
  "razorpayOrder": {
    "id": "order_xxx"
  }
}
```

Important:

- `amount` here is in paise
- pass `razorpayOrder.id` to Razorpay checkout on the client

#### Step 2: verify payment after checkout success

`POST /payments/razorpay/verify`

Body:

```json
{
  "razorpayOrderId": "order_xxx",
  "razorpayPaymentId": "pay_xxx",
  "razorpaySignature": "signature_from_razorpay"
}
```

If verification succeeds, the subscription is activated and the tier limit is reset.

### 6.3 Stripe flow

#### Step 1: create checkout session

`POST /payments/stripe/create-session`

Body:

```json
{
  "tierId": "tier-uuid",
  "discountCode": "LAUNCH50",
  "currency": "USD"
}
```

Response `data`:

```json
{
  "payment": {
    "id": "payment-uuid",
    "userId": "user-uuid",
    "tierId": "tier-uuid",
    "status": "pending",
    "stripeSessionId": "cs_test_xxx",
    "stripePaymentIntentId": null,
    "stripeCustomerId": null,
    "stripeSubscriptionId": null,
    "amount": 4999,
    "currency": "USD",
    "discountId": null,
    "failureMessage": null,
    "refundedAmount": null,
    "refundedAt": null,
    "isPartialRefund": false,
    "createdAt": "2026-03-31T12:00:00.000Z",
    "updatedAt": "2026-03-31T12:00:00.000Z"
  },
  "sessionUrl": "https://checkout.stripe.com/..."
}
```

Frontend action:

- redirect the user to `sessionUrl`

#### Step 2: handle success redirect

After Stripe redirects back, call:

`GET /payments/stripe/success?session_id=<CHECKOUT_SESSION_ID>`

This endpoint finalizes the payment in this service and activates the subscription.

Important:

- do not assume the redirect alone means the subscription is active
- call this success endpoint, then refetch `/subscriptions/me`

#### Cancel route

`GET /payments/stripe/cancel`

This only returns a message that the payment was cancelled.

### 6.4 PayPal flow

#### Step 1: create order

`POST /payments/paypal/create-order`

Body:

```json
{
  "tierId": "tier-uuid",
  "discountCode": "LAUNCH50",
  "currency": "USD"
}
```

Response `data`:

```json
{
  "payment": {
    "id": "payment-uuid",
    "userId": "user-uuid",
    "tierId": "tier-uuid",
    "status": "pending",
    "paypalOrderId": "PAYPAL_ORDER_ID",
    "paypalCaptureId": null,
    "paypalPayerId": null,
    "amount": "49.99",
    "currency": "USD",
    "discountId": null,
    "metadata": null,
    "failureReason": null,
    "refundedAmount": null,
    "refundedAt": null,
    "isPartialRefund": false,
    "createdAt": "2026-03-31T12:00:00.000Z",
    "updatedAt": "2026-03-31T12:00:00.000Z"
  },
  "approvalUrl": "https://www.paypal.com/checkoutnow?token=..."
}
```

Frontend action:

- redirect the user to `approvalUrl`

#### Step 2: capture after user approval

`POST /payments/paypal/capture/:orderId`

Example:

```http
POST /api/v1/payments/paypal/capture/PAYPAL_ORDER_ID
```

This endpoint captures the payment and activates the subscription.

### 6.5 Payment history

Available endpoints:

- `GET /payments/razorpay/history`
- `GET /payments/stripe/history`
- `GET /payments/paypal/history`

Shared query params:

- `page`
- `limit`
- `status` optional

Note:

- the validators allow `status`
- but the current service implementations do not actually filter by status
- so treat `status` as not reliably implemented right now

### 6.6 User refund history

`GET /payments/refunds/me`

Query params:

- `page`
- `limit`
- `provider`: `razorpay | stripe | paypal`
- `status`: `pending | processed | failed`

Response `data`:

```json
{
  "refunds": [],
  "meta": {
    "total": 0,
    "page": 1,
    "limit": 20,
    "totalPages": 0,
    "hasNext": false,
    "hasPrev": false
  }
}
```

## 7. Admin Endpoints

These are usually for admin panel work, not regular end-user screens.

Prefix: `/admin`

### Tier management

- `GET /admin/tiers`
- `POST /admin/tiers`
- `PATCH /admin/tiers/:id`
- `DELETE /admin/tiers/:id`

Create tier body:

```json
{
  "name": "Pro",
  "description": "For power users",
  "benefits": ["10 APIs", "Priority support"],
  "price": 499,
  "limit": 10,
  "permission": "SCRUDQ",
  "isActive": true
}
```

### Discount management

- `GET /admin/discounts`
- `GET /admin/discounts/:id`
- `POST /admin/discounts`
- `PATCH /admin/discounts/:id`
- `DELETE /admin/discounts/:id`

Create discount body:

```json
{
  "tierId": "tier-uuid",
  "code": "LAUNCH50",
  "discountPercentage": 50,
  "validFrom": "2026-03-01T00:00:00.000Z",
  "validUntil": "2026-04-01T00:00:00.000Z",
  "maxUses": 100,
  "isActive": true
}
```

Rules:

- code must be uppercase letters, numbers, `_` or `-`
- `discountPercentage` must be between `0.01` and `100`

### Subscription management

- `GET /admin/subscriptions`
- `PATCH /admin/subscriptions/:id`

Update body:

```json
{
  "tierId": "tier-uuid",
  "isSubscribed": true,
  "status": "active",
  "expiresAt": "2026-04-30T00:00:00.000Z",
  "autoRenew": true,
  "limitLeft": 10
}
```

### Payment reporting

`GET /admin/payments`

Query params:

- `provider`: `razorpay | stripe | paypal`
- `page`
- `limit`

Behavior:

- if `provider` is set, you get a paginated list for that provider
- if `provider` is omitted, you get only summary totals across all providers

### Refund management

- `POST /admin/refunds/razorpay/:paymentId`
- `POST /admin/refunds/stripe/:paymentId`
- `POST /admin/refunds/paypal/:paymentId`
- `GET /admin/refunds`
- `GET /admin/refunds/:refundId`

Refund request body:

```json
{
  "amount": 1000,
  "reason": "Customer requested refund",
  "notes": "Handled by support"
}
```

Important amount behavior:

- Razorpay refund amount is in paise
- Stripe refund amount is in cents
- PayPal full refunds use the original decimal amount internally
- PayPal partial refunds currently divide `amount` by `100`, so send minor-unit style values if you use partial PayPal refunds from admin UI

## 8. Internal Backend Endpoints

These are not for frontend use.

Prefix: `/internal`

Required header:

```http
X-Internal-API-Key: <INTERNAL_API_KEY>
```

Endpoints:

- `GET /internal/subscriptions/check/:userId`
- `POST /internal/subscriptions/decrement/:userId`

`GET /internal/subscriptions/check/:userId` returns:

```json
{
  "canCreate": true,
  "limitLeft": 3,
  "tier": {
    "id": "tier-uuid",
    "name": "Free",
    "permission": "SCRUD",
    "limit": 3
  }
}
```

`POST /internal/subscriptions/decrement/:userId`

Optional body:

```json
{
  "apiId": "new-api-uuid"
}
```

## 9. Webhooks

These are provider-facing server endpoints, not frontend endpoints.

- `POST /webhooks/razorpay`
- `POST /webhooks/stripe`
- `POST /webhooks/paypal`

Do not call these from the browser.

## 10. Pagination Shape

Whenever pagination is used, `meta` usually looks like this:

```json
{
  "total": 57,
  "page": 1,
  "limit": 20,
  "totalPages": 3,
  "hasNext": true,
  "hasPrev": false
}
```

## 11. Common Error Cases

### 400 Bad Request

Usually caused by:

- invalid UUID
- missing required body fields
- invalid discount
- expired discount
- invalid payment signature
- trying to refund a payment in the wrong state

Validation errors usually come in:

```json
{
  "success": false,
  "message": "Validation failed.",
  "errors": [
    {
      "path": "tierId",
      "message": "Invalid tier ID"
    }
  ]
}
```

### 401 Unauthorized

Usually caused by:

- missing token
- expired token
- invalid token
- Stripe session creation without `email` in JWT payload

### 403 Forbidden

Usually caused by:

- non-admin user calling admin route
- wrong internal API key

### 404 Not Found

Usually caused by:

- tier/discount/payment/refund/subscription not found
- wrong route path

### 409 Conflict

Usually caused by:

- duplicate tier name
- duplicate discount code
- payment already verified/captured

### 429 Too Many Requests

Current rate limits in code:

- global: default `100` requests per `15 min`
- payment creation: `20` per hour
- discount validation: `30` per `15 min`
- admin: `60` per `15 min`

## 12. Recommended Frontend Flows

### Pricing page

1. Call `GET /tiers`
2. Render `name`, `description`, `benefits`, `price`, `limit`, `permission`
3. If user enters promo code, call `GET /discounts/validate`

### Buy with Razorpay

1. Call `POST /payments/razorpay/create-order`
2. Open Razorpay checkout using returned `razorpayOrder.id`
3. After checkout success, call `POST /payments/razorpay/verify`
4. Call `GET /subscriptions/me`

### Buy with Stripe

1. Call `POST /payments/stripe/create-session`
2. Redirect to returned `sessionUrl`
3. On your success page, read `session_id` from URL
4. Call `GET /payments/stripe/success?session_id=...`
5. Call `GET /subscriptions/me`

### Buy with PayPal

1. Call `POST /payments/paypal/create-order`
2. Redirect to returned `approvalUrl`
3. After approval, call `POST /payments/paypal/capture/:orderId`
4. Call `GET /subscriptions/me`

## 13. Minimal Fetch Helpers

### Public request

```ts
async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`/api/v1${path}`, {
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message || 'API request failed');
  }
  return json.data as T;
}
```

### Authenticated request

```ts
async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  const res = await fetch(`/api/v1${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    credentials: 'include',
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message || 'API request failed');
  }
  return json.data as T;
}
```

## 14. Gotchas To Remember

- Stripe checkout requires `email` in the authenticated user payload.
- `/payments/stripe/success` is part of the business flow, not just a display page.
- `/subscriptions/me` auto-creates a free subscription if one does not exist yet.
- Money fields are not uniform across providers:
  - Razorpay: integer paise
  - Stripe: integer cents
  - PayPal: decimal string
- Some DB numeric fields are returned as strings, so do not assume all prices are numbers.
- Payment history endpoints accept `status`, but current implementation does not filter by it.
- Admin payment summary and admin payment list share the same endpoint, and behavior changes based on `provider`.

## 15. Best File-Level Mental Model

- tiers: pricing plans
- discounts: promo codes tied to a tier
- subscriptions: what plan the current user has and how many API-creation slots remain
- payments: provider-specific transaction records
- refunds: provider-agnostic refund records
- internal routes: machine-to-machine subscription limit checks

If you only need the frontend integration path, focus on:

- `GET /tiers`
- `GET /discounts/validate`
- one payment provider flow
- `GET /subscriptions/me`
- payment/refund history pages if your UI shows them
