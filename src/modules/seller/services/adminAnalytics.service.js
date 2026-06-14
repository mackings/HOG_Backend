import Listing from "../model/seller.model.js";
import Transaction from "../../transaction/model/transaction.model.js";
import User from "../../user/model/user.model.js";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const SUCCESSFUL_PAYMENT_STATUSES = ["success", "paid", "completed", "full payment"];
const SUCCESSFUL_TRANSACTION_STATUSES = ["success", "successful", "successfull"];
const SUCCESSFUL_ORDER_STATUSES = ["completed", "full payment"];

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

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const cleanString = (value) => {
  const cleaned = String(value || "").trim();
  return cleaned || undefined;
};

export const parseAnalyticsPagination = (query = {}) => {
  const requestedPage = Number.parseInt(query.page, 10);
  const requestedLimit = Number.parseInt(query.limit, 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
    ? Math.min(requestedLimit, MAX_PAGE_SIZE)
    : DEFAULT_PAGE_SIZE;

  return { page, limit, skip: (page - 1) * limit };
};

export const buildPaginationMetadata = ({ page, limit, totalRecords }) => ({
  page,
  limit,
  totalRecords,
  totalPages: totalRecords === 0 ? 0 : Math.ceil(totalRecords / limit),
  hasNextPage: page * limit < totalRecords,
  hasPreviousPage: page > 1,
});

export const buildSuccessfulTransactionFilter = () => ({
  $expr: {
    $or: [
      {
        $in: [
          { $toLower: { $ifNull: ["$paymentStatus", ""] } },
          SUCCESSFUL_PAYMENT_STATUSES,
        ],
      },
      {
        $in: [
          { $toLower: { $ifNull: ["$status", ""] } },
          SUCCESSFUL_TRANSACTION_STATUSES,
        ],
      },
      {
        $in: [
          { $toLower: { $ifNull: ["$orderStatus", ""] } },
          SUCCESSFUL_ORDER_STATUSES,
        ],
      },
    ],
  },
});

export const getTransactionCategoryFilter = (category) => {
  switch (cleanString(category)?.toLowerCase()) {
    case "subscription":
      return { plan: { $exists: true, $nin: [null, ""] } };
    case "marketplace":
      return {
        plan: { $in: [null, ""] },
        $or: [
          { vendorId: { $exists: true, $ne: null } },
          { materialId: { $exists: true, $ne: null } },
          { "listingId.0": { $exists: true } },
        ],
      };
    case "wallet":
      return {
        plan: { $in: [null, ""] },
        vendorId: { $in: [null] },
        materialId: { $in: [null] },
        "listingId.0": { $exists: false },
        transactionType: { $exists: true, $nin: [null, ""] },
      };
    case "other":
      return {
        plan: { $in: [null, ""] },
        vendorId: { $in: [null] },
        materialId: { $in: [null] },
        "listingId.0": { $exists: false },
        transactionType: { $in: [null, ""] },
      };
    default:
      return {};
  }
};

const buildCreatedAtFilter = (query) => {
  const createdAt = {};
  const dateFrom = cleanString(query.dateFrom);
  const dateTo = cleanString(query.dateTo);

  if (dateFrom) {
    const parsed = new Date(dateFrom);
    if (!Number.isNaN(parsed.getTime())) createdAt.$gte = parsed;
  }

  if (dateTo) {
    const parsed = new Date(dateTo);
    if (!Number.isNaN(parsed.getTime())) {
      parsed.setUTCHours(23, 59, 59, 999);
      createdAt.$lte = parsed;
    }
  }

  return Object.keys(createdAt).length ? { createdAt } : {};
};

const buildListResponse = ({ records, page, limit, totalRecords, filters }) => ({
  records,
  pagination: buildPaginationMetadata({ page, limit, totalRecords }),
  filters,
});

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

export const getAnalyticsUsers = async (query = {}) => {
  const { page, limit, skip } = parseAnalyticsPagination(query);
  const filters = { ...buildCreatedAtFilter(query) };
  const search = cleanString(query.search);
  const role = cleanString(query.role);
  const subscriptionPlan = cleanString(query.subscriptionPlan);
  const verification = cleanString(query.verification)?.toLowerCase();
  const accountStatus = cleanString(query.accountStatus)?.toLowerCase();

  if (search) {
    const regex = new RegExp(escapeRegex(search), "i");
    filters.$or = [
      { fullName: regex },
      { email: regex },
      { username: regex },
      { phoneNumber: regex },
    ];
  }
  if (role) filters.role = role;
  if (subscriptionPlan) filters.subscriptionPlan = subscriptionPlan.toLowerCase();
  if (verification === "verified") filters.isVerified = true;
  if (verification === "unverified") filters.isVerified = { $ne: true };
  if (accountStatus === "blocked") filters.isBlocked = true;
  if (accountStatus === "active") filters.isBlocked = { $ne: true };

  const [records, totalRecords] = await Promise.all([
    User.find(filters)
      .select(
        "fullName email username phoneNumber image role country wallet subscriptionPlan " +
        "subscriptionStartDate subscriptionEndDate billTerm isVerified isBlocked " +
        "isVendorEnabled mustChangePassword invitedBy invitedAt createdAt updatedAt"
      )
      .populate("invitedBy", "fullName email role")
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(filters),
  ]);

  return buildListResponse({
    records,
    page,
    limit,
    totalRecords,
    filters: {
      search: search || null,
      role: role || null,
      subscriptionPlan: subscriptionPlan || null,
      verification: verification || null,
      accountStatus: accountStatus || null,
      dateFrom: cleanString(query.dateFrom) || null,
      dateTo: cleanString(query.dateTo) || null,
    },
  });
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

export const getAnalyticsListings = async (query = {}) => {
  const { page, limit, skip } = parseAnalyticsPagination(query);
  const filters = { ...buildCreatedAtFilter(query) };
  const search = cleanString(query.search);
  const pricing = cleanString(query.pricing)?.toLowerCase();
  const approvalStatus = cleanString(query.approvalStatus)?.toLowerCase();
  const availability = cleanString(query.availability)?.toLowerCase();
  const featured = cleanString(query.featured)?.toLowerCase();

  if (search) {
    const regex = new RegExp(escapeRegex(search), "i");
    filters.$or = [
      { title: regex },
      { description: regex },
      { condition: regex },
      { fabric: regex },
      { occasion: regex },
    ];
  }
  if (pricing === "free") filters.price = 0;
  if (pricing === "paid") filters.price = { $gt: 0 };
  if (pricing === "unpriced") {
    filters.$and = [
      ...(filters.$and || []),
      { $or: [{ price: { $exists: false } }, { price: null }, { price: { $lt: 0 } }] },
    ];
  }
  if (approvalStatus === "approved") {
    filters.$and = [
      ...(filters.$and || []),
      {
        $or: [
          { approvalStatus: "approved" },
          { approvalStatus: { $exists: false }, isApproved: true },
        ],
      },
    ];
  }
  if (approvalStatus === "pending") {
    filters.$and = [
      ...(filters.$and || []),
      {
        $or: [
          { approvalStatus: "pending" },
          { approvalStatus: { $exists: false }, isApproved: { $ne: true } },
        ],
      },
    ];
  }
  if (approvalStatus === "rejected") filters.approvalStatus = "rejected";
  if (availability) filters.availability = availability;
  if (featured === "true") filters.isFeatured = true;
  if (featured === "false") filters.isFeatured = { $ne: true };

  const [records, totalRecords] = await Promise.all([
    Listing.find(filters)
      .populate("userId", "fullName email username image role country")
      .populate("categoryId", "name description image")
      .populate("approvedBy", "fullName email role")
      .populate("rejectedBy", "fullName email role")
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Listing.countDocuments(filters),
  ]);

  return buildListResponse({
    records: records.map((listing) => ({
      ...listing,
      approvalStatus: listing.approvalStatus || (listing.isApproved ? "approved" : "pending"),
    })),
    page,
    limit,
    totalRecords,
    filters: {
      search: search || null,
      pricing: pricing || null,
      approvalStatus: approvalStatus || null,
      availability: availability || null,
      featured: featured || null,
      dateFrom: cleanString(query.dateFrom) || null,
      dateTo: cleanString(query.dateTo) || null,
    },
  });
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

export const getAnalyticsTransactions = async (query = {}) => {
  const { page, limit, skip } = parseAnalyticsPagination(query);
  const successful = String(query.successful || "").toLowerCase() === "true";
  const conditions = [];
  const baseFilters = { ...buildCreatedAtFilter(query) };
  const search = cleanString(query.search);
  const paymentStatus = cleanString(query.paymentStatus);
  const orderStatus = cleanString(query.orderStatus);
  const transactionStatus = cleanString(query.transactionStatus);
  const transactionType = cleanString(query.transactionType);
  const paymentMethod = cleanString(query.paymentMethod);
  const currency = cleanString(query.currency);
  const category = cleanString(query.category)?.toLowerCase();

  if (search) {
    const regex = new RegExp(escapeRegex(search), "i");
    conditions.push({
      $or: [
        { paymentReference: regex },
        { title: regex },
        { reason: regex },
        { plan: regex },
        { sessionId: regex },
      ],
    });
  }
  if (successful) conditions.push(buildSuccessfulTransactionFilter());
  if (paymentStatus) baseFilters.paymentStatus = paymentStatus;
  if (orderStatus) baseFilters.orderStatus = orderStatus;
  if (transactionStatus) baseFilters.status = transactionStatus;
  if (transactionType) baseFilters.transactionType = transactionType;
  if (paymentMethod) baseFilters.paymentMethod = paymentMethod;
  if (currency) baseFilters.paymentCurrency = currency.toUpperCase();
  if (["subscription", "marketplace", "wallet", "other"].includes(category)) {
    conditions.push(getTransactionCategoryFilter(category));
  }

  const filters = conditions.length ? { ...baseFilters, $and: conditions } : baseFilters;
  const queryBuilder = Transaction.find(filters)
    .select(
      "userId vendorId materialId listingId totalAmount amountPaid paymentMethod " +
      "paymentReference paymentStatus paymentCurrency orderStatus title billTerm plan " +
      "planId planBenefits subscriptionStartDate subscriptionEndDate status reason sessionId transactionType " +
      "createdAt updatedAt"
    )
    .populate("userId", "fullName email username image role country")
    .populate("vendorId", "businessName businessEmail city state userId")
    .populate("materialId", "attireType clothMaterial color brand")
    .populate("listingId", "title price currency images availability approvalStatus")
    .populate("planId", "name amount duration description benefits")
    .sort({ createdAt: -1, _id: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  const [records, totalRecords] = await Promise.all([
    queryBuilder,
    Transaction.countDocuments(filters),
  ]);

  return buildListResponse({
    records: records.map((transaction) => ({
      ...transaction,
      analyticsAmount: roundMoney(
        Number(transaction.amountPaid) > 0 ? transaction.amountPaid : transaction.totalAmount
      ),
    })),
    page,
    limit,
    totalRecords,
    filters: {
      search: search || null,
      successful,
      paymentStatus: paymentStatus || null,
      orderStatus: orderStatus || null,
      transactionStatus: transactionStatus || null,
      transactionType: transactionType || null,
      paymentMethod: paymentMethod || null,
      currency: currency?.toUpperCase() || null,
      category: category || null,
      dateFrom: cleanString(query.dateFrom) || null,
      dateTo: cleanString(query.dateTo) || null,
    },
  });
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

export const getAnalyticsEarnings = async (query = {}) => {
  const [earnings, transactionSummary, transactionActivity] = await Promise.all([
    getPlatformEarningsAnalytics(),
    getTransactionAnalytics(),
    getAnalyticsTransactions({ ...query, successful: "true" }),
  ]);

  return {
    earnings,
    transactionSummary,
    transactionActivity,
    transactionActivityNote:
      "These are successful platform transactions for investigation. They are not an earnings ledger and must not be summed to reproduce the admin wallet balance.",
  };
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
    drillDown: {
      users: "/api/v1/admin/analytics/users",
      listings: "/api/v1/admin/analytics/listings",
      transactions: "/api/v1/admin/analytics/transactions",
      successfulTransactions: "/api/v1/admin/analytics/successful-transactions",
      earnings: "/api/v1/admin/analytics/earnings",
    },
    generatedAt: new Date().toISOString(),
  };
};
