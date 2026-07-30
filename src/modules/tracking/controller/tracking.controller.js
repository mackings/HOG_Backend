import Tracking from "../model/tracking.model.js";
import Material from "../../material/model/material.model.js";
import crypto from "crypto";
import User from "../../user/model/user.model.js";
import Vendor from "../../vendor/model/vendor.model.js";
import Review from "../../review/model/review.model.js";
import { sendDeliveryStartedEmail } from "../../../utils/emailService.utils.js";
import { fedexCreateShipment, fedexTrackShipment } from "../../../utils/carriers/fedex.service.js";
import { dhlCreateShipment, dhlTrackShipment } from "../../../utils/carriers/dhl.service.js";
import { toISOCode } from "../../../utils/carriers/countryCode.utils.js";



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

    if (!materialId || !carrier || !serviceType || !packages?.length) {
      return res.status(400).json({
        success: false,
        message: "materialId, carrier, serviceType, and packages are required",
      });
    }

    const validCarriers = ["fedex", "dhl"];
    if (!validCarriers.includes(carrier)) {
      return res.status(400).json({
        success: false,
        message: "carrier must be 'fedex' or 'dhl'",
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

    // Build structured addresses for carriers
    const senderAddress = {
      streetLines: [vendorProfile.address || ""],
      city: vendorProfile.city || "",
      stateOrProvinceCode: vendorProfile.state?.substring(0, 2).toUpperCase() || "",
      postalCode: vendorProfile.postalCode || "100001",
      countryCode: toISOCode(vendorUser?.country),
    };

    const recipientAddress = {
      streetLines: [buyer?.address || ""],
      city: buyer?.city || "",
      stateOrProvinceCode: buyer?.state?.substring(0, 2).toUpperCase() || "",
      postalCode: buyer?.postalCode || "100001",
      countryCode: toISOCode(buyer?.country),
    };

    const senderContact = {
      personName: vendorUser?.fullName || vendorProfile.businessName,
      phoneNumber: vendorProfile.businessPhone || vendorUser?.phoneNumber || "",
      emailAddress: vendorProfile.businessEmail || vendorUser?.email || "",
      companyName: vendorProfile.businessName,
    };

    const recipientContact = {
      personName: buyer?.fullName || "",
      phoneNumber: buyer?.phoneNumber || "",
      emailAddress: buyer?.email || "",
    };

    // Normalise packages to carrier format
    const normalizedPackages = packages.map((pkg) => ({
      weight: { units: "KG", value: pkg.weight || 1 },
      dimensions: {
        length: pkg.dimensions?.length || 10,
        width: pkg.dimensions?.width || 10,
        height: pkg.dimensions?.height || 10,
        units: "CM",
      },
    }));

    let shipmentResult;

    if (carrier === "fedex") {
      const isIntl = senderAddress.countryCode !== recipientAddress.countryCode;
      let customsClearanceDetail = null;

      if (isIntl) {
        // Look up the review to get the USD customs value
        const review = await Review.findOne({ materialId: material._id }).sort({ createdAt: -1 }).lean();
        const totalWeightKg = normalizedPackages.reduce((s, p) => s + (p.weight?.value || 1), 0);
        const customsAmountUSD = review?.amountToPayUSD || review?.totalCostUSD || 200;
        const customsAmount = customsAmountUSD > 0 ? customsAmountUSD : (review?.totalCost ? review.totalCost / (review?.exchangeRate || 1500) : 200);

        customsClearanceDetail = {
          dutiesPayment: {
            paymentType: "SENDER",
            payor: {
              responsibleParty: {
                accountNumber: { value: process.env.FEDEX_ACCOUNT_NUMBER },
              },
            },
          },
          totalCustomsValue: {
            amount: parseFloat(customsAmount.toFixed(2)),
            currency: "USD",
          },
          commodities: [
            {
              description: contentDescription || "Clothing and fashion garments",
              countryOfManufacture: senderAddress.countryCode,
              quantity: 1,
              quantityUnits: "PCS",
              unitPrice: {
                amount: parseFloat(customsAmount.toFixed(2)),
                currency: "USD",
              },
              customsValue: {
                amount: parseFloat(customsAmount.toFixed(2)),
                currency: "USD",
              },
              weight: {
                units: "KG",
                value: totalWeightKg,
              },
            },
          ],
        };
      }

      shipmentResult = await fedexCreateShipment({
        senderAddress,
        senderContact,
        recipientAddress,
        recipientContact,
        packages: normalizedPackages,
        serviceType,
        labelFormat,
        customsClearanceDetail,
      });
    } else {
      // DHL uses a slightly different address shape
      const dhlSender = {
        postalCode: senderAddress.postalCode,
        cityName: senderAddress.city,
        countryCode: senderAddress.countryCode,
        addressLine1: senderAddress.streetLines[0],
        typeCode: "business",
        contactInformation: {
          fullName: senderContact.personName,
          phone: senderContact.phoneNumber,
          email: senderContact.emailAddress,
          companyName: senderContact.companyName,
        },
      };
      const dhlReceiver = {
        postalCode: recipientAddress.postalCode,
        cityName: recipientAddress.city,
        countryCode: recipientAddress.countryCode,
        addressLine1: recipientAddress.streetLines[0],
        typeCode: "private",
        contactInformation: {
          fullName: recipientContact.personName,
          phone: recipientContact.phoneNumber,
          email: recipientContact.emailAddress,
        },
      };
      const dhlPackages = packages.map((pkg) => ({
        weight: pkg.weight || 1,
        dimensions: {
          length: pkg.dimensions?.length || 10,
          width: pkg.dimensions?.width || 10,
          height: pkg.dimensions?.height || 10,
        },
      }));

      shipmentResult = await dhlCreateShipment({
        shipperDetails: dhlSender,
        receiverDetails: dhlReceiver,
        packages: dhlPackages,
        productCode: serviceType,
        contentDescription: contentDescription || "Fashion garments",
        labelFormat: labelFormat.toLowerCase(),
      });
    }

    // Persist to Tracking
    const existingTracking = await Tracking.findOne({ materialId: material._id });

    const trackingFields = {
      carrier,
      carrierTrackingNumber: shipmentResult.trackingNumber,
      serviceType,
      labelBase64: shipmentResult.labelBase64,
      labelFormat: shipmentResult.labelFormat,
      shipmentCreatedAt: new Date(),
      status: "dispatched",
    };

    let track;
    if (existingTracking) {
      track = await Tracking.findByIdAndUpdate(existingTracking._id, trackingFields, { new: true });
    } else {
      track = await Tracking.create({
        userId: material.userId,
        vendorId: id,
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

    return res.status(201).json({
      success: true,
      message: `${carrier.toUpperCase()} shipment created successfully`,
      data: {
        trackingId: track._id,
        carrier,
        carrierTrackingNumber: shipmentResult.trackingNumber,
        serviceType,
        labelBase64: shipmentResult.labelBase64,
        labelFormat: shipmentResult.labelFormat,
      },
    });
  } catch (error) {
    next(error);
  }
};


/**
 * GET /tracking/carrier/:carrierTrackingNumber?carrier=fedex|dhl
 *
 * Returns live tracking events from FedEx or DHL.
 * Both the designer and the buyer can call this.
 */
export const trackCarrierShipment = async (req, res, next) => {
  try {
    const { carrierTrackingNumber } = req.params;
    const carrier = (req.query.carrier || "").toLowerCase();

    if (!carrierTrackingNumber) {
      return res.status(400).json({ success: false, message: "carrierTrackingNumber is required" });
    }

    if (!["fedex", "dhl"].includes(carrier)) {
      return res.status(400).json({
        success: false,
        message: "carrier query param must be 'fedex' or 'dhl'",
      });
    }

    let result;
    if (carrier === "fedex") {
      result = await fedexTrackShipment(carrierTrackingNumber);
    } else {
      result = await dhlTrackShipment(carrierTrackingNumber);
    }

    // Optionally sync status to our DB
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
