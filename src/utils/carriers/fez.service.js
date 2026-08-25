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
