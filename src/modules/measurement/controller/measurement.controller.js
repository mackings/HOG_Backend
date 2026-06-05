import MeasurementProfile from "../model/measurementProfile.model.js";
import MeasurementRequest from "../model/measurementRequest.model.js";
import CustomRequest from "../../customOrder/model/customRequest.model.js";
import InitializedOrder from "../../material/model/InitializedOrder.model.js";
import Transaction from "../../transaction/model/transaction.model.js";
import Vendor from "../../vendor/model/vendor.model.js";
import { rejectPastedMediaUrls } from "../../../utils/deviceUpload.utils.js";

const canAccessProfile = (profile, userId) => String(profile.userId) === String(userId);

const uniqueIds = (values) => [...new Set(values.filter(Boolean).map((value) => String(value)))];

const designerRelationshipFilter = (designerId, vendorId) => {
  const filters = [{ vendorId: designerId }, { "cartItems.userId": designerId }];
  if (vendorId) filters.push({ vendorId });
  return { $or: filters };
};

const summarizeRelationship = (customerId, customRequests, orders, transactions) => {
  const isCustomer = (record) => String(record.userId || record.customerId || "") === String(customerId);
  const customerRequests = customRequests.filter((request) => String(request.customerId) === String(customerId));
  const customerOrders = orders.filter(isCustomer);
  const customerTransactions = transactions.filter(isCustomer);

  return {
    hasCustomRequest: customerRequests.length > 0,
    hasMarketplacePurchase: customerOrders.length > 0 || customerTransactions.length > 0,
    customRequestCount: customerRequests.length,
    purchaseCount: customerOrders.length + customerTransactions.length,
    latestCustomRequest: customerRequests[0]
      ? {
          requestId: customerRequests[0]._id,
          status: customerRequests[0].status,
          updatedAt: customerRequests[0].updatedAt,
        }
      : null,
    latestPurchaseAt: [...customerOrders, ...customerTransactions]
      .map((record) => record.updatedAt || record.createdAt)
      .filter(Boolean)
      .sort((a, b) => new Date(b) - new Date(a))[0] || null,
  };
};

export const createMeasurementProfile = async (req, res, next) => {
  try {
    const { id } = req.user;
    const { profileName, fitType, measurements, guideReferences, isDefault } = req.body;

    if (!profileName) {
      return res.status(400).json({ success: false, message: "profileName is required" });
    }
    if (rejectPastedMediaUrls(res, { guideReferences })) return;

    const profile = await MeasurementProfile.create({
      userId: id,
      profileName,
      fitType,
      measurements,
      guideReferences,
      isDefault: Boolean(isDefault),
    });

    return res.status(201).json({
      success: true,
      message: "Measurement profile created successfully",
      data: profile,
    });
  } catch (error) {
    next(error);
  }
};

export const getMeasurementProfiles = async (req, res, next) => {
  try {
    const { id } = req.user;
    const profiles = await MeasurementProfile.find({ userId: id }).sort({ createdAt: -1 }).lean();

    return res.status(200).json({
      success: true,
      message: "Measurement profiles fetched successfully",
      data: profiles,
    });
  } catch (error) {
    next(error);
  }
};

export const updateMeasurementProfile = async (req, res, next) => {
  try {
    const { id } = req.user;
    const { profileId } = req.params;
    const profile = await MeasurementProfile.findById(profileId);

    if (!profile) {
      return res.status(404).json({ success: false, message: "Measurement profile not found" });
    }
    if (!canAccessProfile(profile, id)) {
      return res.status(403).json({ success: false, message: "You can only edit your own measurement profile" });
    }

    profile.history.push({
      measurements: profile.measurements,
      changedBy: id,
      note: req.body.note || "Profile updated",
    });
    if (rejectPastedMediaUrls(res, { guideReferences: req.body.guideReferences })) return;

    for (const key of ["profileName", "fitType", "measurements", "guideReferences", "isDefault"]) {
      if (req.body[key] !== undefined) profile[key] = req.body[key];
    }

    await profile.save();

    return res.status(200).json({
      success: true,
      message: "Measurement profile updated successfully",
      data: profile,
    });
  } catch (error) {
    next(error);
  }
};

export const getDesignerCustomerMeasurementProfiles = async (req, res, next) => {
  try {
    const { id } = req.user;
    const vendor = await Vendor.findOne({ userId: id }).select("_id").lean();
    const relationshipFilter = designerRelationshipFilter(id, vendor?._id);

    const [customRequests, orders, transactions] = await Promise.all([
      CustomRequest.find({
        designerId: id,
        status: {
          $in: ["submitted", "designer_review", "quote_submitted", "revision_requested", "accepted", "converted_to_order"],
        },
      })
        .sort({ updatedAt: -1 })
        .select("customerId status updatedAt")
        .lean(),
      InitializedOrder.find(relationshipFilter)
        .sort({ updatedAt: -1 })
        .select("userId vendorId listingId paymentStatus orderStatus createdAt updatedAt")
        .lean(),
      Transaction.find(relationshipFilter)
        .sort({ updatedAt: -1 })
        .select("userId vendorId listingId paymentStatus orderStatus createdAt updatedAt")
        .lean(),
    ]);

    const customerIds = uniqueIds([
      ...customRequests.map((request) => request.customerId),
      ...orders.map((order) => order.userId),
      ...transactions.map((transaction) => transaction.userId),
    ]);

    if (customerIds.length === 0) {
      return res.status(200).json({
        success: true,
        message: "Customer measurement profiles fetched successfully",
        data: [],
      });
    }

    const profiles = await MeasurementProfile.find({ userId: { $in: customerIds } })
      .sort({ isDefault: -1, updatedAt: -1 })
      .populate("userId", "fullName image email")
      .lean();

    const profilesByCustomer = profiles.reduce((grouped, profile) => {
      const customerId = String(profile.userId?._id || profile.userId);
      if (!grouped[customerId]) grouped[customerId] = [];
      grouped[customerId].push(profile);
      return grouped;
    }, {});

    const data = Object.entries(profilesByCustomer).map(([customerId, customerProfiles]) => ({
      customer: customerProfiles[0].userId,
      profiles: customerProfiles,
      relationship: summarizeRelationship(customerId, customRequests, orders, transactions),
    }));

    return res.status(200).json({
      success: true,
      message: "Customer measurement profiles fetched successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const requestAdditionalMeasurements = async (req, res, next) => {
  try {
    const { id } = req.user;
    const { customerId, orderId, orderType, requestedFields, note } = req.body;

    if (!customerId || !orderId || !Array.isArray(requestedFields) || requestedFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: "customerId, orderId and requestedFields are required",
      });
    }

    const request = await MeasurementRequest.create({
      requesterId: id,
      customerId,
      orderId,
      orderType,
      requestedFields,
      note,
    });

    return res.status(201).json({
      success: true,
      message: "Additional measurement request created successfully",
      data: request,
    });
  } catch (error) {
    next(error);
  }
};

export const getMeasurementRequestTargets = async (req, res, next) => {
  try {
    const { id } = req.user;
    const requests = await CustomRequest.find({
      designerId: id,
      status: { $in: ["submitted", "designer_review", "quote_submitted", "revision_requested", "accepted", "converted_to_order"] },
    })
      .sort({ updatedAt: -1 })
      .populate("customerId", "fullName image")
      .populate("vendorId", "businessName")
      .lean();

    return res.status(200).json({
      success: true,
      message: "Measurement request targets fetched successfully",
      data: requests.map((request) => ({
        measurementTargetId: request._id,
        title: request.vendorId?.businessName || "Custom order",
        customer: request.customerId,
        status: request.status,
        quote: request.quote,
      })),
    });
  } catch (error) {
    next(error);
  }
};

export const requestAdditionalMeasurementsFromTarget = async (req, res, next) => {
  try {
    const { id } = req.user;
    const { measurementTargetId } = req.params;
    const { requestedFields, note } = req.body;

    if (!Array.isArray(requestedFields) || requestedFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: "requestedFields is required",
      });
    }

    const customRequest = await CustomRequest.findOne({ _id: measurementTargetId, designerId: id });
    if (!customRequest) {
      return res.status(404).json({ success: false, message: "Measurement target not found" });
    }

    const request = await MeasurementRequest.create({
      requesterId: id,
      customerId: customRequest.customerId,
      orderId: customRequest._id,
      orderType: "customRequest",
      requestedFields,
      note,
    });

    return res.status(201).json({
      success: true,
      message: "Additional measurement request created successfully",
      data: request,
    });
  } catch (error) {
    next(error);
  }
};

export const getMeasurementRequests = async (req, res, next) => {
  try {
    const { id } = req.user;
    const requests = await MeasurementRequest.find({
      $or: [{ customerId: id }, { requesterId: id }],
    })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      message: "Measurement requests fetched successfully",
      data: requests,
    });
  } catch (error) {
    next(error);
  }
};
