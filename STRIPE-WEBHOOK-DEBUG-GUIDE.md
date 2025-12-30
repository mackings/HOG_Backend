# 🔍 Stripe Webhook Debugging Guide

## Problem
Stripe payments succeed on the Stripe dashboard, but transactions don't appear in the app and vendor wallets aren't being credited.

---

## ✅ What I've Done

### 1. Added Comprehensive Logging
The webhook handler now logs every step of the payment processing:
- Webhook receipt and verification
- Event type identification
- Payment reference extraction
- Order lookup
- Transaction creation
- Vendor wallet crediting
- Review updates
- Email notifications

### 2. Created Verification Endpoint
A new debug endpoint to manually check payment status:

```http
GET /api/v1/stripe/verify-payment/:paymentReference
Authorization: Bearer {token}
```

**Example:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://your-domain.com/api/v1/stripe/verify-payment/PAY-1234567890
```

**Response:**
```json
{
  "success": true,
  "data": {
    "initializedOrder": {
      "id": "...",
      "userId": "...",
      "vendorId": "...",
      "amountPaid": 5000,
      "paymentStatus": "full payment"
    },
    "transaction": {
      "id": "...",
      "userId": "...",
      "vendorId": "...",
      "amountPaid": 5000,
      "paymentStatus": "success",
      "createdAt": "2025-12-30T..."
    },
    "tracking": {
      "status": "success"
    }
  },
  "message": "✅ Payment was processed successfully"
}
```

If the transaction is `null`, it means the webhook was never triggered or failed.

---

## 🔍 Debugging Steps

### Step 1: Check Stripe Webhook Configuration

1. Go to [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks)
2. Find your webhook endpoint
3. Verify the URL is: `https://your-vercel-domain.com/api/v1/stripe/webhook`
4. Check "Events to send":
   - ✅ `checkout.session.completed` (REQUIRED)
   - ✅ `payment_intent.succeeded` (OPTIONAL)

### Step 2: Check Webhook Secret

1. In Stripe Dashboard → Webhooks → Click your endpoint
2. Click "Reveal" on "Signing secret"
3. Copy the secret (starts with `whsec_...`)
4. Verify it matches your `.env`:

```bash
STRIPE_WEBHOOK_SECRET=whsec_your_secret_here
```

### Step 3: Monitor Webhook Logs on Vercel

**Option A: Vercel CLI (Real-time)**
```bash
vercel logs --follow
```

**Option B: Vercel Dashboard**
1. Go to your project on Vercel
2. Click "Logs" tab
3. Watch for webhook activity

### Step 4: Check Stripe Webhook Delivery

1. Go to Stripe Dashboard → Webhooks
2. Click your webhook endpoint
3. Scroll to "Webhook attempts"
4. Look for recent `checkout.session.completed` events
5. Check the HTTP status code:
   - **200**: Success
   - **400**: Signature verification failed
   - **500**: Server error
   - **Timeout**: Vercel function timed out

### Step 5: Test with a New Payment

1. Make a test payment
2. Immediately check Vercel logs for webhook output
3. You should see:

```
🔔 ========== STRIPE WEBHOOK CALLED ==========
📅 Timestamp: 2025-12-30T...
✅ Webhook signature verified successfully
📨 Event Type: checkout.session.completed
🛒 Checkout Session Event - Reference: PAY-1234567890
🔍 Searching for order with reference: PAY-1234567890
✅ Order found: 6953abc123...
💼 Processing marketplace payment...
💰 Crediting vendor wallet...
✅ VENDOR WALLET CREDITED!
✅ TRANSACTION CREATED SUCCESSFULLY!
🎉 ========== WEBHOOK PROCESSING COMPLETE ==========
```

### Step 6: Use Verification Endpoint

Get the payment reference from your test payment and call:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://your-domain.com/api/v1/stripe/verify-payment/PAY-1234567890
```

This will tell you:
- ✅ If the order was created
- ✅ If the transaction was recorded
- ✅ If the tracking was updated

---

## 🐛 Common Issues & Solutions

### Issue 1: "Webhook signature verification failed"

**Symptoms:**
```
❌ Webhook verification failed: No signatures found matching the expected signature
```

**Cause:** Webhook secret mismatch or missing

**Solution:**
1. Get the correct webhook secret from Stripe Dashboard
2. Update `.env` file:
   ```bash
   STRIPE_WEBHOOK_SECRET=whsec_your_actual_secret
   ```
3. Redeploy to Vercel:
   ```bash
   git add .
   git commit -m "fix: update Stripe webhook secret"
   git push
   ```
4. OR update environment variable in Vercel Dashboard:
   - Settings → Environment Variables → Edit `STRIPE_WEBHOOK_SECRET`

---

### Issue 2: "Order not found"

**Symptoms:**
```
❌ Order NOT FOUND for reference: PAY-1234567890
```

**Causes:**
1. Order was never created before payment
2. Payment reference mismatch
3. Order was already processed and deleted

**Solution:**
1. Check if `InitializedOrder` is created during checkout:
   - Add logging to `createStripePayment` function
2. Verify payment reference matches between:
   - Checkout session metadata
   - InitializedOrder document
   - Webhook event

---

### Issue 3: Webhook not being called at all

**Symptoms:**
- No logs appear when payment succeeds
- Vercel logs show no `/api/v1/stripe/webhook` requests

**Causes:**
1. Webhook endpoint not registered in Stripe
2. Wrong URL configured
3. Vercel deployment issue

**Solution:**

**A. Register webhook in Stripe:**
```
1. Go to: https://dashboard.stripe.com/webhooks
2. Click "Add endpoint"
3. URL: https://your-vercel-domain.vercel.app/api/v1/stripe/webhook
4. Events: checkout.session.completed
5. Click "Add endpoint"
6. Copy the signing secret
```

**B. Verify route exists:**
Check [app.js:35](../../app.js#L35):
```javascript
app.post('/api/v1/stripe/webhook', express.raw({ type: 'application/json' }), webhookPaymentSuccess);
```

**C. Test webhook manually:**
Use Stripe CLI to forward webhooks:
```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe  # macOS
# or download from https://stripe.com/docs/stripe-cli

# Login
stripe login

# Forward webhooks to local server
stripe listen --forward-to http://localhost:4500/api/v1/stripe/webhook

# Trigger a test event
stripe trigger checkout.session.completed
```

---

### Issue 4: Transaction created but vendor not credited

**Symptoms:**
```
✅ TRANSACTION CREATED SUCCESSFULLY!
⚠️ Skipping vendor payment - missing vendor or review data
```

**Cause:** Missing `vendorId`, `materialId`, or `reviewId` in the order

**Solution:**
1. Check the `createStripePayment` function
2. Ensure `InitializedOrder` contains:
   ```javascript
   {
     vendorId: "...",
     materialId: "...",
     reviewId: "...",
     amountPaid: 5000,
     paymentStatus: "full payment"
   }
   ```

---

### Issue 5: Vercel function timeout

**Symptoms:**
- Webhook returns 504 Gateway Timeout
- Logs show incomplete processing

**Cause:** Webhook processing takes >10 seconds (Vercel serverless limit)

**Solution:**
1. Optimize email sending (make it non-blocking)
2. Move heavy operations to background jobs
3. Increase Vercel timeout (Pro plan required):
   ```json
   // vercel.json
   {
     "functions": {
       "api/**/*.js": {
         "maxDuration": 30
       }
     }
   }
   ```

---

## 📊 Webhook Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Customer completes Stripe checkout                      │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Stripe sends webhook to:                                │
│    POST /api/v1/stripe/webhook                              │
│    Event: checkout.session.completed                        │
│    Metadata: { reference: "PAY-1234567890" }                │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Webhook handler (webhookPaymentSuccess)                 │
│    ✅ Verify signature                                      │
│    ✅ Extract payment reference                             │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Find InitializedOrder with paymentReference             │
│    ✅ Contains: userId, vendorId, materialId, reviewId      │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Create Transaction record                               │
│    ✅ Visible in customer transaction history               │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Credit vendor wallet                                    │
│    ✅ User.wallet += amountPaid                             │
│    ✅ Send payout notification email                        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. Update Review status                                    │
│    ✅ review.amountPaid += amountPaid                       │
│    ✅ review.status = "full payment"                        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 8. Delete InitializedOrder                                 │
│    ✅ Cleanup temporary order                               │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 9. Return 200 OK to Stripe                                 │
│    ✅ Webhook marked as successful                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Testing Checklist

Before making a test payment, verify:

- [ ] Webhook endpoint registered in Stripe Dashboard
- [ ] Correct webhook secret in `.env` / Vercel environment
- [ ] `checkout.session.completed` event enabled
- [ ] Vercel deployment is live and healthy
- [ ] Database connection working
- [ ] InitializedOrder created before payment
- [ ] Payment reference included in checkout metadata

After test payment:

- [ ] Check Stripe webhook attempts (should be 200 OK)
- [ ] Check Vercel logs for webhook processing
- [ ] Call `/verify-payment/:reference` endpoint
- [ ] Check customer transaction history
- [ ] Check vendor wallet balance
- [ ] Check review status updated

---

## 🚀 Quick Fix Checklist

If webhooks aren't working:

1. **Verify webhook URL in Stripe:**
   - Should end with `/api/v1/stripe/webhook`
   - Should use HTTPS (Vercel domain)

2. **Check environment variable:**
   ```bash
   echo $STRIPE_WEBHOOK_SECRET  # Should start with whsec_
   ```

3. **Redeploy to Vercel:**
   ```bash
   git push  # Triggers automatic Vercel deployment
   ```

4. **Test with Stripe CLI:**
   ```bash
   stripe listen --forward-to https://your-domain.vercel.app/api/v1/stripe/webhook
   stripe trigger checkout.session.completed
   ```

5. **Check Vercel logs immediately:**
   ```bash
   vercel logs --follow
   ```

---

## 📞 Next Steps

After making a test payment:

1. **Check Vercel logs** for the detailed webhook output
2. **Use the verification endpoint** to see payment status
3. **Share the logs with me** so I can identify the exact issue:
   - Webhook attempt status from Stripe Dashboard
   - Vercel logs from the webhook call
   - Response from `/verify-payment/:reference`

This will help pinpoint exactly where the flow is breaking!

---

**Date:** December 30, 2025
**Status:** Debugging tools ready
