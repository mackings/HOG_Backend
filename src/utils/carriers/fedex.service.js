import axios from "axios";

const BASE_URL =
  process.env.FEDEX_ENV === "production"
    ? "https://apis.fedex.com"
    : "https://apis-sandbox.fedex.com";

// In-memory token cache — FedEx tokens last 1 hour
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

/**
 * Get available rates between two addresses.
 *
 * senderAddress / recipientAddress shape:
 *   { streetLines: ["123 Main St"], city, stateOrProvinceCode, postalCode, countryCode }
 *
 * packages: [{ weight: { units: "KG", value: 2 }, dimensions: { length, width, height, units: "CM" } }]
 */
export const fedexGetRates = async ({
  senderAddress,
  recipientAddress,
  packages,
  currency = "USD",
}) => {
  const headers = await authHeaders();

  const { data } = await axios.post(
    `${BASE_URL}/rate/v1/rates/quotes`,
    {
      accountNumber: { value: process.env.FEDEX_ACCOUNT_NUMBER },
      requestedShipment: {
        shipper: { address: senderAddress },
        recipient: { address: recipientAddress },
        pickupType: "DROPOFF_AT_FEDEX_LOCATION",
        preferredCurrency: currency,
        rateRequestType: ["ACCOUNT", "LIST"],
        requestedPackageLineItems: packages,
      },
    },
    { headers }
  );

  return (data.output?.rateReplyDetails || []).map((detail) => {
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

/**
 * Create a shipment and get a tracking number + label.
 *
 * recipientContact: { personName, phoneNumber, emailAddress }
 * senderContact:    { personName, phoneNumber, emailAddress, companyName }
 * labelFormat: "PDF" | "PNG" | "ZPLII"
 */
export const fedexCreateShipment = async ({
  senderAddress,
  senderContact,
  recipientAddress,
  recipientContact,
  packages,
  serviceType,
  labelFormat = "PDF",
  customsClearanceDetail = null,
}) => {
  const headers = await authHeaders();

  const isInternational = senderAddress.countryCode !== recipientAddress.countryCode;

  let resp;
  try {
    resp = await axios.post(
      `${BASE_URL}/ship/v1/shipments`,
      {
        labelResponseOptions: "LABEL",
        accountNumber: { value: process.env.FEDEX_ACCOUNT_NUMBER },
        requestedShipment: {
          shipper: { address: senderAddress, contact: senderContact },
          recipients: [{ address: recipientAddress, contact: recipientContact }],
          pickupType: "DROPOFF_AT_FEDEX_LOCATION",
          serviceType,
          packagingType: "YOUR_PACKAGING",
          shippingChargesPayment: {
            paymentType: "SENDER",
            payor: {
              responsibleParty: {
                accountNumber: { value: process.env.FEDEX_ACCOUNT_NUMBER },
              },
            },
          },
          labelSpecification: {
            imageType: labelFormat,
            labelStockType: "PAPER_85X11_TOP_HALF_LABEL",
          },
          requestedPackageLineItems: packages,
          ...(isInternational && customsClearanceDetail && { customsClearanceDetail }),
        },
      },
      { headers }
    );
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

/**
 * Validate and resolve up to 100 addresses against FedEx reference data.
 * POST /address/v1/addresses/resolve
 *
 * Each address:
 *   { streetLines: ["123 Main St"], city, stateOrProvinceCode, postalCode, countryCode }
 *
 * Returns an array of resolved addresses with classification and validity flags.
 */
export const fedexValidateAddress = async (addresses) => {
  const headers = await authHeaders();

  const { data } = await axios.post(
    `${BASE_URL}/address/v1/addresses/resolve`,
    {
      addressesToValidate: addresses.map((addr) => ({
        address: {
          streetLines: addr.streetLines,
          city: addr.city,
          stateOrProvinceCode: addr.stateOrProvinceCode || undefined,
          postalCode: addr.postalCode || undefined,
          countryCode: addr.countryCode,
        },
      })),
    },
    { headers }
  );

  return (data.output?.resolvedAddresses || []).map((resolved) => ({
    streetLines: resolved.streetLinesToken || [],
    city: resolved.city,
    stateOrProvinceCode: resolved.stateOrProvinceCode,
    postalCode: resolved.postalCodeToken?.value || null,
    countryCode: resolved.countryCode,
    classification: resolved.classification, // BUSINESS | RESIDENTIAL | MIXED | UNKNOWN
    isDeliveryPointValid: resolved.normalizedStatusNameDPV === true,
    isResolved: resolved.attributes?.Resolved === true,
    isMatched: resolved.attributes?.Matched === true,
    postOfficeBox: resolved.postOfficeBox === true,
    customerMessages: (resolved.customerMessage || []).filter(Boolean),
    resolutionMethod: resolved.resolutionMethodName || null,
    alerts: data.output?.alerts || [],
  }));
};

/**
 * Track a shipment by its FedEx tracking number.
 * Returns a normalised events array.
 */
export const fedexTrackShipment = async (trackingNumber) => {
  const headers = await authHeaders();

  let trackResp;
  try {
    trackResp = await axios.post(
      `${BASE_URL}/track/v1/trackingnumbers`,
      {
        trackingInfo: [{ trackingNumberInfo: { trackingNumber } }],
        includeDetailedScans: true,
      },
      { headers }
    );
  } catch (err) {
    const fedexMsg = err.response?.data?.errors?.[0]?.message || err.message;
    const fedexCode = err.response?.data?.errors?.[0]?.code;
    const e = new Error(fedexMsg);
    e.status = err.response?.status || 500;
    if (fedexCode) e.fedexCode = fedexCode;
    throw e;
  }
  const data = trackResp.data;

  const result =
    data.output?.completeTrackResults?.[0]?.trackResults?.[0];

  return {
    carrier: "fedex",
    trackingNumber,
    status: result?.latestStatusDetail?.status || "UNKNOWN",
    statusDescription: result?.latestStatusDetail?.description || "",
    estimatedDelivery:
      result?.estimatedDeliveryTimeWindow?.window?.ends || null,
    events: (result?.scanEvents || []).map((e) => ({
      timestamp: e.date,
      description: e.eventDescription,
      location: [e.scanLocation?.city, e.scanLocation?.countryCode]
        .filter(Boolean)
        .join(", "),
    })),
  };
};
