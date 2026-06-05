import Listing from "../../seller/model/seller.model.js";
import Vendor from "../../vendor/model/vendor.model.js";

const approvedListingsFilter = {
  $or: [
    { approvalStatus: "approved" },
    { approvalStatus: { $exists: false }, isApproved: true },
  ],
};

const buildRegex = (value) => ({ $regex: String(value), $options: "i" });

const publicDesignerPortfolio = (designer = {}) => {
  const portfolioGallery = Array.isArray(designer.portfolioGallery)
    ? designer.portfolioGallery.filter((item) => item?.isVisible !== false)
    : [];
  const visibleUrls = new Set(portfolioGallery.map((item) => item.imageUrl).filter(Boolean));
  const categorizedWorkSections = Object.fromEntries(
    Object.entries(designer.categorizedWorkSections || {}).map(([key, urls]) => [
      key,
      Array.isArray(urls) ? urls.filter((url) => visibleUrls.has(url)) : [],
    ])
  );

  return { ...designer, portfolioGallery, categorizedWorkSections };
};

export const discoverListings = async (req, res, next) => {
  try {
    const {
      gender,
      category,
      occasion,
      size,
      fabric,
      minPrice,
      maxPrice,
      designer,
      availability,
      location,
      sort = "latest",
    } = req.query;

    const query = { ...approvedListingsFilter };
    if (gender) query.gender = buildRegex(gender);
    if (occasion) query.occasion = buildRegex(occasion);
    if (size) query.size = buildRegex(size);
    if (fabric) query.fabric = buildRegex(fabric);
    if (availability) query.availability = availability;
    if (category) query.categoryId = category;
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    let mongoSort = { createdAt: -1 };
    if (sort === "price_low") mongoSort = { price: 1 };
    if (sort === "price_high") mongoSort = { price: -1 };
    if (sort === "popular" || sort === "trending") mongoSort = { viewsCount: -1, savedCount: -1 };
    if (sort === "ratings") mongoSort = { averageRating: -1 };

    let listings = await Listing.find(query)
      .sort(mongoSort)
      .populate("userId", "fullName image address country")
      .populate("categoryId", "name")
      .lean();

    if (designer) {
      listings = listings.filter((listing) =>
        String(listing.userId?.fullName || "").toLowerCase().includes(String(designer).toLowerCase())
      );
    }
    if (location) {
      listings = listings.filter((listing) =>
        [listing.userId?.address, listing.userId?.country].some((value) =>
          String(value || "").toLowerCase().includes(String(location).toLowerCase())
        )
      );
    }

    return res.status(200).json({ success: true, message: "Listings discovered successfully", data: listings });
  } catch (error) {
    next(error);
  }
};

export const getPublicListingById = async (req, res, next) => {
  try {
    const { listingId } = req.params;
    const listing = await Listing.findOne({ _id: listingId, ...approvedListingsFilter })
      .populate("userId", "fullName image address country")
      .populate("categoryId", "name")
      .lean();

    if (!listing) {
      return res.status(404).json({ success: false, message: "Listing not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Listing fetched successfully",
      data: listing,
    });
  } catch (error) {
    next(error);
  }
};

export const discoverDesigners = async (req, res, next) => {
  try {
    const { specialization, availability, location, minRating, sort = "latest" } = req.query;
    const query = {};
    if (specialization) query.specializationTags = buildRegex(specialization);
    if (availability) query.availabilityStatus = availability;
    if (location) query.$or = [{ city: buildRegex(location) }, { state: buildRegex(location) }, { address: buildRegex(location) }];

    let mongoSort = { createdAt: -1 };
    if (sort === "ratings") mongoSort = { totalRatings: -1, ratingSum: -1 };
    if (sort === "completed_orders") mongoSort = { completedOrdersCount: -1 };

    let designers = await Vendor.find(query).sort(mongoSort).populate("userId", "fullName image country").lean();
    if (minRating) {
      designers = designers.filter((vendor) => {
        const average = vendor.totalRatings ? vendor.ratingSum / vendor.totalRatings : 0;
        return average >= Number(minRating);
      });
    }

    return res.status(200).json({
      success: true,
      message: "Designers discovered successfully",
      data: designers.map(publicDesignerPortfolio),
    });
  } catch (error) {
    next(error);
  }
};

export const getPublicDesignerById = async (req, res, next) => {
  try {
    const { designerId } = req.params;
    const designer = await Vendor.findOne({
      $or: [{ _id: designerId }, { userId: designerId }],
    })
      .populate("userId", "fullName image country")
      .lean();

    if (!designer) {
      return res.status(404).json({ success: false, message: "Designer not found" });
    }

    const averageRating = designer.totalRatings ? designer.ratingSum / designer.totalRatings : 0;

    return res.status(200).json({
      success: true,
      message: "Designer fetched successfully",
      data: {
        ...publicDesignerPortfolio(designer),
        socialProof: {
          completedOrders: designer.completedOrdersCount || 0,
          reviews: designer.reviewsCount || designer.totalRatings || 0,
          ratings: Number(averageRating.toFixed(2)),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};
