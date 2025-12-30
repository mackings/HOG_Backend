# ✅ Simplified Offer/Negotiation System

## Overview

The offer system allows **buyers (customers)** and **vendors (tailors)** to negotiate prices for custom tailoring orders through a simple 3-action flow: **Accept**, **Reject**, or **Negotiate** (counter-offer).

---

## 🎯 Key Improvements Made

### ✅ Fixed Issues:
1. **Review Not Updating**: When offers were accepted, the review amounts weren't updating
2. **Acceptance Logic**: System now automatically uses the latest counter-offer amount when accepting
3. **Seamless Flow**: Simplified to 3 clear actions instead of confusing states

### ✅ What Works Now:
- ✅ **Buyer accepts vendor counter** → Review updates with vendor's amounts
- ✅ **Vendor accepts buyer counter** → Review updates with buyer's amounts
- ✅ **Multiple negotiations** → Chat history preserved, latest offer tracked
- ✅ **Automatic sync** → Review costs updated immediately on acceptance
- ✅ **Both costs updated** → Material cost + Workmanship cost + Total cost

---

## 📋 Offer Flow

### 1️⃣ **Customer Initiates Offer**

```
Customer → Vendor
"I want this made for ₦50,000 (materials: ₦30,000, workmanship: ₦20,000)"
```

**API Endpoint:**
```http
POST /api/v1/makeOffer/createMakeOffer/:reviewId
Authorization: Bearer {customer_token}

{
  "materialTotalCost": 30000,
  "workmanshipTotalCost": 20000,
  "comment": "Is this price okay?"
}
```

**Status:** `incoming` (new offer sent to vendor)

---

### 2️⃣ **Vendor Responds**

The vendor has 3 options:

#### Option A: **Accept** ✅
```http
POST /api/v1/makeOffer/vendorReplyOffer/:offerId
Authorization: Bearer {vendor_token}

{
  "action": "accepted",
  "comment": "Perfect! I accept your offer"
}
```
**Result:**
- Offer status → `accepted`
- Review updated with customer's amounts (₦30,000 + ₦20,000 = ₦50,000)
- Chat history saved

#### Option B: **Reject** ❌
```http
POST /api/v1/makeOffer/vendorReplyOffer/:offerId

{
  "action": "rejected",
  "comment": "Sorry, price is too low"
}
```
**Result:**
- Offer status → `rejected`
- Negotiation ends

#### Option C: **Negotiate (Counter-Offer)** 🔄
```http
POST /api/v1/makeOffer/vendorReplyOffer/:offerId

{
  "action": "countered",
  "counterMaterialCost": 40000,
  "counterWorkmanshipCost": 25000,
  "comment": "I can do it for ₦65,000 total"
}
```
**Result:**
- Offer status → `pending` (waiting for customer response)
- New counter-offer: ₦65,000 (materials: ₦40,000, workmanship: ₦25,000)
- Chat history preserved

---

### 3️⃣ **Customer Responds to Counter**

The customer also has 3 options:

#### Option A: **Accept Vendor's Counter** ✅
```http
POST /api/v1/makeOffer/buyerReplyToOffer/:offerId
Authorization: Bearer {customer_token}

{
  "action": "accepted",
  "comment": "Okay, I agree to ₦65,000"
}
```
**Result:**
- Offer status → `accepted`
- Review updated with vendor's counter amounts (₦40,000 + ₦25,000 = ₦65,000)
- Negotiation complete

#### Option B: **Reject Vendor's Counter** ❌
```http
POST /api/v1/makeOffer/buyerReplyToOffer/:offerId

{
  "action": "rejected",
  "comment": "Too expensive for me"
}
```
**Result:**
- Offer status → `rejected`
- Negotiation ends

#### Option C: **Counter Again** 🔄
```http
POST /api/v1/makeOffer/buyerReplyToOffer/:offerId

{
  "action": "countered",
  "counterMaterialCost": 35000,
  "counterWorkmanshipCost": 22000,
  "comment": "How about ₦57,000?"
}
```
**Result:**
- Offer status → `pending` (back to vendor)
- New counter: ₦57,000 (materials: ₦35,000, workmanship: ₦22,000)
- Process continues...

---

## 🔄 Complete Negotiation Example

### Scenario: Multiple Rounds

```
┌─────────────────────────────────────────────────────────────┐
│ Round 1: Customer Offers                                    │
├─────────────────────────────────────────────────────────────┤
│ Customer → Vendor: ₦50,000                                  │
│   Materials: ₦30,000 | Workmanship: ₦20,000                │
│   Status: "incoming"                                         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Round 2: Vendor Counters                                    │
├─────────────────────────────────────────────────────────────┤
│ Vendor → Customer: ₦65,000 (countered)                      │
│   Materials: ₦40,000 | Workmanship: ₦25,000                │
│   Status: "pending"                                          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Round 3: Customer Counters Again                            │
├─────────────────────────────────────────────────────────────┤
│ Customer → Vendor: ₦57,000 (countered)                      │
│   Materials: ₦35,000 | Workmanship: ₦22,000                │
│   Status: "pending"                                          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Round 4: Vendor Accepts                                     │
├─────────────────────────────────────────────────────────────┤
│ Vendor: ACCEPTED ✅                                          │
│   Status: "accepted"                                         │
│   📝 REVIEW UPDATED with ₦57,000                            │
│   ✅ materialTotalCost = ₦35,000                            │
│   ✅ workmanshipTotalCost = ₦22,000                         │
│   ✅ totalCost = ₦57,000                                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 📱 Flutter Implementation

### 1. Fetch All Offers
```dart
Future<List<Offer>> fetchOffers() async {
  final response = await http.get(
    Uri.parse('$baseUrl/makeOffer/getAllMakeOffers'),
    headers: {'Authorization': 'Bearer $token'},
  );

  if (response.statusCode == 200) {
    final data = json.decode(response.body);
    return (data['data'] as List)
        .map((offer) => Offer.fromJson(offer))
        .toList();
  }
  throw Exception('Failed to load offers');
}
```

### 2. Customer Creates Offer
```dart
Future<Offer> createOffer({
  required String reviewId,
  required double materialCost,
  required double workmanshipCost,
  String? comment,
}) async {
  final response = await http.post(
    Uri.parse('$baseUrl/makeOffer/createMakeOffer/$reviewId'),
    headers: {
      'Authorization': 'Bearer $token',
      'Content-Type': 'application/json',
    },
    body: json.encode({
      'materialTotalCost': materialCost,
      'workmanshipTotalCost': workmanshipCost,
      'comment': comment,
    }),
  );

  if (response.statusCode == 201) {
    final data = json.decode(response.body);
    return Offer.fromJson(data['data']);
  }
  throw Exception('Failed to create offer');
}
```

### 3. Respond to Offer (Accept/Reject/Counter)
```dart
Future<Offer> respondToOffer({
  required String offerId,
  required String action,  // "accepted", "rejected", or "countered"
  required bool isVendor,
  double? counterMaterialCost,
  double? counterWorkmanshipCost,
  String? comment,
}) async {
  final endpoint = isVendor
      ? '$baseUrl/makeOffer/vendorReplyOffer/$offerId'
      : '$baseUrl/makeOffer/buyerReplyToOffer/$offerId';

  final body = {
    'action': action,
    if (comment != null) 'comment': comment,
    if (action == 'countered' && counterMaterialCost != null)
      'counterMaterialCost': counterMaterialCost,
    if (action == 'countered' && counterWorkmanshipCost != null)
      'counterWorkmanshipCost': counterWorkmanshipCost,
  };

  final response = await http.post(
    Uri.parse(endpoint),
    headers: {
      'Authorization': 'Bearer $token',
      'Content-Type': 'application/json',
    },
    body: json.encode(body),
  );

  if (response.statusCode == 200) {
    final data = json.decode(response.body);
    return Offer.fromJson(data['data']);
  }
  throw Exception('Failed to respond to offer');
}
```

### 4. UI Example
```dart
// Accept Button
ElevatedButton(
  onPressed: () async {
    await respondToOffer(
      offerId: currentOffer.id,
      action: 'accepted',
      isVendor: userIsVendor,
      comment: 'Great! I accept',
    );
    // Review is now updated with accepted amounts
  },
  child: Text('Accept Offer'),
);

// Reject Button
ElevatedButton(
  onPressed: () async {
    await respondToOffer(
      offerId: currentOffer.id,
      action: 'rejected',
      isVendor: userIsVendor,
      comment: 'Sorry, not interested',
    );
  },
  child: Text('Reject'),
);

// Counter Button
ElevatedButton(
  onPressed: () {
    // Show dialog to enter new amounts
    showDialog(
      context: context,
      builder: (context) => CounterOfferDialog(
        onSubmit: (materialCost, workmanshipCost, comment) async {
          await respondToOffer(
            offerId: currentOffer.id,
            action: 'countered',
            isVendor: userIsVendor,
            counterMaterialCost: materialCost,
            counterWorkmanshipCost: workmanshipCost,
            comment: comment,
          );
        },
      ),
    );
  },
  child: Text('Make Counter Offer'),
);
```

---

## 🔍 Offer Status Meanings

| Status | Meaning | Next Step |
|--------|---------|-----------|
| `incoming` | New offer from customer | Vendor should respond |
| `pending` | Counter-offer made, waiting for response | Other party should respond |
| `accepted` | Offer accepted, negotiation complete ✅ | Proceed to payment |
| `rejected` | Offer rejected, negotiation ended ❌ | Create new offer or cancel |

---

## 📊 Chat History Structure

Each offer contains a `chats` array with the full negotiation history:

```json
{
  "_id": "offer123",
  "status": "accepted",
  "chats": [
    {
      "senderType": "customer",
      "action": "incoming",
      "counterMaterialCost": 30000,
      "counterWorkmanshipCost": 20000,
      "counterTotalCost": 50000,
      "comment": "Is this price okay?",
      "timestamp": "2025-12-30T10:00:00Z"
    },
    {
      "senderType": "vendor",
      "action": "countered",
      "counterMaterialCost": 40000,
      "counterWorkmanshipCost": 25000,
      "counterTotalCost": 65000,
      "comment": "I can do it for ₦65,000",
      "timestamp": "2025-12-30T10:15:00Z"
    },
    {
      "senderType": "customer",
      "action": "accepted",
      "counterMaterialCost": 40000,
      "counterWorkmanshipCost": 25000,
      "counterTotalCost": 65000,
      "comment": "Okay, I agree!",
      "timestamp": "2025-12-30T10:30:00Z"
    }
  ]
}
```

---

## ✅ Key Features

1. **Auto-Accept Latest Offer**: When accepting, system automatically uses the latest counter-offer amounts
2. **Review Auto-Update**: Accepted offers immediately update the review with final costs
3. **Chat History**: All negotiations preserved for reference
4. **Clear Status**: Simple status tracking (incoming → pending → accepted/rejected)
5. **Bilateral Negotiation**: Both parties can counter multiple times
6. **Type Safety**: Validates `senderType` (customer/vendor) and `action` (accepted/rejected/countered)

---

## 🐛 Troubleshooting

**Problem:** Review not updating after acceptance
**Solution:** ✅ Fixed! Both buyer and vendor acceptance now update the review

**Problem:** Wrong amounts in review
**Solution:** ✅ Fixed! System uses latest counter-offer amounts

**Problem:** Can't accept after multiple counters
**Solution:** ✅ Fixed! Acceptance works at any point in negotiation

---

**Status:** ✅ Complete and Production Ready
**Date:** December 30, 2025
