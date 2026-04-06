# Listing Moderation API Documentation

This document describes the seller listing moderation APIs for the mobile apps.

## Roles

- `admin`
  - Can review pending listings
  - Can approve and reject listings
  - Can see listings they approved
  - Can see listings they rejected
  - Can see their own moderation history

- `superAdmin`
  - Can review pending listings
  - Can approve and reject listings
  - Can see all approved listings
  - Can see all rejected listings
  - Can see all moderation history
  - Can filter by moderator

All admin moderation endpoints require:

```http
Authorization: Bearer <token>
```

Base URL:

```text
/api/v1/admin
```

## Listing Moderation Fields

Every moderated listing now exposes these fields:

- `approvalStatus`
  - `pending`
  - `approved`
  - `rejected`
- `approvedBy`
- `approvedAt`
- `rejectedBy`
- `rejectedAt`
- `rejectionReasons`
- `moderationHistory`

## 1. Get Pending Listings

```http
GET /api/v1/admin/getAllPendingSellerListings?page=1&limit=20&categoryId=<optional>
```

Returns all pending listings for review.

Sample request:

```http
GET /api/v1/admin/getAllPendingSellerListings?page=1&limit=10
Authorization: Bearer <token>
```

Sample response:

```json
{
  "success": true,
  "message": "Pending seller listings fetched successfully",
  "data": [
    {
      "_id": "67f14b0aa12c4567890abcd1",
      "title": "Vintage Senator Material",
      "size": "Large",
      "description": "Clean fabric listing with two yards included",
      "condition": "New",
      "status": "available",
      "price": 25000,
      "currency": "NGN",
      "approvalStatus": "pending",
      "isApproved": false,
      "images": [
        "https://imagekit.io/example/listing-1.jpg"
      ],
      "yards": ["2 yards"],
      "userId": {
        "_id": "67f1499aa12c4567890ab111",
        "fullName": "Seller One",
        "image": "https://imagekit.io/example/seller.jpg",
        "address": "Lekki, Lagos",
        "email": "seller@example.com",
        "phoneNumber": "+2348000000000"
      },
      "categoryId": {
        "_id": "67f1499aa12c4567890ab222",
        "name": "Ankara"
      },
      "approvedBy": null,
      "approvedAt": null,
      "rejectedBy": null,
      "rejectedAt": null,
      "rejectionReasons": [],
      "moderationHistory": [],
      "createdAt": "2026-04-06T10:00:00.000Z",
      "updatedAt": "2026-04-06T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1
  },
  "filters": {
    "status": "pending",
    "mine": false,
    "approvedBy": null,
    "rejectedBy": null,
    "categoryId": null
  }
}
```

## 2. Get Approved Listings

```http
GET /api/v1/admin/getApprovedSellerListings?page=1&limit=20&mine=true&approvedBy=<optional>&categoryId=<optional>
```

Behaviour:

- For `admin`, the endpoint returns listings approved by the logged-in admin
- For `superAdmin`, the endpoint returns all approved listings by default
- `superAdmin` can filter with `mine=true`
- `superAdmin` can filter with `approvedBy=<userId>`

Sample request:

```http
GET /api/v1/admin/getApprovedSellerListings?page=1&limit=10&mine=true
Authorization: Bearer <token>
```

Sample response:

```json
{
  "success": true,
  "message": "Approved seller listings fetched successfully",
  "data": [
    {
      "_id": "67f14b0aa12c4567890abcd2",
      "title": "Italian Wool Fabric",
      "size": "Medium",
      "description": "Premium wool, ready for tailoring",
      "condition": "New",
      "status": "available",
      "price": 48000,
      "currency": "NGN",
      "approvalStatus": "approved",
      "isApproved": true,
      "userId": {
        "_id": "67f1499aa12c4567890ab333",
        "fullName": "Seller Two",
        "image": "https://imagekit.io/example/seller-2.jpg",
        "address": "Abuja, Nigeria",
        "email": "seller2@example.com",
        "phoneNumber": "+2348111111111"
      },
      "categoryId": {
        "_id": "67f1499aa12c4567890ab444",
        "name": "Wool"
      },
      "approvedBy": {
        "_id": "67f1499aa12c4567890ab555",
        "fullName": "Admin User",
        "email": "admin@example.com",
        "role": "admin"
      },
      "approvedAt": "2026-04-06T12:00:00.000Z",
      "rejectedBy": null,
      "rejectedAt": null,
      "rejectionReasons": [],
      "moderationHistory": [
        {
          "action": "approved",
          "moderatorId": "67f1499aa12c4567890ab555",
          "moderatorName": "Admin User",
          "moderatorRole": "admin",
          "reason": null,
          "createdAt": "2026-04-06T12:00:00.000Z",
          "_id": "67f14b0aa12c4567890ab777"
        }
      ],
      "createdAt": "2026-04-05T09:00:00.000Z",
      "updatedAt": "2026-04-06T12:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1
  },
  "filters": {
    "status": "approved",
    "mine": true,
    "approvedBy": null,
    "rejectedBy": null,
    "categoryId": null
  }
}
```

## 3. Get Rejected Listings

```http
GET /api/v1/admin/getRejectedSellerListings?page=1&limit=20&mine=true&rejectedBy=<optional>&categoryId=<optional>
```

Behaviour:

- For `admin`, the endpoint returns listings rejected by the logged-in admin
- For `superAdmin`, the endpoint returns all rejected listings by default
- `superAdmin` can filter with `mine=true`
- `superAdmin` can filter with `rejectedBy=<userId>`

Sample request:

```http
GET /api/v1/admin/getRejectedSellerListings?page=1&limit=10
Authorization: Bearer <token>
```

Sample response:

```json
{
  "success": true,
  "message": "Rejected seller listings fetched successfully",
  "data": [
    {
      "_id": "67f14b0aa12c4567890abcd3",
      "title": "Designer Lace Bundle",
      "size": "Standard",
      "description": "Bundle uploaded with poor image quality",
      "condition": "New",
      "status": "available",
      "price": 19000,
      "currency": "NGN",
      "approvalStatus": "rejected",
      "isApproved": false,
      "userId": {
        "_id": "67f1499aa12c4567890ab666",
        "fullName": "Seller Three",
        "image": "https://imagekit.io/example/seller-3.jpg",
        "address": "Ibadan, Nigeria",
        "email": "seller3@example.com",
        "phoneNumber": "+2348222222222"
      },
      "categoryId": {
        "_id": "67f1499aa12c4567890ab888",
        "name": "Lace"
      },
      "approvedBy": null,
      "approvedAt": null,
      "rejectedBy": {
        "_id": "67f1499aa12c4567890ab999",
        "fullName": "Super Admin",
        "email": "superadmin@example.com",
        "role": "superAdmin"
      },
      "rejectedAt": "2026-04-06T13:00:00.000Z",
      "rejectionReasons": [
        "Images are unclear",
        "Listing title is too vague"
      ],
      "moderationHistory": [
        {
          "action": "rejected",
          "moderatorId": "67f1499aa12c4567890ab999",
          "moderatorName": "Super Admin",
          "moderatorRole": "superAdmin",
          "reason": "Images are unclear, Listing title is too vague",
          "createdAt": "2026-04-06T13:00:00.000Z",
          "_id": "67f14b0aa12c4567890ab112"
        }
      ],
      "createdAt": "2026-04-06T08:00:00.000Z",
      "updatedAt": "2026-04-06T13:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1
  },
  "filters": {
    "status": "rejected",
    "mine": false,
    "approvedBy": null,
    "rejectedBy": null,
    "categoryId": null
  }
}
```

## 4. Get Listings With Flexible Filters

```http
GET /api/v1/admin/getSellerListings?status=pending&page=1&limit=20&mine=true&approvedBy=<optional>&rejectedBy=<optional>&categoryId=<optional>
```

Supported query params:

- `status`
  - `pending`
  - `approved`
  - `rejected`
- `page`
- `limit`
- `mine`
- `approvedBy`
- `rejectedBy`
- `categoryId`

Use this endpoint for admin listing tabs with filters.

Sample request:

```http
GET /api/v1/admin/getSellerListings?status=approved&page=1&limit=20&approvedBy=67f1499aa12c4567890ab555
Authorization: Bearer <token>
```

Sample response:

```json
{
  "success": true,
  "message": "Seller listings fetched successfully",
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1
  },
  "filters": {
    "status": "approved",
    "mine": false,
    "approvedBy": "67f1499aa12c4567890ab555",
    "rejectedBy": null,
    "categoryId": null
  }
}
```

## 5. Get Listing Details

```http
GET /api/v1/admin/getSellerListingById/:listingId
```

Use this for the listing detail screen.

Important fields in the response:

- `approvalStatus`
- `approvedBy`
- `approvedAt`
- `rejectedBy`
- `rejectedAt`
- `rejectionReasons`
- `moderationHistory`

Sample request:

```http
GET /api/v1/admin/getSellerListingById/67f14b0aa12c4567890abcd2
Authorization: Bearer <token>
```

Sample response:

```json
{
  "success": true,
  "message": "Seller listing fetched successfully",
  "data": {
    "_id": "67f14b0aa12c4567890abcd2",
    "title": "Italian Wool Fabric",
    "size": "Medium",
    "description": "Premium wool, ready for tailoring",
    "condition": "New",
    "status": "available",
    "price": 48000,
    "currency": "NGN",
    "approvalStatus": "approved",
    "isApproved": true,
    "userId": {
      "_id": "67f1499aa12c4567890ab333",
      "fullName": "Seller Two",
      "email": "seller2@example.com",
      "phoneNumber": "+2348111111111",
      "address": "Abuja, Nigeria",
      "subscriptionPlan": "premium",
      "wallet": 0
    },
    "categoryId": {
      "_id": "67f1499aa12c4567890ab444",
      "name": "Wool"
    },
    "approvedBy": {
      "_id": "67f1499aa12c4567890ab555",
      "fullName": "Admin User",
      "email": "admin@example.com",
      "role": "admin",
      "image": "https://imagekit.io/example/admin.jpg"
    },
    "approvedAt": "2026-04-06T12:00:00.000Z",
    "rejectedBy": null,
    "rejectedAt": null,
    "rejectionReasons": [],
    "moderationHistory": [
      {
        "action": "approved",
        "moderatorId": {
          "_id": "67f1499aa12c4567890ab555",
          "fullName": "Admin User",
          "email": "admin@example.com",
          "role": "admin"
        },
        "moderatorName": "Admin User",
        "moderatorRole": "admin",
        "reason": null,
        "createdAt": "2026-04-06T12:00:00.000Z",
        "_id": "67f14b0aa12c4567890ab777"
      }
    ]
  }
}
```

## 6. Approve Listing

```http
PUT /api/v1/admin/approveSellerListing/:listingId
```

Response includes:

- `listingId`
- `listingTitle`
- `approvalStatus`
- `approvedAt`
- `approvedBy`

When approved:

- listing becomes visible to buyers
- seller receives approval email
- moderation history is updated

Sample request:

```http
PUT /api/v1/admin/approveSellerListing/67f14b0aa12c4567890abcd2
Authorization: Bearer <token>
Content-Type: application/json
```

Sample response:

```json
{
  "success": true,
  "message": "Seller listing approved successfully",
  "data": {
    "listingId": "67f14b0aa12c4567890abcd2",
    "listingTitle": "Italian Wool Fabric",
    "approvalStatus": "approved",
    "approvedAt": "2026-04-06T12:00:00.000Z",
    "approvedBy": {
      "id": "67f1499aa12c4567890ab555",
      "fullName": "Admin User",
      "email": "admin@example.com",
      "role": "admin"
    }
  }
}
```

## 7. Reject Listing

```http
PUT /api/v1/admin/rejectSellerListing/:listingId
Content-Type: application/json
```

Request body:

```json
{
  "reasons": [
    "Images are unclear",
    "Incorrect category selected"
  ]
}
```

`reasons` can also be sent as a single string.

Response includes:

- `listingId`
- `listingTitle`
- `approvalStatus`
- `rejectedAt`
- `rejectedBy`
- `rejectionReasons`

When rejected:

- listing stays in the system
- listing is not visible to buyers
- seller receives rejection email
- moderation history is updated

Sample request:

```http
PUT /api/v1/admin/rejectSellerListing/67f14b0aa12c4567890abcd3
Authorization: Bearer <token>
Content-Type: application/json

{
  "reasons": [
    "Images are unclear",
    "Incorrect category selected"
  ]
}
```

Sample response:

```json
{
  "success": true,
  "message": "Seller listing rejected successfully",
  "data": {
    "listingId": "67f14b0aa12c4567890abcd3",
    "listingTitle": "Designer Lace Bundle",
    "approvalStatus": "rejected",
    "rejectedAt": "2026-04-06T13:00:00.000Z",
    "rejectionReasons": [
      "Images are unclear",
      "Incorrect category selected"
    ],
    "rejectedBy": {
      "id": "67f1499aa12c4567890ab999",
      "fullName": "Super Admin",
      "email": "superadmin@example.com",
      "role": "superAdmin"
    }
  }
}
```

## 8. Get Moderation History

```http
GET /api/v1/admin/getListingModerationHistory?page=1&limit=20&action=<optional>&moderatorId=<optional>
```

Supported query params:

- `page`
- `limit`
- `action`
  - `approved`
  - `rejected`
- `moderatorId`
  - `superAdmin` only

Response contains:

- `data`
  - recent moderation actions
- `summary`
  - `pending`
  - `approved`
  - `rejected`
- `pagination`

Use this endpoint for the admin dashboard moderation summary and activity feed.

Sample request:

```http
GET /api/v1/admin/getListingModerationHistory?page=1&limit=10&action=approved
Authorization: Bearer <token>
```

Sample response:

```json
{
  "success": true,
  "message": "Listing moderation history fetched successfully",
  "data": [
    {
      "listingId": "67f14b0aa12c4567890abcd2",
      "listingTitle": "Italian Wool Fabric",
      "sellerId": "67f1499aa12c4567890ab333",
      "categoryId": "67f1499aa12c4567890ab444",
      "currentStatus": "approved",
      "action": "approved",
      "moderatorId": "67f1499aa12c4567890ab555",
      "moderatorName": "Admin User",
      "moderatorRole": "admin",
      "reason": null,
      "moderatedAt": "2026-04-06T12:00:00.000Z"
    }
  ],
  "summary": {
    "pending": 6,
    "approved": 12,
    "rejected": 3
  },
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1
  },
  "filters": {
    "action": "approved",
    "moderatorId": null
  }
}
```

## Buyer App Behaviour

Buyer-facing listing APIs now return approved listings only.

This applies to:

- `GET /api/v1/buyer/getAlSellerListings`
- `GET /api/v1/buyer/searchListings`
- `GET /api/v1/buyer/getSellerListingById/:listingId`
- `POST /api/v1/buyer/purchaseListing/:listingId`
- `POST /api/v1/buyer/purchaseMultipleListings`

If a listing is pending or rejected:

- buyers cannot view it
- buyers cannot purchase it

## Suggested Mobile Screens

- `Pending Listings`
  - use `getAllPendingSellerListings`

- `Approved Listings`
  - use `getApprovedSellerListings`

- `Rejected Listings`
  - use `getRejectedSellerListings`

- `Listing Detail`
  - use `getSellerListingById/:listingId`

- `Moderation Dashboard`
  - use `getListingModerationHistory`

## Recommended UI Fields

For each listing card or detail page, show:

- title
- seller name
- category
- approval status
- approved by
- approved date
- rejected by
- rejected date
- rejection reasons

## Pagination Response Format

List endpoints return:

```json
{
  "success": true,
  "message": "Seller listings fetched successfully",
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1
  }
}
```

## Notes For Mobile Engineers

- `approvalStatus` should be treated as the main moderation state
- `isApproved` may still exist for backward compatibility, but the app should use `approvalStatus`
- `admin` users should expect approved/rejected results scoped to their own moderation actions
- `superAdmin` users should expect system-wide results unless filters are applied
