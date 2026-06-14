# Subscription Plans API

Base URL:

```text
https://hog-fyic.onrender.com/api/v1/subscription
```

All endpoints require:

```http
Authorization: Bearer <access-token>
Content-Type: application/json
```

Subscription plans are available to both `user` and `tailor` accounts.

## Country And Payment Provider

The backend selects the provider from the authenticated user's `country`:

| User country | Display currency | Payment provider |
| --- | --- | --- |
| `Nigeria`, `NG`, or `Nigerian` | NGN | Paystack |
| Any other country | USD | Stripe |

Plan prices are stored in NGN. International display and checkout amounts are converted
to USD using the configured exchange-rate API. If that API is unavailable, the backend
uses `DEFAULT_USD_NGN_RATE`, which defaults to `1500`.

## Benefits Checklist

Every newly created plan must contain between one and seven `benefits`. Benefits:

- Are returned in their original order for checklist display.
- Cannot be blank.
- Cannot be duplicated, case-insensitively.
- Must be 160 characters or fewer each.
- Are copied into the initialized order and transaction as `planBenefits`.

The snapshot means later plan edits do not alter the benefits recorded for an earlier
subscription payment.

## Create Plan

Admin or super admin only.

```http
POST /api/v1/subscription/createSubscriptionPlan
```

Request:

```json
{
  "name": "Premium",
  "amount": 30000,
  "duration": "monthly",
  "description": "Premium tools for active fashion businesses",
  "benefits": [
    "Unlimited marketplace listings",
    "Advanced business analytics",
    "Priority customer support",
    "Featured designer eligibility",
    "Custom portfolio sections",
    "Faster moderation review",
    "International customer visibility"
  ]
}
```

Allowed plan names:

- `Standard`
- `Premium`
- `Enterprise`

Allowed durations:

- `monthly`
- `quarterly`
- `yearly`

Success response:

```json
{
  "success": true,
  "message": "Subscription plan created successfully",
  "data": {
    "_id": "685000000000000000000201",
    "name": "Premium",
    "amount": 30000,
    "duration": "monthly",
    "description": "Premium tools for active fashion businesses",
    "benefits": [
      "Unlimited marketplace listings",
      "Advanced business analytics",
      "Priority customer support",
      "Featured designer eligibility",
      "Custom portfolio sections",
      "Faster moderation review",
      "International customer visibility"
    ],
    "createdAt": "2026-06-14T13:00:00.000Z",
    "updatedAt": "2026-06-14T13:00:00.000Z"
  }
}
```

The combination of `name` and `duration` must be unique.

## Update Plan

Admin or super admin only.

```http
PUT /api/v1/subscription/updateSubscriptionPlan/:id
```

Send any fields that should change:

```json
{
  "amount": 35000,
  "benefits": [
    "Unlimited marketplace listings",
    "Advanced business analytics",
    "Priority customer support"
  ]
}
```

To reorder checklist items, send the complete `benefits` array in the required order.

Success response:

```json
{
  "success": true,
  "message": "Subscription plan updated successfully",
  "data": {
    "_id": "685000000000000000000201",
    "name": "Premium",
    "amount": 35000,
    "duration": "monthly",
    "description": "Premium tools for active fashion businesses",
    "benefits": [
      "Unlimited marketplace listings",
      "Advanced business analytics",
      "Priority customer support"
    ]
  }
}
```

## List Plans

Available to users, tailors, admins, and super admins.

```http
GET /api/v1/subscription/getSubscriptionPlans
```

### Nigerian User Response

```json
{
  "success": true,
  "message": "Subscription plans retrieved successfully",
  "data": [
    {
      "_id": "685000000000000000000201",
      "name": "Premium",
      "amount": 30000,
      "duration": "monthly",
      "description": "Premium tools for active fashion businesses",
      "benefits": [
        "Unlimited marketplace listings",
        "Advanced business analytics",
        "Priority customer support"
      ],
      "benefitCount": 3,
      "baseCurrency": "NGN",
      "displayCurrency": "NGN",
      "displayAmount": 30000,
      "paymentProvider": "paystack"
    }
  ]
}
```

### International User Response

Example using an exchange rate of `1500 NGN = 1 USD`:

```json
{
  "success": true,
  "message": "Subscription plans retrieved successfully",
  "data": [
    {
      "_id": "685000000000000000000201",
      "name": "Premium",
      "amount": 30000,
      "duration": "monthly",
      "description": "Premium tools for active fashion businesses",
      "benefits": [
        "Unlimited marketplace listings",
        "Advanced business analytics",
        "Priority customer support"
      ],
      "benefitCount": 3,
      "baseCurrency": "NGN",
      "displayCurrency": "USD",
      "displayAmount": 20,
      "exchangeRate": 1500,
      "paymentProvider": "stripe"
    }
  ]
}
```

## Get One Plan

```http
GET /api/v1/subscription/getSubscriptionPlan/:id
```

The response uses the same country-aware pricing and benefit fields as the list endpoint.

## Initialize Subscription Payment

Available to `user` and `tailor` accounts.

```http
POST /api/v1/subscription/subscriptionPayments
```

Using a plan ID is recommended:

```json
{
  "planId": "685000000000000000000201"
}
```

The legacy name and duration form remains supported:

```json
{
  "plan": "Premium",
  "billTerm": "monthly"
}
```

### Nigerian User: Paystack

```json
{
  "success": true,
  "provider": "paystack",
  "message": "Subscription payment initialized successfully",
  "authorizationUrl": "https://checkout.paystack.com/example",
  "data": {
    "paymentMethod": "Paystack",
    "paymentReference": "payment-reference",
    "plan": "Premium",
    "planId": "685000000000000000000201",
    "planBenefits": [
      "Unlimited marketplace listings",
      "Advanced business analytics",
      "Priority customer support"
    ],
    "amountPaid": 30000
  },
  "breakdown": {
    "plan": "Premium",
    "billTerm": "monthly",
    "benefits": [
      "Unlimited marketplace listings",
      "Advanced business analytics",
      "Priority customer support"
    ],
    "amountNGN": 30000,
    "currency": "NGN"
  }
}
```

### International User: Stripe

```json
{
  "success": true,
  "provider": "stripe",
  "message": "Subscription payment initialized successfully",
  "checkoutUrl": "https://checkout.stripe.com/example",
  "sessionId": "cs_test_example",
  "data": {
    "paymentMethod": "Stripe",
    "paymentReference": "payment-reference",
    "sessionId": "cs_test_example",
    "plan": "Premium",
    "planId": "685000000000000000000201",
    "planBenefits": [
      "Unlimited marketplace listings",
      "Advanced business analytics",
      "Priority customer support"
    ],
    "amountPaid": 30000,
    "amountPaidUSD": 20,
    "exchangeRate": 1500
  },
  "breakdown": {
    "plan": "Premium",
    "billTerm": "monthly",
    "benefits": [
      "Unlimited marketplace listings",
      "Advanced business analytics",
      "Priority customer support"
    ],
    "amountNGN": 30000,
    "amountUSD": 20,
    "exchangeRate": 1500,
    "currency": "USD"
  }
}
```

## Verify And Activate

```http
GET /api/v1/subscription/verifySubscriptionPayment/:paymentReference
```

The backend verifies:

- Paystack status, reference, NGN currency, and expected amount.
- Stripe payment status, session ID, reference, USD currency, and expected amount.
- The requester owns the payment or is an admin/super admin.

Success response:

```json
{
  "success": true,
  "message": "Subscription activated successfully",
  "alreadyProcessed": false,
  "data": {
    "paymentReference": "payment-reference",
    "paymentMethod": "Stripe",
    "paymentCurrency": "USD",
    "amountPaid": 20,
    "plan": "Premium",
    "planId": "685000000000000000000201",
    "planBenefits": [
      "Unlimited marketplace listings",
      "Advanced business analytics",
      "Priority customer support"
    ]
  },
  "planBenefits": [
    "Unlimited marketplace listings",
    "Advanced business analytics",
    "Priority customer support"
  ],
  "user": {
    "_id": "685000000000000000000301",
    "subscriptionPlan": "premium",
    "subscriptionStartDate": "2026-06-14T13:00:00.000Z",
    "subscriptionEndDate": "2026-07-14T13:00:00.000Z",
    "billTerm": "monthly"
  }
}
```

Stripe can also activate the subscription through the signed webhook. Both verification
paths are idempotent and use the payment reference to avoid duplicate transactions.

## Delete Plan

Admin or super admin only.

```http
DELETE /api/v1/subscription/deleteSubscriptionPlan/:id
```

Deleting a plan does not remove benefits already snapshotted into completed
subscription transactions.

## Validation Errors

More than seven benefits:

```json
{
  "success": false,
  "message": "A plan can have at most 7 benefits"
}
```

Duplicate benefits:

```json
{
  "success": false,
  "message": "Plan benefits cannot contain duplicates"
}
```

Missing benefits during plan creation:

```json
{
  "success": false,
  "message": "Plan benefits are required"
}
```

Unconfirmed or mismatched provider payment:

```json
{
  "success": false,
  "message": "Stripe payment has not been confirmed for this subscription",
  "providerStatus": "unpaid"
}
```

## Environment Configuration

Paystack:

```text
PAYSTACK_MAIN_KEY
```

Stripe:

```text
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
```

Pricing conversion:

```text
EXCHANGE_RATE_API_KEY
DEFAULT_USD_NGN_RATE
```

Redirect URLs:

```text
FRONTEND_URL
```
