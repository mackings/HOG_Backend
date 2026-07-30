import axios from "axios";

/**
 * Geocodes an address string using OpenCage.
 * Returns { latitude, longitude, postalCode, city, state } or null on failure.
 */
export const geocodeAddress = async (address) => {
  const key = process.env.OPENCAGE_KEY;
  if (!key || !address?.trim()) return null;

  try {
    const { data } = await axios.get("https://api.opencagedata.com/geocode/v1/json", {
      params: { key, q: address, limit: 1, no_annotations: 1 },
    });

    const result = data?.results?.[0];
    if (!result?.geometry) return null;

    const comp = result.components || {};
    return {
      latitude:   parseFloat(result.geometry.lat),
      longitude:  parseFloat(result.geometry.lng),
      postalCode: comp.postcode || comp.postal_code || null,
      city:       comp.city || comp.town || comp.village || null,
      state:      comp.state_code || comp.state || null,
    };
  } catch {
    return null;
  }
};

/**
 * Fills missing postalCode and city on a FedEx/DHL-format address object
 * by geocoding the raw street address string. No-ops if both are already set.
 */
export const resolveCarrierAddress = async (base, rawAddress) => {
  if (base.postalCode && base.city) return base;
  const geo = await geocodeAddress(rawAddress);
  return {
    ...base,
    postalCode:          base.postalCode || geo?.postalCode || null,
    city:                base.city       || geo?.city       || base.city,
    stateOrProvinceCode: base.stateOrProvinceCode ||
      (geo?.state ? geo.state.substring(0, 2).toUpperCase() : "") || "",
  };
};
