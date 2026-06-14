import Listing from "../model/seller.model.js";
import Transaction from "../../transaction/model/transaction.model.js";
import User from "../../user/model/user.model.js";

const roundMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;

const facetTotal = (facet = []) => facet[0]?.count || 0;

const groupedValues = (groups = []) =>
  Object.fromEntries(groups.map(({ _id, count }) => [String(_id), count]));

const numericAmountPaid = {
  $convert: {
    input: "$amountPaid",
    to: "double",
    onError: 0,
    onNull: 0,
  },
};

const numericTotalAmount = {
  $convert: {
    input: "$totalAmount",
    to: "double",
    onError: 0,
    onNull: 0,
  },
};

const amountExpression = {
  $cond: [{ $gt: [numericAmountPaid, 0] }, numericAmountPaid, numericTotalAmount],
};

export const formatUserAnalytics = ([result = {}] = []) => ({
  totalUsers: facetTotal(result.total),
  byRole: groupedValues(result.byRole),
  bySubscriptionPlan: groupedValues(result.bySubscriptionPlan),
  verification: groupedValues(result.verification),
  accountStatus: groupedValues(result.accountStatus),
  registeredLast30Days: facetTotal(result.registeredLast30Days),
});

export const formatListingAnalytics = ([result = {}] = []) => {
  const pricing = groupedValues(result.byPricing);
  const value = result.value?.[0] || {};

  return {
    totalListings: facetTotal(result.total),
    freeListings: pricing.free || 0,
    paidListings: pricing.paid || 0,
    unpricedListings: pricing.unpriced || 0,
    byApprovalStatus: groupedValues(result.byApprovalStatus),
    byAvailability: groupedValues(result.byAvailability),
    featured: groupedValues(result.featured),
    listedValue: {
      total: roundMoney(value.total),
      average: roundMoney(value.average),
      currencyNote: "Values are not converted; use only when listing currencies are consistent.",
    },
  };
};

export const formatTransactionAnalytics = ([result = {}] = []) => ({
  totalTransactions: facetTotal(result.total),
  successfulTransactions: facetTotal(result.successful),
  byPaymentStatus: groupedValues(result.byPaymentStatus),
  byOrderStatus: groupedValues(result.byOrderStatus),
  byTransactionStatus: groupedValues(result.byTransactionStatus),
  byTransactionType: groupedValues(result.byTransactionType),
  byPaymentMethod: groupedValues(result.byPaymentMethod),
  byCategory: groupedValues(result.byCategory),
  amountsByCurrency: Object.fromEntries(
    (result.amountsByCurrency || []).map(({ _id, count, totalAmount }) => [
      String(_id),
      { transactionCount: count, totalAmount: roundMoney(totalAmount) },
    ])
  ),
});

export const getUserAnalytics = async () => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const result = await User.aggregate([
    {
      $facet: {
        total: [{ $count: "count" }],
        byRole: [
          { $group: { _id: { $ifNull: ["$role", "unspecified"] }, count: { $sum: 1 } } },
          { $sort: { _id: 1 } },
        ],
        bySubscriptionPlan: [
          {
            $group: {
              _id: { $ifNull: ["$subscriptionPlan", "free"] },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ],
        verification: [
          {
            $group: {
              _id: { $cond: [{ $eq: ["$isVerified", true] }, "verified", "unverified"] },
              count: { $sum: 1 },
            },
          },
        ],
        accountStatus: [
          {
            $group: {
              _id: { $cond: [{ $eq: ["$isBlocked", true] }, "blocked", "active"] },
              count: { $sum: 1 },
            },
          },
        ],
        registeredLast30Days: [
          { $match: { createdAt: { $gte: thirtyDaysAgo } } },
          { $count: "count" },
        ],
      },
    },
  ]);

  return formatUserAnalytics(result);
};

export const getListingAnalytics = async () => {
  const result = await Listing.aggregate([
    {
      $facet: {
        total: [{ $count: "count" }],
        byPricing: [
          {
            $group: {
              _id: {
                $switch: {
                  branches: [
                    { case: { $eq: ["$price", 0] }, then: "free" },
                    { case: { $gt: ["$price", 0] }, then: "paid" },
                  ],
                  default: "unpriced",
                },
              },
              count: { $sum: 1 },
            },
          },
        ],
        byApprovalStatus: [
          {
            $group: {
              _id: {
                $switch: {
                  branches: [
                    {
                      case: { $in: ["$approvalStatus", ["pending", "approved", "rejected"]] },
                      then: "$approvalStatus",
                    },
                    { case: { $eq: ["$isApproved", true] }, then: "approved" },
                  ],
                  default: "pending",
                },
              },
              count: { $sum: 1 },
            },
          },
        ],
        byAvailability: [
          {
            $group: {
              _id: { $ifNull: ["$availability", "available"] },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ],
        featured: [
          {
            $group: {
              _id: { $cond: [{ $eq: ["$isFeatured", true] }, "featured", "standard"] },
              count: { $sum: 1 },
            },
          },
        ],
        value: [
          { $match: { price: { $type: "number", $gte: 0 } } },
          {
            $group: {
              _id: null,
              total: { $sum: "$price" },
              average: { $avg: "$price" },
            },
          },
        ],
      },
    },
  ]);

  return formatListingAnalytics(result);
};

export const getTransactionAnalytics = async () => {
  const normalizedPaymentStatus = { $toLower: { $ifNull: ["$paymentStatus", ""] } };
  const normalizedStatus = { $toLower: { $ifNull: ["$status", ""] } };
  const normalizedOrderStatus = { $toLower: { $ifNull: ["$orderStatus", ""] } };

  const result = await Transaction.aggregate([
    {
      $facet: {
        total: [{ $count: "count" }],
        successful: [
          {
            $match: {
              $expr: {
                $or: [
                  { $in: [normalizedPaymentStatus, ["success", "paid", "completed", "full payment"]] },
                  { $in: [normalizedStatus, ["success", "successful", "successfull"]] },
                  { $in: [normalizedOrderStatus, ["completed", "full payment"]] },
                ],
              },
            },
          },
          { $count: "count" },
        ],
        byPaymentStatus: [
          {
            $group: {
              _id: { $ifNull: ["$paymentStatus", "unspecified"] },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ],
        byOrderStatus: [
          {
            $group: {
              _id: { $ifNull: ["$orderStatus", "unspecified"] },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ],
        byTransactionStatus: [
          {
            $group: {
              _id: { $ifNull: ["$status", "unspecified"] },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ],
        byTransactionType: [
          {
            $group: {
              _id: { $ifNull: ["$transactionType", "unspecified"] },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ],
        byPaymentMethod: [
          {
            $group: {
              _id: { $ifNull: ["$paymentMethod", "unspecified"] },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ],
        byCategory: [
          {
            $group: {
              _id: {
                $switch: {
                  branches: [
                    {
                      case: {
                        $and: [
                          { $ne: [{ $ifNull: ["$plan", null] }, null] },
                          { $ne: ["$plan", ""] },
                        ],
                      },
                      then: "subscription",
                    },
                    {
                      case: {
                        $or: [
                          { $ne: [{ $ifNull: ["$vendorId", null] }, null] },
                          { $ne: [{ $ifNull: ["$materialId", null] }, null] },
                          {
                            $gt: [
                              {
                                $cond: [
                                  { $isArray: "$listingId" },
                                  { $size: "$listingId" },
                                  0,
                                ],
                              },
                              0,
                            ],
                          },
                        ],
                      },
                      then: "marketplace",
                    },
                    {
                      case: {
                        $ne: [{ $ifNull: ["$transactionType", null] }, null],
                      },
                      then: "wallet",
                    },
                  ],
                  default: "other",
                },
              },
              count: { $sum: 1 },
            },
          },
        ],
        amountsByCurrency: [
          {
            $group: {
              _id: { $ifNull: ["$paymentCurrency", "unspecified"] },
              count: { $sum: 1 },
              totalAmount: { $sum: amountExpression },
            },
          },
          { $sort: { _id: 1 } },
        ],
      },
    },
  ]);

  return formatTransactionAnalytics(result);
};

export const getEarningsAnalytics = (admin) => {
  const totalEarnings = roundMoney(admin?.wallet);
  const recordedCommission = roundMoney(admin?.commission);
  const recordedTax = roundMoney(admin?.tax);
  const otherWalletCredits = roundMoney(totalEarnings - recordedCommission - recordedTax);

  return {
    totalEarnings,
    currency: "NGN",
    basis: "current_admin_wallet_balance",
    derivation: {
      recordedCommission,
      recordedTax,
      otherWalletCredits,
      formula: "totalEarnings = recordedCommission + recordedTax + otherWalletCredits",
    },
    note:
      "This is the primary admin account's current wallet balance, not gross historical revenue. Other wallet credits include listing fees and any credits not stored as commission or tax.",
  };
};

export const getPlatformEarningsAnalytics = async () => {
  const admin = await User.findOne({ role: "admin" })
    .select("wallet commission tax")
    .lean();

  return admin ? getEarningsAnalytics(admin) : null;
};

export const getAdminDashboardAnalytics = async () => {
  const [users, listings, transactions, earnings] = await Promise.all([
    getUserAnalytics(),
    getListingAnalytics(),
    getTransactionAnalytics(),
    getPlatformEarningsAnalytics(),
  ]);

  return {
    users,
    listings,
    earnings,
    transactions,
    generatedAt: new Date().toISOString(),
  };
};
