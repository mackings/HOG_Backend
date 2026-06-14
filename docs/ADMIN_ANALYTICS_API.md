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
