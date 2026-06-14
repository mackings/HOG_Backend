# Admin Analytics API

Base URL:

```text
https://hog-fyic.onrender.com/api/v1/admin
```

All endpoints require an authenticated `admin` or `superAdmin`.

```http
Authorization: Bearer <access-token>
```

## Recommended Dashboard Request

Use this endpoint for the Analytics screen. It replaces the five separate dashboard
requests with one request, while the server runs the independent database aggregations
in parallel.

### Get All Analytics

```http
GET /api/v1/admin/analytics
```

Request body: none.

Example:

```bash
curl --request GET \
  --url https://hog-fyic.onrender.com/api/v1/admin/analytics \
  --header "Authorization: Bearer <access-token>"
```

Example `200 OK` response:

```json
{
  "success": true,
  "message": "Admin analytics fetched successfully",
  "data": {
    "users": {
      "totalUsers": 39,
      "byRole": {
        "admin": 1,
        "superAdmin": 1,
        "tailor": 7,
        "user": 30
      },
      "bySubscriptionPlan": {
        "free": 35,
        "premium": 4
      },
      "verification": {
        "verified": 31,
        "unverified": 8
      },
      "accountStatus": {
        "active": 38,
        "blocked": 1
      },
      "registeredLast30Days": 6
    },
    "listings": {
      "totalListings": 4,
      "freeListings": 0,
      "paidListings": 4,
      "unpricedListings": 0,
      "byApprovalStatus": {
        "approved": 3,
        "pending": 1
      },
      "byAvailability": {
        "available": 3,
        "sold": 1
      },
      "featured": {
        "featured": 1,
        "standard": 3
      },
      "listedValue": {
        "total": 450000,
        "average": 112500,
        "currencyNote": "Values are not converted; use only when listing currencies are consistent."
      }
    },
    "earnings": {
      "totalEarnings": 1355958.84,
      "currency": "NGN",
      "basis": "current_admin_wallet_balance",
      "derivation": {
        "recordedCommission": 200000,
        "recordedTax": 550000,
        "otherWalletCredits": 605958.84,
        "formula": "totalEarnings = recordedCommission + recordedTax + otherWalletCredits"
      },
      "note": "This is the primary admin account's current wallet balance, not gross historical revenue. Other wallet credits include listing fees and any credits not stored as commission or tax."
    },
    "transactions": {
      "totalTransactions": 61,
      "successfulTransactions": 54,
      "byPaymentStatus": {
        "success": 54,
        "unspecified": 7
      },
      "byOrderStatus": {
        "completed": 40,
        "full payment": 14,
        "part payment": 7
      },
      "byTransactionStatus": {
        "success": 6,
        "unspecified": 55
      },
      "byTransactionType": {
        "credit": 6,
        "unspecified": 55
      },
      "byPaymentMethod": {
        "Paystack": 50,
        "Stripe": 11
      },
      "byCategory": {
        "marketplace": 34,
        "subscription": 21,
        "wallet": 6
      },
      "amountsByCurrency": {
        "NGN": {
          "transactionCount": 50,
          "totalAmount": 2000000
        },
        "USD": {
          "transactionCount": 11,
          "totalAmount": 1200
        }
      }
    },
    "generatedAt": "2026-06-14T10:55:00.000Z"
  }
}
```

The breakdown values above are examples. The API calculates them from the current
database.

## Drill-Down List Endpoints

Use these endpoints for the dedicated pages opened from the dashboard cards. All list
responses use the same pagination object. The default page size is `20`; the maximum is
`100`.

### Users List

```http
GET /api/v1/admin/analytics/users
```

Query parameters:

- `page`, `limit`
- `search`: name, email, username, or phone number
- `role`: `user`, `tailor`, `admin`, or `superAdmin`
- `subscriptionPlan`: `free`, `standard`, `premium`, or `enterprise`
- `verification`: `verified` or `unverified`
- `accountStatus`: `active` or `blocked`
- `dateFrom`, `dateTo`: ISO date, for example `2026-06-01`

Example:

```http
GET /api/v1/admin/analytics/users?page=1&limit=20&role=tailor
```

```json
{
  "success": true,
  "message": "Analytics users fetched successfully",
  "data": {
    "summary": {
      "totalUsers": 39,
      "byRole": {
        "admin": 1,
        "superAdmin": 1,
        "tailor": 7,
        "user": 30
      },
      "bySubscriptionPlan": {
        "free": 35,
        "premium": 4
      },
      "verification": {
        "verified": 31,
        "unverified": 8
      },
      "accountStatus": {
        "active": 38,
        "blocked": 1
      },
      "registeredLast30Days": 6
    },
    "records": [
      {
        "_id": "685000000000000000000001",
        "fullName": "Ada Designer",
        "email": "ada@example.com",
        "username": "adadesigns",
        "phoneNumber": "+2348000000000",
        "image": "https://ik.imagekit.io/example/profile.jpg",
        "role": "tailor",
        "country": "Nigeria",
        "wallet": 250000,
        "subscriptionPlan": "premium",
        "subscriptionStartDate": "2026-05-01T00:00:00.000Z",
        "subscriptionEndDate": "2026-06-30T23:59:59.999Z",
        "billTerm": "monthly",
        "isVerified": true,
        "isBlocked": false,
        "isVendorEnabled": true,
        "createdAt": "2026-04-10T09:30:00.000Z",
        "updatedAt": "2026-06-10T12:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "totalRecords": 7,
      "totalPages": 1,
      "hasNextPage": false,
      "hasPreviousPage": false
    },
    "filters": {
      "search": null,
      "role": "tailor",
      "subscriptionPlan": null,
      "verification": null,
      "accountStatus": null,
      "dateFrom": null,
      "dateTo": null
    }
  }
}
```

Passwords and bank account fields are deliberately excluded.

### Listings List

```http
GET /api/v1/admin/analytics/listings
```

Query parameters:

- `page`, `limit`
- `search`: title, description, condition, fabric, or occasion
- `pricing`: `free`, `paid`, or `unpriced`
- `approvalStatus`: `pending`, `approved`, or `rejected`
- `availability`: `available`, `sold`, `made_to_order`, or `unavailable`
- `featured`: `true` or `false`
- `dateFrom`, `dateTo`

Example:

```http
GET /api/v1/admin/analytics/listings?page=1&limit=20&approvalStatus=approved
```

`data.summary` contains the complete listing breakdown. Each item in `data.records` is
the actual listing document, including images, media,
price, moderation data, availability, views, saves, ratings, and timestamps. Related
fields are populated:

```json
{
  "_id": "685000000000000000000010",
  "title": "Blue Corporate Suit",
  "price": 150000,
  "currency": "NGN",
  "approvalStatus": "approved",
  "availability": "available",
  "images": ["https://ik.imagekit.io/example/suit.jpg"],
  "userId": {
    "_id": "685000000000000000000001",
    "fullName": "Ada Designer",
    "email": "ada@example.com",
    "username": "adadesigns",
    "role": "tailor",
    "country": "Nigeria"
  },
  "categoryId": {
    "_id": "685000000000000000000020",
    "name": "Corporate",
    "description": "Corporate fashion",
    "image": "https://ik.imagekit.io/example/category.jpg"
  },
  "createdAt": "2026-06-10T12:00:00.000Z"
}
```

The enclosing response uses the same `summary`, `records`, `pagination`, and `filters`
structure shown in the users example.

### Transactions List

```http
GET /api/v1/admin/analytics/transactions
```

Query parameters:

- `page`, `limit`
- `successful=true`: return only successful transactions
- `search`: payment reference, title, reason, plan, or session ID
- `paymentStatus`, `orderStatus`, `transactionStatus`, `transactionType`
- `paymentMethod`, `currency`
- `category`: `marketplace`, `subscription`, `wallet`, or `other`
- `dateFrom`, `dateTo`

All transactions:

```http
GET /api/v1/admin/analytics/transactions?page=1&limit=20
```

Successful-transactions page:

```http
GET /api/v1/admin/analytics/successful-transactions?page=1&limit=20
```

This dedicated route is equivalent to:

```http
GET /api/v1/admin/analytics/transactions?page=1&limit=20&successful=true
```

Example record:

```json
{
  "_id": "685000000000000000000030",
  "userId": {
    "_id": "685000000000000000000031",
    "fullName": "Buyer Name",
    "email": "buyer@example.com",
    "role": "user",
    "country": "Nigeria"
  },
  "vendorId": {
    "_id": "685000000000000000000032",
    "businessName": "Ada Designs",
    "businessEmail": "studio@example.com",
    "city": "Lagos",
    "state": "Lagos"
  },
  "materialId": {
    "_id": "685000000000000000000033",
    "attireType": "Suit",
    "clothMaterial": "Wool",
    "color": "Blue",
    "brand": "Example"
  },
  "listingId": [
    {
      "_id": "685000000000000000000010",
      "title": "Blue Corporate Suit",
      "price": 150000,
      "currency": "NGN",
      "availability": "available",
      "approvalStatus": "approved"
    }
  ],
  "totalAmount": 150000,
  "amountPaid": 150000,
  "analyticsAmount": 150000,
  "paymentMethod": "Paystack",
  "paymentReference": "HOG-EXAMPLE-001",
  "paymentStatus": "success",
  "paymentCurrency": "NGN",
  "orderStatus": "full payment",
  "transactionType": null,
  "createdAt": "2026-06-12T15:20:00.000Z"
}
```

`data.summary` contains the complete transaction breakdown, including successful count,
status groups, methods, categories, and currency totals.

`analyticsAmount` uses `amountPaid` when it is greater than zero; otherwise it uses
`totalAmount`. Bank account numbers and delivery addresses are excluded.

### Earnings Details

```http
GET /api/v1/admin/analytics/earnings?page=1&limit=20
```

The response contains:

- `data.earnings`: wallet, commission, tax, and other-credit breakdown.
- `data.transactionSummary`: complete transaction analytics.
- `data.transactionActivity`: paginated successful transaction records.
- `data.transactionActivityNote`: explains that transaction activity is not a platform
  earnings ledger.

The current schema does not record every admin wallet credit/debit as a dedicated
earnings event. Therefore the API does not falsely claim that successful transaction
amounts reproduce the wallet balance.

## Existing Dashboard Endpoints

These endpoints remain available. Their original `data` fields are unchanged for
Flutter compatibility, and a new top-level `breakdown` field contains the details.

### Total Users

```http
GET /api/v1/admin/totalUsers
```

```json
{
  "success": true,
  "message": "Total users fetched successfully",
  "data": 39,
  "breakdown": {
    "totalUsers": 39,
    "byRole": {
      "admin": 1,
      "superAdmin": 1,
      "tailor": 7,
      "user": 30
    },
    "bySubscriptionPlan": {
      "free": 35,
      "premium": 4
    },
    "verification": {
      "verified": 31,
      "unverified": 8
    },
    "accountStatus": {
      "active": 38,
      "blocked": 1
    },
    "registeredLast30Days": 6
  }
}
```

Unlike the old behavior, an empty user collection returns `200` with `data: 0`.

### Free and Paid Listings

```http
GET /api/v1/admin/totalNumberOfFreeAndPaidListings
```

```json
{
  "success": true,
  "message": "Total free and paid listings fetched successfully",
  "data": {
    "freeListings": 0,
    "paidListings": 4
  },
  "breakdown": {
    "totalListings": 4,
    "freeListings": 0,
    "paidListings": 4,
    "unpricedListings": 0,
    "byApprovalStatus": {
      "approved": 3,
      "pending": 1
    },
    "byAvailability": {
      "available": 3,
      "sold": 1
    },
    "featured": {
      "featured": 1,
      "standard": 3
    },
    "listedValue": {
      "total": 450000,
      "average": 112500,
      "currencyNote": "Values are not converted; use only when listing currencies are consistent."
    }
  }
}
```

Pricing classification:

- `freeListings`: `price` is exactly `0`.
- `paidListings`: `price` is greater than `0`.
- `unpricedListings`: `price` is missing, null, negative, or otherwise not classifiable.

### Total Earnings

```http
GET /api/v1/admin/adminTotalEarnings
```

```json
{
  "success": true,
  "message": "Total earnings fetched successfully",
  "data": {
    "totalEarnings": 1355958.84
  },
  "breakdown": {
    "totalEarnings": 1355958.84,
    "currency": "NGN",
    "basis": "current_admin_wallet_balance",
    "derivation": {
      "recordedCommission": 200000,
      "recordedTax": 550000,
      "otherWalletCredits": 605958.84,
      "formula": "totalEarnings = recordedCommission + recordedTax + otherWalletCredits"
    },
    "note": "This is the primary admin account's current wallet balance, not gross historical revenue. Other wallet credits include listing fees and any credits not stored as commission or tax."
  }
}
```

Important: the existing database does not have a dedicated platform-earnings ledger.
`totalEarnings` is the primary admin account's current wallet balance. It is not a sum
of all historical transactions, and withdrawals or manual wallet changes affect it.

### Total Transactions

```http
GET /api/v1/admin/totalTransactions
```

```json
{
  "success": true,
  "message": "Total transactions fetched successfully",
  "data": {
    "totalTransactions": 61
  },
  "breakdown": {
    "totalTransactions": 61,
    "successfulTransactions": 54,
    "byPaymentStatus": {
      "success": 54,
      "unspecified": 7
    },
    "byOrderStatus": {
      "completed": 40,
      "full payment": 14,
      "part payment": 7
    },
    "byTransactionStatus": {
      "success": 6,
      "unspecified": 55
    },
    "byTransactionType": {
      "credit": 6,
      "unspecified": 55
    },
    "byPaymentMethod": {
      "Paystack": 50,
      "Stripe": 11
    },
    "byCategory": {
      "marketplace": 34,
      "subscription": 21,
      "wallet": 6
    },
    "amountsByCurrency": {
      "NGN": {
        "transactionCount": 50,
        "totalAmount": 2000000
      },
      "USD": {
        "transactionCount": 11,
        "totalAmount": 1200
      }
    }
  }
}
```

Amounts are grouped by currency and are never added across currencies. The API uses
`amountPaid` when it is greater than zero; otherwise it uses `totalAmount`.

### Total Listings

```http
GET /api/v1/admin/totalListings
```

```json
{
  "success": true,
  "message": "Total listings fetched successfully",
  "data": {
    "totalListings": 4
  },
  "breakdown": {
    "totalListings": 4,
    "freeListings": 0,
    "paidListings": 4,
    "unpricedListings": 0,
    "byApprovalStatus": {
      "approved": 3,
      "pending": 1
    },
    "byAvailability": {
      "available": 3,
      "sold": 1
    },
    "featured": {
      "featured": 1,
      "standard": 3
    },
    "listedValue": {
      "total": 450000,
      "average": 112500,
      "currencyNote": "Values are not converted; use only when listing currencies are consistent."
    }
  }
}
```

## Error Responses

Missing or invalid token:

```json
{
  "message": "Authorization header is missing"
}
```

Authenticated user without an allowed role:

```json
{
  "message": "You are not authorized as user to perform this operation"
}
```

Primary admin account missing from the earnings endpoint:

```json
{
  "success": false,
  "message": "Admin not found"
}
```

Unexpected server and database errors are passed to the application's standard error
middleware.
