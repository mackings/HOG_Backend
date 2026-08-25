import axios from "axios";

const BASE_URL =
  process.env.FEZ_ENV === "production"
    ? "https://api.fezdelivery.co/v1"
    : "https://apisandbox.fezdelivery.co/v1";

// Cached auth — both bearer token and secret-key required on every call
let _token      = null;
let _secretKey  = null;
let _orgState   = null; // default pickup state from org profile
let _tokenExpiry = 0;

const authenticate = async () => {
  if (_token && _secretKey && Date.now() < _tokenExpiry) {
    return { token: _token, secretKey: _secretKey, orgState: _orgState };
  }

  const { data } = await axios.post(`${BASE_URL}/user/authenticate`, {
    user_id:  process.env.FEZ_USER_ID,
    password: process.env.FEZ_PASSWORD,
  });

  // Real response shape (verified against sandbox):
  // data.authDetails.authToken, data.authDetails.expireToken
  // data.orgDetails["secret-key"], data.orgDetails.orgState
  _token     = data.authDetails?.authToken;
  _secretKey = data.orgDetails?.["secret-key"];
  _orgState  = data.orgDetails?.orgState || null;

  const expireStr = data.authDetails?.expireToken; // e.g. "2026-08-25 13:52:39"
  _tokenExpiry = expireStr
    ? new Date(expireStr).getTime() - 60_000
    : Date.now() + 23 * 60 * 60 * 1000;

  if (!_token || !_secretKey) {
    throw new Error("Fez authentication failed: missing authToken or secret-key in response");
  }

  return { token: _token, secretKey: _secretKey, orgState: _orgState };
};

const authHeaders = async () => {
  const { token, secretKey } = await authenticate();
  return {
    Authorization: `Bearer ${token}`,
    "secret-key":  secretKey,
    "Content-Type": "application/json",
  };
};

/**
 * Get delivery cost for a domestic Nigeria shipment.
 * POST /order/cost
 *
 * @param {string} recipientState  - Destination Nigeria state (e.g. "Lagos")
 * @param {string} [pickUpState]   - Origin state (defaults to org's configured state)
 * @param {number} [weight]        - Weight in KG
 */
export const fezGetDeliveryCost = async ({ recipientState, pickUpState, weight }) => {
  const { orgState } = await authenticate();
  const headers = await authHeaders();

  const body = { state: recipientState };
  if (pickUpState || orgState) body.pickUpState = pickUpState || orgState;
  if (weight) body.weight = weight;

  let resp;
  try {
    const r = await axios.post(`${BASE_URL}/order/cost`, body, { headers });
    resp = r.data;
  } catch (err) {
    const msg = err.response?.data?.description || err.response?.data?.message || err.message;
    const e   = new Error(msg);
    e.status  = err.response?.status || 500;
    throw e;
  }

  return {
    carrier:     "fez",
    serviceType: "FEZ_STANDARD",
    serviceName: "Fez Delivery",
    amount:      resp.totalCost,
    baseAmount:  resp.cost?.cost,
    vatAmount:   resp.vat?.vatAmount,
    vatPercent:  resp.vat?.vatPercent,
    surcharges:  resp.surcharge?.items || [],
    currency:    "NGN",
    state:       resp.cost?.state,
  };
};

/**
 * Create a domestic order (waybill).
 * POST /order  (array of order objects)
 *
 * Each item: { recipientAddress, recipientState, recipientName, recipientPhone,
 *              uniqueID, BatchID, valueOfItem, weight,
 *              recipientEmail?, itemDescription?, additionalDetails? }
 */
export const fezCreateOrder = async (orders) => {
  const headers = await authHeaders();

  let resp;
  try {
    const r = await axios.post(`${BASE_URL}/order`, orders, { headers });
    resp = r.data;
  } catch (err) {
    const msg = err.response?.data?.description || err.response?.data?.message || err.message;
    const e   = new Error(msg);
    e.status  = err.response?.status || 500;
    throw e;
  }

  return {
    carrier:  "fez",
    status:   resp.status,
    orderNos: resp.orderNos || {},
  };
};

/**
 * Track an order by its Fez waybill / order number.
 * GET /order/track/{orderNumber}
 *
 * Real response shape:
 *   { status, description, order: { orderNo, orderStatus, recipientAddress, senderAddress, ... }, history: [...] }
 */
export const fezTrackOrder = async (orderNumber) => {
  const headers = await authHeaders();

  let resp;
  try {
    const r = await axios.get(`${BASE_URL}/order/track/${orderNumber}`, { headers });
    resp = r.data;
  } catch (err) {
    const msg = err.response?.data?.description || err.response?.data?.message || err.message;
    const e   = new Error(msg);
    e.status  = err.response?.status || 500;
    throw e;
  }

  const order = resp.order || {};
  return {
    carrier:          "fez",
    orderNumber,
    status:           order.orderStatus || "UNKNOWN",
    senderName:       order.senderName   || null,
    senderAddress:    order.senderAddress || null,
    recipientName:    order.recipientName || null,
    recipientAddress: order.recipientAddress || null,
    recipientState:   order.recipientState  || null,
    createdAt:        order.createdAt || null,
    proofOfDelivery:  order.proofOfDelivery || null,
    events: (resp.history || []).map((h) => ({
      status:      h.orderStatus || "",
      timestamp:   h.statusCreationDate || null,
      description: h.statusDescription  || "",
    })),
  };
};

/**
 * Get the org's default pickup state (returned during auth).
 * Useful for pre-filling pickup state in the UI.
 */
export const fezGetOrgState = async () => {
  const { orgState } = await authenticate();
  return orgState;
};

// ─── International delivery ───────────────────────────────────────────────────

// Export location IDs: country name → Fez exportLocationId
// Sourced from GET /orders/export-locations (sandbox, Aug 2026)
const EXPORT_LOCATION_IDS = {
  "canada": 1,
  "united states": 3, "united states of america": 3, "usa": 3, "us": 3,
  "ghana": 5,
  "united arab emirates": 6, "uae": 6,
  "cote d'ivoire": 7, "ivory coast": 7, "cote divoire": 7,
  "ireland": 8,
  "australia": 9,
  "china": 10,
  "gabon": 11,
  "gambia": 12,
  "guinea": 13,
  "niger": 14,
  "liberia": 15,
  "lebanon": 16,
  "india": 17,
  "united kingdom": 18, "uk": 18, "great britain": 18, "england": 18,
  "austria": 19,
  "cyprus": 20,
  "italy": 21,
  "france": 22,
  "egypt": 23,
  "south africa": 24,
  "spain": 25,
  "afghanistan": 28,
  "albania": 29,
  "algeria": 30,
  "american samoa": 31,
  "andorra": 32,
  "angola": 33,
  "anguilla": 34,
  "antigua": 35,
  "argentina": 36,
  "armenia": 37,
  "aruba": 38,
  "azerbaijan": 39,
  "bahamas": 40,
  "bahrain": 41,
  "bangladesh": 42,
  "barbados": 43,
  "belarus": 44,
  "belgium": 45,
  "belize": 46,
  "republic of benin": 47, "benin": 47,
  "bermuda": 48,
  "bhutan": 49,
  "bolivia": 50, "boliva": 50,
  "bonaire": 51,
  "bosnia": 52, "bosnia & herzegovina": 52, "bosnia and herzegovina": 52,
  "botswana": 53,
  "brazil": 54,
  "brunei": 55,
  "bulgaria": 56,
  "burkina faso": 57,
  "burundi": 58,
  "cambodia": 59,
  "canary island": 61, "canary islands": 61,
  "central african republic": 62,
  "chad": 63,
  "chile": 64,
  "colombia": 65,
  "comoros": 66,
  "congo": 67,
  "democratic republic of congo": 68, "drc": 68,
  "cook islands": 69,
  "costa rica": 70,
  "croatia": 71,
  "cuba": 72,
  "curacao": 73,
  "czech republic": 74, "czechia": 74,
  "denmark": 75,
  "djibouti": 76,
  "dominica": 77,
  "dominican republic": 78,
  "ecuador": 79,
  "el salvador": 80,
  "eritrea": 81,
  "estonia": 82,
  "eswatini": 83, "swaziland": 83,
  "ethiopia": 84,
  "falkland island": 85, "falkland islands": 85,
  "faroe island": 86, "faroe islands": 86,
  "fiji": 87,
  "finland": 88,
  "french guyana": 89, "french guiana": 89,
  "georgia": 90,
  "germany": 91,
  "gibraltar": 92,
  "greece": 93,
  "greenland": 94,
  "grenada": 95,
  "guadeloupe": 96,
  "guam": 97,
  "guatemala": 98,
  "guernsey": 99,
  "guinea bissau": 100,
  "guinea equatorial": 101, "equatorial guinea": 101,
  "guyana": 102,
  "namibia": 160,
  "nepal": 161,
  "nevis": 162,
  "new caledonia": 163,
  "new zealand": 164,
  "nicaragua": 165,
  "niue": 166,
  "north macedonia": 167,
  "norway": 168,
  "oman": 169,
  "pakistan": 170,
  "palau": 171,
  "panama": 172,
  "papua new guinea": 173,
  "paraguay": 174,
  "peru": 175,
  "poland": 176,
  "portugal": 177,
  "puerto rico": 178,
  "qatar": 179,
  "montenegro": 180, "rep of montenegro": 180,
  "somaliland": 181,
  "moldova": 182,
  "nauru": 183,
  "serbia": 184,
  "yemen": 185,
  "romania": 186,
  "russia": 187, "russian federation": 187,
  "rwanda": 188,
  "saint helena": 189,
  "samoa": 190,
  "san marino": 191,
  "sao tome and principe": 192,
  "saudi arabia": 193,
  "senegal": 194,
  "seychelles": 195,
  "sierra leone": 196,
  "singapore": 197,
  "slovakia": 198,
  "slovenia": 199,
  "solomon islands": 200,
  "somalia": 201,
  "south sudan": 202,
  "sri lanka": 203,
  "st. barthelemy": 204,
  "st. eustatius": 205,
  "st. kitts": 206,
  "st. lucia": 207,
  "st. maarten": 208,
  "st. vincent": 209,
  "sudan": 210,
  "suriname": 211,
  "sweden": 212,
  "switzerland": 213,
  "syria": 214,
  "tahiti": 215,
  "taiwan": 216,
  "tajikistan": 217,
  "tanzania": 218,
  "thailand": 219,
  "netherlands": 220, "the netherlands": 220, "holland": 220,
  "philippines": 221, "the philippines": 221,
  "timor-leste": 222, "east timor": 222,
  "togo": 223,
  "tonga": 224,
  "trinidad and tobago": 225,
  "tunisia": 226,
  "turkey": 227, "türkiye": 227,
  "turkmenistan": 228,
  "turks & caicos": 229, "turks and caicos": 229,
  "tuvalu": 230,
  "uganda": 231,
  "ukraine": 232,
  "uruguay": 233,
  "uzbekistan": 234,
  "vanuatu": 235,
  "vatican city": 236,
  "venezuela": 237,
  "vietnam": 238, "viet nam": 238,
  "virgin islands british": 239, "british virgin islands": 239,
  "virgin islands us": 240, "us virgin islands": 240,
  "zambia": 241,
  "zimbabwe": 242,
};

// Import location IDs: country name → Fez importLocationId
// Only 7 supported source countries (from sandbox, Aug 2026)
const IMPORT_LOCATION_IDS = {
  "niger": 1,
  "united kingdom": 2, "uk": 2, "great britain": 2, "england": 2,
  "united states": 3, "usa": 3, "us": 3, "united states of america": 3,
  "india": 4,
  "palestine": 5,
  "australia": 6,
  "hong kong": 7,
};

// Weight tiers sorted ascending — pick the smallest tier >= actual weight
const WEIGHT_TIERS = [
  { id: 19, kg: 0.5 }, { id: 20, kg: 1 }, { id: 21, kg: 1.5 },
  { id: 1,  kg: 2   }, { id: 17, kg: 2.5 },
  { id: 2,  kg: 3   }, { id: 3,  kg: 3.5 }, { id: 4,  kg: 4   },
  { id: 5,  kg: 4.5 }, { id: 6,  kg: 5   }, { id: 7,  kg: 5.5 },
  { id: 8,  kg: 6   }, { id: 9,  kg: 6.5 }, { id: 10, kg: 7   },
  { id: 11, kg: 7.5 }, { id: 12, kg: 8   }, { id: 13, kg: 8.5 },
  { id: 14, kg: 9   }, { id: 15, kg: 9.5 }, { id: 18, kg: 10  },
];

const resolveWeightId = (weightKg) => {
  const wt = Number(weightKg) || 1;
  const tier = WEIGHT_TIERS.find((t) => t.kg >= wt);
  return tier ? tier.id : WEIGHT_TIERS[WEIGHT_TIERS.length - 1].id;
};

const lookupExportId = (countryName) =>
  EXPORT_LOCATION_IDS[String(countryName || "").toLowerCase().trim()] || null;

const lookupImportId = (countryName) =>
  IMPORT_LOCATION_IDS[String(countryName || "").toLowerCase().trim()] || null;

/**
 * Get export cost (NG → World).
 * GET /orders/export-price?weightId=&exportLocationId=&pickUpState=
 */
export const fezGetExportCost = async ({ pickUpState, countryName, weight }) => {
  const headers = await authHeaders();
  const exportLocationId = lookupExportId(countryName);
  if (!exportLocationId) {
    const err = new Error(`Fez international export: unsupported destination country "${countryName}"`);
    err.status = 400;
    throw err;
  }
  const weightId = resolveWeightId(weight);
  const params = { weightId, exportLocationId };
  if (pickUpState) params.pickUpState = pickUpState;

  let resp;
  try {
    const r = await axios.get(`${BASE_URL}/orders/export-price`, { headers, params });
    resp = r.data?.data || r.data;
  } catch (err) {
    const msg = err.response?.data?.description || err.response?.data?.message || err.message;
    const e = new Error(msg);
    e.status = err.response?.status || 500;
    throw e;
  }

  return {
    carrier:          "fez",
    serviceType:      "FEZ_EXPORT",
    serviceName:      "Fez International Export",
    amount:           resp.totalCost,
    baseAmount:       resp.price,
    vatAmount:        resp.vat?.vatAmount,
    vatPercent:       resp.vat?.vatPercent,
    currency:         "NGN",
    destination:      countryName,
    weightId,
    exportLocationId,
  };
};

/**
 * Get import cost (World → NG).
 * POST /orders/import-price  body: { destinationState, weight, importLocationId }
 */
export const fezGetImportCost = async ({ destinationState, countryName, weight }) => {
  const headers = await authHeaders();
  const importLocationId = lookupImportId(countryName);
  if (!importLocationId) {
    const err = new Error(
      `Fez international import: origin country "${countryName}" is not supported. Supported: United Kingdom, United States, India, Australia, Hong Kong, Niger, Palestine`
    );
    err.status = 400;
    throw err;
  }

  let resp;
  try {
    const r = await axios.post(
      `${BASE_URL}/orders/import-price`,
      { destinationState, weight: Number(weight) || 1, importLocationId },
      { headers }
    );
    resp = r.data?.data || r.data;
  } catch (err) {
    const msg = err.response?.data?.description || err.response?.data?.message || err.message;
    const e = new Error(msg);
    e.status = err.response?.status || 500;
    throw e;
  }

  return {
    carrier:          "fez",
    serviceType:      "FEZ_IMPORT",
    serviceName:      "Fez International Import",
    amount:           resp.totalCost,
    baseAmount:       resp.price,
    vatAmount:        resp.vat?.vatAmount,
    vatPercent:       resp.vat?.vatPercent,
    currency:         resp.currency || "USD",
    origin:           countryName,
    importLocationId,
  };
};

/**
 * Create an international export order (NG → World).
 * POST /orders/export
 *
 * Each item: { recipientAddress, recipientName, recipientPhone (Nigerian local),
 *              recipientEmail?, uniqueID, BatchID, valueOfItem, weight,
 *              weightId, exportLocationId, pickUpState,
 *              itemDescription?, itemCategory? }
 */
export const fezCreateExportOrder = async (orders) => {
  const headers = await authHeaders();
  let resp;
  try {
    const r = await axios.post(`${BASE_URL}/orders/export`, orders, { headers });
    resp = r.data;
  } catch (err) {
    const msg = err.response?.data?.description || err.response?.data?.message || err.message;
    const e = new Error(msg);
    e.status = err.response?.status || 500;
    throw e;
  }
  return { carrier: "fez", status: resp.status, orderNos: resp.orderNos || {} };
};

/**
 * Create an international import order (World → NG).
 * POST /orders/import
 *
 * Each item: { recipientAddress, recipientState (Nigerian state), recipientName,
 *              recipientPhone (Nigerian local), recipientEmail?,
 *              uniqueID, BatchID, valueOfItem, weight, quantity,
 *              importLocationId, itemDescription?, itemCategory?, businessName? }
 */
export const fezCreateImportOrder = async (orders) => {
  const headers = await authHeaders();
  let resp;
  try {
    const r = await axios.post(`${BASE_URL}/orders/import`, orders, { headers });
    resp = r.data;
  } catch (err) {
    const msg = err.response?.data?.description || err.response?.data?.message || err.message;
    const e = new Error(msg);
    e.status = err.response?.status || 500;
    throw e;
  }
  return { carrier: "fez", status: resp.status, orderNos: resp.orderNos || {} };
};

/**
 * Resolve a weight (kg) to the nearest Fez weightId tier.
 * Exported so controllers can include weightId in export orders.
 */
export { resolveWeightId, lookupExportId, lookupImportId };
