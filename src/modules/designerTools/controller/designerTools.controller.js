import Transaction from "../../transaction/model/transaction.model.js";
import Listing from "../../seller/model/seller.model.js";
import Vendor from "../../vendor/model/vendor.model.js";
import DesignerReview from "../../reputation/model/designerReview.model.js";
import Conversation from "../../messaging/model/conversation.model.js";
import { PLAN_ORDER } from "../../subscription/services/subscriptionPlan.service.js";

export const getDesignerAnalytics = async (req, res, next) => {
  try {
    const { id } = req.user;
    // req.planRank is set by requirePlan middleware; default to premium rank since that's the gate
    const planRank = req.planRank ?? PLAN_ORDER["premium"];
    const isElitePlus = planRank >= PLAN_ORDER["elite"];

    const vendor = await Vendor.findOne({ userId: id }).lean();

    const [transactions, listings, reviewsCount, conversationsCount] = await Promise.all([
      Transaction.find({
        $or: [{ vendorId: vendor?._id }, { "cartItems.userId": id }],
      }).lean(),
      Listing.find({ userId: id }).lean(),
      DesignerReview.countDocuments({ designerId: id }),
      Conversation.countDocuments({ designerId: id }),
    ]);

    const totalSales = transactions.reduce(
      (sum, item) => sum + Number(item.totalAmount || item.amountPaid || 0),
      0
    );

    const listingPerformance = listings.map((listing) => ({
      listingId: listing._id,
      title: listing.title,
      viewsCount: listing.viewsCount || 0,
      savedCount: listing.savedCount || 0,
      averageRating: listing.averageRating || 0,
      isFeatured: Boolean(listing.isFeatured),
    }));

    const data = {
      sales: {
        totalSales,
        transactionCount: transactions.length,
      },
      listings: {
        totalListings: listings.length,
        performance: listingPerformance,
      },
      orders: {
        completedOrders: vendor?.completedOrdersCount || 0,
      },
      engagement: {
        reviewsCount,
        conversationsCount,
      },
    };

    // Advanced analytics — Elite and Enterprise plans only
    if (isElitePlus) {
      // Monthly revenue breakdown for the past 12 months
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

      const recentTransactions = transactions.filter(
        (t) => new Date(t.createdAt) >= twelveMonthsAgo
      );

      const monthlyMap = {};
      for (const t of recentTransactions) {
        const d = new Date(t.createdAt);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        monthlyMap[key] = (monthlyMap[key] || 0) + Number(t.totalAmount || t.amountPaid || 0);
      }
      const monthlyRevenue = Object.entries(monthlyMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, revenue]) => ({ month, revenue }));

      // Top 5 listings by views
      const topListings = [...listingPerformance]
        .sort((a, b) => b.viewsCount - a.viewsCount)
        .slice(0, 5);

      // Listing approval breakdown
      const approvalBreakdown = listings.reduce((acc, l) => {
        const status = l.approvalStatus || (l.isApproved ? "approved" : "pending");
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {});

      data.advanced = {
        monthlyRevenue,
        topListings,
        listingApprovalBreakdown: approvalBreakdown,
        averageOrderValue: transactions.length > 0 ? Math.round(totalSales / transactions.length) : 0,
      };
    }

    return res.status(200).json({
      success: true,
      message: "Designer analytics fetched successfully",
      plan: req.effectivePlan,
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const featureListing = async (req, res, next) => {
  try {
    const { id } = req.user;
    const { listingId } = req.params;
    const { isFeatured = true } = req.body;

    const listing = await Listing.findOneAndUpdate(
      { _id: listingId, userId: id },
      { isFeatured: Boolean(isFeatured) },
      { new: true }
    );

    if (!listing) {
      return res.status(404).json({ success: false, message: "Listing not found or unauthorized" });
    }

    return res.status(200).json({
      success: true,
      message: "Listing promotion status updated successfully",
      data: listing,
    });
  } catch (error) {
    next(error);
  }
};
