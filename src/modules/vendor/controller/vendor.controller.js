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
    if (!req.imageUrl) {
      return res.status(400).json({ message: "Nepa bill image is required" });
    }

    // Create vendor
    const newTailor = await Vendor.create({
      userId: id,
      businessName,
      businessEmail,
      businessPhone,
      address,
      nepaBill: req.imageUrl,
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

    const tailor = await Vendor.findOne({ userId: id });
    if (!tailor) {
      return res.status(404).json({
        success: false,
        message: "Tailor not found",
      });
    }

    const assignedMaterials = await Material.find({ vendorId: tailor._id })
      .populate("userId", "fullName email phoneNumber address city state");

    if (assignedMaterials.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No assigned materials found for you",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Assigned materials fetched successfully",
      count: assignedMaterials.length,
      data: assignedMaterials,
    });

  } catch (error) {
    next(error);
  }
};


export const updateMaterialPrice = async (req, res, next) => {
  try {
    const { id } = req.user;
    const vendor = await Vendor.findOne({ userId: id });

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      });
    }

    const { materialId } = req.params;
    const { price } = req.body;

    if (price === undefined || price === null) {
      return res.status(400).json({
        success: false,
        message: "Price is required",
      });
    }

    // Option 1: Increment price
    // const updateQuery = { $inc: { price: price } };

    // Option 2: Set new price (recommended)
    const updateQuery = { $set: { price: price, vendorId: vendor._id } };

    const material = await Material.findOneAndUpdate(
      { _id: materialId },
      updateQuery,
      { new: true }
    );

    if (!material) {
      return res.status(404).json({
        success: false,
        message: "Material not found or unauthorized",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Material price updated successfully",
      data: material,
    });
  } catch (error) {
    next(error);
  }
};


