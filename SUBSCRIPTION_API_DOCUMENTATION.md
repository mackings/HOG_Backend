# Subscription API Documentation

Base URL: `https://<your-domain>/api/v1`  
Auth Header: `Authorization: Bearer <token>`

## Quick Call Instructions

Use these defaults for every request:

- Header: `Authorization: Bearer <JWT_TOKEN>`
- Header: `Content-Type: application/json`
- Base URL example: `https://hog-fyic.onrender.com/api/v1`

### Step A: Admin creates plan (once)
```bash
curl -X POST "https://hog-fyic.onrender.com/api/v1/subscription/createSubscriptionPlan" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Premium",
    "amount": 50000,
    "duration": "monthly",
    "description": "Premium monthly plan"
  }'
```

### Step B: Tailor fetches plans
```bash
curl -X GET "https://hog-fyic.onrender.com/api/v1/subscription/getSubscriptionPlans" \
  -H "Authorization: Bearer <TAILOR_TOKEN>"
```

### Step C: Tailor initializes payment using `planId` (recommended)
```bash
curl -X POST "https://hog-fyic.onrender.com/api/v1/subscription/subscriptionPayments" \
  -H "Authorization: Bearer <TAILOR_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "planId": "<PLAN_ID_FROM_STEP_B>"
  }'
```

What to do with response:
- `provider=paystack`: open `authorizationUrl`.
- `provider=stripe`: open `checkoutUrl`.

### Step D: Confirm activation in app
After successful payment redirect/webhook, refresh user profile:
- expect `subscriptionPlan`, `subscriptionStartDate`, `subscriptionEndDate`, `billTerm` to be updated.

If webhook delay occurs, call manual verify endpoint:
```bash
curl -X GET "https://hog-fyic.onrender.com/api/v1/subscription/verifySubscriptionPayment/<PAYMENT_REFERENCE>" \
  -H "Authorization: Bearer <TAILOR_TOKEN>"
```

## Overview

- Admins/SuperAdmins manage subscription plans.
- Tailors subscribe to plans.
- Payment provider is selected by tailor country:
  - Nigerian tailor: **Paystack (NGN)**
  - International tailor: **Stripe Checkout (USD)** with NGN -> USD conversion.

## Roles and Access

- `tailor`:
  - `POST /subscription/subscriptionPayments`
  - `GET /subscription/getSubscriptionPlans`
  - `GET /subscription/getSubscriptionPlan/:id`

- `admin`, `superAdmin`:
  - All read endpoints above
  - `POST /subscription/createSubscriptionPlan`
  - `PUT /subscription/updateSubscriptionPlan/:id`
  - `DELETE /subscription/deleteSubscriptionPlan/:id`

## 1) Plan Management APIs (Admin/SuperAdmin)

### 1.1 Create subscription plan
- Method: `POST`
- URL: `/subscription/createSubscriptionPlan`

Request:
```json
{
  "name": "Standard",
  "amount": 50000,
  "duration": "monthly",
  "description": "Standard plan billed monthly"
}
```

Rules:
- `name`: `Standard | Premium | Enterprise`
- `duration`: `monthly | quarterly | yearly`
- Combination of `name + duration` must be unique.

Response `201`:
```json
{
  "success": true,
  "message": "Subscription plan created successfully",
  "data": {
    "_id": "67b....",
    "name": "Standard",
    "amount": 50000,
    "duration": "monthly",
    "description": "Standard plan billed monthly"
  }
}
```

### 1.2 Update subscription plan
- Method: `PUT`
- URL: `/subscription/updateSubscriptionPlan/:id`

Request (partial allowed):
```json
{
  "amount": 55000,
  "description": "Updated description"
}
```

### 1.3 Delete subscription plan
- Method: `DELETE`
- URL: `/subscription/deleteSubscriptionPlan/:id`

Response `200`:
```json
{
  "success": true,
  "message": "Subscription plan deleted successfully",
  "data": {
    "id": "67b...."
  }
}
```

## 2) Plan Read APIs (Tailor/Admin/SuperAdmin)

### 2.1 Get all plans
- Method: `GET`
- URL: `/subscription/getSubscriptionPlans`

Response note:
- Base plan amount is stored in `NGN` as `amount`.
- API also returns display fields based on logged-in tailor country:
  - Nigerian: `displayCurrency=NGN`, `displayAmount=amount`
  - International: `displayCurrency=USD`, `displayAmount=amount/exchangeRate`

### 2.2 Get single plan
- Method: `GET`
- URL: `/subscription/getSubscriptionPlan/:id`

## 3) Tailor Subscription Payment API

### 3.1 Initialize subscription payment
- Method: `POST`
- URL: `/subscription/subscriptionPayments`
- Role: `tailor`

You can use either:

Option A (recommended): `planId`
```json
{
  "planId": "67b..."
}
```

Option B: `plan + billTerm`
```json
{
  "plan": "Premium",
  "billTerm": "yearly"
}
```

Notes:
- Amount is computed from DB plan price on backend (client cannot override).
- Start/end dates are computed from plan duration.

### 3.2 Nigerian tailor response (Paystack)
```json
{
  "success": true,
  "provider": "paystack",
  "message": "Subscription payment initialized successfully",
  "authorizationUrl": "https://checkout.paystack.com/....",
  "data": {
    "_id": "67c...",
    "paymentReference": "a1b2c3...",
    "paymentMethod": "Paystack",
    "plan": "Premium",
    "billTerm": "monthly",
    "totalAmount": 50000
  },
  "breakdown": {
    "plan": "Premium",
    "billTerm": "monthly",
    "amountNGN": 50000,
    "currency": "NGN"
  }
}
```

### 3.3 International tailor response (Stripe)
```json
{
  "success": true,
  "provider": "stripe",
  "message": "Subscription payment initialized successfully",
  "checkoutUrl": "https://checkout.stripe.com/c/pay/....",
  "sessionId": "cs_test_....",
  "data": {
    "_id": "67c...",
    "paymentReference": "z9y8x7...",
    "paymentMethod": "Stripe",
    "plan": "Premium",
    "billTerm": "monthly",
    "totalAmount": 50000,
    "amountPaidUSD": 33.33,
    "exchangeRate": 1500
  },
  "breakdown": {
    "plan": "Premium",
    "billTerm": "monthly",
    "amountNGN": 50000,
    "amountUSD": 33.33,
    "exchangeRate": 1500,
    "currency": "USD"
  }
}
```

## 4) Payment Completion and Activation

Subscription activation is handled by existing webhooks/verification flow:

- Paystack webhook: `POST /material/orderWebhook`
- Stripe webhook: `POST /stripe/webhook`

On successful payment:
- Transaction is created.
- User gets:
  - `subscriptionPlan`
  - `subscriptionStartDate`
  - `subscriptionEndDate`
  - `billTerm`

Optional verification endpoint (Stripe):
- `GET /stripe/verify-payment/:paymentReference`

Manual subscription verification endpoint (Paystack/Stripe subscription refs):
- `GET /subscription/verifySubscriptionPayment/:paymentReference`

## 5) Mobile Integration Flow

1. Fetch plans:
- `GET /subscription/getSubscriptionPlans`

2. User selects plan:
- Keep selected `planId`.

3. Initialize payment:
- `POST /subscription/subscriptionPayments`

4. Handle provider response:
- If `provider=paystack`, open `authorizationUrl`.
- If `provider=stripe`, open `checkoutUrl`.

5. After success redirect/webhook:
- Refresh user profile from app user API to reflect active subscription.

6. If profile not updated within a short time (webhook delay):
- Call `GET /subscription/verifySubscriptionPayment/:paymentReference`
- Then refresh profile again.

## 5.1 Flutter Integration Notes

- Always send JWT token in `Authorization` header.
- For payment initialization, send either:
  - `{"planId":"..."}` (recommended), or
  - `{"plan":"Premium","billTerm":"monthly"}`
- Do **not** send amount from app; backend computes and secures amount from DB.
- If request fails with role error, confirm logged-in account role is `tailor` for subscription payment.
- If request fails with plan errors, fetch plans again and use current `_id`.

## 6) Error Examples

Invalid role:
```json
{
  "message": "You are not authorized as user to perform this operation"
}
```

Invalid plan ID:
```json
{
  "success": false,
  "message": "Invalid plan ID"
}
```

Plan not found:
```json
{
  "success": false,
  "message": "Subscription plan not found"
}
```

Invalid role for payment endpoint:
```json
{
  "message": "You are not authorized as user to perform this operation"
}
```

Invalid body for payment endpoint:
```json
{
  "success": false,
  "message": "Provide a valid plan and billing term, or use planId"
}
```
