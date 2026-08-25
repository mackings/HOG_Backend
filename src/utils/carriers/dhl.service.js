// ============================================================
// DHL integration — commented out pending API approval
// Re-enable by uncommenting and restoring imports in:
//   src/modules/deliveryRate/controller/deliveryRate.controller.js
//   src/modules/tracking/controller/tracking.controller.js
// ============================================================

/*
import axios from "axios";

const BASE_URL =
  process.env.DHL_ENV === "production"
    ? "https://express.api.dhl.com/mydhlapi"
    : "https://express.api.dhl.com/mydhlapi/test";

const TRACKING_URL = "https://api-eu.dhl.com/track/shipments";

const authHeader = () => {
  if (!process.env.DHL_API_KEY || !process.env.DHL_API_SECRET) {
    throw new Error("DHL Express credentials not configured. Set DHL_API_KEY and DHL_API_SECRET.");
  }
  return `Basic ${Buffer.from(`${process.env.DHL_API_KEY}:${process.env.DHL_API_SECRET}`).toString("base64")}`;
};

const nextBusinessDay = () => {
  const d = new Date(Date.now() + 86_400_000);
  return d.toISOString().replace("Z", " GMT+00:00");
};

export const dhlGetRates = async ({ shipperDetails, receiverDetails, packages, isCustomsDeclarable = false }) => {
  const { data } = await axios.post(`${BASE_URL}/rates`, {
    customerDetails: {
      shipperDetails: { ...shipperDetails, typeCode: shipperDetails.typeCode || "business" },
      receiverDetails: { ...receiverDetails, typeCode: receiverDetails.typeCode || "private" },
    },
    accounts: [{ number: process.env.DHL_ACCOUNT_NUMBER, typeCode: "shipper" }],
    plannedShippingDateAndTime: nextBusinessDay(),
    unitOfMeasurement: "metric",
    isCustomsDeclarable,
    packages: packages.map((pkg) => ({ weight: pkg.weight, dimensions: { length: pkg.dimensions?.length || 10, width: pkg.dimensions?.width || 10, height: pkg.dimensions?.height || 10 } })),
  }, { headers: { Authorization: authHeader(), "Content-Type": "application/json" } });
  return (data.products || []).map((product) => {
    const pricing = product.pricingOptions?.[0]?.totalPrice?.[0];
    return { carrier: "dhl", serviceType: product.productCode, serviceName: product.productName, estimatedDeliveryDate: product.deliveryCapabilities?.estimatedDeliveryDateAndTime || null, transitDays: product.deliveryCapabilities?.deliveryTypeCode || null, amount: pricing ? Number(pricing.price) : null, currency: pricing?.priceCurrency || "USD" };
  });
};

export const dhlCreateShipment = async ({ shipperDetails, receiverDetails, packages, productCode = "P", contentDescription = "Fashion garments", isCustomsDeclarable = false, labelFormat = "pdf" }) => {
  const { data } = await axios.post(`${BASE_URL}/shipments`, {
    plannedShippingDateAndTime: nextBusinessDay(),
    pickup: { isRequested: false },
    productCode,
    accounts: [{ number: process.env.DHL_ACCOUNT_NUMBER, typeCode: "shipper" }],
    customerDetails: { shipperDetails, receiverDetails },
    content: { packages: packages.map((pkg) => ({ weight: pkg.weight, dimensions: { length: pkg.dimensions?.length || 10, width: pkg.dimensions?.width || 10, height: pkg.dimensions?.height || 10 } })), isCustomsDeclarable, description: contentDescription, incoterm: "DAP", unitOfMeasurement: "metric" },
    outputImageProperties: { printerDPI: 300, encodingFormat: labelFormat, imageOptions: [{ typeCode: "label", templateName: "ECOM26_84_001", isRequested: true, hideAccountNumber: true }] },
  }, { headers: { Authorization: authHeader(), "Content-Type": "application/json" } });
  const labelDoc = (data.documents || []).find((d) => d.typeCode === "label");
  return { carrier: "dhl", trackingNumber: data.shipmentTrackingNumber, labelBase64: labelDoc?.content || null, labelFormat, serviceType: productCode };
};

export const dhlTrackShipment = async (trackingNumber) => {
  const trackingKey = process.env.DHL_TRACKING_API_KEY;
  if (!trackingKey) throw new Error("DHL_TRACKING_API_KEY not configured.");
  const { data } = await axios.get(TRACKING_URL, { params: { trackingNumber }, headers: { "DHL-API-Key": trackingKey } });
  const shipment = data.shipments?.[0];
  return {
    carrier: "dhl", trackingNumber,
    status: shipment?.status?.status || "UNKNOWN",
    statusDescription: shipment?.status?.description || "",
    estimatedDelivery: shipment?.estimatedTimeOfDelivery || null,
    events: (shipment?.events || []).map((e) => ({ timestamp: e.timestamp, description: e.description, location: [e.location?.address?.addressLocality, e.location?.address?.countryCode].filter(Boolean).join(", ") })),
  };
};
*/
