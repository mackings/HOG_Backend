# HOG Review & Offer API Documentation
**Version:** 2.0
**Last Updated:** December 31, 2025
**Base URL:** `https://hogbackend.vercel.app`

---

## Table of Contents
1. [Overview](#overview)
2. [Review Model](#review-model)
3. [Offer Model](#offer-model)
4. [Review API Endpoints](#review-api-endpoints)
5. [Offer API Endpoints](#offer-api-endpoints)
6. [Payment Flow with Offers](#payment-flow-with-offers)
7. [Flutter Integration](#flutter-integration)

---

## Overview

### What is a Review/Quote?
A **Review** represents a tailor's quote for a material submitted by a customer. It includes:
- Material costs
- Workmanship costs
- Delivery dates
- Total pricing
- Payment status

### What is an Offer?
An **Offer** enables price negotiation between customer and tailor before payment. It includes:
- Counter-offers from both parties
- Chat/negotiation history
- Accepted/rejected/pending status
- Link to the review

### New Payment Rule
✅ **Payment is now blocked until an offer is accepted**
Customers must negotiate and accept an offer before making payment for a review.

---

## Review Model

### Schema Structure

```javascript
{
  _id: ObjectId,
  userId: ObjectId (ref: "User"),
  vendorId: ObjectId (ref: "Vendor"),
  materialId: ObjectId (ref: "Material"),

  // Cost breakdown
  materialTotalCost: Number,
  workmanshipTotalCost: Number,
  subTotalCost: Number,
  totalCost: Number, // User payable total (base + extra 10% on agreement)
  tax: Number,
  commission: Number, // 10% added to user payable on agreement

  // Payment tracking
  amountPaid: Number (default: 0),
  amountToPay: Number (default: 0), // User payable remaining amount
  // New fields added on agreement
  vendorBaseTotal: Number, // Agreed base amount for vendor
  userPayableTotal: Number, // Agreed base + 10% for user payment

  // Dates
  deliveryDate: Date,
  reminderDate: Date,

  // Offer integration (NEW)
  hasAcceptedOffer: Boolean (default: false),
  acceptedOfferId: ObjectId (ref: "MakeOffer"),

  // Status
  status: String (enum: [
    "pending",
    "approved",
    "rejected",
    "requesting",
    "quote",
    "part payment",
    "full payment"
  ]),

  // Metadata
  comment: String,
  country: String,
  createdAt: Date,
  updatedAt: Date
}
```

### Status Flow

```
requesting → quote → approved → part payment → full payment
                   ↘ rejected
```

| Status | Description | Can Pay? | Can Modify? |
|--------|-------------|----------|-------------|
| `requesting` | Internal query status | ❌ | ✅ |
| `quote` | Tailor provided quote | ❌ | ✅ |
| `approved` | Customer approved quote | ✅ (if offer accepted) | ❌ |
| `rejected` | Customer rejected quote | ❌ | ❌ |
| `part payment` | Partial payment made | ✅ | ❌ |
| `full payment` | Fully paid | ❌ | ❌ |

### NEW: Offer Validation Fields

```javascript
hasAcceptedOffer: Boolean  // True if an offer was accepted
acceptedOfferId: ObjectId  // Reference to the accepted offer
```

**Payment Rule:**
- If `hasAcceptedOffer === false` → Payment is **BLOCKED**
- If `acceptedOfferId` exists → Payment is **ALLOWED**

**Amount Rule on Agreement:**
- Vendor keeps **agreed base amount** (`vendorBaseTotal`)
- User pays **base + 10%** (`userPayableTotal` / `totalCost`)

---

## Offer Model

### Schema Structure

```javascript
{
  _id: ObjectId,
  userId: ObjectId (ref: "User"),        // Customer
  vendorId: ObjectId (ref: "Vendor"),    // Tailor
  materialId: ObjectId (ref: "Material"),
  reviewId: ObjectId (ref: "Review"),

  status: String (enum: [
    "pending",
    "accepted",
    "rejected",
    "countered",
    "incoming"
  ]),

  total: Number,

  chats: [{
    senderType: String (enum: ["customer", "vendor"]),
    action: String (enum: ["accepted", "rejected", "countered", "pending", "incoming"]),
    counterMaterialCost: Number,
    counterWorkmanshipCost: Number,
    counterTotalCost: Number,
    comment: String,
    timestamp: Date
  }],

  createdAt: Date,
  updatedAt: Date
}
```

### Offer Status Flow

```
incoming → pending ⇄ countered → accepted
                              → rejected
```

| Status | Description | Who Set It? |
|--------|-------------|-------------|
| `incoming` | Customer sent new offer | Customer |
| `pending` | Waiting for response | Either party |
| `countered` | Counter-offer made | Either party |
| `accepted` | Offer accepted | Either party |
| `rejected` | Offer rejected | Either party |

---

## Review API Endpoints

### 1. Get Review by ID

**Endpoint:**
```
GET /api/v1/review/getReviewById/{reviewId}
```

**Headers:**
```json
{
  "Authorization": "Bearer <token>"
}
```

**Response (Success 200):**
```json
{
  "success": true,
  "review": {
    "_id": "67890abc",
    "userId": {
      "_id": "user123",
      "fullName": "John Doe",
      "email": "john@example.com",
      "image": "https://..."
    },
    "vendorId": {
      "_id": "vendor456",
      "userId": "tailorUser789",
      "businessName": "Elite Tailors",
      "businessEmail": "contact@elitetailors.com",
      "businessPhone": "+2348012345678"
    },
    "materialId": {
      "_id": "mat101",
      "attireType": "Agbada",
      "clothMaterial": "Senator Material",
      "color": "Navy Blue",
      "measurement": [...],
      "sampleImage": [...]
    },
    "materialTotalCost": 50000,
    "workmanshipTotalCost": 30000,
    "subTotalCost": 80000,
    "totalCost": 100000,
    "tax": 16000,
    "commission": 4000,
    "amountPaid": 30000,
    "amountToPay": 70000,
    "deliveryDate": "2025-01-15T00:00:00.000Z",
    "reminderDate": "2025-01-10T00:00:00.000Z",
    "hasAcceptedOffer": true,
    "acceptedOfferId": "offer789",
    "status": "part payment",
    "comment": "Premium quality work guaranteed",
    "country": "Nigeria",
    "createdAt": "2025-12-25T10:00:00.000Z",
    "updatedAt": "2025-12-30T15:30:00.000Z"
  }
}
```

---

### 2. Update Review Status (Customer)

**Endpoint:**
```
PUT /api/v1/review/updateReviewStatus/{reviewId}
```

**Headers:**
```json
{
  "Authorization": "Bearer <token>",
  "Content-Type": "application/json"
}
```

**Request Body:**
```json
{
  "status": "approved"
}
```

**Allowed Status Values:**
- `"pending"`
- `"approved"`
- `"rejected"`
- `"resolved"`

**Response (Success 200):**
```json
{
  "success": true,
  "message": "Review status updated successfully",
  "review": { /* updated review object */ }
}
```

**Response (Error 400 - No Accepted Offer):**
```json
{
  "success": false,
  "message": "Please negotiate and accept an offer before approving this quote"
}
```

---

## Offer API Endpoints

### 1. Create/Update Offer (Customer)

**Endpoint:**
```
POST /api/v1/makeOffer/createMakeOffer/{reviewId}
```

**Headers:**
```json
{
  "Authorization": "Bearer <token>",
  "Content-Type": "application/json"
}
```

**Request Body:**
```json
{
  "materialTotalCost": 45000,
  "workmanshipTotalCost": 25000,
  "comment": "Can we reduce the price slightly?"
}
```

**Response (Success 201):**
```json
{
  "success": true,
  "message": "Offer created successfully",
  "data": {
    "_id": "offer123",
    "userId": "user456",
    "vendorId": "vendor789",
    "materialId": "mat101",
    "reviewId": "review202",
    "status": "incoming",
    "chats": [
      {
        "senderType": "customer",
        "action": "incoming",
        "counterMaterialCost": 45000,
        "counterWorkmanshipCost": 25000,
        "counterTotalCost": 70000,
        "comment": "Can we reduce the price slightly?",
        "timestamp": "2025-12-31T10:00:00.000Z"
      }
    ],
    "createdAt": "2025-12-31T10:00:00.000Z",
    "updatedAt": "2025-12-31T10:00:00.000Z"
  }
}
```

---

### 2. Vendor Reply to Offer

**Endpoint:**
```
POST /api/v1/makeOffer/vendorReplyOffer/{offerId}
```

**Headers:**
```json
{
  "Authorization": "Bearer <token>",
  "Content-Type": "application/json"
}
```

**Request Body:**

**Option A: Accept Customer's Offer**
```json
{
  "action": "accepted",
  "comment": "Great! I accept your offer"
}
```

**Option B: Reject Offer**
```json
{
  "action": "rejected",
  "comment": "Sorry, price is too low"
}
```

**Option C: Counter-Offer**
```json
{
  "action": "countered",
  "counterMaterialCost": 47000,
  "counterWorkmanshipCost": 27000,
  "comment": "How about we meet in the middle?"
}
```

**Response (Success 200 - Accepted):**
```json
{
  "success": true,
  "message": "Offer accepted successfully. Review has been updated.",
  "data": {
    "_id": "offer123",
    "status": "accepted",
    "chats": [
      {
        "senderType": "customer",
        "action": "incoming",
        "counterMaterialCost": 45000,
        "counterWorkmanshipCost": 25000,
        "counterTotalCost": 70000,
        "comment": "Can we reduce the price slightly?",
        "timestamp": "2025-12-31T10:00:00.000Z"
      },
      {
        "senderType": "vendor",
        "action": "accepted",
        "counterMaterialCost": 45000,
        "counterWorkmanshipCost": 25000,
        "counterTotalCost": 70000,
        "comment": "Great! I accept your offer",
        "timestamp": "2025-12-31T11:30:00.000Z"
      }
    ]
  }
}
```

**What Happens When Vendor Accepts:**
1. ✅ Offer status → `"accepted"`
2. ✅ Review updated with agreed costs
3. ✅ `review.hasAcceptedOffer` → `true`
4. ✅ `review.acceptedOfferId` → `offer._id`
5. ✅ Customer can now proceed to payment

---

### 3. Buyer Reply to Vendor Counter-Offer

**Endpoint:**
```
POST /api/v1/makeOffer/buyerReplyToOffer/{offerId}
```

**Headers:**
```json
{
  "Authorization": "Bearer <token>",
  "Content-Type": "application/json"
}
```

**Request Body:**

**Accept Vendor's Counter:**
```json
{
  "action": "accepted",
  "comment": "Sounds good! I accept"
}
```

**Reject Counter:**
```json
{
  "action": "rejected",
  "comment": "Still too high for my budget"
}
```

**Send Another Counter:**
```json
{
  "action": "countered",
  "counterMaterialCost": 46000,
  "counterWorkmanshipCost": 26000,
  "comment": "One more counter - can we do this?"
}
```

**Response (Success 200 - Accepted):**
```json
{
  "success": true,
  "message": "You accepted the vendor's offer successfully. Review has been updated.",
  "data": { /* offer object */ }
}
```

---

### 4. Get All Offers (Customer or Vendor)

**Endpoint:**
```
GET /api/v1/makeOffer/getAllMakeOffers
```

**Headers:**
```json
{
  "Authorization": "Bearer <token>"
}
```

**Response (Success 200):**
```json
{
  "success": true,
  "message": "Make offers retrieved successfully",
  "count": 3,
  "data": [
    {
      "_id": "offer123",
      "userId": { /* customer details */ },
      "vendorId": { /* vendor details */ },
      "materialId": { /* material details */ },
      "reviewId": { /* review details */ },
      "status": "accepted",
      "chats": [ /* chat history */ ],
      "chatSummary": {
        "totalMessages": 4,
        "latestMessage": {
          "senderType": "customer",
          "action": "accepted",
          "comment": "Sounds good!",
          "timestamp": "2025-12-31T12:00:00.000Z"
        }
      },
      "createdAt": "2025-12-30T10:00:00.000Z",
      "updatedAt": "2025-12-31T12:00:00.000Z"
    }
  ]
}
```

---

### 5. Get Offer by ID

**Endpoint:**
```
GET /api/v1/makeOffer/getMakeOfferById/{offerId}
```

**Headers:**
```json
{
  "Authorization": "Bearer <token>"
}
```

**Response (Success 200):**
```json
{
  "success": true,
  "message": "Offer retrieved successfully",
  "data": {
    "_id": "offer123",
    "userId": { /* customer */ },
    "vendorId": { /* vendor */ },
    "materialId": { /* material */ },
    "reviewId": { /* review */ },
    "status": "pending",
    "chats": [
      {
        "senderType": "customer",
        "action": "incoming",
        "counterMaterialCost": 45000,
        "counterWorkmanshipCost": 25000,
        "counterTotalCost": 70000,
        "comment": "Initial offer",
        "timestamp": "2025-12-31T10:00:00.000Z"
      },
      {
        "senderType": "vendor",
        "action": "countered",
        "counterMaterialCost": 47000,
        "counterWorkmanshipCost": 27000,
        "counterTotalCost": 74000,
        "comment": "Counter-offer",
        "timestamp": "2025-12-31T11:00:00.000Z"
      }
    ],
    "chatSummary": {
      "totalMessages": 2,
      "latestMessage": { /* latest chat */ }
    }
  }
}
```

---

## Payment Flow with Offers

### Complete Flow Diagram

```
1. Customer submits material
         ↓
2. Tailor creates review/quote
         ↓
3. Customer receives quote
         ↓
4. Customer creates offer (negotiation)
         ↓
5. Vendor responds (accept/reject/counter)
         ↓
6. [Negotiation loop continues until accepted]
         ↓
7. Either party accepts offer
         ↓
8. Review updated:
   - hasAcceptedOffer = true
   - acceptedOfferId = offer._id
   - vendorBaseTotal updated with agreed base amount
   - userPayableTotal/totalCost updated with agreed base + 10%
         ↓
9. Customer can now make payment
         ↓
10. Payment processed (Stripe/Paystack)
```

### Payment Validation

When customer attempts payment:

```javascript
// Stripe: POST /api/v1/stripe/make-payment/{reviewId}
// Paystack: POST /api/v1/material/createPaymentOnline/{reviewId}

// Backend checks:
if (review.hasAcceptedOffer === false && !review.acceptedOfferId) {
  return {
    success: false,
    message: "Please negotiate and accept an offer before making payment",
    requiresOffer: true
  }
}
```

**Error Response (400):**
```json
{
  "success": false,
  "message": "Please negotiate and accept an offer before making payment",
  "requiresOffer": true
}
```

---

## Flutter Integration

### 1. Check if Payment is Allowed

```dart
Future<bool> canMakePayment(String reviewId) async {
  final review = await fetchReviewById(reviewId);

  if (!review.hasAcceptedOffer || review.acceptedOfferId == null) {
    // Show offer negotiation UI
    return false;
  }

  return true;
}
```

### 2. Display Review with Offer Status

```dart
class ReviewCard extends StatelessWidget {
  final Review review;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Column(
        children: [
          // Review details
          Text('Total Cost: ₦${review.totalCost}'), // user payable
          Text('Amount Paid: ₦${review.amountPaid}'),
          Text('Remaining: ₦${review.amountToPay}'),

          // Offer status indicator
          if (review.hasAcceptedOffer)
            Chip(
              label: Text('Offer Accepted'),
              backgroundColor: Colors.green,
              avatar: Icon(Icons.check_circle, color: Colors.white),
            )
          else
            Chip(
              label: Text('Negotiation Required'),
              backgroundColor: Colors.orange,
              avatar: Icon(Icons.handshake, color: Colors.white),
            ),

          // Action buttons
          if (!review.hasAcceptedOffer)
            ElevatedButton(
              onPressed: () => navigateToOfferNegotiation(review),
              child: Text('Negotiate Price'),
            )
          else if (review.amountToPay > 0)
            ElevatedButton(
              onPressed: () => navigateToPayment(review),
              child: Text('Make Payment'),
            ),
        ],
      ),
    );
  }
}
```

### 3. Offer Negotiation UI

```dart
class OfferNegotiationScreen extends StatefulWidget {
  final Review review;

  @override
  _OfferNegotiationScreenState createState() => _OfferNegotiationScreenState();
}

class _OfferNegotiationScreenState extends State<OfferNegotiationScreen> {
  Offer? currentOffer;
  bool loading = true;

  @override
  void initState() {
    super.initState();
    loadOffer();
  }

  Future<void> loadOffer() async {
    // Fetch existing offer for this review
    final offers = await getAllOffers();
    final reviewOffer = offers.firstWhere(
      (o) => o.reviewId == widget.review.id,
      orElse: () => null,
    );

    setState(() {
      currentOffer = reviewOffer;
      loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (loading) return CircularProgressIndicator();

    return Scaffold(
      appBar: AppBar(title: Text('Price Negotiation')),
      body: Column(
        children: [
          // Original quote
          Card(
            child: ListTile(
              title: Text('Original Quote'),
              subtitle: Text('₦${widget.review.totalCost}'),
            ),
          ),

          // Negotiation history
          if (currentOffer != null)
            Expanded(
              child: ListView.builder(
                itemCount: currentOffer!.chats.length,
                itemBuilder: (context, index) {
                  final chat = currentOffer!.chats[index];
                  final isCustomer = chat.senderType == 'customer';

                  return Align(
                    alignment: isCustomer
                        ? Alignment.centerRight
                        : Alignment.centerLeft,
                    child: Card(
                      color: isCustomer ? Colors.blue[100] : Colors.grey[200],
                      child: Padding(
                        padding: EdgeInsets.all(12),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              chat.action.toUpperCase(),
                              style: TextStyle(fontWeight: FontWeight.bold),
                            ),
                            Text('Material: ₦${chat.counterMaterialCost}'),
                            Text('Workmanship: ₦${chat.counterWorkmanshipCost}'),
                            Text('Total: ₦${chat.counterTotalCost}'),
                            if (chat.comment != null)
                              Text(
                                chat.comment!,
                                style: TextStyle(fontStyle: FontStyle.italic),
                              ),
                            Text(
                              DateFormat('MMM dd, HH:mm').format(chat.timestamp),
                              style: TextStyle(fontSize: 10),
                            ),
                          ],
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),

          // Action buttons based on offer status
          if (currentOffer == null)
            _buildCreateOfferButton()
          else if (currentOffer!.status == 'pending' &&
              _isVendorsTurn(currentOffer!))
            Text('Waiting for vendor response...')
          else if (currentOffer!.status == 'pending' &&
              !_isVendorsTurn(currentOffer!))
            _buildResponseButtons()
          else if (currentOffer!.status == 'accepted')
            Column(
              children: [
                Icon(Icons.check_circle, color: Colors.green, size: 48),
                Text('Offer Accepted!'),
                ElevatedButton(
                  onPressed: () => navigateToPayment(widget.review),
                  child: Text('Proceed to Payment'),
                ),
              ],
            ),
        ],
      ),
    );
  }

  Widget _buildCreateOfferButton() {
    return ElevatedButton(
      onPressed: () => showCreateOfferDialog(),
      child: Text('Make an Offer'),
    );
  }

  Widget _buildResponseButtons() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
      children: [
        ElevatedButton(
          onPressed: () => acceptOffer(),
          style: ElevatedButton.styleFrom(backgroundColor: Colors.green),
          child: Text('Accept'),
        ),
        OutlinedButton(
          onPressed: () => showCounterOfferDialog(),
          child: Text('Counter'),
        ),
        OutlinedButton(
          onPressed: () => rejectOffer(),
          style: OutlinedButton.styleFrom(foregroundColor: Colors.red),
          child: Text('Reject'),
        ),
      ],
    );
  }

  bool _isVendorsTurn(Offer offer) {
    if (offer.chats.isEmpty) return false;
    final lastChat = offer.chats.last;
    return lastChat.senderType == 'customer';
  }

  Future<void> acceptOffer() async {
    try {
      await buyerReplyToOffer(
        offerId: currentOffer!.id,
        action: 'accepted',
      );

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Offer accepted! You can now pay')),
      );

      Navigator.pop(context);
    } catch (e) {
      // Handle error
    }
  }
}
```

### 4. Payment with Offer Validation

```dart
Future<void> initiatePayment(Review review) async {
  try {
    // Attempt payment
    final response = await createStripePayment(
      reviewId: review.id,
      amount: review.amountToPay,
      shipmentMethod: 'regular',
      paymentStatus: 'full payment',
    );

    // Redirect to checkout
    launchUrl(Uri.parse(response['data']['checkoutUrl']));
  } on HttpException catch (e) {
    if (e.statusCode == 400 && e.body.contains('requiresOffer')) {
      // Show offer negotiation dialog
      showDialog(
        context: context,
        builder: (context) => AlertDialog(
          title: Text('Negotiation Required'),
          content: Text('Please negotiate and accept an offer before paying'),
          actions: [
            TextButton(
              onPressed: () {
                Navigator.pop(context);
                navigateToOfferNegotiation(review);
              },
              child: Text('Start Negotiation'),
            ),
          ],
        ),
      );
    }
  }
}
```

---

## Sample Response Objects

### Complete Review Object
```json
{
  "_id": "67890abc",
  "userId": {
    "_id": "user123",
    "fullName": "John Doe",
    "email": "john@example.com",
    "image": "https://imagekit.io/...",
    "country": "Nigeria",
    "phoneNumber": "+2348012345678",
    "address": "15 Admiralty Way, Lekki, Lagos"
  },
  "vendorId": {
    "_id": "vendor456",
    "userId": "tailorUser789",
    "businessName": "Elite Tailors Ltd",
    "businessEmail": "contact@elitetailors.com",
    "businessPhone": "+2348087654321"
  },
  "materialId": {
    "_id": "mat101",
    "userId": "user123",
    "attireType": "Agbada",
    "clothMaterial": "Senator Material",
    "color": "Navy Blue",
    "brand": "ABC Textiles",
    "measurement": [
      { "name": "Shoulder", "value": "18" },
      { "name": "Chest", "value": "42" },
      { "name": "Length", "value": "60" }
    ],
    "sampleImage": ["https://imagekit.io/..."],
    "settlement": false,
    "isDelivered": false,
    "specialInstructions": "Please add gold embroidery"
  },
  "materialTotalCost": 50000,
  "workmanshipTotalCost": 30000,
  "subTotalCost": 80000,
  "totalCost": 100000,
  "tax": 16000,
  "commission": 4000,
  "amountPaid": 30000,
  "amountToPay": 70000,
  "deliveryDate": "2025-01-15T00:00:00.000Z",
  "reminderDate": "2025-01-10T00:00:00.000Z",
  "hasAcceptedOffer": true,
  "acceptedOfferId": "offer789",
  "status": "part payment",
  "comment": "Premium quality work with gold embroidery",
  "country": "Nigeria",
  "createdAt": "2025-12-25T10:00:00.000Z",
  "updatedAt": "2025-12-30T15:30:00.000Z"
}
```

### Complete Offer Object
```json
{
  "_id": "offer789",
  "userId": {
    "_id": "user123",
    "fullName": "John Doe",
    "email": "john@example.com",
    "profileImage": "https://imagekit.io/...",
    "role": "user"
  },
  "vendorId": {
    "_id": "vendor456",
    "businessName": "Elite Tailors Ltd",
    "userId": {
      "_id": "tailorUser789",
      "fullName": "Ahmed Ibrahim",
      "email": "ahmed@elitetailors.com"
    }
  },
  "materialId": { /* material object */ },
  "reviewId": { /* review object */ },
  "status": "accepted",
  "chats": [
    {
      "_id": "chat1",
      "senderType": "customer",
      "action": "incoming",
      "counterMaterialCost": 45000,
      "counterWorkmanshipCost": 25000,
      "counterTotalCost": 70000,
      "comment": "Can we reduce the price?",
      "timestamp": "2025-12-28T10:00:00.000Z"
    },
    {
      "_id": "chat2",
      "senderType": "vendor",
      "action": "countered",
      "counterMaterialCost": 47000,
      "counterWorkmanshipCost": 27000,
      "counterTotalCost": 74000,
      "comment": "How about meeting in the middle?",
      "timestamp": "2025-12-28T14:00:00.000Z"
    },
    {
      "_id": "chat3",
      "senderType": "customer",
      "action": "accepted",
      "counterMaterialCost": 47000,
      "counterWorkmanshipCost": 27000,
      "counterTotalCost": 74000,
      "comment": "Sounds good! I accept",
      "timestamp": "2025-12-28T16:00:00.000Z"
    }
  ],
  "chatSummary": {
    "totalMessages": 3,
    "latestMessage": {
      "senderType": "customer",
      "action": "accepted",
      "comment": "Sounds good! I accept",
      "timestamp": "2025-12-28T16:00:00.000Z"
    }
  },
  "createdAt": "2025-12-28T10:00:00.000Z",
  "updatedAt": "2025-12-28T16:00:00.000Z"
}
```

---

## Summary

### Key Changes
1. ✅ Added `hasAcceptedOffer` and `acceptedOfferId` to Review model
2. ✅ Payment blocked until offer is accepted
3. ✅ Offer system fully integrated with payment flow
4. ✅ Both Stripe and Paystack validate accepted offers

### Payment Flow Rules
- **Before Offer:** Payment returns error `requiresOffer: true`
- **After Offer Accepted:** Payment proceeds normally
- **Offer Updates Review:** Accepted offer updates review costs automatically

### Flutter Requirements
1. Check `review.hasAcceptedOffer` before showing payment button
2. Show offer negotiation UI if no accepted offer
3. Handle `requiresOffer` error from payment API
4. Display offer chat history for transparency

---

**Last Updated:** December 31, 2025
**Backend Version:** 2.0
**Compatible with:** Flutter 3.x
