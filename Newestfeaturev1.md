# House of GLAME Newest Features v1 API Documentation

Live base URL: `https://hog-fyic.onrender.com/api/v1`

Local base URL: `/api/v1`

Auth: protected endpoints require `Authorization: Bearer <token>`.

Live deployment verified on Render through commit `1d00d61`.

## Test Accounts

Use these exact accounts for mobile QA and API verification.

| Role | Email | Password |
| --- | --- | --- |
| Customer / Standard Account | `newuser@daouse.com` | `Kk76117018@` |
| Designer / Tailor | `naijatailor@lnovic.com` | `Kk76117018@` |
| Admin / Support | `oy0kavev6v@illubd.com` | `Kk76117018@` |

### Login

`POST /user/login`

Request:

```json
{
  "email": "newuser@daouse.com",
  "password": "Kk76117018@"
}
```

Sample response:

```json
{
  "message": "Login successful",
  "token": "<jwt-token>",
  "user": {
    "role": "user"
  }
}
```

Use the token:

```http
Authorization: Bearer <jwt-token>
```

## Mobile UI And Design Requirements

The backend provides APIs, status values, uploaded media URLs, and records. The mobile app owns the screens, responsive layouts, guided measurement UI, image zoom, galleries, video players, checkout prompts, empty states, loading states, validation states, and account prompts.

The mobile app must be fully responsive across small phones, large phones, tablets, foldables, and mobile web if used. Do not build fixed-width screens. Use adaptive grids, safe areas, scrollable content, and touch-friendly controls.

Important UX rules:

- Do not ask customers to type backend IDs like `designerId`, `vendorId`, `orderId`, `escrowId`, `reviewTargetId`, `supportTargetId`, respondent IDs, or Paystack/internal references.
- Show cards/lists from backend APIs. When a user taps a card, pass the returned internal token/ID to the next endpoint.
- Guests can browse public listings/designers. Ask guests to log in before buying, saving, messaging, paying, or creating custom requests.
- Do not expose pasted media URL fields. User media must come from the device camera, gallery, file picker, or audio recorder.

## Required Mobile Copy Updates

| Old Text | New Text |
| --- | --- |
| List Item | Create Listing |
| Enter product title | e.g. Men's Corporate Suit (Black, XL) |
| Size (If Applicable) | Size (Optional) |
| Enter price (0 if free) | Enter price (₦0 if free) |
| Enter 0 if this item is listed for free | Enter ₦0 if the item is free |
| Describe the item | Provide details about the item (condition, material, usage, etc.) |
| Newly Sewed | Brand New / Like New / Used |
| Available | Available / Sold / Reserved |
| Front | Front View |
| Side | Side View |
| Back | Back View |
| Upload Listing | Publish Listing |
| All Designers | Browse Designers |
| Browse the full directory of available designers. | Find and connect with skilled designers near you. |
| 1reviews | 1 review |
| User | Standard Account |
| Chat with Admin | Chat with Support |
| Contact Regional Admin | Email Support Team |
| Upgrade from Free | Upgrade Your Plan |
| Log off | Log Out |
| Verified Account | Verified |
| Free | Free Plan |
| Wallet | My Wallet |
| Transactions | Transaction History |

## Media Upload Policy

Customers, designers, and admins should not paste media links into forms. User-provided images, voice notes, portfolio media, inspiration images, moodboard images, listing media, and dispute evidence must be uploaded as `multipart/form-data`.

Common upload fields:

| Area | File field |
| --- | --- |
| Listing images | `images` |
| Listing media | `images` |
| Portfolio | `images` |
| Published work | `images` |
| Moodboard image | `images` |
| Dispute evidence | `images` |
| Messaging attachments | `files` |
| Support chat attachments | `files` |

Pasted URL rejection sample:

```json
{
  "success": false,
  "message": "Upload files from the device instead of submitting media URLs.",
  "data": {
    "blockedFields": ["inspirationImages"]
  }
}
```

## Feature Coverage

| Feature | Status | Main APIs |
| --- | --- | --- |
| Guest browsing | Live | `GET /discovery/public/listings`, `GET /discovery/public/designers` |
| Studio listing creation | Live | `POST /seller/sellerCreateListing/:categoryId` |
| Studio published work | Live | `/published/*` |
| Admin listing moderation | Live | `/admin/*SellerListing*` |
| Buyer listing browse/search | Live | `/buyer/getAlSellerListings`, `/buyer/searchListings` |
| Designer analytics/growth | Live | `/designer-tools/*` |
| Designer profile/portfolio | Live | `/tailor/getTailor`, `PUT /tailor/portfolio` |
| Customer-designer order chat | Live | `/messaging/*` |
| User/designer-admin support chat | Live | `/support/*` |
| Contact masking/blocking | Live | Messaging and support chat |
| Measurements/sizing | Live | `/measurements/*` |
| Custom order/quote workflow | Live | `/custom-orders/requests/*` |
| Escrow-like payment protection | Live | `/custom-orders/requests/:requestId/pay`, `/custom-orders/escrow/*` |
| Order workflow tracking | Live | `PUT /custom-orders/workflow` |
| Moodboards/saved styles | Live | `/moodboards/*` |
| Discovery filters/sorting | Live | `/discovery/listings`, `/discovery/designers` |
| Rich listing media | Live | `PUT /seller/updateSellerListingMedia/:listingId` |
| Disputes/support tickets | Live | `/disputes/*` |
| Reviews/reputation | Live | `/reputation/*` |
| Delivery tracking | Live | `/tracking/*` |

## 1. Discovery And Guest Browsing

### Public Listings

`GET /discovery/public/listings?gender=male&fabric=cotton&minPrice=0&maxPrice=250000&sort=latest`

Supported filters: `gender`, `category`, `occasion`, `size`, `fabric`, `minPrice`, `maxPrice`, `designer`, `availability`, `location`.

Supported sorts: `popular`, `trending`, `latest`, `price_low`, `price_high`, `ratings`.

Sample response:

```json
{
  "success": true,
  "message": "Listings discovered successfully",
  "data": [
    {
      "_id": "69cbab0ddfe7dcb5433f3dd9",
      "title": "Corporate business wear",
      "size": "XL",
      "price": 60,
      "currency": "NGN",
      "images": ["https://ik.imagekit.io/.../front.jpg"],
      "condition": "Brand New",
      "availability": "available"
    }
  ]
}
```

### Public Designers

`GET /discovery/public/designers?specialization=native&location=Lagos&sort=ratings`

Sample response:

```json
{
  "success": true,
  "message": "Designers discovered successfully",
  "data": [
    {
      "_id": "69585d7de72807c9b00b6899",
      "businessName": "Naija Tailor",
      "city": "Lagos",
      "state": "Lagos",
      "yearOfExperience": "5",
      "availabilityStatus": "available",
      "totalRatings": 1,
      "ratingSum": 5
    }
  ]
}
```

## 2. Studio APIs

There is no `/studio` route namespace. Studio features are covered by `/seller`, `/published`, `/designer-tools`, `/tailor`, `/buyer`, and `/admin`.

### Get Categories

`GET /category/getAllCategories`

Roles: user, tailor, admin.

Sample response:

```json
{
  "success": true,
  "message": "Categories fetched successfully",
  "data": [
    {
      "_id": "6953e397191dd43782210e6b",
      "name": "Corporate Suit"
    }
  ]
}
```

### Designer Creates Listing

`POST /seller/sellerCreateListing/:categoryId`

Content type: `multipart/form-data`

File field: `images`

Fields:

```json
{
  "title": "Men's Corporate Suit (Black, XL)",
  "size": "XL",
  "description": "Provide details about the item (condition, material, usage, etc.)",
  "condition": "Brand New",
  "status": "Available",
  "price": "0",
  "yards": "[{\"length\":\"1\",\"width\":\"1\"}]",
  "gender": "male",
  "occasion": "corporate",
  "fabric": "cotton",
  "availability": "available"
}
```

Response:

```json
{
  "success": true,
  "message": "Listing created successfully",
  "data": {
    "_id": "6a1e0d5b3d0617347ea8b70f",
    "title": "Men's Corporate Suit (Black, XL)",
    "images": ["https://ik.imagekit.io/.../studio-probe.jpg"],
    "approvalStatus": "pending",
    "isApproved": false
  }
}
```

### Designer Listing Management

`GET /seller/getSellerListings`

`GET /seller/getSellerListingById/:listingId`

`PUT /seller/updateSellerListing/:listingId`

`DELETE /seller/deleteSellerListing/:listingId`

Update listing uses `multipart/form-data` with file field `images`.

### Listing Rich Media

`PUT /seller/updateSellerListingMedia/:listingId`

Content type: `multipart/form-data`

File field: `images`

Optional field `mediaSlots` is a JSON array matching uploaded files:

```json
["fabricCloseups", "zoomImages", "beforeAfterShowcases", "styledLookPreviews", "videoPreviews"]
```

Response:

```json
{
  "success": true,
  "message": "Listing media updated successfully",
  "data": {
    "_id": "6a1e0d5b3d0617347ea8b70f",
    "media": {
      "fabricCloseups": [],
      "videoPreviews": [],
      "beforeAfterShowcases": [],
      "styledLookPreviews": [],
      "zoomImages": ["https://ik.imagekit.io/.../zoom.jpg"]
    }
  }
}
```

Product/listing video previews are allowed. Messaging video sharing is not supported.

### Admin Listing Moderation

`GET /admin/getAllPendingSellerListings`

`GET /admin/getSellerListings`

`GET /admin/getSellerListingById/:listingId`

`PUT /admin/approveSellerListing/:listingId`

`PUT /admin/rejectSellerListing/:listingId`

`GET /admin/getListingModerationHistory`

Admin dashboard endpoints:

`GET /admin/totalUsers`

`GET /admin/totalListings`

`GET /admin/totalTransactions`

`GET /admin/adminTotalEarnings`

`GET /admin/getListingFee`

Approval response:

```json
{
  "success": true,
  "message": "Seller listing approved successfully",
  "data": {
    "_id": "6a1e0d5b3d0617347ea8b70f",
    "approvalStatus": "approved",
    "isApproved": true
  }
}
```

### Buyer Browses Studio Listings

`GET /buyer/getAlSellerListings`

`GET /buyer/getSellerListingById/:listingId`

`GET /buyer/searchListings?search=Corporate`

Search also accepts `query` and `q`.

Response:

```json
{
  "success": true,
  "message": "Listing Materials fetched successfully",
  "data": [
    {
      "_id": "69cbab0ddfe7dcb5433f3dd9",
      "title": "Corporate business wear"
    }
  ]
}
```

Missing query response:

```json
{
  "success": false,
  "message": "Search query is required"
}
```

### Published Designer Work

Create:

`POST /published/createPublished/:categoryId`

Content type: `multipart/form-data`

File field: `images`

Fields:

```json
{
  "attireType": "Agbada",
  "clothPublished": "Cotton",
  "color": "Black",
  "brand": "Studio Collection"
}
```

Response:

```json
{
  "success": true,
  "message": "Published successfully",
  "data": {
    "_id": "6a1e0d6c3d0617347ea8b760",
    "attireType": "Agbada",
    "sampleImage": ["https://ik.imagekit.io/.../published.jpg"]
  }
}
```

Other endpoints:

`GET /published/getAllPublished`

`GET /published/getPublishedById/:publishedId`

`PUT /published/updatePublished/:publishedId`

`DELETE /published/deletePublished/:publishedId`

`POST /published/userPatronizedPublished/:publishedId`

Patronize request:

```json
{
  "measurement": [
    { "name": "chest", "value": "40" }
  ],
  "specialInstructions": "Please use a fitted style."
}
```

Patronize response:

```json
{
  "success": true,
  "message": "Material purchased successfully",
  "data": {
    "_id": "<materialId>",
    "attireType": "Agbada",
    "specialInstructions": "Please use a fitted style."
  }
}
```

### Designer Analytics

`GET /designer-tools/analytics`

Response:

```json
{
  "success": true,
  "message": "Designer analytics fetched successfully",
  "data": {
    "sales": {
      "totalSales": 0,
      "transactionCount": 0
    },
    "listings": {
      "totalListings": 1,
      "performance": [
        {
          "listingId": "6a1e0d5b3d0617347ea8b70f",
          "title": "Men's Corporate Suit",
          "viewsCount": 0,
          "savedCount": 0,
          "averageRating": 0,
          "isFeatured": true
        }
      ]
    },
    "orders": {
      "completedOrders": 1
    },
    "engagement": {
      "reviewsCount": 1,
      "conversationsCount": 1
    }
  }
}
```

### Feature Listing

`PUT /designer-tools/listings/:listingId/feature`

Request:

```json
{
  "isFeatured": true
}
```

Response:

```json
{
  "success": true,
  "message": "Listing promotion status updated successfully",
  "data": {
    "_id": "6a1e0d5b3d0617347ea8b70f",
    "isFeatured": true
  }
}
```

## 3. Designer Profile And Portfolio

### Get Designer Profile

Own profile:

`GET /tailor/getTailor`

Public profile:

`GET /discovery/public/designers/:designerId`

Response:

```json
{
  "success": true,
  "message": "Tailor found",
  "data": {
    "_id": "69585d7de72807c9b00b6899",
    "businessName": "Naija Tailor",
    "bio": "Bespoke native and corporate designer.",
    "yearOfExperience": "5",
    "specializationTags": ["native wear", "menswear"],
    "turnaroundTime": "10-14 days",
    "availabilityStatus": "available",
    "isVerifiedDesigner": true,
    "portfolioGallery": []
  }
}
```

### Update Designer Profile

`PUT /tailor/updateTailor/:tailorId`

Request:

```json
{
  "bio": "Bespoke native and bridal designer.",
  "specializationTags": ["bridal", "native wear", "menswear"],
  "turnaroundTime": "10-14 days",
  "availabilityStatus": "available"
}
```

### Update Portfolio

`PUT /tailor/portfolio`

Content type: `multipart/form-data`

File field: `images`

Fields:

```json
{
  "captions": "[\"Beaded bridal dress\"]",
  "categories": "[\"bridal\"]"
}
```

Response:

```json
{
  "success": true,
  "message": "Designer portfolio updated successfully",
  "data": {
    "portfolioGallery": [
      {
        "imageUrl": "https://ik.imagekit.io/.../portfolio.jpg",
        "caption": "Beaded bridal dress",
        "category": "bridal"
      }
    ],
    "categorizedWorkSections": {
      "bridal": [],
      "nativeWear": [],
      "corporate": [],
      "casual": [],
      "menswear": [],
      "womenswear": []
    }
  }
}
```

Pasted portfolio URLs return `400`.

## 4. Customer-Designer Messaging

Order-linked chat opens only after both parties agree on a quotation or the custom request is converted to order.

Messaging supports:

- Text
- Uploaded images
- Uploaded voice notes
- Measurement discussions
- Quote discussions
- Order-linked conversations
- Email notifications
- Contact masking/blocking
- Admin visibility for flagged conversations

Messaging does not support video sharing.

### Get Eligible Threads

`GET /messaging/eligible-threads`

Response:

```json
{
  "success": true,
  "message": "Eligible message threads fetched successfully",
  "data": [
    {
      "threadId": "6a1e0a28779d66b560641a10",
      "threadType": "customRequest",
      "title": "Naija Tailor",
      "subtitle": "Agreed quote: NGN 2",
      "status": "converted_to_order"
    }
  ]
}
```

### Start Conversation

`POST /messaging/conversations`

Request:

```json
{
  "threadId": "6a1e0a28779d66b560641a10",
  "topic": "measurement"
}
```

Response:

```json
{
  "success": true,
  "message": "Conversation ready",
  "data": {
    "_id": "6a1e0a3a5f43798854ad9573",
    "orderType": "customRequest",
    "orderId": "6a1e0a28779d66b560641a10",
    "topic": "measurement",
    "status": "active"
  }
}
```

### Send Text Message

`POST /messaging/conversations/:conversationId/messages`

Request:

```json
{
  "topic": "measurement",
  "content": "Please confirm the updated sleeve length."
}
```

Response:

```json
{
  "success": true,
  "message": "Message sent",
  "data": {
    "message": {
      "messageType": "text",
      "deliveryStatus": "sent",
      "isFlagged": false
    },
    "emailNotification": {
      "queued": true,
      "success": true
    }
  }
}
```

### Send Uploaded Image Or Voice Note

`POST /messaging/conversations/:conversationId/messages`

Content type: `multipart/form-data`

File field: `files`

Fields:

```json
{
  "topic": "measurement",
  "content": "Please check this sleeve reference."
}
```

Response:

```json
{
  "success": true,
  "message": "Message sent",
  "data": {
    "message": {
      "messageType": "mixed",
      "attachments": [
        {
          "type": "image",
          "url": "https://ik.imagekit.io/.../message.jpg",
          "mimeType": "image/jpeg"
        }
      ],
      "deliveryStatus": "sent"
    }
  }
}
```

### Contact Blocking

Restricted message response:

```json
{
  "success": false,
  "message": "For your safety and protection, please keep all communication within House of GLAME.",
  "data": {
    "blocked": true,
    "detectedContactTypes": ["phone", "address"]
  }
}
```

Video rejection:

```json
{
  "success": false,
  "message": "Video sharing is not supported in platform messaging."
}
```

### Fetch Messages And Admin Flags

`GET /messaging/conversations`

`GET /messaging/conversations/:conversationId/messages`

`GET /messaging/admin/flagged-conversations`

## 5. Chat With Support: User/Admin And Designer/Admin

This is direct support communication between customers/designers and admins.

It supports:

- User to admin support conversations
- Designer to admin support conversations
- Admin replies
- Uploaded images/voice notes
- Contact blocking
- Email notifications

### Create Support Conversation

`POST /support/conversations`

Request:

```json
{
  "subject": "Need help with my custom order",
  "category": "order",
  "content": "Please help review the latest order update."
}
```

Response:

```json
{
  "success": true,
  "message": "Support conversation created successfully",
  "data": {
    "_id": "6a1e0f111111111111111111",
    "requesterId": "6953e0e4d1d396ed1a4632a9",
    "adminId": "69568f164e805412047edccb",
    "subject": "Need help with my custom order",
    "category": "order",
    "status": "awaiting_admin"
  }
}
```

### List Support Conversations

`GET /support/conversations`

Users/designers see their own support conversations. Admin sees all support conversations.

Response:

```json
{
  "success": true,
  "message": "Support conversations fetched successfully",
  "data": [
    {
      "_id": "6a1e0f111111111111111111",
      "subject": "Need help with my custom order",
      "status": "awaiting_admin",
      "requesterId": {
        "fullName": "New User",
        "email": "newuser@daouse.com"
      },
      "adminId": {
        "email": "oy0kavev6v@illubd.com"
      }
    }
  ]
}
```

### Send Support Message

`POST /support/conversations/:conversationId/messages`

JSON request:

```json
{
  "content": "Support has reviewed the order."
}
```

Multipart upload:

- Content type: `multipart/form-data`
- File field: `files`
- Field: `content`

Response:

```json
{
  "success": true,
  "message": "Support message sent",
  "data": {
    "message": {
      "messageType": "mixed",
      "content": "Support image attached for review",
      "attachments": [
        {
          "type": "image",
          "url": "https://ik.imagekit.io/.../support.jpg",
          "mimeType": "image/jpeg"
        }
      ],
      "deliveryStatus": "sent"
    },
    "emailNotification": {
      "queued": true,
      "success": true
    }
  }
}
```

### Fetch Support Messages

`GET /support/conversations/:conversationId/messages`

Response:

```json
{
  "success": true,
  "message": "Support messages fetched successfully",
  "data": [
    {
      "messageType": "text",
      "content": "Please help with this listing",
      "deliveryStatus": "sent",
      "isFlagged": false
    },
    {
      "messageType": "text",
      "content": "Support has reviewed the listing",
      "deliveryStatus": "sent",
      "isFlagged": false
    }
  ]
}
```

## 6. Measurement And Sizing

### Create Measurement Profile

`POST /measurements/profiles`

Request:

```json
{
  "profileName": "Native fit",
  "fitType": "native",
  "measurements": {
    "chest": 40,
    "waist": 34,
    "hip": 39,
    "shoulder": 18,
    "sleeveLength": 25,
    "trouserLength": 41,
    "native": {
      "agbadaLength": 56,
      "capSize": 22
    }
  },
  "isDefault": false
}
```

Supported `fitType` values:

```json
["casual", "fitted", "native", "custom"]
```

Response:

```json
{
  "success": true,
  "message": "Measurement profile created successfully",
  "data": {
    "_id": "6a07741ce29ba6785f7a1608",
    "profileName": "Native fit",
    "fitType": "native",
    "measurements": {
      "chest": 40,
      "native": {
        "agbadaLength": 56
      }
    },
    "history": []
  }
}
```

Visual measurement guides, diagrams, and instruction videos should be bundled as responsive mobile UI/assets. User-pasted guide URLs are rejected.

### Update Measurement Profile

`PUT /measurements/profiles/:profileId`

Request:

```json
{
  "note": "Updated sleeve length",
  "measurements": {
    "chest": 40,
    "sleeveLength": 26
  }
}
```

Previous values are stored in `history`.

### Designer Requests Additional Measurements

Fetch selectable targets:

`GET /measurements/request-targets`

Response:

```json
{
  "success": true,
  "message": "Measurement request targets fetched successfully",
  "data": [
    {
      "measurementTargetId": "6a1e0a28779d66b560641a10",
      "title": "Naija Tailor",
      "customer": {
        "fullName": "New User"
      },
      "status": "converted_to_order"
    }
  ]
}
```

Submit request:

`POST /measurements/request-targets/:measurementTargetId`

```json
{
  "requestedFields": ["neck", "inseam", "agbadaLength"],
  "note": "Please add final native measurements."
}
```

Fetch requests:

`GET /measurements/requests`

## 7. Custom Order And Quote Workflow

### Create Custom Request

`POST /custom-orders/requests`

Use JSON if no inspiration images. Use `multipart/form-data` with file field `images` for uploaded inspiration images.

Request:

```json
{
  "vendorName": "Naija Tailor",
  "measurementProfileId": "6a07741ce29ba6785f7a1608",
  "styleNotes": "Native agbada with subtle embroidery.",
  "fabricPreferences": ["silk", "aso oke"],
  "deliveryTimelinePreference": "Before June 1"
}
```

Response:

```json
{
  "success": true,
  "message": "Custom order request submitted successfully",
  "data": {
    "_id": "6a1e0a28779d66b560641a10",
    "customerId": "6953e0e4d1d396ed1a4632a9",
    "designerId": "69585d20e72807c9b00b688d",
    "vendorId": "69585d7de72807c9b00b6899",
    "status": "submitted",
    "inspirationImages": []
  }
}
```

### Designer Accepts Or Declines

`POST /custom-orders/requests/:requestId/designer-response`

```json
{
  "action": "accept",
  "note": "I can review this request and prepare a quote."
}
```

Use `"action": "decline"` if unavailable.

### Designer Submits Quote

`POST /custom-orders/requests/:requestId/quote`

```json
{
  "materialCost": 80000,
  "workmanshipCost": 120000,
  "currency": "NGN",
  "estimatedProductionDays": 14,
  "fabricRecommendations": ["premium silk", "aso oke trim"],
  "note": "Can deliver within two weeks after deposit."
}
```

Response:

```json
{
  "success": true,
  "message": "Custom quote submitted successfully",
  "data": {
    "status": "quote_submitted",
    "quote": {
      "materialCost": 80000,
      "workmanshipCost": 120000,
      "totalCost": 200000,
      "currency": "NGN"
    }
  }
}
```

### Revision Cycle

`POST /custom-orders/requests/:requestId/revisions`

```json
{
  "note": "Please reduce embroidery and update the quote."
}
```

### Customer Accepts Quote

`POST /custom-orders/requests/:requestId/accept`

Response:

```json
{
  "success": true,
  "message": "Quote accepted and payment protection record created",
  "data": {
    "request": {
      "_id": "6a1e0a28779d66b560641a10",
      "status": "accepted"
    },
    "workflow": {
      "currentStatus": "accepted",
      "timeline": [
        { "status": "quote_received" },
        { "status": "accepted" }
      ]
    },
    "escrow": {
      "_id": "6a1e0a30779d66b560641a44",
      "totalAmount": 200000,
      "depositAmount": 100000,
      "balanceAmount": 100000,
      "status": "pending"
    }
  }
}
```

### Pay Deposit Or Balance

`POST /custom-orders/requests/:requestId/pay`

```json
{
  "milestoneName": "deposit"
}
```

Use `"balance"` for balance payment.

### Convert To Order

`POST /custom-orders/requests/:requestId/convert`

```json
{
  "estimatedCompletionDate": "2026-06-02T00:00:00.000Z"
}
```

### Update Workflow

`PUT /custom-orders/workflow`

```json
{
  "orderType": "customRequest",
  "orderId": "6a1e0a28779d66b560641a10",
  "status": "in_production",
  "note": "Cutting and stitching started.",
  "estimatedCompletionDate": "2026-06-02T00:00:00.000Z"
}
```

Supported statuses:

```json
["quote_received", "accepted", "in_production", "ready", "shipped", "delivered", "delayed", "cancelled"]
```

Delay:

```json
{
  "orderType": "customRequest",
  "orderId": "6a1e0a28779d66b560641a10",
  "status": "delayed",
  "delayReason": "Fabric supplier delay"
}
```

### Escrow Wallet / Admin Refund / Admin Release

`GET /custom-orders/designer/escrow-wallet`

`POST /custom-orders/escrow/:escrowId/refund`

`POST /custom-orders/escrow/:escrowId/release`

Refund/release request:

```json
{
  "amount": 50000,
  "adminNote": "Partial refund approved after dispute review."
}
```

## 8. Moodboards And Saved Styles

### Create Moodboard

`POST /moodboards`

```json
{
  "name": "Wedding inspiration",
  "description": "Looks for June event",
  "visibility": "private"
}
```

Response:

```json
{
  "success": true,
  "message": "Moodboard created successfully",
  "data": {
    "_id": "6a07744be29ba6785f7a1634",
    "name": "Wedding inspiration",
    "items": []
  }
}
```

### Add Saved Listing

`POST /moodboards/:moodboardId/items`

```json
{
  "itemType": "listing",
  "itemId": "69cbab0ddfe7dcb5433f3dd9",
  "note": "Inspired by the sleeve detail",
  "inspiredBy": {
    "itemType": "listing",
    "itemId": "69cbab0ddfe7dcb5433f3dd9"
  }
}
```

### Add Uploaded Inspiration Image

Use `multipart/form-data` with file field `images`.

Fields:

```json
{
  "itemType": "image",
  "note": "Inspired by neckline"
}
```

Pasted `imageUrl` is rejected.

Fetch/remove:

`GET /moodboards`

`DELETE /moodboards/:moodboardId/items/:itemId`

## 9. Reviews And Reputation

### Fetch Reviewable Orders

`GET /reputation/reviewable-orders`

Response:

```json
{
  "success": true,
  "message": "Reviewable orders fetched successfully",
  "data": [
    {
      "reviewTargetId": "6a1e0a28779d66b560641a10",
      "title": "Naija Tailor",
      "status": "converted_to_order"
    }
  ]
}
```

### Create Review

`POST /reputation/reviewable-orders/:reviewTargetId/review`

```json
{
  "rating": 5,
  "categories": {
    "fitAccuracy": 5,
    "communication": 5,
    "deliveryReliability": 4,
    "materialQuality": 5,
    "overallExperience": 5
  },
  "comment": "The fit was accurate and delivery was smooth."
}
```

Response:

```json
{
  "success": true,
  "message": "Review submitted successfully",
  "data": {
    "_id": "6a1e0a44779d66b560641ac5",
    "isVerifiedPurchase": true,
    "rating": 5,
    "comment": "The fit was accurate and delivery was smooth."
  }
}
```

### Designer Responds

`POST /reputation/designer-reviews/:reviewId/respond`

```json
{
  "response": "Thank you. It was a pleasure working on this outfit."
}
```

Fetch designer reviews:

`GET /reputation/designers/:designerId/reviews`

## 10. Disputes And Admin Moderation

### Fetch Support-Eligible Orders

`GET /disputes/support-orders`

Response:

```json
{
  "success": true,
  "message": "Support-eligible orders fetched successfully",
  "data": [
    {
      "supportTargetId": "6a1e0a28779d66b560641a10",
      "title": "Naija Tailor",
      "status": "converted_to_order"
    }
  ]
}
```

### Create Dispute

`POST /disputes/support-orders/:supportTargetId`

```json
{
  "category": "fit_issue",
  "title": "Sleeve length is incorrect",
  "description": "The sleeve is shorter than the approved measurement profile.",
  "requestedResolution": "revision"
}
```

For evidence, use `multipart/form-data` with file field `images`. Pasted evidence URLs are rejected.

Response:

```json
{
  "success": true,
  "message": "Dispute ticket created successfully",
  "data": {
    "_id": "6a1e0a40779d66b560641aad",
    "category": "fit_issue",
    "requestedResolution": "revision",
    "status": "open"
  }
}
```

### Fetch And Resolve

`GET /disputes/mine`

`GET /disputes/admin`

`PUT /disputes/admin/:disputeId`

```json
{
  "status": "resolved",
  "resolution": "Designer agreed to revise sleeve length.",
  "adminNote": "Revision approved after reviewing evidence."
}
```

## 11. Delivery Tracking

Existing tracking module:

`POST /tracking/createTracking?materialId=:materialId`

`GET /tracking/getTracking?trackingId=:trackingId`

`PUT /tracking/updateMaterialThroughTracking?trackingNumber=:trackingNumber`

Sample response:

```json
{
  "success": true,
  "message": "Tracking created successfully",
  "data": {
    "trackingNumber": "HOG-TRACK-12345",
    "status": "in_transit"
  }
}
```

## 12. Live Verification Results

All tests below used only these accounts:

- `newuser@daouse.com`
- `naijatailor@lnovic.com`
- `oy0kavev6v@illubd.com`

### Core Feature Matrix

```json
{
  "publicListings": 200,
  "publicDesigners": 200,
  "measurements": 200,
  "designerMeasurementTargets": 200,
  "designerProfile": 200,
  "designerReviews": 200,
  "customOrders": 200,
  "escrowWallet": 200,
  "messagingThreads": 200,
  "supportChat": 200,
  "moodboards": 200,
  "discoveryFilters": 200,
  "disputes": 200,
  "adminDisputes": 200,
  "designerAnalytics": 200,
  "sellerListings": 200
}
```

### Communication Matrix

```json
{
  "customerDesignerChat": {
    "eligibleThreads": 200,
    "conversation": 201,
    "safeTextMessage": 201,
    "uploadedImageMessage": 201,
    "blockedContact": 400,
    "adminFlaggedVisibility": 200
  },
  "userAdminSupportChat": {
    "createConversation": 201,
    "adminReply": 201,
    "uploadedImage": 201,
    "messages": 200
  },
  "designerAdminSupportChat": {
    "createConversation": 201,
    "adminReply": 201,
    "messages": 200
  }
}
```

### Studio Matrix

```json
{
  "designerStudio": {
    "createSellerListing": 201,
    "getSellerListings": 200,
    "getSellerListingDetail": 200,
    "updateSellerListing": 200,
    "updateListingMedia": 200,
    "featureListing": 200,
    "deleteSellerListingCleanup": 200
  },
  "adminStudioModeration": {
    "pendingListings": 200,
    "moderatedListings": 200,
    "approveListing": 200,
    "moderationHistory": 200,
    "totalUsers": 200,
    "totalListings": 200,
    "totalTransactions": 200,
    "adminEarnings": 200,
    "listingFee": 200
  },
  "publishedStudioWork": {
    "createPublished": 201,
    "designerList": 200,
    "userList": 200,
    "detail": 200,
    "update": 200,
    "userPatronize": 201,
    "deletePublishedCleanup": 200
  },
  "buyerStudioBrowse": {
    "allListings": 200,
    "listingDetail": 200,
    "searchWithSearchParam": 200,
    "searchWithQueryParam": 200,
    "missingSearchQuery": 400
  }
}
```

## 13. Mobile Implementation Checklist

- Build responsive screens for all device sizes.
- Use public discovery for guest browsing.
- Prompt login before buy, save, message, payment, support, or custom request actions.
- Use returned cards/tokens instead of asking users for backend IDs.
- Upload media from device only.
- Do not provide pasted media URL inputs.
- Render listing videos from uploaded listing media URLs.
- Block messaging video attempts and show the backend rejection message.
- Show the safety prompt when chat/support contact sharing returns `400`.
- Use `Chat with Support` for admin communication.
- Use the required label replacements in this document.
- Use correct review grammar: `1 review`, not `1reviews`.

## 14. Known Boundaries

- Chat is API-based with email notifications. There is no WebSocket/socket streaming in this backend version.
- Messaging video sharing is intentionally blocked. Listing/product video previews are supported through listing media.
- Measurement guides should be implemented as responsive mobile UI/assets. User-pasted guide URLs are rejected.
- Payment references are generated internally. Mobile should not ask users to type references.
