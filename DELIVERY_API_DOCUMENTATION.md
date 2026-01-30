# Delivery API Documentation
**Version:** 1.0  
**Last Updated:** January 30, 2026  
**Base URL:** `/api/v1/deliveryRate`

---

## 1) Get All Delivery Rates
**GET** `/getDeliveryRates`

Returns all delivery plans and their fees.

### Response (200)
```json
{
  "success": true,
  "message": "Delivery rates retrieved successfully",
  "deliveryRates": [
    {
      "_id": "65ff0c9b9c1b2a0012a1b001",
      "deliveryType": "Express",
      "amount": 2500,
      "createdAt": "2026-01-30T10:00:00.000Z",
      "updatedAt": "2026-01-30T10:00:00.000Z",
      "__v": 0
    },
    {
      "_id": "65ff0c9b9c1b2a0012a1b002",
      "deliveryType": "Cargo",
      "amount": 1800,
      "createdAt": "2026-01-30T10:00:00.000Z",
      "updatedAt": "2026-01-30T10:00:00.000Z",
      "__v": 0
    },
    {
      "_id": "65ff0c9b9c1b2a0012a1b003",
      "deliveryType": "Regular",
      "amount": 1200,
      "createdAt": "2026-01-30T10:00:00.000Z",
      "updatedAt": "2026-01-30T10:00:00.000Z",
      "__v": 0
    }
  ]
}
```

---

## 2) Calculate Delivery Cost
**POST** `/deliveryCost/:reviewId`

Calculates a delivery cost for a given review and shipment method.

### Request Body
```json
{
  "shipmentMethod": "express",
  "address": "12 Example Street, Lagos, Nigeria"
}
```

### Response (200)
```json
{
  "success": true,
  "message": "Delivery cost calculated successfully",
  "cost": 2750
}
```

---

## Payment Breakdown (Stripe + Paystack)
When creating a payment, both Stripe and Paystack responses now include a **breakdown** object.

### Stripe Payment Response (excerpt)
```json
{
  "success": true,
  "message": "Stripe checkout created successfully.",
  "data": {
    "checkoutUrl": "https://checkout.stripe.com/...",
    "breakdown": {
      "currency": "USD",
      "productCost": 25.77,
      "deliveryFee": 0.04,
      "total": 25.81,
      "deliveryType": "Regular"
    }
  }
}
```

### Paystack Payment Response (excerpt)
```json
{
  "success": true,
  "message": "Payment initialized successfully",
  "authorizationUrl": "https://checkout.paystack.com/...",
  "breakdown": {
    "currency": "NGN",
    "productCost": 36000,
    "deliveryFee": 500,
    "total": 36500,
    "deliveryMethod": "regular"
  }
}
```

### Paystack Metadata
Paystack does not show line items on the hosted page, but the metadata includes:
```
custom_fields: [
  { display_name: "Product Amount", variable_name: "product_amount", value: ... },
  { display_name: "Delivery Fee (regular)", variable_name: "delivery_fee", value: ... },
  { display_name: "Total", variable_name: "total_amount", value: ... }
]
```

### Errors
- **400**: Invalid review ID / missing shipmentMethod / invalid method
- **404**: Review or material not found
- **400**: Invalid pickup or delivery address

---

## Notes
- Supported shipment methods: **Express**, **Cargo**, **Regular** (case-insensitive).
- This endpoint returns **one calculated cost** for the selected method.
- If you want all methods computed at once, add a new endpoint like:
  `POST /deliveryCosts/:reviewId` → returns Express/Cargo/Regular in one response.
