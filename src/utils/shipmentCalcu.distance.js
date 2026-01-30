import DeliveryRate from '../../src/modules/deliveryRate/model/deliveryRate.model.js';

const normalizeCountry = (value) => String(value || "").trim().toLowerCase();
const isNigeria = (value) => {
  const normalized = normalizeCountry(value);
  return normalized === "nigeria" || normalized === "ng";
};

export const resolveDeliveryCurrency = (buyerCountry, vendorCountry) => {
  if (isNigeria(buyerCountry) && isNigeria(vendorCountry)) {
    return "NGN";
  }
  return "USD";
};

const getDeliveryRate = async (deliveryType, currency) => {
  if (currency) {
    const byCurrency = await DeliveryRate.findOne({ deliveryType, currency });
    if (byCurrency) return byCurrency;
  }

  // Backward-compatible fallback for legacy records without currency.
  if (!currency || currency === "NGN") {
    const legacy = await DeliveryRate.findOne({ deliveryType });
    if (legacy) return legacy;
  }

  throw new Error(`Delivery rate not found for ${deliveryType} (${currency || "NGN"})`);
};

const haversineDistance = (senderLocation, deliveryLocation) => {
  const toRad = (value) => (value * Math.PI) / 180;

  const lat1 = senderLocation.latitude;
  const lon1 = senderLocation.longitude;
  const lat2 = deliveryLocation.latitude;
  const lon2 = deliveryLocation.longitude;

  const R = 6371; // Radius of the Earth in kilometers
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in kilometers
};

export const expressCalculateCost = async (
  deliveryLocation,
  senderLocation,
  numberOfPackages,
  currency = "NGN",
) => {
  const deliveryRate = await getDeliveryRate("Express", currency);
  const ratePerKm = Number(deliveryRate.amount);
  const distance = haversineDistance(senderLocation, deliveryLocation);

  return ratePerKm * distance * numberOfPackages;
};

export const cargoCalculateCost = async (
  deliveryLocation,
  senderLocation,
  numberOfPackages,
  currency = "NGN",
) => {
  const deliveryRate = await getDeliveryRate("Cargo", currency);
  const ratePerKm = Number(deliveryRate.amount);
  const distance = haversineDistance(senderLocation, deliveryLocation);

  return ratePerKm * distance * numberOfPackages;
};

export const regularCalculateCost = async (
  deliveryLocation,
  senderLocation,
  numberOfPackages,
  currency = "NGN",
) => {
  const deliveryRate = await getDeliveryRate("Regular", currency);
  const ratePerKm = Number(deliveryRate.amount);
  const distance = haversineDistance(senderLocation, deliveryLocation);

  return ratePerKm * distance * numberOfPackages;
};
