# Payment API Quick Reference

## 🚀 Quick Start

### Stripe Payment (USD)
```dart
POST /api/v1/stripe/make-payment/{reviewId}
Body: {
  "amount": 2500.00,
  "shipmentMethod": "express",
  "paymentStatus": "part payment"
}
```

### Paystack Payment (NGN)
```dart
POST /api/v1/material/createPaymentOnline/{reviewId}
Body: {
  "amount": 150000,
  "shipmentMethod": "regular",
  "paymentStatus": "part payment"
}
```

---

## 📊 Payment Status Values

| Status | Description |
|--------|-------------|
| `quote` | Tailor created quote |
| `pending` | User reviewing |
| `approved` | User approved quote |
| `part payment` | Partial payment made |
| `full payment` | Fully paid |
| `rejected` | User rejected |

---

## 💰 Amount Tracking

```dart
totalCost = 500000      // Total cost (fixed)
amountPaid = 150000     // Amount user has paid
amountToPay = 350000    // Remaining (totalCost - amountPaid)
```

---

## 🔄 Payment Flow

```
1. Fetch Review → Get totalCost, amountPaid, amountToPay
2. User selects amount & payment type
3. Call payment API → Get checkoutUrl
4. Redirect to gateway
5. Webhook processes payment (automatic)
6. User redirected to success page
7. Refresh review to see updated amounts
```

---

## ✅ Validation Rules

```dart
// Part Payment
amount > 0
amount <= review.amountToPay
paymentStatus = "part payment"

// Full Payment
amount = review.amountToPay
paymentStatus = "full payment"
```

---

## 🎯 Flutter Code Snippets

### Create Payment
```dart
Future<String> initiatePayment({
  required String reviewId,
  required double amount,
  required String gateway, // "stripe" or "paystack"
  required bool isFullPayment,
}) async {
  final endpoint = gateway == 'stripe'
      ? '/api/v1/stripe/make-payment/$reviewId'
      : '/api/v1/material/createPaymentOnline/$reviewId';

  final response = await http.post(
    Uri.parse('$baseUrl$endpoint'),
    headers: {
      'Authorization': 'Bearer $token',
      'Content-Type': 'application/json',
    },
    body: jsonEncode({
      'amount': amount,
      'shipmentMethod': 'regular',
      'paymentStatus': isFullPayment ? 'full payment' : 'part payment',
    }),
  );

  final data = jsonDecode(response.body);
  return gateway == 'stripe'
      ? data['data']['checkoutUrl']
      : data['authorizationUrl'];
}
```

### Payment Button
```dart
ElevatedButton(
  onPressed: () async {
    final url = await initiatePayment(
      reviewId: review.id,
      amount: selectedAmount,
      gateway: 'paystack',
      isFullPayment: selectedAmount == review.amountToPay,
    );

    // Launch URL in browser/webview
    await launchUrl(Uri.parse(url));
  },
  child: Text('Pay Now'),
)
```

### Display Payment Progress
```dart
Column(
  children: [
    Text('Total: ₦${review.totalCost}'),
    Text('Paid: ₦${review.amountPaid}'),
    Text('Remaining: ₦${review.amountToPay}'),

    LinearProgressIndicator(
      value: review.amountPaid / review.totalCost,
    ),

    Chip(
      label: Text(review.status),
      backgroundColor: review.status == 'full payment'
          ? Colors.green
          : Colors.orange,
    ),
  ],
)
```

---

## 🐛 Common Errors

| Error | Fix |
|-------|-----|
| "Invalid review ID" | Check ID format is valid MongoDB ObjectId |
| "shipmentMethod is required" | Add shipmentMethod to request body |
| "User not found" | Check auth token is valid |
| "Amount exceeds remaining" | Validate: `amount <= review.amountToPay` |

---

## 📝 Testing Scenarios

### Scenario 1: Full Payment in One Go
```
Total: ₦500,000
Payment 1: ₦500,000 (full payment)
Result: amountPaid=500k, amountToPay=0, status="full payment"
```

### Scenario 2: Three Part Payments
```
Total: ₦500,000
Payment 1: ₦150,000 (part payment)
  → amountPaid=150k, amountToPay=350k
Payment 2: ₦200,000 (part payment)
  → amountPaid=350k, amountToPay=150k
Payment 3: ₦150,000 (full payment)
  → amountPaid=500k, amountToPay=0, status="full payment"
```

---

## 🔗 Related Endpoints

```dart
// Get review details
GET /api/v1/review/getReviewById/{reviewId}

// Get user transactions
GET /api/v1/transaction/getUserTransactions

// Verify payment (debug)
GET /api/v1/stripe/verify-payment/{paymentReference}
```

---

## 📱 Complete Flutter Example

```dart
class PaymentScreen extends StatefulWidget {
  final Review review;

  @override
  _PaymentScreenState createState() => _PaymentScreenState();
}

class _PaymentScreenState extends State<PaymentScreen> {
  bool isFullPayment = true;
  double customAmount = 0;
  String selectedGateway = 'paystack';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Payment')),
      body: Column(
        children: [
          // Payment Info
          Card(
            child: Column(
              children: [
                Text('Total: ₦${widget.review.totalCost}'),
                Text('Paid: ₦${widget.review.amountPaid}'),
                Text('Balance: ₦${widget.review.amountToPay}'),
              ],
            ),
          ),

          // Gateway Selection
          DropdownButton<String>(
            value: selectedGateway,
            items: [
              DropdownMenuItem(value: 'paystack', child: Text('Paystack (NGN)')),
              DropdownMenuItem(value: 'stripe', child: Text('Stripe (USD)')),
            ],
            onChanged: (value) => setState(() => selectedGateway = value!),
          ),

          // Payment Type
          RadioListTile(
            title: Text('Full Payment (₦${widget.review.amountToPay})'),
            value: true,
            groupValue: isFullPayment,
            onChanged: (value) => setState(() {
              isFullPayment = true;
              customAmount = widget.review.amountToPay;
            }),
          ),

          RadioListTile(
            title: Text('Part Payment'),
            value: false,
            groupValue: isFullPayment,
            onChanged: (value) => setState(() => isFullPayment = false),
          ),

          if (!isFullPayment)
            TextField(
              keyboardType: TextInputType.number,
              decoration: InputDecoration(labelText: 'Amount'),
              onChanged: (v) => customAmount = double.tryParse(v) ?? 0,
            ),

          // Pay Button
          ElevatedButton(
            onPressed: _processPayment,
            child: Text('Pay ₦${isFullPayment ? widget.review.amountToPay : customAmount}'),
          ),
        ],
      ),
    );
  }

  void _processPayment() async {
    final amount = isFullPayment ? widget.review.amountToPay : customAmount;

    if (amount <= 0 || amount > widget.review.amountToPay) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Invalid amount')),
      );
      return;
    }

    try {
      final url = await initiatePayment(
        reviewId: widget.review.id,
        amount: amount,
        gateway: selectedGateway,
        isFullPayment: isFullPayment,
      );

      await launchUrl(Uri.parse(url));
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Payment failed: $e')),
      );
    }
  }
}
```

---

**Last Updated:** December 30, 2025
