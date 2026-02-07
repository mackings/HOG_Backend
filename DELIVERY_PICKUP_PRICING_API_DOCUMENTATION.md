# Delivery, Pickup, Tax/VAT API Documentation

Base URL: `https://<your-domain>/api/v1`  
Auth: `Authorization: Bearer <token>`

## 1) Pricing Configuration (Admin-updatable Tax/VAT)

### 1.1 Get current pricing config
- Method: `GET`
- URL: `/pricing/getPricingConfig`
- Roles: any authenticated user

Response `200`:
```json
{
  "success": true,
  "message": "Pricing configuration fetched successfully",
  "data": {
    "quotationTaxRate": 0.1,
    "vatRate": 0.1,
    "quotationTaxPercent": 10,
    "vatPercent": 10,
    "updatedAt": "2026-02-07T12:00:00.000Z"
  }
}
```

### 1.2 Update pricing config
- Method: `PUT`
- URL: `/pricing/updatePricingConfig`
- Roles: `admin`, `superAdmin`

You can send either decimals (`0.1`) or percentages (`10`):
```json
{
  "quotationTaxPercent": 10,
  "vatPercent": 10
}
```
or
```json
{
  "quotationTaxRate": 0.1,
  "vatRate": 0.1
}
```

Response `200`:
```json
{
  "success": true,
  "message": "Pricing configuration updated successfully",
  "data": {
    "quotationTaxRate": 0.1,
    "vatRate": 0.1,
    "quotationTaxPercent": 10,
    "vatPercent": 10,
    "updatedAt": "2026-02-07T12:01:00.000Z"
  }
}
```

Validation errors:
- `400` when values are invalid (must be `0-1` or `0-100`).

## 2) Pickup Locations (Country -> State -> Location)

Route base: `/deliveryRate`

### 2.1 Create pickup country
- Method: `POST`
- URL: `/deliveryRate/pickup/countries`
- Roles: `admin`, `superAdmin`

Request:
```json
{
  "name": "Nigeria"
}
```

### 2.2 Add state to country
- Method: `POST`
- URL: `/deliveryRate/pickup/countries/:countryId/states`
- Roles: `admin`, `superAdmin`

Request:
```json
{
  "name": "Lagos"
}
```

### 2.3 Add location to state
- Method: `POST`
- URL: `/deliveryRate/pickup/countries/:countryId/states/:stateId/locations`
- Roles: `admin`, `superAdmin`

Request:
```json
{
  "name": "Ikeja Pickup Hub",
  "address": "12 Allen Avenue, Ikeja, Lagos, Nigeria"
}
```

### 2.4 Get pickup countries
- Method: `GET`
- URL: `/deliveryRate/pickup/countries`
- Roles: any authenticated user

### 2.5 Get states in a country
- Method: `GET`
- URL: `/deliveryRate/pickup/countries/:countryId/states`
- Roles: any authenticated user

### 2.6 Get locations in a state
- Method: `GET`
- URL: `/deliveryRate/pickup/countries/:countryId/states/:stateId/locations`
- Roles: any authenticated user

### 2.7 Get full pickup hierarchy (for dropdowns)
- Method: `GET`
- URL: `/deliveryRate/pickup/hierarchy`
- Roles: any authenticated user

Response `200` (example):
```json
{
  "success": true,
  "message": "Pickup hierarchy retrieved successfully",
  "data": [
    {
      "_id": "countryId",
      "name": "Nigeria",
      "states": [
        {
          "_id": "stateId",
          "name": "Lagos",
          "locations": [
            {
              "_id": "locationId",
              "name": "Ikeja Pickup Hub",
              "address": "12 Allen Avenue, Ikeja, Lagos, Nigeria",
              "isActive": true
            }
          ]
        }
      ]
    }
  ]
}
```

## 3) Delivery Cost API (Now supports pickup location IDs)

### 3.1 Calculate delivery cost
- Method: `POST`
- URL: `/deliveryRate/deliveryCost/:reviewId`
- Roles: any authenticated user

#### Option A: Normal address delivery
Request:
```json
{
  "shipmentMethod": "express",
  "address": "No 10 Admiralty Way, Lekki, Lagos"
}
```

#### Option B: Use admin-configured pickup location as delivery destination
Request:
```json
{
  "shipmentMethod": "regular",
  "pickupCountryId": "67a5...",
  "pickupStateId": "67a6...",
  "pickupLocationId": "67a7..."
}
```

Response `200`:
```json
{
  "success": true,
  "message": "Delivery cost calculated successfully",
  "cost": 4500,
  "currency": "NGN",
  "selectedPickupLocation": {
    "countryId": "67a5...",
    "country": "Nigeria",
    "stateId": "67a6...",
    "state": "Lagos",
    "locationId": "67a7...",
    "locationName": "Ikeja Pickup Hub",
    "locationAddress": "12 Allen Avenue, Ikeja, Lagos, Nigeria"
  }
}
```

## 4) Existing Delivery Rate Admin APIs (unchanged)

### 4.1 Create delivery rate
- `POST /deliveryRate/createDeliveryRate`

### 4.2 Update delivery rate
- `PUT /deliveryRate/updateDeliveryRate/:id`

### 4.3 Delete delivery rate
- `DELETE /deliveryRate/deleteDeliveryRate/:id`

### 4.4 Get delivery rates
- `GET /deliveryRate/getDeliveryRates`

## 5) Pricing Behavior Used by Quote/Offer Flow

Current runtime behavior:
1. Quotation stage (`createReview`):
- applies **Quotation Tax** from `/pricing/updatePricingConfig` (`quotationTaxRate`)
- VAT is not applied at this stage

2. Mutual consent stage (`makeOffer` acceptance by both sides):
- applies only **VAT** from `/pricing/updatePricingConfig` (`vatRate`)
- quotation tax is treated as already applied at quote stage

Example with `quotationTax = 10%`, `vat = 10%`:
- designer base quote = `50,000`
- quote payable = `55,000`
- negotiated agreed base = `53,000`
- post-consent payable = `58,300`

## 6) Mobile Integration Sequence (Recommended)

1. Fetch pickup hierarchy:
- `GET /deliveryRate/pickup/hierarchy`

2. Let user choose:
- `shipmentMethod` + either free address or pickup location IDs

3. Compute delivery:
- `POST /deliveryRate/deliveryCost/:reviewId`

4. Fetch pricing config for display labels:
- `GET /pricing/getPricingConfig`

5. Proceed with offer/payment flows using returned totals.

