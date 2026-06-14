import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPaginationMetadata,
  buildSuccessfulTransactionFilter,
  formatListingAnalytics,
  formatTransactionAnalytics,
  formatUserAnalytics,
  getEarningsAnalytics,
  getTransactionCategoryFilter,
  parseAnalyticsPagination,
} from "../src/modules/seller/services/adminAnalytics.service.js";

test("analytics pagination applies defaults and caps large page sizes", () => {
  assert.deepEqual(parseAnalyticsPagination({}), {
    page: 1,
    limit: 20,
    skip: 0,
  });
  assert.deepEqual(parseAnalyticsPagination({ page: "3", limit: "500" }), {
    page: 3,
    limit: 100,
    skip: 200,
  });
});

test("pagination metadata reports page navigation", () => {
  assert.deepEqual(
    buildPaginationMetadata({ page: 2, limit: 20, totalRecords: 45 }),
    {
      page: 2,
      limit: 20,
      totalRecords: 45,
      totalPages: 3,
      hasNextPage: true,
      hasPreviousPage: true,
    }
  );
});

test("successful transaction filter covers all stored success fields", () => {
  const serialized = JSON.stringify(buildSuccessfulTransactionFilter());

  assert.match(serialized, /paymentStatus/);
  assert.match(serialized, /orderStatus/);
  assert.match(serialized, /full payment/);
  assert.match(serialized, /successfull/);
});

test("transaction categories build distinct database filters", () => {
  assert.deepEqual(getTransactionCategoryFilter("subscription"), {
    plan: { $exists: true, $nin: [null, ""] },
  });
  assert.equal(getTransactionCategoryFilter("marketplace").$or.length, 3);
  assert.equal(getTransactionCategoryFilter("wallet").transactionType.$exists, true);
  assert.deepEqual(getTransactionCategoryFilter("invalid"), {});
});

test("user analytics formats facet counts into dashboard breakdowns", () => {
  const analytics = formatUserAnalytics([
    {
      total: [{ count: 39 }],
      byRole: [
        { _id: "admin", count: 2 },
        { _id: "user", count: 30 },
        { _id: "tailor", count: 7 },
      ],
      bySubscriptionPlan: [
        { _id: "free", count: 35 },
        { _id: "premium", count: 4 },
      ],
      verification: [
        { _id: "verified", count: 31 },
        { _id: "unverified", count: 8 },
      ],
      accountStatus: [
        { _id: "active", count: 38 },
        { _id: "blocked", count: 1 },
      ],
      registeredLast30Days: [{ count: 6 }],
    },
  ]);

  assert.equal(analytics.totalUsers, 39);
  assert.equal(analytics.byRole.tailor, 7);
  assert.equal(analytics.bySubscriptionPlan.premium, 4);
  assert.equal(analytics.verification.verified, 31);
  assert.equal(analytics.accountStatus.blocked, 1);
  assert.equal(analytics.registeredLast30Days, 6);
});

test("listing analytics preserves free and paid totals and rounds values", () => {
  const analytics = formatListingAnalytics([
    {
      total: [{ count: 4 }],
      byPricing: [
        { _id: "free", count: 0 },
        { _id: "paid", count: 4 },
      ],
      byApprovalStatus: [{ _id: "approved", count: 4 }],
      byAvailability: [{ _id: "available", count: 3 }, { _id: "sold", count: 1 }],
      featured: [{ _id: "standard", count: 4 }],
      value: [{ total: 450000.555, average: 112500.13875 }],
    },
  ]);

  assert.equal(analytics.totalListings, 4);
  assert.equal(analytics.freeListings, 0);
  assert.equal(analytics.paidListings, 4);
  assert.equal(analytics.byApprovalStatus.approved, 4);
  assert.equal(analytics.listedValue.total, 450000.56);
  assert.equal(analytics.listedValue.average, 112500.14);
});

test("transaction analytics exposes status, category, and currency totals", () => {
  const analytics = formatTransactionAnalytics([
    {
      total: [{ count: 61 }],
      successful: [{ count: 54 }],
      byPaymentStatus: [{ _id: "success", count: 54 }, { _id: "unspecified", count: 7 }],
      byOrderStatus: [{ _id: "completed", count: 61 }],
      byTransactionStatus: [{ _id: "unspecified", count: 55 }, { _id: "success", count: 6 }],
      byTransactionType: [{ _id: "credit", count: 6 }, { _id: "unspecified", count: 55 }],
      byPaymentMethod: [{ _id: "Paystack", count: 61 }],
      byCategory: [{ _id: "marketplace", count: 40 }, { _id: "subscription", count: 21 }],
      amountsByCurrency: [{ _id: "NGN", count: 61, totalAmount: 2000000.129 }],
    },
  ]);

  assert.equal(analytics.totalTransactions, 61);
  assert.equal(analytics.successfulTransactions, 54);
  assert.equal(analytics.byCategory.marketplace, 40);
  assert.deepEqual(analytics.amountsByCurrency.NGN, {
    transactionCount: 61,
    totalAmount: 2000000.13,
  });
});

test("earnings analytics explains the wallet balance derivation", () => {
  const analytics = getEarningsAnalytics({
    wallet: 1355958.8399999999,
    commission: 200000,
    tax: 550000,
  });

  assert.equal(analytics.totalEarnings, 1355958.84);
  assert.equal(analytics.derivation.recordedCommission, 200000);
  assert.equal(analytics.derivation.recordedTax, 550000);
  assert.equal(analytics.derivation.otherWalletCredits, 605958.84);
});
