import Transaction from "../../transaction/model/transaction.model.js";
import Listing from "../../seller/model/seller.model.js";
import Vendor from "../../vendor/model/vendor.model.js";
import DesignerReview from "../../reputation/model/designerReview.model.js";
import Conversation from "../../messaging/model/conversation.model.js";

export const getDesignerAnalytics = async (req, res, next) => {
  try {
    const { id } = req.user;
    const vendor = await Vendor.findOne({ userId: id }).lean();

    const [transactions, listings, reviewsCount, conversationsCount] = await Promise.all([
      Transaction.find({
        $or: [{ vendorId: vendor?._id }, { "cartItems.userId": id }],
      }).lean(),
      Listing.find({ userId: id }).lean(),
      DesignerReview.countDocuments({ designerId: id }),
      Conversation.countDocuments({ designerId: id }),
    ]);

    const totalSales = transactions.reduce((sum, item) => sum + Number(item.totalAmount || item.amountPaid || 0), 0);
    const listingPerformance = listings.map((listing) => ({
      listingId: listing._id,
      title: listing.title,
      viewsCount: listing.viewsCount || 0,
      savedCount: listing.savedCount || 0,
      averageRating: listing.averageRating || 0,
      isFeatured: Boolean(listing.isFeatured),
    }));

    return res.status(200).json({
      success: true,
      message: "Designer analytics fetched successfully",
      data: {
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
      },
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

