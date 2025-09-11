import User from "../../user/model/user.model.js";
import Vendor from "../model/vendor.model.js";
import Material from "../../material/model/material.model.js";


export const createTailor = async (req, res, next) => {
  try {
    const { id } = req.user;
    const {
      businessName,
      businessEmail,
      businessPhone,
      address,
      city,
      state,
      yearOfExperience,
      description
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
      address,
      nepaBill: images,
      city,
      state,
      yearOfExperience,
      description
    });

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
          yearOfExperience: updates.yearOfExperience,
          description: updates.description
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


export const updateMaterialPrice  = async (req, res, next) => {
  try {
    const { id } = req.user;
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (user.role !== "tailor") {
        return res.status(403).json({
        success: false,
        message: "You are not authorized to update a review and quote of the material for the vendor",
      });
    }

    const { reviewId } = req.params;

    const vendor = await Vendor.findOne({ userId: user._id });
    if (!vendor) {
      return res.status(403).json({
        success: false,
        message: "Your organization has not been set up yet",
      });
    }

    let review = await Review.findOne({ _id: reviewId, vendorId: vendor._id });
    if (!review) {
      return res.status(200).json({
        success: true,
        review: null,
        message: "Review not found",
      });
    }

    if (review.status === "approved") {
        return res.status(403).json({
          success: false,
          message: "You cannot update an approved review",
        });
    }

    const {
      comment,
      materialTotalCost,
      workmanshipTotalCost,
      deliveryDate,
      reminderDate,
    } = req.body;

    // Update numeric fields safely
    if (materialTotalCost !== undefined) {
      review.materialTotalCost = Number(materialTotalCost) || 0;
    }
    if (workmanshipTotalCost !== undefined) {
      review.workmanshipTotalCost = Number(workmanshipTotalCost) || 0;
    }

    // Always recompute total
    review.totalCost =
      (review.materialTotalCost || 0) + (review.workmanshipTotalCost || 0);

    if (comment !== undefined) review.comment = comment;
    if (deliveryDate !== undefined) review.deliveryDate = deliveryDate;
    if (reminderDate !== undefined) review.reminderDate = reminderDate;

    await review.save();

    review = await Review.findById(review._id)
      .populate("userId", "fullName email image")
      .populate(
        "materialId",
        "userId attireType clothMaterial color brand measurement sampleImage settlement isDelivered specialInstructions"
      )
      .populate("vendorId", "userId businessName businessEmail businessPhone")
      .lean();

    return res.status(200).json({
      success: true,
      message: "Review updated successfully",
      review,
    });
  } catch (error) {
    next(error);
  }
};
