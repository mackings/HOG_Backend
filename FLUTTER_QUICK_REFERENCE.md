# Flutter Quick Reference - Offer Negotiation System

## 🚀 Quick Start for Flutter Developers

### Key Concept
**Both buyer and vendor must consent before payment can proceed.**

---

## 📊 The 3 Key Boolean Fields

```dart
class MakeOffer {
  bool buyerConsent;        // Has buyer agreed?
  bool vendorConsent;       // Has vendor agreed?
  bool mutualConsentAchieved; // Can payment proceed?
}
```

### Rule:
```dart
mutualConsentAchieved = buyerConsent && vendorConsent
```

---

## 🎯 Payment Button Logic (Copy-Paste Ready)

```dart
bool canMakePayment(Review review, MakeOffer? offer) {
  // No negotiation? Always allow payment
  if (offer == null || !review.hasAcceptedOffer) {
    return true;
  }

  // Has negotiation? Require mutual consent
  return offer.mutualConsentAchieved == true;
}

// Usage in Widget:
ElevatedButton(
  onPressed: canMakePayment(review, offer)
    ? () => navigateToPayment()
    : null,
  child: Text(
    canMakePayment(review, offer)
      ? 'Pay Now'
      : 'Waiting for Agreement'
  ),
)
```

---

## 💬 Chat Message Display

```dart
Widget buildChatMessage(ChatMessage chat) {
  final isCustomer = chat.senderType == 'customer';

  return Align(
    alignment: isCustomer ? Alignment.centerRight : Alignment.centerLeft,
    child: Container(
      color: isCustomer ? Colors.blue : Colors.grey[200],
      child: Column(
        children: [
          // Action Badge
          _buildActionBadge(chat.action),

          // Amount (if counter or incoming)
          if (chat.action == 'countered' || chat.action == 'incoming')
            Text('₦${formatMoney(chat.counterTotalCost)}'),

          // Comment
          if (chat.comment != null)
            Text(chat.comment),

          // Timestamp
          Text(formatTime(chat.timestamp)),
        ],
      ),
    ),
  );
}
```

---

## 🎨 Status Badges

```dart
Widget buildStatusBadge(MakeOffer offer) {
  if (offer.mutualConsentAchieved) {
    return Badge(
      label: 'Ready for Payment ✓',
      color: Colors.green,
    );
  }

  if (offer.status == 'accepted' && !offer.mutualConsentAchieved) {
    return Badge(
      label: 'Waiting for Confirmation',
      color: Colors.orange,
    );
  }

  if (offer.status == 'rejected') {
    return Badge(
      label: 'Rejected',
      color: Colors.red,
    );
  }

  if (offer.status == 'incoming') {
    return Badge(
      label: 'New Offer',
      color: Colors.blue,
    );
  }

  return Badge(
    label: 'Negotiating',
    color: Colors.yellow,
  );
}
```

---

## ✓ Consent Checkmarks

```dart
Widget buildConsentIndicators(MakeOffer offer) {
  return Row(
    children: [
      // Buyer consent
      if (offer.buyerConsent)
        Icon(Icons.check_circle, color: Colors.green),
      Text('Buyer'),

      SizedBox(width: 20),

      // Vendor consent
      if (offer.vendorConsent)
        Icon(Icons.check_circle, color: Colors.green),
      Text('Vendor'),
    ],
  );
}
```

---

## 🔘 Action Buttons

### For Buyer:
```dart
Widget buildBuyerActions(MakeOffer offer) {
  // Show if vendor sent last message OR vendor accepted waiting for buyer
  final canRespond =
    offer.chats.last.senderType == 'vendor' ||
    (offer.vendorConsent && !offer.buyerConsent);

  if (!canRespond) return SizedBox();

  return Row(
    children: [
      ElevatedButton(
        onPressed: () => acceptOffer(offer.id),
        style: ButtonStyle(backgroundColor: Colors.green),
        child: Text('Accept'),
      ),
      ElevatedButton(
        onPressed: () => rejectOffer(offer.id),
        style: ButtonStyle(backgroundColor: Colors.red),
        child: Text('Reject'),
      ),
      ElevatedButton(
        onPressed: () => showCounterDialog(offer.id),
        style: ButtonStyle(backgroundColor: Colors.blue),
        child: Text('Counter'),
      ),
    ],
  );
}
```

### For Vendor:
```dart
Widget buildVendorActions(MakeOffer offer) {
  // Show if customer sent last message
  final canRespond = offer.chats.last.senderType == 'customer';

  if (!canRespond) return SizedBox();

  return Row(
    children: [
      ElevatedButton(
        onPressed: () => acceptOffer(offer.id),
        style: ButtonStyle(backgroundColor: Colors.green),
        child: Text('Accept Offer'),
      ),
      ElevatedButton(
        onPressed: () => rejectOffer(offer.id),
        style: ButtonStyle(backgroundColor: Colors.red),
        child: Text('Decline'),
      ),
      ElevatedButton(
        onPressed: () => showCounterDialog(offer.id),
        style: ButtonStyle(backgroundColor: Colors.blue),
        child: Text('Send Counter'),
      ),
    ],
  );
}
```

---

## 🎉 Mutual Consent Banner

```dart
Widget buildMutualConsentBanner(MakeOffer offer) {
  if (!offer.mutualConsentAchieved) return SizedBox();

  return Container(
    color: Colors.green,
    padding: EdgeInsets.all(16),
    child: Column(
      children: [
        Icon(Icons.celebration, color: Colors.white, size: 48),
        Text(
          'Both parties agreed!',
          style: TextStyle(color: Colors.white, fontSize: 20),
        ),
        Text(
          'Final amount: ₦${formatMoney(offer.finalTotalCost)}',
          style: TextStyle(color: Colors.white, fontSize: 16),
        ),
        SizedBox(height: 16),
        ElevatedButton(
          onPressed: () => navigateToPayment(),
          child: Text('Proceed to Payment'),
        ),
      ],
    ),
  );
}
```

---

## 📡 API Calls

### Accept Offer (Buyer)
```dart
Future<void> acceptOffer(String offerId) async {
  final response = await http.post(
    Uri.parse('$baseUrl/api/v1/makeOffer/buyerReplyToOffer/$offerId'),
    headers: {
      'Authorization': 'Bearer $token',
      'Content-Type': 'application/json',
    },
    body: jsonEncode({
      'action': 'accepted',
      'comment': 'I agree to this price!',
    }),
  );

  final data = jsonDecode(response.body);

  if (data['mutualConsentAchieved'] == true) {
    showSnackbar('Both parties agreed! You can now pay.');
  } else {
    showSnackbar('Waiting for vendor to confirm.');
  }
}
```

### Accept Offer (Vendor)
```dart
Future<void> acceptOffer(String offerId) async {
  final response = await http.post(
    Uri.parse('$baseUrl/api/v1/makeOffer/vendorReplyOffer/$offerId'),
    headers: {
      'Authorization': 'Bearer $token',
      'Content-Type': 'application/json',
    },
    body: jsonEncode({
      'action': 'accepted',
      'comment': 'Deal! Let\'s proceed.',
    }),
  );

  final data = jsonDecode(response.body);

  if (data['mutualConsentAchieved'] == true) {
    showSnackbar('Both parties agreed! Payment can proceed.');
  } else {
    showSnackbar('Waiting for buyer to confirm.');
  }
}
```

### Counter Offer
```dart
Future<void> sendCounterOffer(String offerId, double material, double workmanship) async {
  final response = await http.post(
    Uri.parse('$baseUrl/api/v1/makeOffer/buyerReplyToOffer/$offerId'),
    headers: {
      'Authorization': 'Bearer $token',
      'Content-Type': 'application/json',
    },
    body: jsonEncode({
      'action': 'countered',
      'counterMaterialCost': material,
      'counterWorkmanshipCost': workmanship,
      'comment': 'How about this price?',
    }),
  );

  showSnackbar('Counter offer sent!');
}
```

---

## 🚨 Handle Payment Error

```dart
Future<void> attemptPayment(String reviewId) async {
  try {
    final response = await http.post(
      Uri.parse('$baseUrl/api/v1/stripe/make-payment/$reviewId'),
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({
        'paymentStatus': 'full payment',
        'shipmentMethod': 'Regular',
      }),
    );

    final data = jsonDecode(response.body);

    if (data['requiresMutualConsent'] == true) {
      // Payment blocked - show consent status
      showDialog(
        context: context,
        builder: (ctx) => AlertDialog(
          title: Text('Agreement Required'),
          content: Column(
            children: [
              Text(data['message']),
              SizedBox(height: 16),
              Text('Buyer: ${data['buyerConsent'] ? '✓' : '✗'}'),
              Text('Vendor: ${data['vendorConsent'] ? '✓' : '✗'}'),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: Text('OK'),
            ),
          ],
        ),
      );
    }
  } catch (e) {
    showSnackbar('Payment failed: $e');
  }
}
```

---

## 📋 Data Model (Copy-Paste)

```dart
class MakeOffer {
  String id;
  String userId;
  String vendorId;
  String materialId;
  String reviewId;
  String status;

  // NEW FIELDS - IMPORTANT!
  bool buyerConsent;
  bool vendorConsent;
  bool mutualConsentAchieved;
  double finalMaterialCost;
  double finalWorkmanshipCost;
  double finalTotalCost;

  List<ChatMessage> chats;
  DateTime createdAt;
  DateTime updatedAt;

  MakeOffer.fromJson(Map<String, dynamic> json)
    : id = json['_id'],
      userId = json['userId'],
      vendorId = json['vendorId'],
      materialId = json['materialId'],
      reviewId = json['reviewId'],
      status = json['status'],
      buyerConsent = json['buyerConsent'] ?? false,
      vendorConsent = json['vendorConsent'] ?? false,
      mutualConsentAchieved = json['mutualConsentAchieved'] ?? false,
      finalMaterialCost = (json['finalMaterialCost'] ?? 0).toDouble(),
      finalWorkmanshipCost = (json['finalWorkmanshipCost'] ?? 0).toDouble(),
      finalTotalCost = (json['finalTotalCost'] ?? 0).toDouble(),
      chats = (json['chats'] as List)
          .map((e) => ChatMessage.fromJson(e))
          .toList(),
      createdAt = DateTime.parse(json['createdAt']),
      updatedAt = DateTime.parse(json['updatedAt']);
}

class ChatMessage {
  String senderType; // 'customer' or 'vendor'
  String action; // 'accepted', 'rejected', 'countered', 'incoming'
  double counterMaterialCost;
  double counterWorkmanshipCost;
  double counterTotalCost;
  String? comment;
  DateTime timestamp;

  ChatMessage.fromJson(Map<String, dynamic> json)
    : senderType = json['senderType'],
      action = json['action'],
      counterMaterialCost = (json['counterMaterialCost'] ?? 0).toDouble(),
      counterWorkmanshipCost = (json['counterWorkmanshipCost'] ?? 0).toDouble(),
      counterTotalCost = (json['counterTotalCost'] ?? 0).toDouble(),
      comment = json['comment'],
      timestamp = DateTime.parse(json['timestamp']);
}
```

---

## ✅ Testing Checklist

- [ ] Buyer can create offer
- [ ] Vendor can accept/reject/counter
- [ ] Buyer can accept/reject/counter
- [ ] Consent checkmarks display correctly
- [ ] Mutual consent banner shows when both agree
- [ ] Payment button disabled without mutual consent
- [ ] Payment button enabled with mutual consent
- [ ] Payment works without negotiation
- [ ] Chat messages display in correct order
- [ ] Status badges show correctly
- [ ] Error message shows when payment blocked

---

## 🆘 Common Issues

### Payment button always disabled?
**Check:** Is `mutualConsentAchieved` actually `true`? Both buyer AND vendor must accept.

### Consent checkmarks not showing?
**Check:** Are you reading `buyerConsent` and `vendorConsent` from the API response?

### Counter offer not working?
**Check:** Are you sending `action: 'countered'` with `counterMaterialCost` and `counterWorkmanshipCost`?

### Chat messages out of order?
**Check:** Sort by `timestamp` in ascending order.

---

## 📞 Need Help?

1. Check the full documentation: `OFFER_NEGOTIATION_DOCUMENTATION.json`
2. Review model structure: `OFFER_MODEL_STRUCTURE.json`
3. See test scenarios: `OFFER_SYSTEM_TEST_SUMMARY.md`

---

**Remember: The KEY is `mutualConsentAchieved` - it controls payment!**

✨ Happy Coding! ✨
