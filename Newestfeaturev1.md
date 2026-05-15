# Newestfeaturev1 API Documentation

Base URL: `/api/v1`

Auth: all endpoints below require `Authorization: Bearer <token>` unless stated otherwise.

Mobile UI responsibility: the backend provides APIs, fields, URLs, status values, and stored records. The mobile app should build and organize the actual screens, visual layouts, guided measurement UI, image zoom interactions, galleries, video players for listing previews, moodboard presentation, and checkout/account prompts.

Guest access: guests can explore listings, collections, designers, and public listing/designer details without registering. When a guest wants to buy, create a custom request, save a style, message a designer, or make payment, the mobile app should ask the user to create/login to an account.

Important UX rule: customer-facing screens should not ask users to type backend IDs such as `designerId`, `vendorId`, `orderId`, `escrowId`, Paystack references, or respondent IDs. The mobile app should show names/cards returned by backend list/search endpoints. When a user taps a card, mobile can pass the backend `threadId`, `reviewTargetId`, or `supportTargetId` that came from the API response. These are internal selection tokens, not fields the user manually enters.

## Full Requirement Checklist

| Feature | Status | API / Data Support |
| --- | --- | --- |
| Saved body measurements | Integrated | `POST /measurements/profiles`, `GET /measurements/profiles` |
| Casual, fitted, native/traditional profiles | Integrated | `fitType`: `casual`, `fitted`, `native`, `custom` |
| Chest, waist, hip, shoulder, sleeve, trouser, native fields | Integrated | `measurements` object on measurement profile |
| Visual guides, diagrams, optional video instructions | Integrated as URLs | `guideReferences.visualGuideUrls`, `diagramUrls`, `instructionVideoUrls`; mobile renders UI |
| Designer requests additional measurements | Integrated | `GET /measurements/request-targets`, `POST /measurements/request-targets/:measurementTargetId` |
| Editable measurement history | Integrated | `PUT /measurements/profiles/:profileId` stores previous values in `history` |
| Designer portfolio gallery | Integrated | `PUT /tailor/portfolio` |
| Bridal/native/corporate/casual/menswear/womenswear sections | Integrated | `categorizedWorkSections` |
| Bio/about, experience, tags, turnaround, availability | Integrated | Vendor profile fields and `PUT /tailor/updateTailor/:tailorId` |
| Completed orders, reviews, ratings | Integrated | Public designer profile `socialProof` |
| Verification badge | Integrated | `isVerifiedDesigner`, `verifiedAt` |
| Star and written reviews | Integrated | `GET /reputation/reviewable-orders`, `POST /reputation/reviewable-orders/:reviewTargetId/review` |
| Review categories | Integrated | `categories.fitAccuracy`, `communication`, `deliveryReliability`, `materialQuality`, `overallExperience` |
| Verified purchase reviews only | Integrated | Review target is generated only from paid/escrowed orders |
| Designer review response | Integrated | `POST /reputation/designer-reviews/:reviewId/respond` |
| Deposit and balance payments | Integrated as protected milestones | `POST /custom-orders/requests/:requestId/pay` |
| Payment milestone tracking | Integrated | `EscrowPayment.milestones` |
| Delivery confirmation before final release | Integrated | Admin release records `deliveryConfirmedAt` and credits designer wallet |
| Hold/release logic | Integrated | Escrow statuses: `deposit_held`, `fully_held`, `released` |
| Refund/dispute support | Integrated | Escrow refund endpoint plus `GET /disputes/support-orders`, `POST /disputes/support-orders/:supportTargetId` |
| Admin intervention | Integrated | Escrow admin fields and dispute admin endpoints |
| Order timeline/status tracking | Integrated | `PUT /custom-orders/workflow` |
| Quote received, accepted, in production, ready, shipped, delivered | Integrated | Workflow status enum |
| Designer status updates | Integrated | `PUT /custom-orders/workflow` |
| Estimated completion dates | Integrated | `estimatedCompletionDate` |
| Delay notifications | Integrated as workflow flag | `status=delayed`, `delayReason`, `delayNotifiedAt`; mobile can surface alert |
| Delivery tracking integration | Integrated | `deliveryTrackingNumber` plus existing tracking module |
| Save listings/images, collections, wishlist | Integrated | `/moodboards` and moodboard items |
| Inspired-by linking | Integrated | `items.inspiredBy` |
| Fashion filters and sort | Integrated | `/discovery/listings`, `/discovery/designers` |
| Multiple images, zoom, closeups, video previews, before/after, styled looks | Integrated as media fields | Listing `images` and `media`; mobile handles zoom/player UI |
| Report issue, fit/delivery issues, ticketing | Integrated | `GET /disputes/support-orders`, `POST /disputes/support-orders/:supportTargetId` |
| Admin moderation tools | Integrated | `GET /disputes/admin`, `PUT /disputes/admin/:disputeId` |
| Refund/revision request handling | Integrated | `requestedResolution`, escrow refund endpoint |
| Designer sales/listing/order/engagement analytics | Integrated | `GET /designer-tools/analytics` |
| Promotion tools/featured listing | Integrated | `PUT /designer-tools/listings/:listingId/feature` |
| Full custom request customer fields | Integrated | `POST /custom-orders/requests` |
| Designer quote, timeline, fabric recommendations | Integrated | `POST /custom-orders/requests/:requestId/quote` |
| Designer accept/decline request | Integrated | `POST /custom-orders/requests/:requestId/designer-response` |
| Revision cycle | Integrated | `POST /custom-orders/requests/:requestId/revisions` |
| Quote approval | Integrated | `POST /custom-orders/requests/:requestId/accept` |
| Order conversion after approval | Integrated | `POST /custom-orders/requests/:requestId/convert` |
| Guest exploration without account | Integrated | `GET /discovery/public/listings`, `/public/designers` |

Dummy simulation accounts used in examples:

```json
{
  "customer": {
    "_id": "665000000000000000000001",
    "fullName": "Ada Buyer",
    "role": "user"
  },
  "designer": {
    "_id": "665000000000000000000002",
    "fullName": "Tolu Designer",
    "role": "tailor"
  },
  "vendor": {
    "_id": "665000000000000000000003",
    "businessName": "Tolu Couture"
  },
  "material": {
    "_id": "665000000000000000000004",
    "attireType": "Agbada"
  }
}
```

## 1. In-App Messaging

Video sharing is intentionally not supported.

Contact blocking rule: phone numbers, emails, physical addresses, external links, social handles, and obfuscated links are blocked before delivery. The blocked attempt is recorded for admin visibility. After repeated attempts, the conversation can be temporarily restricted.

Push notifications: messaging notifications are email-based through the existing backend email service. No mobile push provider is required for this feature version.

### Get Messageable Threads

Messaging is WhatsApp-style. First fetch threads the logged-in user is allowed to message.

`GET /messaging/eligible-threads`

Only agreed quotation/order threads are returned. If both parties have not agreed at quotation level, the thread is not messageable.

Sample response:

```json
{
  "success": true,
  "data": [
    {
      "threadId": "665000000000000000000030",
      "threadType": "customRequest",
      "title": "Tolu Couture",
      "subtitle": "Agreed quote: NGN 190000",
      "status": "converted_to_order"
    }
  ]
}
```

### Start Or Open Conversation

`POST /messaging/conversations`

```json
{
  "threadId": "665000000000000000000030",
  "topic": "measurement"
}
```

Sample response:

```json
{
  "success": true,
  "message": "Conversation ready",
  "data": {
    "_id": "665000000000000000000010",
    "orderType": "customRequest",
    "orderId": "665000000000000000000030",
    "customerId": "665000000000000000000001",
    "designerId": "665000000000000000000002",
    "vendorId": "665000000000000000000003",
    "topic": "measurement",
    "status": "active"
  }
}
```

### Send Message With Image Or Voice Note

`POST /messaging/conversations/:conversationId/messages`

```json
{
  "topic": "quote",
  "content": "Can you make this fitted? Please check the sleeve reference.",
  "attachments": [
    {
      "type": "image",
      "url": "https://cdn.example.com/inspiration.jpg",
      "mimeType": "image/jpeg"
    },
    {
      "type": "voice",
      "url": "https://cdn.example.com/note.m4a",
      "mimeType": "audio/mp4",
      "durationSeconds": 18
    }
  ]
}
```

Sample response:

```json
{
  "success": true,
  "message": "Message sent",
  "data": {
    "message": {
      "_id": "665000000000000000000011",
      "conversationId": "665000000000000000000010",
      "senderId": "665000000000000000000001",
      "recipientId": "665000000000000000000002",
      "messageType": "mixed",
      "content": "Can you make this fitted? Please check the sleeve reference.",
      "topic": "quote",
      "isFlagged": false,
      "deliveryStatus": "sent"
    },
    "emailNotification": {
      "queued": true,
      "recipientId": "665000000000000000000002",
      "success": true,
      "messageId": "email-provider-message-id"
    }
  }
}
```

Restricted contact response sample:

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

Video rejection sample:

```json
{
  "success": false,
  "message": "Video sharing is not supported in platform messaging."
}
```

### Fetch Conversations And Messages

`GET /messaging/conversations`

`GET /messaging/conversations/:conversationId/messages`

### Admin Flagged Conversations

`GET /messaging/admin/flagged-conversations`

## 2. Measurement & Sizing

### Create Saved Measurement Profile

`POST /measurements/profiles`

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
  "guideReferences": {
    "visualGuideUrls": ["https://cdn.example.com/chest-guide.jpg"],
    "diagramUrls": ["https://cdn.example.com/native-diagram.png"],
    "instructionVideoUrls": ["https://cdn.example.com/measurement-guide.mp4"]
  }
}
```

Sample response:

```json
{
  "success": true,
  "message": "Measurement profile created successfully",
  "data": {
    "_id": "665000000000000000000020",
    "userId": "665000000000000000000001",
    "profileName": "Native fit",
    "fitType": "native",
    "measurements": {
      "chest": 40,
      "waist": 34,
      "hip": 39,
      "shoulder": 18,
      "sleeveLength": 25,
      "trouserLength": 41
    }
  }
}
```

### Edit Measurement Profile

`PUT /measurements/profiles/:profileId`

The previous measurement values are stored in `history`.

### Request Additional Measurements

First fetch measurement request targets for the designer:

`GET /measurements/request-targets`

The mobile app should show the returned cards. The designer taps the customer/order they need more measurements for.

Then submit the request:

`POST /measurements/request-targets/:measurementTargetId`

```json
{
  "requestedFields": ["neck", "inseam", "agbadaLength"],
  "note": "Please add neck and full native attire length."
}
```

### Fetch Measurement Profiles Or Requests

`GET /measurements/profiles`

`GET /measurements/requests`

## 3. Designer Profile & Portfolio

Existing tailor creation remains valid. New optional fields are supported:

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

```json
{
  "portfolioGallery": [
    {
      "imageUrl": "https://cdn.example.com/bridal-1.jpg",
      "caption": "Beaded bridal dress",
      "category": "bridal"
    }
  ],
  "categorizedWorkSections": {
    "bridal": ["https://cdn.example.com/bridal-1.jpg"],
    "nativeWear": ["https://cdn.example.com/native-1.jpg"],
    "corporate": [],
    "casual": [],
    "menswear": ["https://cdn.example.com/men-1.jpg"],
    "womenswear": ["https://cdn.example.com/women-1.jpg"]
  }
}
```

### Public Designer Profile

`GET /tailor/profile/:designerId`

Response includes portfolio, bio, years of experience, specialization tags, turnaround time, availability, social proof, and verification badge.

## 4. Reviews & Reputation

Only verified purchase reviews are accepted.

### Fetch Reviewable Orders

`GET /reputation/reviewable-orders`

The mobile app should show these returned cards. The customer taps an order to review.

### Create Designer Review From Selected Order

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

The backend resolves designer, vendor, order, and verified purchase status from the selected review target.

### Designer Responds

`POST /reputation/designer-reviews/:reviewId/respond`

```json
{
  "response": "Thank you. It was a pleasure working on this outfit."
}
```

### Fetch Designer Reviews

`GET /reputation/designers/:designerId/reviews`

## 5. Escrow-Like Payment Protection

Payment protection records track deposit, balance, hold, release, refund/dispute readiness, and admin intervention. The user should not enter Paystack references. Backend generates internal payment references when a payment milestone is recorded.

Escrow behavior:

- When the customer pays deposit/balance, the money is marked as held in escrow.
- The designer sees the held money in their escrow wallet as `pendingEscrow`.
- The money is not added to the designer wallet/bank payout balance until the release condition is met.
- On admin/customer-confirmed release, backend credits the designer wallet.
- Existing payout/bank transfer flows can then move released wallet funds to the designer bank account.

### Designer Escrow Wallet

`GET /custom-orders/designer/escrow-wallet`

Sample response:

```json
{
  "success": true,
  "data": {
    "summary": {
      "pendingEscrow": 190000,
      "released": 0,
      "refunded": 0
    },
    "orders": []
  }
}
```

### Record Escrow Milestone Payment

Primary customer-facing endpoint:

`POST /custom-orders/requests/:requestId/pay`

```json
{
  "milestoneName": "deposit"
}
```

The backend generates the internal reference automatically.

### Admin Release Payment

`POST /custom-orders/escrow/:escrowId/release`

```json
{
  "amount": 100000,
  "adminNote": "Delivery confirmed by customer."
}
```

## 6. Order Workflow & Production Tracking

### Update Timeline Status

`PUT /custom-orders/workflow`

```json
{
  "orderType": "customRequest",
  "orderId": "665000000000000000000030",
  "status": "in_production",
  "note": "Cutting and stitching started.",
  "estimatedCompletionDate": "2026-06-01T00:00:00.000Z"
}
```

Supported statuses:

```json
["quote_received", "accepted", "in_production", "ready", "shipped", "delivered", "delayed", "cancelled"]
```

## 7. Saved Styles / Moodboards

### Create Moodboard

`POST /moodboards`

```json
{
  "name": "Wedding inspiration",
  "description": "Looks for June event",
  "visibility": "private"
}
```

### Add Saved Item

`POST /moodboards/:moodboardId/items`

```json
{
  "itemType": "image",
  "imageUrl": "https://cdn.example.com/style.jpg",
  "note": "Inspired by the sleeve detail",
  "inspiredBy": {
    "itemType": "listing",
    "itemId": "665000000000000000000040"
  }
}
```

### Fetch Or Remove

`GET /moodboards`

`DELETE /moodboards/:moodboardId/items/:itemId`

## 8. Advanced Fashion Filtering & Discovery

Guest/public endpoints:

`GET /discovery/public/listings`

`GET /discovery/public/listings/:listingId`

`GET /discovery/public/designers`

`GET /discovery/public/designers/:designerId`

Authenticated endpoints:

### Filter Listings

`GET /discovery/listings?gender=female&occasion=bridal&fabric=silk&minPrice=50000&maxPrice=250000&sort=ratings`

Supported filters: `gender`, `category`, `occasion`, `size`, `fabric`, `minPrice`, `maxPrice`, `designer`, `availability`, `location`.

Supported sorts: `popular`, `trending`, `latest`, `price_low`, `price_high`, `ratings`.

### Filter Designers

`GET /discovery/designers?specialization=native&availability=available&location=Lagos&sort=ratings`

## 9. Improved Fashion Media Presentation

Listings now support:

```json
{
  "images": ["https://cdn.example.com/front.jpg", "https://cdn.example.com/back.jpg"],
  "media": {
    "fabricCloseups": ["https://cdn.example.com/fabric-close.jpg"],
    "videoPreviews": ["https://cdn.example.com/preview.mp4"],
    "beforeAfterShowcases": ["https://cdn.example.com/before-after.jpg"],
    "styledLookPreviews": ["https://cdn.example.com/styled-look.jpg"],
    "zoomImages": ["https://cdn.example.com/zoom.jpg"]
  }
}
```

Note: product/listing video previews are allowed. Messaging video sharing is not supported.

### Update Listing Rich Media

`PUT /seller/updateSellerListingMedia/:listingId`

```json
{
  "gender": "male",
  "occasion": "native",
  "fabric": "silk",
  "availability": "available",
  "media": {
    "fabricCloseups": ["https://cdn.example.com/fabric-close.jpg"],
    "videoPreviews": ["https://cdn.example.com/listing-preview.mp4"],
    "beforeAfterShowcases": ["https://cdn.example.com/before-after.jpg"],
    "styledLookPreviews": ["https://cdn.example.com/styled-look.jpg"],
    "zoomImages": ["https://cdn.example.com/zoom.jpg"]
  }
}
```

Video preview playback requirements:

- `media.videoPreviews` must contain public HTTPS URLs.
- Supported URL formats are `.mp4` or HLS `.m3u8`.
- The hosting provider must allow mobile/web playback and CORS access.
- The backend stores and returns the URLs; the mobile app renders the video player.

Video upload note:

- Current backend support is URL-based.
- If mobile needs direct video upload later, use the existing ImageKit auth endpoint `GET /imagekit/auth` for signed client upload, or add a dedicated upload flow.

## 10. Dispute Resolution & Support

### Report Issue

First fetch support-eligible orders. The mobile app shows the returned cards; user taps the order they need help with.

`GET /disputes/support-orders`

Then create a support ticket from the selected order:

`POST /disputes/support-orders/:supportTargetId`

```json
{
  "category": "fit_issue",
  "title": "Sleeve length is incorrect",
  "description": "The sleeve is shorter than the approved measurement profile.",
  "evidence": ["https://cdn.example.com/fit-issue.jpg"],
  "requestedResolution": "revision"
}
```

### Fetch And Moderate

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

## 11. Designer Analytics & Growth Tools

### Analytics

`GET /designer-tools/analytics`

Response includes sales totals, listing performance, order insights, and engagement metrics.

### Feature Listing

`PUT /designer-tools/listings/:listingId/feature`

```json
{
  "isFeatured": true
}
```

## 12. Full Custom Order / Quote Workflow

### Customer Creates Request

`POST /custom-orders/requests`

```json
{
  "vendorName": "Tolu Couture",
  "measurementProfileId": "665000000000000000000020",
  "inspirationImages": ["https://cdn.example.com/inspo.jpg"],
  "styleNotes": "Native agbada with subtle embroidery.",
  "fabricPreferences": ["silk", "aso oke"],
  "deliveryTimelinePreference": "Before June 1"
}
```

The backend can resolve the designer by `vendorName`, `designerName`, or `designerUsername`. In the mobile UI, users should select a designer from discovery/search results instead of typing IDs.

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

### Designer Accepts Or Declines Request

`POST /custom-orders/requests/:requestId/designer-response`

```json
{
  "action": "accept",
  "note": "I can review this request and prepare a quote."
}
```

Use `"action": "decline"` when the designer cannot take the request.

### Revision Cycle

`POST /custom-orders/requests/:requestId/revisions`

```json
{
  "note": "Please reduce embroidery and update the quote."
}
```

### Customer Accepts Quote

`POST /custom-orders/requests/:requestId/accept`

Sample response:

```json
{
  "success": true,
  "message": "Quote accepted and payment protection record created",
  "data": {
    "request": {
      "_id": "665000000000000000000030",
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
      "totalAmount": 200000,
      "depositAmount": 100000,
      "balanceAmount": 100000,
      "status": "pending"
    }
  }
}
```

### Convert Accepted Request To Order

`POST /custom-orders/requests/:requestId/convert`

```json
{
  "estimatedCompletionDate": "2026-06-01T00:00:00.000Z"
}
```

The backend can use the accepted request as the order record. Mobile should not ask the user to enter an order ID.

### Refund Escrow Payment

`POST /custom-orders/escrow/:escrowId/refund`

```json
{
  "amount": 50000,
  "adminNote": "Partial refund approved after dispute review."
}
```

## 13. Review Flow Without Manual IDs

### Fetch Reviewable Orders

`GET /reputation/reviewable-orders`

The API returns paid custom orders the customer can review.

### Create Review From Selected Order

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

The backend resolves the designer, vendor, order, and verified-purchase status from the selected review target.

## Test Status

Simulation coverage added in `tests/newest-features-simulation.test.js`:

- Contact details are blocked before message delivery.
- Address-style content is blocked before message delivery.
- Messaging video attachments are rejected.
- Measurement profile supports native fit fields and edit history shape.
- Custom quote workflow creates quote, accepted status timeline, and escrow structure.

Dummy account API simulation added in `scripts/simulate-newest-messaging-flow.js`.

The script:

- Connects to the configured MongoDB database.
- Creates a dummy customer account.
- Creates a dummy designer account.
- Creates a dummy vendor profile for the designer.
- Creates a dummy material/order context for the customer.
- Calls the actual messaging API endpoints with bearer tokens.
- Confirms valid image/text message delivery.
- Confirms phone/address content is blocked with HTTP `400`.
- Confirms video attachment is blocked with HTTP `400`.
- Confirms blocked contact attempts are recorded for admin visibility.
- Cleans up all dummy records after the simulation.

Latest local result:

```json
{
  "success": true,
  "apiResults": {
    "createConversationStatus": 201,
    "validMessageStatus": 201,
    "emailNotification": {
      "queued": true,
      "success": false,
      "error": "SMTP credentials not configured"
    },
    "blockedContactStatus": 400,
    "blockedContactTypes": ["phone", "address"],
    "blockedVideoStatus": 400,
    "fetchedSentMessages": 1,
    "blockedAttemptsRecordedForAdmin": 1
  }
}
```

The email notification path was executed, but the local environment does not have SMTP credentials configured, so no real email was sent during the simulation.

Full end-to-end dummy account API simulation added in `scripts/simulate-newest-full-flow.js`.

The full script:

- Creates fresh verified dummy customer, designer, and admin accounts.
- Signs in through `POST /api/v1/user/login` for customer, designer, and admin tokens.
- Creates dummy vendor, category, material/order context, and approved listing fixtures.
- Tests guest/public exploration before auth-protected actions.
- Tests measurement profile create/update and designer measurement request.
- Tests designer portfolio and public designer profile.
- Tests custom request, designer accept, quote, revision, quote approval, escrow deposit/balance, conversion, workflow, delay, refund, and release.
- Tests messaging conversation, valid image/text message, phone/address blocking, and video blocking.
- Tests moodboard create and saved item.
- Tests authenticated discovery filters.
- Tests tracking creation, tracking fetch, and delivery confirmation.
- Tests verified-purchase designer review and designer response.
- Tests dispute creation, admin list, and admin resolution.
- Tests designer analytics and featured listing.
- Cleans up all dummy records after the run.

Latest full-flow result:

```json
{
  "success": true,
  "report": {
    "auth": {
      "customerLogin": 200,
      "designerLogin": 200,
      "adminLogin": 200
    },
    "guestDiscovery": {
      "publicListings": 200,
      "publicDesigners": 200
    },
    "measurements": {
      "create": 201,
      "update": 200,
      "requestTargets": 200,
      "request": 201
    },
    "designerProfile": {
      "portfolio": 200,
      "publicProfile": 200
    },
    "customOrderEscrow": {
      "request": 201,
      "designerResponse": 200,
      "quote": 200,
      "revision": 200,
      "accept": 200,
      "deposit": 200,
      "balance": 200,
      "convert": 200,
      "workflow": 200,
      "delay": 200,
      "refund": 200,
      "release": 200,
      "designerWallet": 200
    },
    "messaging": {
      "eligibleThreads": 200,
      "conversation": 201,
      "validMessage": 201,
      "blockedContact": 400,
      "blockedVideo": 400
    },
    "moodboards": {
      "create": 201,
      "addItem": 200
    },
    "discovery": {
      "listings": 200,
      "designers": 200,
      "listingMedia": 200
    },
    "trackingDelivery": {
      "create": 201,
      "get": 200,
      "delivered": 200
    },
    "reputation": {
      "reviewableOrders": 200,
      "review": 201,
      "response": 200
    },
    "disputes": {
      "supportOrders": 200,
      "create": 201,
      "adminList": 200,
      "update": 200
    },
    "designerTools": {
      "analytics": 200,
      "featureListing": 200
    }
  }
}
```

Note: the script creates verified dummy accounts directly in MongoDB, then signs them in through the real login API. This avoids the existing `verifyToken` flow because that flow calls Paystack dedicated account APIs.
