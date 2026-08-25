import Tracking from "../model/tracking.model.js";
import Material from "../../material/model/material.model.js";
import crypto from "crypto";
import User from "../../user/model/user.model.js";
import Vendor from "../../vendor/model/vendor.model.js";
import Review from "../../review/model/review.model.js";
import { sendDeliveryStartedEmail } from "../../../utils/emailService.utils.js";
// FedEx and DHL integrations are commented out pending API approval
// import { fedexCreateShipment, fedexTrackShipment } from "../../../utils/carriers/fedex.service.js";
// import { dhlCreateShipment, dhlTrackShipment } from "../../../utils/carriers/dhl.service.js";
import { fezCreateOrder, fezCreateExportOrder, fezCreateImportOrder, fezTrackOrder, resolveWeightId, lookupExportId, lookupImportId } from "../../../utils/carriers/fez.service.js";



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

    const [user, vendorUser, vendorProfile] = await Promise.all([
      User.findById(material.userId).lean(),
      User.findById(id).lean(),
      Vendor.findOne({ userId: id }).select("businessName").lean(),
    ]);

    if (user?.email) {
      await sendDeliveryStartedEmail({
        user,
        vendorUser,
        vendorProfile,
        material,
        tracking: track,
      });
    }

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




/**
 * POST /tracking/createCarrierShipment
 *
 * Creates a real shipment with FedEx or DHL and stores the carrier tracking
 * number + label against the Tracking record.
 *
 * Body:
 *   materialId   — ID of the material being shipped
 *   carrier      — "fedex" | "dhl"
 *   serviceType  — carrier service code from the rates endpoint
 *   packages     — [{ weight: 2, dimensions: { length, width, height } }]
 *   labelFormat  — "PDF" | "PNG" | "ZPLII" | "pdf" | "zpl"  (optional)
 *   contentDescription — short text for customs/waybill (optional)
 */
export const createCarrierShipment = async (req, res, next) => {
  try {
    const { id } = req.user; // must be the vendor (tailor)
    const {
      materialId,
      carrier,
      serviceType,
      packages,
      labelFormat = "PDF",
      contentDescription,
    } = req.body;

    if (!materialId || !packages?.length) {
      return res.status(400).json({
        success: false,
        message: "materialId and packages are required",
      });
    }

    const material = await Material.findById(materialId);
    if (!material) {
      return res.status(404).json({ success: false, message: "Material not found" });
    }

    const [buyer, vendorProfile, vendorUser] = await Promise.all([
      User.findById(material.userId).lean(),
      Vendor.findOne({ userId: id }).lean(),
      User.findById(id).lean(),
    ]);

    if (!vendorProfile) {
      return res.status(403).json({ success: false, message: "Vendor profile not found" });
    }

    const totalWeight = packages.reduce((sum, p) => sum + (p.weight || 1), 0);
    const uniqueID    = `HOG-${material._id}`;
    const batchID     = `BATCH-${material._id}`;

    const review = await Review.findOne({ materialId: material._id }).sort({ createdAt: -1 }).lean();
    const valueOfItem = review?.totalCost || review?.amountToPay || 5000;

    const normalizePhone = (phone) => {
      if (!phone) return "08000000000";
      let p = String(phone).trim().replace(/\s+/g, "");
      if (p.startsWith("+234")) p = p.slice(4);
      else if (p.startsWith("234")) p = p.slice(3);
      if (!p.startsWith("0")) p = "0" + p;
      return p.slice(0, 14);
    };

    const isNigeria = (c) => {
      const v = String(c || "").toLowerCase().trim();
      return v === "nigeria" || v === "ng" || v === "";
    };

    const vendorCountry  = vendorProfile.country || vendorUser?.country || "Nigeria";
    const buyerCountry   = buyer.country || "Nigeria";
    const vendorInNg     = isNigeria(vendorCountry);
    const buyerInNg      = isNigeria(buyerCountry);
    const pickUpState    = vendorProfile.state || vendorUser?.state || null;

    let fezResult;
    let resolvedServiceType = "FEZ_STANDARD";

    if (vendorInNg && buyerInNg) {
      // Domestic: NG → NG
      if (!buyer.state) {
        return res.status(400).json({ success: false, message: "Buyer's Nigerian state is required to create a domestic Fez shipment." });
      }
      fezResult = await fezCreateOrder([{
        recipientAddress: buyer.address || "",
        recipientState:   buyer.state,
        recipientName:    buyer.fullName || buyer.name || "",
        recipientPhone:   normalizePhone(buyer.phoneNumber),
        recipientEmail:   buyer.email || undefined,
        uniqueID,
        BatchID: batchID,
        valueOfItem,
        weight:  totalWeight,
        itemDescription: contentDescription || "Fashion garments",
      }]);
      resolvedServiceType = "FEZ_STANDARD";

    } else if (vendorInNg && !buyerInNg) {
      // Export: NG → World
      const exportLocationId = lookupExportId(buyerCountry);
      if (!exportLocationId) {
        return res.status(400).json({ success: false, message: `International export to "${buyer.country}" is not supported by Fez Delivery.` });
      }
      const weightId = resolveWeightId(totalWeight);
      fezResult = await fezCreateExportOrder([{
        recipientAddress: buyer.address || "",
        recipientName:    buyer.fullName || buyer.name || "",
        recipientPhone:   normalizePhone(buyer.phoneNumber),
        recipientEmail:   buyer.email || undefined,
        uniqueID,
        BatchID: batchID,
        valueOfItem,
        weight:  totalWeight,
        weightId,
        exportLocationId,
        pickUpState: pickUpState || undefined,
        itemDescription: contentDescription || "Fashion garments",
        itemCategory: 2, // Retail Products
      }]);
      resolvedServiceType = "FEZ_EXPORT";

    } else if (!vendorInNg && buyerInNg) {
      // Import: World → NG
      if (!buyer.state) {
        return res.status(400).json({ success: false, message: "Buyer's Nigerian state is required to create an international import Fez shipment." });
      }
      const importLocationId = lookupImportId(vendorCountry);
      if (!importLocationId) {
        return res.status(400).json({ success: false, message: `International import from "${vendorCountry}" is not supported by Fez Delivery. Supported origins: UK, US, India, Australia, Hong Kong, Niger, Palestine.` });
      }
      fezResult = await fezCreateImportOrder([{
        recipientAddress: buyer.address || "",
        recipientState:   buyer.state,
        recipientName:    buyer.fullName || buyer.name || "",
        recipientPhone:   normalizePhone(buyer.phoneNumber),
        recipientEmail:   buyer.email || undefined,
        uniqueID,
        BatchID: batchID,
        valueOfItem,
        weight:  totalWeight,
        quantity: 1,
        importLocationId,
        itemDescription: contentDescription || "Fashion garments",
        itemCategory: 2, // Retail Products
        businessName: vendorProfile.businessName || "House of GLAME",
      }]);
      resolvedServiceType = "FEZ_IMPORT";

    } else {
      return res.status(400).json({ success: false, message: "Route not supported: at least one party must be in Nigeria." });
    }

    const waybillNumber = fezResult.orderNos?.[uniqueID] || Object.values(fezResult.orderNos || {})[0] || null;

    // Persist to Tracking
    const existingTracking = await Tracking.findOne({ materialId: material._id });

    const trackingFields = {
      carrier:               "fez",
      carrierTrackingNumber: waybillNumber,
      serviceType:           resolvedServiceType,
      labelBase64:           null,
      labelFormat:           null,
      shipmentCreatedAt:     new Date(),
      status:                "dispatched",
    };

    let track;
    if (existingTracking) {
      track = await Tracking.findByIdAndUpdate(existingTracking._id, trackingFields, { new: true });
    } else {
      track = await Tracking.create({
        userId:    material.userId,
        vendorId:  id,
        materialId: material._id,
        ...trackingFields,
      });
    }

    if (buyer?.email) {
      await sendDeliveryStartedEmail({
        user: buyer,
        vendorUser,
        vendorProfile,
        material,
        tracking: track,
      });
    }

    const shipmentLabel = resolvedServiceType === "FEZ_EXPORT" ? "export" : resolvedServiceType === "FEZ_IMPORT" ? "import" : "domestic";
    return res.status(201).json({
      success: true,
      message: `Fez ${shipmentLabel} shipment created successfully`,
      data: {
        trackingId:            track._id,
        carrier:               "fez",
        carrierTrackingNumber: waybillNumber,
        waybillNumber,
        serviceType:           resolvedServiceType,
      },
    });
  } catch (error) {
    next(error);
  }
};


/**
 * GET /tracking/carrier/:carrierTrackingNumber?carrier=fez
 *
 * Returns live tracking events from Fez Delivery.
 * Both the designer and the buyer can call this.
 */
export const trackCarrierShipment = async (req, res, next) => {
  try {
    const { carrierTrackingNumber } = req.params;
    const carrier = (req.query.carrier || "fez").toLowerCase();

    if (!carrierTrackingNumber) {
      return res.status(400).json({ success: false, message: "carrierTrackingNumber is required" });
    }

    if (carrier !== "fez") {
      return res.status(400).json({
        success: false,
        message: "carrier query param must be 'fez'",
      });
    }

    const result = await fezTrackOrder(carrierTrackingNumber);

    // Sync delivered status to DB
    await Tracking.findOneAndUpdate(
      { carrierTrackingNumber },
      { status: result.status?.toLowerCase() === "delivered" ? "delivered" : "dispatched" }
    );

    return res.status(200).json({
      success: true,
      message: "Tracking info fetched successfully",
      data: result,
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

    await Tracking.findByIdAndUpdate(
      track._id,
      { isDelivered: true, status: "delivered" },
      { new: true }
    );

    return res.status(200).json({
      success: true,
      message: "Material successfully marked as delivered",
      data: updateMaterial,
    });
  } catch (error) {
    next(error)
  }
};
