import User from "../../user/model/user.model.js";
import Vendor from "../model/vendor.model.js";
import Published from "../model/published.model.js";
import Material from "../../material/model/material.model.js";


export const createPublished = async (req, res, next) => {
  try {
    const { id } = req.user;
    const user = await User.findById(id);
    if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
    }
    if (user.role !== "tailor") {
        return res.status(403).json({
        success: false,
        message: "You are not authorized to publish a material for a review and quote for the vendor",
      });
    }
    const {
      attireType,
      clothPublished,
      color,
      brand,
    } = req.body;

    const { categoryId } = req.params;
 
    const images = req.imageUrls || [];

    if (!categoryId || !attireType || !clothPublished) {
      return res.status(400).json({
        success: false,
        message: "categoryId, attireType and clothPublished are required",
      });
    }

    const published = await Published.create({
      userId: id,
      categoryId,
      attireType,
      clothPublished,
      color,
      brand,
      sampleImage: images,
    });

    return res.status(201).json({
      success: true,
      message: "Published successfully",
      data: published,
    });
  } catch (error) {
    next(error);
  }
};



export const getAllPublished = async (req, res, next) => {
    try {
        const { id } = req.user;
        const published = await Published.find({ userId: id });
        if (!published) {
            return res.status(404).json({ message: "Published not found" });
        }
        return res.status(200).json({
            success: true,
            message: "Published fetched successfully",
            data: published
        }); 
    } catch (error) {
        next(error);
    }
};



export const getPublishedById = async (req, res, next) => { 
    try {
        const { id } = req.user;
        const { publishedId } = req.params;
        const published = await Published.findById(publishedId);
        if(!published){
            return res.status(404).json({ message: "Published not found" });
        }

        return res.status(200).json({
            success: true,
            message: "published fetched successfully",
            data: published
        });
    } catch (error) {
        next(error);
    }
}


export const updatePublished = async (req, res, next) => {
  try {
    const { id } = req.user;
    const user = await User.findById(id);
    if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
    }
    if (user.role !== "tailor") {
        return res.status(403).json({
        success: false,
        message: "You are not authorized to update or publish a material for a review and quote for the vendor",
      });
    }
    const { publishedId } = req.params;
    const { attireType, clothPublished, color, brand } = req.body;

    const images = req.imageUrls;

    const updateData = {};
    if (attireType) updateData.attireType = attireType;
    if (clothPublished) updateData.clothPublished = clothPublished;
    if (color) updateData.color = color;
    if (brand) updateData.brand = brand;
    if (images && images.length > 0) updateData.sampleImage = images;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No fields provided for update",
      });
    }

    const updatedPublished = await Published.findOneAndUpdate(
      { _id: publishedId, userId: id },
      updateData,
      { new: true }
    );

    if (!updatedPublished) {
      return res.status(404).json({
        success: false,
        message: "Published not found or not authorized",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Published updated successfully",
      data: updatedPublished,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update published material",
      error: error.message,
    });
  }
};



export const deletePublished = async (req, res, next) => {
    try {
        const { id } = req.user;
        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        if (user.role !== "tailor") {
            return res.status(403).json({
            success: false,
            message: "You are not authorized to delete or publish a material for a review and quote for the vendor",
        });
        }
        const { publishedId } = req.params;
        const publishedConfirm = await Published.findOne({ _id: publishedId, userId: id });
        if (!publishedConfirm) {
            return res.status(401).json({
                    success: false,
                    message: "Published does not belong to this user",
            });
        }
        const published = await Published.findByIdAndDelete(publishedId);

        if (!published) {
            return res.status(404).json({
                success: false,
                message: "Published not found",
            });
        }
        return res.status(200).json({
            success: true,
            message: "Published deleted successfully",
            data: published,
        });
    } catch (error) {
        next(error);
    }
}



export const userPatronizedPublished = async (req, res, next) => {
    try {
    const { id } = req.user;
    const user = await User.findById(id);
    if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
    }
    if (user.role !== "user") {
        return res.status(403).json({
        success: false,
        message: "You are not authorized to patronize a material for a review and quote from the vendor, you must be a user",
    });
    }
    const { publishedId } = req.params;
    const published = await Published.findById(publishedId);
    if (!published) {
        return res.status(404).json({ success: false, message: "Published not found" });
    }

    const { measurement, specialInstructions } = req.body;

   const material = await Material.create({
        userId: id,
        categoryId: published.categoryId,
        attireType: published.attireType,
        clothMaterial: published.clothPublished,
        color: published.color,
        brand: published.brand,
        measurement,
        sampleImage: published.sampleImage,
        specialInstructions,
    });

    return res.status(201).json({
        success: true,
        message: "Material purchased successfully",
        data: material,
    });
    } catch (error) {
        next(error);
    }
}