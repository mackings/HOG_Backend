# HOG Payment API Documentation - Review Payments
**Version:** 2.0
**Last Updated:** December 30, 2025
**Base URL:** `https://hogbackend.vercel.app`

---

## Overview

The HOG platform supports **both part payments and full payments** for tailor reviews/quotes using **Stripe (USD)** and **Paystack (NGN)** payment gateways.

### Key Features
- ✅ Multiple part payments allowed until full amount is paid
- ✅ Vendor receives credit immediately on each payment
- ✅ Platform commission only deducted on final full payment
- ✅ Automatic webhook processing for both gateways
- ✅ Real-time transaction tracking
- ✅ Email notifications for all parties

---

## Payment Flow Overview

```
1. User submits material to tailor
2. Tailor creates review/quote with costs
3. User chooses payment method (Stripe or Paystack)
4. User selects payment type (Part or Full)
5. API creates payment session
6. User completes payment on gateway
7. Webhook processes payment automatically
8. Review updated, vendor credited, emails sent
```

---

## Authentication

All payment endpoints require authentication via Bearer token:

```
Authorization: Bearer <user_access_token>
```

---

## API Endpoints

### 1️⃣ STRIPE PAYMENT (USD)

#### **Endpoint:** Create Stripe Payment
```
POST /api/v1/stripe/make-payment/{reviewId}
```

#### **Headers:**
```json
{
  "Authorization": "Bearer <token>",
  "Content-Type": "application/json"
}
```

#### **Request Body:**
```json
{
  "amount": 2500.00,
  "shipmentMethod": "express",
  "address": "123 Main Street, Lagos, Nigeria",
  "paymentStatus": "part payment"
}
```

#### **Request Parameters:**

| Field | Type | Required | Description | Values |
|-------|------|----------|-------------|--------|
| `amount` | Number | Yes | Amount user wants to pay (in USD) | Any positive number |
| `shipmentMethod` | String | Yes | Delivery method | `"express"`, `"cargo"`, `"regular"` |
| `address` | String | No | Delivery address (uses user's address if omitted) | Any valid address |
| `paymentStatus` | String | Yes | Type of payment | `"part payment"`, `"full payment"` |

#### **Response (Success 201):**
```json
{
  "success": true,
  "message": "Stripe checkout created successfully.",
  "data": {
    "order": {
      "_id": "67890abc12345",
      "userId": "user123",
      "vendorId": "vendor456",
      "reviewId": "review789",
      "totalAmount": 5000,
      "amountPaid": 2500,
      "paymentStatus": "part payment",
      "paymentReference": "a1b2c3d4e5f6",
      "paymentMethod": "Stripe"
    },
    "checkoutUrl": "https://checkout.stripe.com/c/pay/cs_test_..."
  }
}
```

#### **Response (Error 400):**
```json
{
  "success": false,
  "message": "Invalid review ID"
}
```

#### **Response (Error 404):**
```json
{
  "success": false,
  "message": "User not found"
}
```

#### **Flutter Implementation Example:**
```dart
Future<Map<String, dynamic>> createStripePayment({
  required String reviewId,
  required double amount,
  required String shipmentMethod, // "express", "cargo", "regular"
  required String paymentStatus,  // "part payment", "full payment"
  String? address,
}) async {
  final url = Uri.parse('$baseUrl/api/v1/stripe/make-payment/$reviewId');

  final response = await http.post(
    url,
    headers: {
      'Authorization': 'Bearer $accessToken',
      'Content-Type': 'application/json',
    },
    body: jsonEncode({
      'amount': amount,
      'shipmentMethod': shipmentMethod,
      'address': address,
      'paymentStatus': paymentStatus,
    }),
  );

  if (response.statusCode == 201) {
    final data = jsonDecode(response.body);
    // Redirect user to: data['data']['checkoutUrl']
    return data;
  } else {
    throw Exception('Payment initialization failed');
  }
}
```

---

### 2️⃣ PAYSTACK PAYMENT (NGN) - UNIFIED ENDPOINT

#### **Endpoint:** Create Paystack Payment (Part or Full)
```
POST /api/v1/material/createPaymentOnline/{reviewId}
```

#### **Headers:**
```json
{
  "Authorization": "Bearer <token>",
  "Content-Type": "application/json"
}
```

#### **Request Body:**
```json
{
  "amount": 150000,
  "shipmentMethod": "regular",
  "address": "15 Admiralty Way, Lekki, Lagos",
  "paymentStatus": "part payment"
}
```

#### **Request Parameters:**

| Field | Type | Required | Description | Values |
|-------|------|----------|-------------|--------|
| `amount` | Number | Yes | Amount user wants to pay (in NGN) | Any positive number |
| `shipmentMethod` | String | Yes | Delivery method | `"express"`, `"cargo"`, `"regular"` |
| `address` | String | No | Delivery address | Any valid address |
| `paymentStatus` | String | No | Type of payment (default: "full payment") | `"part payment"`, `"full payment"` |

#### **Response (Success 201):**
```json
{
  "success": true,
  "message": "Payment initialized successfully",
  "authorizationUrl": "https://checkout.paystack.com/abc123...",
  "payment": {
    "_id": "order123",
    "userId": "user456",
    "vendorId": "vendor789",
    "reviewId": "review101",
    "totalAmount": 500000,
    "amountPaid": 150000,
    "paymentStatus": "part payment",
    "paymentReference": "f6e5d4c3b2",
    "paymentMethod": "Paystack"
  }
}
```

#### **Response (Error 400):**
```json
{
  "success": false,
  "message": "Invalid review ID"
}
```

#### **Flutter Implementation Example:**
```dart
Future<Map<String, dynamic>> createPaystackPayment({
  required String reviewId,
  required double amount,
  required String shipmentMethod,
  required String paymentStatus,
  String? address,
}) async {
  final url = Uri.parse('$baseUrl/api/v1/material/createPaymentOnline/$reviewId');

  final response = await http.post(
    url,
    headers: {
      'Authorization': 'Bearer $accessToken',
      'Content-Type': 'application/json',
    },
    body: jsonEncode({
      'amount': amount,
      'shipmentMethod': shipmentMethod,
      'address': address,
      'paymentStatus': paymentStatus,
    }),
  );

  if (response.statusCode == 201) {
    final data = jsonDecode(response.body);
    // Redirect user to: data['authorizationUrl']
    return data;
  } else {
    throw Exception('Payment initialization failed');
  }
}
```

---

### 3️⃣ PAYSTACK PART PAYMENT - LEGACY ENDPOINT

> **Note:** This endpoint is maintained for backward compatibility but the unified endpoint above is recommended.

#### **Endpoint:** Create Paystack Part Payment
```
POST /api/v1/material/createPartPaymentOnline/{reviewId}
```

#### **Request Body:**
```json
{
  "amount": 150000
}
```

#### **Differences from Unified Endpoint:**
- ❌ No shipping cost calculation
- ❌ No address parameter
- ❌ Always sets `paymentStatus: "part payment"`
- ✅ Simpler for pure part payments without delivery

---

### 4️⃣ GET REVIEW DETAILS

To display payment information to users, fetch the review:

#### **Endpoint:** Get Review by ID
```
GET /api/v1/review/getReviewById/{reviewId}
```

#### **Response:**
```json
{
  "success": true,
  "review": {
    "_id": "review789",
    "userId": { /* user object */ },
    "vendorId": { /* vendor object */ },
    "materialId": { /* material object */ },
    "totalCost": 500000,
    "amountPaid": 150000,
    "amountToPay": 350000,
    "status": "part payment",
    "materialTotalCost": 200000,
    "workmanshipTotalCost": 250000,
    "tax": 25000,
    "commission": 25000,
    "deliveryDate": "2025-01-15T00:00:00.000Z"
  }
}
```

---

## Payment Status Flow

### Review Status Values:
- `"quote"` - Initial quote created by tailor
- `"pending"` - User reviewing quote
- `"approved"` - User approved quote
- `"part payment"` - User made partial payment(s)
- `"full payment"` - User paid full amount
- `"rejected"` - User rejected quote

### Amount Tracking:
- `totalCost` - Total amount for the order (never changes)
- `amountPaid` - Cumulative amount user has paid
- `amountToPay` - Remaining amount to pay (`totalCost - amountPaid`)

---

## Payment Calculation Examples

### Example 1: Single Full Payment
```
Review Total Cost: ₦500,000

Payment:
- Amount: ₦500,000
- Payment Status: "full payment"

Result:
- amountPaid: ₦500,000
- amountToPay: ₦0
- status: "full payment"
- Vendor receives: ₦500,000
- Platform commission: CREDITED
```

### Example 2: Multiple Part Payments
```
Review Total Cost: ₦500,000

Payment 1:
- Amount: ₦150,000
- Payment Status: "part payment"
Result:
- amountPaid: ₦150,000
- amountToPay: ₦350,000
- status: "part payment"

Payment 2:
- Amount: ₦200,000
- Payment Status: "part payment"
Result:
- amountPaid: ₦350,000
- amountToPay: ₦150,000
- status: "part payment"

Payment 3:
- Amount: ₦150,000
- Payment Status: "full payment"
Result:
- amountPaid: ₦500,000
- amountToPay: ₦0
- status: "full payment"
- Platform commission: CREDITED
```

---

## Flutter UI Implementation Guide

### 1. Display Review Payment Information

```dart
class ReviewPaymentCard extends StatelessWidget {
  final Review review;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Column(
        children: [
          Text('Total Cost: ${review.totalCost.toStringAsFixed(2)}'),
          Text('Amount Paid: ${review.amountPaid.toStringAsFixed(2)}'),
          Text('Amount To Pay: ${review.amountToPay.toStringAsFixed(2)}'),

          LinearProgressIndicator(
            value: review.amountPaid / review.totalCost,
          ),

          Text('Payment Status: ${review.status}'),
        ],
      ),
    );
  }
}
```

### 2. Payment Amount Input

```dart
class PaymentAmountSelector extends StatefulWidget {
  final Review review;

  @override
  _PaymentAmountSelectorState createState() => _PaymentAmountSelectorState();
}

class _PaymentAmountSelectorState extends State<PaymentAmountSelector> {
  bool isFullPayment = false;
  double customAmount = 0;

  @override
  Widget build(BuildContext context) {
    final remainingAmount = widget.review.amountToPay;

    return Column(
      children: [
        // Full Payment Option
        RadioListTile(
          title: Text('Pay Full Amount (₦${remainingAmount.toStringAsFixed(2)})'),
          value: true,
          groupValue: isFullPayment,
          onChanged: (value) {
            setState(() {
              isFullPayment = true;
              customAmount = remainingAmount;
            });
          },
        ),

        // Part Payment Option
        RadioListTile(
          title: Text('Pay Custom Amount'),
          value: false,
          groupValue: isFullPayment,
          onChanged: (value) {
            setState(() {
              isFullPayment = false;
            });
          },
        ),

        // Custom Amount Input (only show if part payment)
        if (!isFullPayment)
          TextField(
            keyboardType: TextInputType.number,
            decoration: InputDecoration(
              labelText: 'Enter amount',
              hintText: 'Max: ₦${remainingAmount.toStringAsFixed(2)}',
            ),
            onChanged: (value) {
              customAmount = double.tryParse(value) ?? 0;
            },
          ),

        // Payment Button
        ElevatedButton(
          onPressed: () => _initiatePayment(),
          child: Text('Continue to Payment'),
        ),
      ],
    );
  }

  void _initiatePayment() async {
    final paymentStatus = isFullPayment ? 'full payment' : 'part payment';
    final amount = isFullPayment ? widget.review.amountToPay : customAmount;

    // Validate
    if (amount <= 0) {
      // Show error
      return;
    }

    if (amount > widget.review.amountToPay) {
      // Show error: amount exceeds remaining
      return;
    }

    // Call payment API
    try {
      final result = await createPaystackPayment(
        reviewId: widget.review.id,
        amount: amount,
        shipmentMethod: 'regular', // Let user select
        paymentStatus: paymentStatus,
      );

      // Redirect to authorization URL
      _launchURL(result['authorizationUrl']);
    } catch (e) {
      // Handle error
    }
  }

  void _launchURL(String url) async {
    // Use url_launcher or webview
  }
}
```

### 3. Payment Gateway Selection

```dart
class PaymentGatewaySelector extends StatelessWidget {
  final Review review;

  @override
  Widget build(BuildContext context) {
    final user = context.read<UserProvider>().user;

    return Column(
      children: [
        // Show Paystack for Nigerian users
        if (user.country.toLowerCase() == 'nigeria')
          ListTile(
            leading: Icon(Icons.payment),
            title: Text('Pay with Paystack (NGN)'),
            subtitle: Text('Local payment method'),
            onTap: () => _navigateToPaystackPayment(),
          ),

        // Show Stripe for international users
        ListTile(
          leading: Icon(Icons.credit_card),
          title: Text('Pay with Stripe (USD)'),
          subtitle: Text('International payment'),
          onTap: () => _navigateToStripePayment(),
        ),
      ],
    );
  }
}
```

---

## Webhook Processing (Automatic)

After payment completion, webhooks automatically:

### Stripe Webhook:
- Endpoint: `POST /api/v1/stripe/webhook`
- Event: `checkout.session.completed`
- No action needed from Flutter app

### Paystack Webhook:
- Endpoint: `POST /api/v1/material/orderWebhook`
- Event: `charge.success`
- No action needed from Flutter app

### What Happens Automatically:
1. ✅ Transaction record created
2. ✅ Review updated (`amountPaid`, `amountToPay`, `status`)
3. ✅ Vendor wallet credited
4. ✅ Platform commission credited (on full payment)
5. ✅ Email notifications sent
6. ✅ Stripe transfer to vendor (if connected)

---

## Payment Success Handling

After user completes payment on gateway, they're redirected to:
```
https://hog-fashion.vercel.app/payment-success
```

### In Your Flutter App:
```dart
// Listen for deep link or check payment status
void checkPaymentStatus(String reviewId) async {
  final review = await fetchReviewById(reviewId);

  if (review.status == 'full payment' || review.status == 'part payment') {
    // Payment successful
    showSuccessDialog(review);
  } else {
    // Payment pending or failed
    showErrorDialog();
  }
}
```

---

## Error Handling

### Common Errors:

| Status Code | Error Message | Cause | Solution |
|-------------|---------------|-------|----------|
| 400 | "Invalid review ID" | Review ID format wrong | Validate ObjectId format |
| 400 | "shipmentMethod is required" | Missing shipment method | Include in request |
| 400 | "Invalid shipment method" | Wrong method value | Use: express/cargo/regular |
| 404 | "User not found" | Invalid auth token | Re-authenticate user |
| 404 | "Review not found" | Review doesn't exist | Verify review ID |
| 404 | "Material not found" | Material deleted | Refresh data |
| 400 | "Invalid deliveryAddress provided" | Geocoding failed | Use valid address |

### Flutter Error Handling:
```dart
try {
  final result = await createStripePayment(...);
  // Success
} on HttpException catch (e) {
  if (e.statusCode == 404) {
    showDialog('Review not found');
  } else if (e.statusCode == 400) {
    showDialog('Invalid request: ${e.message}');
  }
} catch (e) {
  showDialog('Network error');
}
```

---

## Testing Checklist

### Part Payment Testing:
- [ ] Make first part payment of 30% of total
- [ ] Verify `amountPaid` increases correctly
- [ ] Verify `amountToPay` decreases correctly
- [ ] Verify status changes to "part payment"
- [ ] Make second part payment of 40% of total
- [ ] Verify cumulative `amountPaid` is 70%
- [ ] Verify `amountToPay` is 30%
- [ ] Make final payment with `paymentStatus: "full payment"`
- [ ] Verify `amountToPay` becomes 0
- [ ] Verify status changes to "full payment"

### Full Payment Testing:
- [ ] Select full payment option
- [ ] Verify amount equals `review.amountToPay`
- [ ] Complete payment
- [ ] Verify `amountPaid` equals `totalCost`
- [ ] Verify `amountToPay` is 0
- [ ] Verify status is "full payment"

### Multi-Gateway Testing:
- [ ] Test Stripe payment flow
- [ ] Test Paystack payment flow
- [ ] Verify both update review correctly
- [ ] Verify both send notifications

---

## Migration Notes for Existing Flutter Code

### What Changed:
1. **`createPaymentOnline` now accepts `paymentStatus` parameter**
   - Add `paymentStatus` field to request body
   - Default is "full payment" if omitted

2. **`amountToPay` calculation is now accurate**
   - Previously could show wrong values on multiple payments
   - Now correctly tracks remaining amount

3. **Platform commission timing changed**
   - Previously credited on every payment
   - Now only credited on final "full payment"

### Required Flutter Updates:

#### Before:
```dart
// Old code (still works but not recommended)
await createPaymentOnline(
  reviewId: reviewId,
  amount: amount,
  shipmentMethod: method,
);
```

#### After:
```dart
// New code (recommended)
await createPaymentOnline(
  reviewId: reviewId,
  amount: amount,
  shipmentMethod: method,
  paymentStatus: isFullPayment ? 'full payment' : 'part payment',
);
```

---

## Support

For issues or questions:
- Backend Repository: `https://github.com/Arosebine/hog`
- API Base URL: `https://hogbackend.vercel.app`
- Contact: Backend Team

---

**Generated:** December 30, 2025
**Backend Version:** 2.0
**Compatible with:** Flutter 3.x
