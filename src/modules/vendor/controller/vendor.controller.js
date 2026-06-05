import User from "../../user/model/user.model.js";
import Vendor from "../model/vendor.model.js";
import Material from "../../material/model/material.model.js";
import Review from "../../review/model/review.model.js";
import { rejectPastedMediaUrls, uploadedFileUrls } from "../../../utils/deviceUpload.utils.js";

const parseMaybeJson = (value, fallback) => {
  if (value === undefined) return fallback;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    return value;
  }
};

const arrayValue = (value) => {
  const parsed = parseMaybeJson(value, []);
  if (Array.isArray(parsed)) return parsed;
  return parsed === undefined || parsed === null || parsed === "" ? [] : [parsed];
};

const booleanValue = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return undefined;
};

const normalizePortfolioCategory = (value) => {
  const raw = String(value || "").trim();
  const normalized = raw.toLowerCase().replace(/[\s-]+/g, "_");
  const aliases = {
    bridal: "bridal",
    nativewear: "native_wear",
    native_wear: "native_wear",
    native: "native_wear",
    corporate: "corporate",
    casual: "casual",
    menswear: "menswear",
    mens_wear: "menswear",
    womenswear: "womenswear",
    womens_wear: "womenswear",
    womenwear: "womenswear",
    women_wear: "womenswear",
    other: "other",
  };

  return aliases[normalized] || "other";
};

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

  return { portfolioGallery, categorizedWorkSections };
};


export const createTailor = async (req, res, next) => {
  try {
    const { id } = req.user;
    const {
      businessName,
      businessEmail,
      businessRegistrationNumber,
      registeredIn,
      businessPhone,
      address,
      city,
      state,
      yearOfExperience,
      description,
      bio,
      specializationTags,
      turnaroundTime,
      availabilityStatus
    } = req.body;

    // Validate required fields
    const requiredFields = {
      businessName,
      businessEmail,
      businessPhone,
      address,
      city,
      state,
      yearOfExperience,
      description
    };

    const missingField = Object.entries(requiredFields)
      .find(([_, value]) => !value)?.[0];

    if (missingField) {
      return res.status(400).json({ message: `${missingField} is required` });
    }

    // Check if vendor already exists
    const existingTailor = await Vendor.findOne({ userId: id });
    if (existingTailor) {
      return res.status(400).json({ message: 'Tailor (Vendor) already exists' });
    }

    // Validate image upload
    const images = req.imageUrls[0]

    // Create vendor
    const newTailor = await Vendor.create({
      userId: id,
      businessName,
      businessEmail,
      businessPhone,
      businessRegistrationNumber,
      registeredIn,
      address,
      nepaBill: images,
      city,
      state,
      yearOfExperience,
      description,
      bio,
      specializationTags,
      turnaroundTime,
      availabilityStatus
    });

    await User.findByIdAndUpdate(id, { isVendorEnabled: true });

    return res.status(201).json({
      success: true,
      message: 'Tailor created successfully',
      data: newTailor
    });

  } catch (error) {
    next(error);
  }
};

export const getTailor = async (req, res, next)=>{
    try {
        const {id}= req.user;
        const tailor = await Vendor.findOne({userId: id});
        if (!tailor) {
            return res.status(404).json({ message: 'Tailor not found' });
        }
        return res.status(200).json({success: true, message: 'Tailor found', data: tailor });
    } catch (error) {
        next(error);
    }
}


export const updateTailor = async (req, res, next) => {
  try {
    const { id } = req.user;
    const { tailorId } = req.params;

    const updates = req.body;

    const tailor = await Vendor.findOneAndUpdate(
      { _id: tailorId, userId: id },
      {
        $set: {
          businessName: updates.businessName,
          businessEmail: updates.businessEmail,
          businessPhone: updates.businessPhone,
          address: updates.address,
          city: updates.city,
          state: updates.state,
          businessRegistrationNumber: updates.businessRegistrationNumber,
          registeredIn: updates.registeredIn,
          yearOfExperience: updates.yearOfExperience,
          description: updates.description,
          bio: updates.bio,
          specializationTags: updates.specializationTags,
          turnaroundTime: updates.turnaroundTime,
          availabilityStatus: updates.availabilityStatus,
          categorizedWorkSections: updates.categorizedWorkSections
        }
      },
      { new: true, runValidators: true }
    );

    if (!tailor) {
      return res.status(404).json({ message: "Tailor not found or unauthorized" });
    }

    res.status(200).json({
      success: true,
      message: "Tailor updated successfully",
      data: tailor
    });

  } catch (error) {
    next(error);
  }
};

export const updateDesignerPortfolio = async (req, res, next) => {
  try {
    const { id } = req.user;
    const { portfolioGallery, categorizedWorkSections } = req.body;
    if (rejectPastedMediaUrls(res, { portfolioGallery, categorizedWorkSections })) return;

    const uploadedUrls = uploadedFileUrls(req);
    const captions = arrayValue(req.body.captions);
    const categories = arrayValue(req.body.categories);
    const uploadedPortfolioGallery = uploadedUrls.map((imageUrl, index) => ({
      imageUrl,
      caption: captions[index],
      category: normalizePortfolioCategory(categories[index]),
      isVisible: true,
    }));

    const nextCategorizedWorkSections = parseMaybeJson(categorizedWorkSections, undefined);

    const tailor = await Vendor.findOneAndUpdate(
      { userId: id },
      {
        ...(uploadedPortfolioGallery.length > 0
          ? { $push: { portfolioGallery: { $each: uploadedPortfolioGallery } } }
          : {}),
        ...(nextCategorizedWorkSections
          ? { $set: { categorizedWorkSections: nextCategorizedWorkSections } }
          : {}),
      },
      { new: true, runValidators: true }
    );

    if (!tailor) {
      return res.status(404).json({ success: false, message: "Tailor not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Designer portfolio updated successfully",
      data: tailor,
    });
  } catch (error) {
    next(error);
  }
};

export const updatePortfolioItem = async (req, res, next) => {
  try {
    const { id } = req.user;
    const { itemId } = req.params;
    const { caption, category } = req.body;
    const isVisible = booleanValue(req.body.isVisible);
    const uploadedUrls = uploadedFileUrls(req);

    if (req.body.isVisible !== undefined && isVisible === undefined) {
      return res.status(400).json({ success: false, message: "isVisible must be a boolean" });
    }

    const tailor = await Vendor.findOne({ userId: id, "portfolioGallery._id": itemId });
    if (!tailor) {
      return res.status(404).json({ success: false, message: "Portfolio item not found" });
    }

    const portfolioItem = tailor.portfolioGallery.id(itemId);
    const previousImageUrl = portfolioItem.imageUrl;

    if (uploadedUrls.length > 0) portfolioItem.imageUrl = uploadedUrls[0];
    if (caption !== undefined) portfolioItem.caption = caption;
    if (category !== undefined) portfolioItem.category = normalizePortfolioCategory(category);
    if (isVisible !== undefined) portfolioItem.isVisible = isVisible;

    if (uploadedUrls.length > 0 && previousImageUrl && previousImageUrl !== portfolioItem.imageUrl) {
      Object.keys(tailor.categorizedWorkSections || {}).forEach((section) => {
        tailor.categorizedWorkSections[section] = tailor.categorizedWorkSections[section].filter(
          (url) => url !== previousImageUrl
        );
      });
    }

    await tailor.save();

    return res.status(200).json({
      success: true,
      message: "Portfolio item updated successfully",
      data: tailor,
    });
  } catch (error) {
    next(error);
  }
};

export const updatePortfolioItemVisibility = async (req, res, next) => {
  try {
    const { id } = req.user;
    const { itemId } = req.params;
    const isVisible = booleanValue(req.body.isVisible);

    if (isVisible === undefined) {
      return res.status(400).json({ success: false, message: "isVisible must be a boolean" });
    }

    const tailor = await Vendor.findOneAndUpdate(
      { userId: id, "portfolioGallery._id": itemId },
      { $set: { "portfolioGallery.$.isVisible": isVisible } },
      { new: true, runValidators: true }
    );

    if (!tailor) {
      return res.status(404).json({ success: false, message: "Portfolio item not found" });
    }

    return res.status(200).json({
      success: true,
      message: isVisible ? "Portfolio item is now visible" : "Portfolio item is now hidden",
      data: tailor,
    });
  } catch (error) {
    next(error);
  }
};

export const deletePortfolioItem = async (req, res, next) => {
  try {
    const { id } = req.user;
    const { itemId } = req.params;

    const tailor = await Vendor.findOne({ userId: id, "portfolioGallery._id": itemId });
    if (!tailor) {
      return res.status(404).json({ success: false, message: "Portfolio item not found" });
    }

    const portfolioItem = tailor.portfolioGallery.id(itemId);
    const deletedImageUrl = portfolioItem?.imageUrl;
    tailor.portfolioGallery.pull({ _id: itemId });

    if (deletedImageUrl) {
      Object.keys(tailor.categorizedWorkSections || {}).forEach((section) => {
        tailor.categorizedWorkSections[section] = tailor.categorizedWorkSections[section].filter(
          (url) => url !== deletedImageUrl
        );
      });
    }

    await tailor.save();

    return res.status(200).json({
      success: true,
      message: "Portfolio item deleted successfully",
      data: tailor,
    });
  } catch (error) {
    next(error);
  }
};

export const getDesignerPublicProfile = async (req, res, next) => {
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
      message: "Designer profile fetched successfully",
      data: {
        ...designer,
        ...publicDesignerPortfolio(designer),
        socialProof: {
          completedOrders: designer.completedOrdersCount || 0,
          reviews: designer.reviewsCount || designer.totalRatings || 0,
          ratings: Number(averageRating.toFixed(2)),
        },
        verificationBadge: {
          isVerified: Boolean(designer.isVerifiedDesigner),
          verifiedAt: designer.verifiedAt,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};


export const deleteTailor = async (req, res, next) => {
  try {
    const { id } = req.user;
    const { tailorId } = req.params;

    if (!tailorId) {
      return res.status(400).json({
        success: false,
        message: "Tailor ID is required",
      });
    }

    const tailor = await Vendor.findOneAndDelete({ _id: tailorId, userId: id });

    if (!tailor) {
      return res.status(404).json({
        success: false,
        message: "Tailor not found or unauthorized",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Tailor deleted successfully",
      data: tailor,
    });

  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid tailor ID format",
      });
    }
    next(error);
  }
};

export const getAllAssignedMaterials = async (req, res, next) => {
  try {
    const { id } = req.user;
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const vendor = await Vendor.findOne({ userId: user._id });
    const materials = await Material.find({ userId: user._id }).select("_id");
    const materialIds = materials.map((m) => m._id);

    // Build query conditions safely
    const query = { $or: [] };

    if (vendor) {
      query.$or.push({ vendorId: vendor._id });
    }
    if (materialIds.length > 0) {
      query.$or.push({ materialId: { $in: materialIds } });
    }

    // If no vendor & no materials, return empty set
    if (query.$or.length === 0) {
      return res.status(200).json({ success: true, count: 0, reviews: [] });
    }

    const reviews = await Review.find(query)
      .sort({ createdAt: -1 })
      .populate("userId", "fullName email image")
      .populate(
        "materialId",
        "userId attireType clothMaterial color brand measurement sampleImage settlement isDelivered specialInstructions"
      )
      .populate("vendorId", "userId businessName businessEmail businessPhone")
      .lean();

    return res.status(200).json({
      success: true,
      count: reviews.length,
      reviews,
    });
  } catch (error) {
    next(error);
  }
};
