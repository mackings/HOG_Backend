import Tracking from "../model/tracking.model.js";
import Material from "../../material/model/material.model.js";
import crypto from "crypto";



export const createTracking = async (req, res, next) => {
  try {
    const { id } = req.user;
    const { materialId } = req.query;

    if (!materialId) {
      return res.status(400).json({
        success: false,
        message: "Material ID is required",
      });
    }

    const material = await Material.findById(materialId);
    if (!material) {
      return res.status(404).json({
        success: false,
        message: "Cloth material not found",
      });
    }

    if(material.isDelivered == true ){
        return res.status(409).json({
        success: false,
        message: "Cloth material has been delivered to the owner, thanks you",
      });
    }

    const existingTracking = await Tracking.findOne({materialId: material._id});
    if(existingTracking){
      return res.status(200).json({
        success: true,
        message: "Tracking already exists for this cloth material for dispatch or delivery",
        data: existingTracking,
        alreadyExists: true,
      });
   }

    let trackingNumber;
    let exists = true;
    while (exists) {
      trackingNumber = crypto.randomInt(100000, 999999).toString();
      exists = await Tracking.findOne({ trackingNumber });
    }

    const track = await Tracking.create({
      userId: material.userId,
      vendorId: id,
      materialId: material._id,
      trackingNumber,
    });

    return res.status(201).json({
      success: true,
      message: "Tracking successfully created",
      data: track,
    });
  } catch (error) {
    next(error)
  }
};




export const deleteTracking = async (req, res, next) => {
  try {
    const { id } = req.user; // vendorId
    const { trackingId } = req.query;

    if (!trackingId) {
      return res.status(400).json({
        success: false,
        message: "Tracking ID is required",
      });
    }

    const track = await Tracking.findById(trackingId);
    if (!track) {
      return res.status(404).json({
        success: false,
        message: "Tracking record not found",
      });
    }

    const trackingMaterial = await Material.findById(track.materialId);
    if(trackingMaterial.isDelivered == true){
        return res.status(403).json({
        success: false,
        message: "This tracking record for the clothe material delivered, can not deleted",
      });
    }

    if (track.vendorId.toString() !== id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized: You can only delete your own tracking",
      });
    }

    await track.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Tracking deleted successfully",
      data: { trackingId },
    });
  } catch (error) {
    next(error);
  }
};



export const getTracking = async (req, res, next) => {
  try {
    const { id} = req.user; // logged-in user
    const { trackingId } = req.query;

    if (!trackingId) {
      return res.status(400).json({
        success: false,
        message: "Tracking ID is required",
      });
    }

    const track = await Tracking.findById(trackingId);
    if (!track) {
      return res.status(404).json({
        success: false,
        message: "Tracking record not found",
      });
    }

    if (
      track.vendorId.toString() !== id.toString() &&
      track.userId.toString() !== id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized: You can only view your own tracking",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Tracking fetched successfully",
      data: track,
    });
  } catch (error) {
    next(error)
  }
};



export const getAllTracking = async (req, res, next) => {
  try {
    const { id } = req.user;

    const tracks = await Tracking.find({
      $or: [{ vendorId: id }, { userId: id }],
    })
      .sort({ createdAt: -1 })
      .populate("materialId", "attireType clothMaterial color measurement sampleImage brand")
      .lean();

    return res.status(200).json({
      success: true,
      message: tracks.length > 0
        ? "Tracking records fetched successfully"
        : "No tracking records found",
      data: tracks,
    });
  } catch (error) {
    next(error);
  }
};




export const updateMaterialThroughTracking = async (req, res, next) => {
  try {
    const { id } = req.user; // logged-in user (must be the recipient)
    const { trackingNumber } = req.query;

    if (!trackingNumber) {
      return res.status(400).json({
        success: false,
        message: "Tracking number is required",
      });
    }

    // 1️⃣ Find the tracking record
    const track = await Tracking.findOne({ trackingNumber });
    if (!track) {
      return res.status(404).json({
        success: false,
        message: "Invalid tracking number",
      });
    }

    // 2️⃣ Ensure the logged-in user is the rightful recipient
    if (track.userId.toString() !== id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized: You are not the owner of this material",
      });
    }

    // 3️⃣ Find the material linked to this user
    const material = await Material.findOne({ userId: track.userId });
    if (!material) {
      return res.status(404).json({
        success: false,
        message: "Material not found for this tracking",
      });
    }

    // 4️⃣ Update material as delivered
    const updateMaterial = await Material.findByIdAndUpdate(material._id, {
        isDelivered: true
    },
    {
        new: true
    });

    await Tracking.findByIdAndUpdate(track._id, { isDelivered: true}, { new: true });

    return res.status(200).json({
      success: true,
      message: "Material successfully marked as delivered",
      data: updateMaterial,
    });
  } catch (error) {
    next(error)
  }
};
