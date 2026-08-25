// ============================================================
// FedEx integration — commented out pending API approval
// Re-enable by uncommenting and restoring imports in:
//   src/modules/deliveryRate/controller/deliveryRate.controller.js
//   src/modules/tracking/controller/tracking.controller.js
// ============================================================

/*
import axios from "axios";

const BASE_URL =
  process.env.FEDEX_ENV === "production"
    ? "https://apis.fedex.com"
    : "https://apis-sandbox.fedex.com";

let _cachedToken = null;
let _tokenExpiry = 0;

const getAccessToken = async () => {
  if (_cachedToken && Date.now() < _tokenExpiry - 60_000) return _cachedToken;
  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: process.env.FEDEX_CLIENT_ID,
    client_secret: process.env.FEDEX_CLIENT_SECRET,
  });
  const { data } = await axios.post(`${BASE_URL}/oauth/token`, params.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  _cachedToken = data.access_token;
  _tokenExpiry = Date.now() + data.expires_in * 1000;
  return _cachedToken;
};

const authHeaders = async () => ({
  Authorization: `Bearer ${await getAccessToken()}`,
  "Content-Type": "application/json",
  "x-locale": "en_US",
});

const cleanAddress = (addr) =>
  Object.fromEntries(Object.entries(addr).filter(([, v]) => v !== null && v !== undefined && v !== ""));

export const fedexGetRates = async ({ senderAddress, recipientAddress, packages, currency = "USD" }) => {
  const headers = await authHeaders();
  let rateData;
  try {
    const resp = await axios.post(`${BASE_URL}/rate/v1/rates/quotes`, {
      accountNumber: { value: process.env.FEDEX_ACCOUNT_NUMBER },
      requestedShipment: {
        shipper: { address: cleanAddress(senderAddress) },
        recipient: { address: cleanAddress(recipientAddress) },
        pickupType: "DROPOFF_AT_FEDEX_LOCATION",
        preferredCurrency: currency,
        rateRequestType: ["ACCOUNT", "LIST"],
        requestedPackageLineItems: packages,
      },
    }, { headers });
    rateData = resp.data;
  } catch (err) {
    const body = err.response?.data || {};
    const msg = body.errors?.[0]?.message || body.message || err.message;
    const e = new Error(msg);
    e.status = err.response?.status || 500;
    throw e;
  }
  return (rateData.output?.rateReplyDetails || []).map((detail) => {
    const rateDetail = detail.ratedShipmentDetails?.[0];
    return {
      carrier: "fedex",
      serviceType: detail.serviceType,
      serviceName: detail.serviceName,
      estimatedDeliveryDate: detail.commit?.dateDetail?.dayFormat || null,
      transitDays: detail.commit?.transitDays?.toString() || null,
      amount: rateDetail?.totalNetCharge ?? null,
      currency: rateDetail?.currency || currency,
    };
  });
};

export const fedexCreateShipment = async ({ senderAddress, senderContact, recipientAddress, recipientContact, packages, serviceType, labelFormat = "PDF", customsClearanceDetail = null }) => {
  const headers = await authHeaders();
  const isInternational = senderAddress.countryCode !== recipientAddress.countryCode;
  let resp;
  try {
    resp = await axios.post(`${BASE_URL}/ship/v1/shipments`, {
      labelResponseOptions: "LABEL",
      accountNumber: { value: process.env.FEDEX_ACCOUNT_NUMBER },
      requestedShipment: {
        shipper: { address: cleanAddress(senderAddress), contact: senderContact },
        recipients: [{ address: cleanAddress(recipientAddress), contact: recipientContact }],
        pickupType: "DROPOFF_AT_FEDEX_LOCATION",
        serviceType,
        packagingType: "YOUR_PACKAGING",
        shippingChargesPayment: { paymentType: "SENDER", payor: { responsibleParty: { accountNumber: { value: process.env.FEDEX_ACCOUNT_NUMBER } } } },
        labelSpecification: { imageType: labelFormat, labelStockType: "PAPER_85X11_TOP_HALF_LABEL" },
        requestedPackageLineItems: packages,
        ...(isInternational && customsClearanceDetail && { customsClearanceDetail }),
      },
    }, { headers });
  } catch (err) {
    const fedexMsg = err.response?.data?.errors?.[0]?.message || err.message;
    const fedexCode = err.response?.data?.errors?.[0]?.code;
    const e = new Error(fedexMsg);
    e.status = err.response?.status || 500;
    if (fedexCode) e.fedexCode = fedexCode;
    throw e;
  }
  const shipment = resp.data.output?.transactionShipments?.[0];
  const pieceResponse = shipment?.pieceResponses?.[0];
  return {
    carrier: "fedex",
    trackingNumber: shipment?.masterTrackingNumber,
    labelBase64: pieceResponse?.packageDocuments?.[0]?.encodedLabel || null,
    labelFormat,
    serviceType,
  };
};

export const fedexValidateAddress = async (addresses) => {
  const headers = await authHeaders();
  const { data } = await axios.post(`${BASE_URL}/address/v1/addresses/resolve`, {
    addressesToValidate: addresses.map((addr) => ({ address: { streetLines: addr.streetLines, city: addr.city, stateOrProvinceCode: addr.stateOrProvinceCode || undefined, postalCode: addr.postalCode || undefined, countryCode: addr.countryCode } })),
  }, { headers });
  return (data.output?.resolvedAddresses || []).map((resolved) => ({
    streetLines: resolved.streetLinesToken || [],
    city: resolved.city,
    stateOrProvinceCode: resolved.stateOrProvinceCode,
    postalCode: resolved.postalCodeToken?.value || null,
    countryCode: resolved.countryCode,
    classification: resolved.classification,
    isDeliveryPointValid: resolved.normalizedStatusNameDPV === true,
    isResolved: resolved.attributes?.Resolved === true,
    isMatched: resolved.attributes?.Matched === true,
    postOfficeBox: resolved.postOfficeBox === true,
    customerMessages: (resolved.customerMessage || []).filter(Boolean),
    resolutionMethod: resolved.resolutionMethodName || null,
    alerts: data.output?.alerts || [],
  }));
};

export const fedexTrackShipment = async (trackingNumber) => {
  const headers = await authHeaders();
  let trackResp;
  try {
    trackResp = await axios.post(`${BASE_URL}/track/v1/trackingnumbers`, {
      trackingInfo: [{ trackingNumberInfo: { trackingNumber } }],
      includeDetailedScans: true,
    }, { headers });
  } catch (err) {
    const fedexMsg = err.response?.data?.errors?.[0]?.message || err.message;
    const fedexCode = err.response?.data?.errors?.[0]?.code;
    const e = new Error(fedexMsg);
    e.status = err.response?.status || 500;
    if (fedexCode) e.fedexCode = fedexCode;
    throw e;
  }
  const result = trackResp.data.output?.completeTrackResults?.[0]?.trackResults?.[0];
  return {
    carrier: "fedex",
    trackingNumber,
    status: result?.latestStatusDetail?.status || "UNKNOWN",
    statusDescription: result?.latestStatusDetail?.description || "",
    estimatedDelivery: result?.estimatedDeliveryTimeWindow?.window?.ends || null,
    events: (result?.scanEvents || []).map((e) => ({
      timestamp: e.date,
      description: e.eventDescription,
      location: [e.scanLocation?.city, e.scanLocation?.countryCode].filter(Boolean).join(", "),
    })),
  };
};
*/
