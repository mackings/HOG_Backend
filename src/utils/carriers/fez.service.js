import axios from "axios";

const BASE_URL =
  process.env.FEZ_ENV === "production"
    ? "https://api.fezdelivery.co/v1"
    : "https://apisandbox.fezdelivery.co/v1";

// Cached auth — both bearer token and secret-key are required on every call
let _token = null;
let _secretKey = null;
let _tokenExpiry = 0;

const authenticate = async () => {
  if (_token && _secretKey && Date.now() < _tokenExpiry) {
    return { token: _token, secretKey: _secretKey };
  }

  const { data } = await axios.post(`${BASE_URL}/user/authenticate`, {
    user_id: process.env.FEZ_USER_ID,
    password: process.env.FEZ_PASSWORD,
  });

  const auth = data.data?.auth || {};
  const org  = data.data?.organization || {};

  _token     = auth.token || data.token;
  _secretKey = org.secretKey || data.secretKey;

  // Use server-supplied expiry if present, otherwise 23 hours
  _tokenExpiry = auth.expiresAt
    ? new Date(auth.expiresAt).getTime() - 60_000
    : Date.now() + 23 * 60 * 60 * 1000;

  if (!_token || !_secretKey) {
    throw new Error("Fez authentication failed: missing token or secret-key in response");
  }

  return { token: _token, secretKey: _secretKey };
};

const authHeaders = async () => {
  const { token, secretKey } = await authenticate();
  return {
    Authorization: `Bearer ${token}`,
    "secret-key": secretKey,
    "Content-Type": "application/json",
  };
};

/**
 * Get delivery cost for a domestic Nigeria shipment.
 * POST /order/cost
 *
 * @param {string} recipientState  - Destination Nigeria state name (e.g. "Lagos")
 * @param {string} [pickUpState]   - Origin state (defaults to org's configured state)
 * @param {number} [weight]        - Weight in KG (defaults to 0-5 kg tier)
 */
export const fezGetDeliveryCost = async ({ recipientState, pickUpState, weight }) => {
  const headers = await authHeaders();

  const body = { state: recipientState };
  if (pickUpState) body.pickUpState = pickUpState;
  if (weight)      body.weight      = weight;

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
    vatAmount:   resp.vat?.amount,
    vatPercent:  resp.vat?.percentage,
    currency:    "NGN",
    state:       resp.cost?.state,
  };
};

/**
 * Create a domestic order and get the waybill number.
 * POST /order  (accepts an array)
 *
 * Each item in orders:
 *   { recipientAddress, recipientState, recipientName, recipientPhone,
 *     uniqueID, BatchID, valueOfItem, weight,
 *     recipientEmail?, itemDescription?, additionalDetails? }
 *
 * Returns { carrier, orderNos: { [uniqueID]: waybillNumber } }
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

  const order = resp.data || resp;
  return {
    carrier:          "fez",
    orderNumber,
    status:           order.status || "UNKNOWN",
    senderName:       order.senderName || null,
    senderAddress:    order.senderAddress || null,
    recipientName:    order.recipientName || null,
    recipientAddress: order.recipientAddress || null,
    createdAt:        order.createdAt || null,
    events: (order.history || []).map((h) => ({
      timestamp:   h.timestamp || h.date || null,
      description: h.description || h.status || "",
    })),
  };
};

/**
 * Get all 37 Nigerian states supported by Fez.
 * GET /states
 */
export const fezGetStates = async () => {
  const headers = await authHeaders();
  const { data } = await axios.get(`${BASE_URL}/states`, { headers });
  return data.data || data.states || [];
};
