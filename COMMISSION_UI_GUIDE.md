# Commission Percentage Guide (Frontend)
**Purpose:** Explain how commission is applied at quotation and agreement so the UI can display accurate totals.
**Effective Date:** January 30, 2026

---

## Summary
- **Quotation level:** add **10%** commission to the base amount.
- **Agreement level (mutual consent):** add **another 10%** to the base amount.
- **Total commission after agreement:** **20% of the agreed base**.
- **Vendor sees base only.** **User pays base + commission.**

---

## Definitions
- **Base amount:** the negotiated cost for the work (material + workmanship).
- **User payable:** what the user pays.
- **Vendor base:** what the vendor should receive.

---

## Rules
### 1) At quotation
```
user_payable = base * 1.10
vendor_base = base
commission = base * 0.10
```

### 2) After agreement (mutual consent)
```
user_payable = base * 1.20   // base + 10% (quote) + 10% (agreement)
vendor_base = base
commission_total = base * 0.20
```

---

## Which fields to show
### Buyer UI
- **Total to pay:** `review.userPayableTotal` (fallback `review.totalCost`)
- **Label:** “Total (includes 20% commission after agreement)”

### Vendor UI
- **Agreed price:** `review.vendorBaseTotal` (fallback `offer.finalTotalCost`)
- **Label:** “Agreed price (before commission)”

---

## UI Suggestions
### Quote screen (before agreement)
- Show:
  - **Base:** ₦X
  - **Commission (10%):** ₦Y
  - **Total to Pay:** ₦X+Y

### Agreement screen (after consent)
- For Buyer:
  - **Agreed Base:** ₦X
  - **Commission (20% total):** ₦Y
  - **Total to Pay:** ₦X+Y
- For Vendor:
  - **Agreed Base:** ₦X
  - **Payout:** ₦X

---

## Example
Base = ₦30,000

- **Quotation:** commission 10% = ₦3,000 → user pays ₦33,000
- **Agreement:** commission 20% = ₦6,000 → user pays ₦36,000
- **Vendor payout:** ₦30,000
