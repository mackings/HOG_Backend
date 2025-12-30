# ✅ Delivery Rates Setup Complete

## Summary

Your HOG backend has been successfully configured with **3 delivery rate types**!

---

## 📊 Delivery Rates

| Delivery Type | Base Cost | Speed | Best For |
|---------------|-----------|-------|----------|
| 🚚 **Regular** | ₦1,000 | Standard (3-5 days) | Normal orders, cost-effective |
| ⚡ **Express** | ₦2,500 | Fast (1-2 days) | Urgent deliveries, premium service |
| 📦 **Cargo** | ₦1,500 | Standard (3-5 days) | Heavy/bulk items |

---

## 💰 Cost Calculation Formula

```
Total Cost = (Base Cost + Weight + Volume + (Distance × 10)) × Number of Packages
```

### Breakdown:
- **Base Cost**: The amount from delivery rate (₦1,000, ₦1,500, or ₦2,500)
- **Weight Multiplier**: ₦5 (fixed)
- **Volume Multiplier**: ₦5 (fixed)
- **Distance Multiplier**: ₦10 per kilometer
- **Number of Packages**: Quantity of items (default: 1)

### Examples (10km distance):

```javascript
// Regular Delivery (10km)
Cost = (₦1,000 + ₦5 + ₦5 + (10km × ₦10)) × 1
Cost = (₦1,000 + ₦5 + ₦5 + ₦100) × 1
Cost = ₦1,110

// Express Delivery (10km)
Cost = (₦2,500 + ₦5 + ₦5 + (10km × ₦10)) × 1
Cost = (₦2,500 + ₦5 + ₦5 + ₦100) × 1
Cost = ₦2,610

// Cargo Delivery (10km)
Cost = (₦1,500 + ₦5 + ₦5 + (10km × ₦10)) × 1
Cost = (₦1,500 + ₦5 + ₦5 + ₦100) × 1
Cost = ₦1,610
```

### Examples (50km distance):

```javascript
// Regular: ₦1,000 + ₦5 + ₦5 + (50 × ₦10) = ₦1,510
// Express: ₦2,500 + ₦5 + ₦5 + (50 × ₦10) = ₦3,010
// Cargo:   ₦1,500 + ₦5 + ₦5 + (50 × ₦10) = ₦2,010
```

---

## 🚀 API Endpoints

### Get All Delivery Rates
```http
GET /api/v1/deliveryRate/getDeliveryRates
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "message": "Delivery rates retrieved successfully",
  "deliveryRates": [
    {
      "_id": "6953efcb7c1379090effbe41",
      "deliveryType": "Regular",
      "amount": 1000,
      "createdAt": "2025-12-30T...",
      "updatedAt": "2025-12-30T..."
    },
    {
      "_id": "6953efcb7c1379090effbe42",
      "deliveryType": "Express",
      "amount": 2500,
      "createdAt": "2025-12-30T...",
      "updatedAt": "2025-12-30T..."
    },
    {
      "_id": "6953efcb7c1379090effbe43",
      "deliveryType": "Cargo",
      "amount": 1500,
      "createdAt": "2025-12-30T...",
      "updatedAt": "2025-12-30T..."
    }
  ]
}
```

### Calculate Delivery Cost
```http
POST /api/v1/deliveryRate/deliveryCost/:reviewId
Authorization: Bearer {token}
Content-Type: application/json

{
  "shipmentMethod": "Regular",  // or "Express" or "Cargo"
  "address": "123 Main Street, Lagos, Nigeria"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Delivery cost calculated successfully",
  "cost": 1110
}
```

---

## 📱 Flutter App Integration

### 1. Fetch Delivery Rates
```dart
Future<List<DeliveryRate>> fetchDeliveryRates() async {
  final response = await http.get(
    Uri.parse('$baseUrl/deliveryRate/getDeliveryRates'),
    headers: {'Authorization': 'Bearer $token'},
  );

  if (response.statusCode == 200) {
    final data = json.decode(response.body);
    return (data['deliveryRates'] as List)
        .map((rate) => DeliveryRate.fromJson(rate))
        .toList();
  }
  throw Exception('Failed to load delivery rates');
}
```

### 2. Display to User
```dart
// Show delivery options
List<DeliveryRate> rates = await fetchDeliveryRates();

// rates = [
//   {type: "Regular", amount: 1000, ...},
//   {type: "Express", amount: 2500, ...},
//   {type: "Cargo", amount: 1500, ...}
// ]
```

### 3. Calculate Delivery Cost
```dart
Future<int> calculateDeliveryCost({
  required String reviewId,
  required String shipmentMethod,  // "Regular", "Express", or "Cargo"
  required String address,
}) async {
  final response = await http.post(
    Uri.parse('$baseUrl/deliveryRate/deliveryCost/$reviewId'),
    headers: {
      'Authorization': 'Bearer $token',
      'Content-Type': 'application/json',
    },
    body: json.encode({
      'shipmentMethod': shipmentMethod,
      'address': address,
    }),
  );

  if (response.statusCode == 200) {
    final data = json.decode(response.body);
    return data['cost'];
  }
  throw Exception('Failed to calculate cost');
}
```

---

## 🔧 Management Commands

### Seed/Replace Delivery Rates
```bash
npm run seed:delivery
```

### Update Existing Rates (without deleting)
```bash
npm run seed:delivery:update
```

---

## 🎯 Delivery Rate IDs

```javascript
const DELIVERY_RATES = {
  REGULAR: "6953efcb7c1379090effbe41",
  EXPRESS: "6953efcb7c1379090effbe42",
  CARGO: "6953efcb7c1379090effbe43"
};
```

---

## 📝 Admin Operations

### Create New Delivery Rate (Admin)
```http
POST /api/v1/deliveryRate/createDeliveryRate
Authorization: Bearer {admin_token}

{
  "deliveryType": "Premium",
  "amount": 5000
}
```

### Update Delivery Rate (Admin)
```http
PUT /api/v1/deliveryRate/updateDeliveryRate/:id
Authorization: Bearer {admin_token}

{
  "amount": 1200
}
```

### Delete Delivery Rate (Admin)
```http
DELETE /api/v1/deliveryRate/deleteDeliveryRate/:id
Authorization: Bearer {admin_token}
```

---

## 💡 Customization

To adjust delivery rates, edit `seedDeliveryRates.js`:

```javascript
const deliveryRates = [
  {
    deliveryType: "Regular",
    amount: 1000,  // ← Change this
  },
  {
    deliveryType: "Express",
    amount: 2500,  // ← Change this
  },
  {
    deliveryType: "Cargo",
    amount: 1500,  // ← Change this
  }
];
```

Then run: `npm run seed:delivery:update`

---

## 🔍 Cost Calculation Location

The delivery cost calculation logic is in:
- **File:** `src/utils/shipmentCalcu.distance.js`
- **Functions:** `regularCalculateCost()`, `expressCalculateCost()`, `cargoCalculateCost()`

To modify the calculation formula, edit these functions.

---

## ✅ Status

- ✅ 3 delivery rate types seeded
- ✅ Regular: ₦1,000 base cost
- ✅ Express: ₦2,500 base cost
- ✅ Cargo: ₦1,500 base cost
- ✅ API endpoints working
- ✅ Cost calculation functional

**Date:** December 30, 2025
**Status:** Production Ready
