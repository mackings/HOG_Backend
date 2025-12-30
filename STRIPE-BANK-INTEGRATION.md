# Stripe Connected Accounts & Bank Integration

## Overview

This system allows users to:
1. **Connect their Stripe account** as a connected account (Express account)
2. **Add banks via Stripe onboarding** (during account setup)
3. **Add banks manually** (via your platform)
4. **View all banks together** (Stripe + Manual in one API response)

---

## Flow Diagram

```
User → Create Stripe Account → Onboarding → Add Banks → getBanks API
                                                  ↓
User → Add Manual Bank → getBanks API
                            ↓
                    Shows Both Sources!
```

---

## API Endpoints

### 1. Create Stripe Connected Account

**Endpoint:** `POST /api/v1/stripe/create-account`

**Description:** Creates a Stripe Express connected account for the user and returns an onboarding URL where they can add their bank accounts.

**Request:**
```http
POST /api/v1/stripe/create-account
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Stripe onboarding started",
  "data": {
    "stripeAccountId": "acct_1234567890",
    "onboardingUrl": "https://connect.stripe.com/setup/s/xxxxx"
  }
}
```

**What happens:**
- Creates a Stripe Express account
- Saves `stripeId` to user document
- Returns onboarding URL where user adds banks
- User completes onboarding and links bank accounts

---

### 2. Get Stripe Account Status

**Endpoint:** `GET /api/v1/stripe/account-status`

**Description:** Gets the Stripe connected account details including banks linked via Stripe.

**Request:**
```http
GET /api/v1/stripe/account-status
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "account": {
      "id": "acct_1234567890",
      "email": "user@example.com",
      "country": "US",
      "charges_enabled": true,
      "payouts_enabled": true,
      "requirements": {
        "currently_due": [],
        "eventually_due": [],
        "disabled_reason": null
      }
    },
    "bankAccounts": [
      {
        "id": "ba_1234567890",
        "bank_name": "Chase Bank",
        "last4": "6789",
        "currency": "usd",
        "country": "US",
        "status": "verified"
      }
    ]
  }
}
```

---

### 3. Add Manual Bank Account

**Endpoint:** `POST /api/v1/bank/create`

**Description:** Manually add a bank account to your database (not connected to Stripe).

**Request:**
```http
POST /api/v1/bank/create
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "bankName": "First Bank",
  "accountNumber": "1234567890",
  "accountName": "John Doe",
  "bankCode": "044"
}
```

**Response:**
```json
{
  "message": "Bank account created successfully",
  "data": {
    "_id": "64f1234567890abcdef",
    "bankName": "First Bank",
    "accountNumber": "1234567890",
    "accountName": "John Doe",
    "bankCode": "044",
    "userId": "64f0987654321fedcba",
    "createdAt": "2025-12-30T10:00:00.000Z"
  }
}
```

---

### 4. Get All Banks (Stripe + Manual) ⭐ NEW

**Endpoint:** `GET /api/v1/bank/getBank`

**Description:** Returns ALL bank accounts - both from Stripe connected account AND manually added banks, merged into one response.

**Request:**
```http
GET /api/v1/bank/getBank
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Bank accounts retrieved successfully",
  "data": {
    "stripeAccount": {
      "id": "acct_1234567890",
      "email": "user@example.com",
      "country": "US",
      "charges_enabled": true,
      "payouts_enabled": true,
      "details_submitted": true,
      "requirements": {
        "currently_due": [],
        "eventually_due": [],
        "disabled_reason": null
      }
    },
    "banks": [
      {
        "id": "ba_1234567890",
        "source": "stripe",
        "bank_name": "Chase Bank",
        "account_holder_name": "John Doe",
        "last4": "6789",
        "routing_number": "110000000",
        "currency": "usd",
        "country": "US",
        "status": "verified",
        "default_for_currency": true
      },
      {
        "id": "64f1234567890abcdef",
        "source": "manual",
        "bank_name": "First Bank",
        "account_holder_name": "John Doe",
        "account_number": "1234567890",
        "bank_code": "044",
        "created_at": "2025-12-30T10:00:00.000Z"
      }
    ],
    "summary": {
      "total": 2,
      "stripe": 1,
      "manual": 1
    }
  }
}
```

---

## How It Works

### User Journey

#### Option 1: Connect via Stripe (Recommended)
1. User calls `POST /api/v1/stripe/create-account`
2. Receives `onboardingUrl`
3. User completes Stripe onboarding and adds bank(s)
4. User's `stripeId` is saved to database
5. User calls `GET /api/v1/bank/getBank` → sees Stripe banks

#### Option 2: Manual Entry
1. User calls `POST /api/v1/bank/create` with bank details
2. Bank is saved to MongoDB
3. User calls `GET /api/v1/bank/getBank` → sees manual banks

#### Option 3: Both (Best)
1. User does both Option 1 and Option 2
2. User calls `GET /api/v1/bank/getBank` → sees BOTH sources merged!

---

## Technical Implementation

### Bank Sources

**Stripe Banks:**
- Fetched from: `stripe.accounts.listExternalAccounts()`
- Identified by: `source: "stripe"`
- Fields: `bank_name`, `last4`, `routing_number`, `currency`, `status`

**Manual Banks:**
- Fetched from: MongoDB `Bank` collection
- Identified by: `source: "manual"`
- Fields: `bank_name`, `account_number`, `account_name`, `bank_code`

### Merging Logic

```javascript
// 1. Get manual banks from database
const manualBanks = await Bank.find({ userId: id });

// 2. Get Stripe banks if stripeId exists
let stripeBanks = [];
if (user.stripeId) {
  const externalAccounts = await stripe.accounts.listExternalAccounts(user.stripeId);
  stripeBanks = externalAccounts.data;
}

// 3. Merge both arrays
const allBanks = [...stripeBanks, ...formattedManualBanks];

// 4. Return merged result
return { banks: allBanks, summary: { total, stripe, manual } };
```

---

## Error Handling

### Scenario 1: No Stripe Account
- Stripe banks = `[]`
- Only shows manual banks
- No error thrown

### Scenario 2: Stripe API Error
- Catches error, logs it
- Continues with manual banks only
- No error thrown to user

### Scenario 3: No Banks At All
- Returns 404 with message
- Prompts user to add banks

---

## Frontend Integration

### Display Banks

```javascript
const response = await fetch('/api/v1/bank/getBank', {
  headers: { Authorization: `Bearer ${token}` }
});

const { data } = await response.json();

// Display Stripe banks
data.banks
  .filter(bank => bank.source === 'stripe')
  .map(bank => ({
    name: bank.bank_name,
    last4: bank.last4,
    badge: '🔒 Stripe Connected'
  }));

// Display Manual banks
data.banks
  .filter(bank => bank.source === 'manual')
  .map(bank => ({
    name: bank.bank_name,
    accountNumber: bank.account_number,
    badge: '📝 Manually Added'
  }));

// Summary
console.log(`Total: ${data.summary.total} banks`);
console.log(`Stripe: ${data.summary.stripe}, Manual: ${data.summary.manual}`);
```

---

## Webhooks

After Stripe onboarding completes, you can listen for webhooks:

```javascript
// Webhook handler for account updates
stripe.webhooks.constructEvent(
  req.body,
  signature,
  process.env.STRIPE_WEBHOOK_SECRET
);

// Listen for: account.updated, account.external_account.created
```

---

## Security Notes

1. **Stripe Banks:**
   - Never expose full bank account numbers (only `last4`)
   - Stripe handles verification and security
   - Users manage banks via Stripe dashboard

2. **Manual Banks:**
   - Stored in your database
   - Full account number visible (consider encrypting)
   - You control access and validation

---

## Testing

### Test Connected Account Flow

1. Create account: `POST /api/v1/stripe/create-account`
2. Visit `onboardingUrl` in response
3. Complete Stripe onboarding with test bank
4. Check status: `GET /api/v1/stripe/account-status`
5. Get merged banks: `GET /api/v1/bank/getBank`

### Test Manual Bank Flow

1. Add bank: `POST /api/v1/bank/create`
2. Get banks: `GET /api/v1/bank/getBank`

---

## Benefits

✅ **Flexibility:** Users choose Stripe OR manual entry
✅ **Single API:** One endpoint returns all banks
✅ **Clear Separation:** `source` field identifies origin
✅ **Stripe Security:** Verified banks via Stripe onboarding
✅ **Fallback:** Manual entry if Stripe not available
✅ **Summary Stats:** Know how many of each type

---

## Next Steps

1. Deploy the updated code
2. Test the flow end-to-end
3. Update frontend to display both bank types
4. Add webhook listeners for Stripe account events
5. Consider encrypting manual bank account numbers

---

**Documentation Version:** 1.0
**Last Updated:** 2025-12-30
**Author:** Claude Code Assistant
