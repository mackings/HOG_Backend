import DeliveryRate from '../model/deliveryRate.model.js';
import User from '../../user/model/user.model.js';
import axios from 'axios';
import mongoose from 'mongoose';
import Review from '../../review/model/review.model.js';
import Vendor from '../../vendor/model/vendor.model.js';
import PickupCountry from '../model/pickupCountry.model.js';
import { expressCalculateCost, cargoCalculateCost, regularCalculateCost, resolveDeliveryCurrency } from '../../../utils/shipmentCalcu.distance.js';

const normalizeAddressForGeocode = (rawAddress, country) => {
  let addr = String(rawAddress || "").trim();
  addr = addr.replace(/[\r\n]+/g, ", ");
  addr = addr.replace(/\s*,\s*/g, ", ");
  addr = addr.replace(/\s+/g, " ");
  addr = addr.replace(/[.,]+$/g, "");

  const countryValue = String(country || "").trim();
  if (countryValue && !addr.toLowerCase().includes(countryValue.toLowerCase())) {
    addr = `${addr}, ${countryValue}`;
  }
  return addr;
};

const geocodeWithOpenCage = async (address) => {
  const openCageKey = process.env.OPENCAGE_KEY;
  if (!openCageKey) {
    throw new Error("OPENCAGE_KEY is not set");
  }

  const response = await axios.get(`https://api.opencagedata.com/geocode/v1/json`, {
    params: {
      key: openCageKey,
      q: address,
      limit: 1,
      no_annotations: 1,
    },
  });

  const geometry = response.data?.results?.[0]?.geometry;
  if (!geometry || geometry.lat == null || geometry.lng == null) {
    return null;
  }

  return {
    latitude: parseFloat(geometry.lat),
    longitude: parseFloat(geometry.lng),
  };
};

const normalizeName = (value) => String(value || "").trim().replace(/\s+/g, " ");
const canonicalName = (value) =>
  normalizeName(value)
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
const normalizedKey = (value) => canonicalName(value).toLowerCase();

const mergeStatesByName = (states = []) => {
  const mergedMap = new Map();

  for (const rawState of states) {
    if (!rawState || !rawState.isActive) continue;

    const state = rawState.toObject ? rawState.toObject() : rawState;
    const key = normalizedKey(state.name);
    if (!key) continue;

    if (!mergedMap.has(key)) {
      mergedMap.set(key, {
        _id: state._id,
        name: canonicalName(state.name),
        isActive: true,
        locations: [],
      });
    }

    const target = mergedMap.get(key);
    const seenLocationKeys = new Set(
      target.locations.map((location) =>
        `${normalizedKey(location.name)}::${normalizedKey(location.address)}`
      )
    );

    for (const rawLocation of state.locations || []) {
      if (!rawLocation || !rawLocation.isActive) continue;
      const location = rawLocation.toObject ? rawLocation.toObject() : rawLocation;
      const locKey = `${normalizedKey(location.name)}::${normalizedKey(location.address)}`;
      if (!locKey || seenLocationKeys.has(locKey)) continue;

      target.locations.push({
        _id: location._id,
        name: canonicalName(location.name),
        address: normalizeName(location.address),
        isActive: true,
      });
      seenLocationKeys.add(locKey);
    }
  }

  return Array.from(mergedMap.values()).sort((a, b) => a.name.localeCompare(b.name));
};

export const createPickupCountry = async (req, res, next) => {
  try {
    const { name } = req.body;
    const countryName = canonicalName(name);

    if (!countryName) {
      return res.status(400).json({ success: false, message: "Country name is required" });
    }

    const existingCountry = await PickupCountry.findOne({
      name: { $regex: new RegExp(`^${countryName}$`, "i") },
    });

    if (existingCountry) {
      return res.status(400).json({ success: false, message: "Pickup country already exists" });
    }

    const country = await PickupCountry.create({ name: countryName, states: [] });
    return res.status(201).json({
      success: true,
      message: "Pickup country created successfully",
      data: country,
    });
  } catch (error) {
    next(error);
  }
};

export const addPickupState = async (req, res, next) => {
  try {
    const { countryId } = req.params;
    const { name } = req.body;

    if (!mongoose.Types.ObjectId.isValid(countryId)) {
      return res.status(400).json({ success: false, message: "Invalid country ID" });
    }

    const stateName = canonicalName(name);
    if (!stateName) {
      return res.status(400).json({ success: false, message: "State name is required" });
    }

    const country = await PickupCountry.findById(countryId);
    if (!country) {
      return res.status(404).json({ success: false, message: "Pickup country not found" });
    }

    const hasState = country.states.some(
      (state) => normalizedKey(state.name) === normalizedKey(stateName)
    );
    if (hasState) {
      return res.status(400).json({ success: false, message: "State already exists in this country" });
    }

    country.states.push({ name: stateName, locations: [] });
    await country.save();

    return res.status(201).json({
      success: true,
      message: "Pickup state added successfully",
      data: country,
    });
  } catch (error) {
    next(error);
  }
};

export const addPickupLocation = async (req, res, next) => {
  try {
    const { countryId, stateId } = req.params;
    const { name, address } = req.body;

    if (!mongoose.Types.ObjectId.isValid(countryId) || !mongoose.Types.ObjectId.isValid(stateId)) {
      return res.status(400).json({ success: false, message: "Invalid country or state ID" });
    }

    const locationName = canonicalName(name);
    const locationAddress = normalizeName(address);

    if (!locationName || !locationAddress) {
      return res.status(400).json({
        success: false,
        message: "Location name and address are required",
      });
    }

    const country = await PickupCountry.findById(countryId);
    if (!country) {
      return res.status(404).json({ success: false, message: "Pickup country not found" });
    }

    const state = country.states.id(stateId);
    if (!state) {
      return res.status(404).json({ success: false, message: "Pickup state not found" });
    }

    const hasLocation = state.locations.some(
      (location) =>
        normalizedKey(location.name) === normalizedKey(locationName) &&
        normalizedKey(location.address) === normalizedKey(locationAddress)
    );
    if (hasLocation) {
      return res.status(400).json({ success: false, message: "Pickup location already exists in this state" });
    }

    state.locations.push({ name: locationName, address: locationAddress });
    await country.save();

    return res.status(201).json({
      success: true,
      message: "Pickup location added successfully",
      data: country,
    });
  } catch (error) {
    next(error);
  }
};

export const getPickupCountries = async (req, res, next) => {
  try {
    const countries = await PickupCountry.find({ isActive: true })
      .select("name isActive createdAt updatedAt")
      .sort({ name: 1 });
    return res.status(200).json({
      success: true,
      message: "Pickup countries retrieved successfully",
      data: countries,
    });
  } catch (error) {
    next(error);
  }
};

export const getPickupStatesByCountry = async (req, res, next) => {
  try {
    const { countryId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(countryId)) {
      return res.status(400).json({ success: false, message: "Invalid country ID" });
    }

    const country = await PickupCountry.findById(countryId).select("name states");
    if (!country) {
      return res.status(404).json({ success: false, message: "Pickup country not found" });
    }

    const states = mergeStatesByName(country.states);
    return res.status(200).json({
      success: true,
      message: "Pickup states retrieved successfully",
      data: {
        countryId: country._id,
        country: country.name,
        states,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getPickupLocationsByState = async (req, res, next) => {
  try {
    const { countryId, stateId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(countryId) || !mongoose.Types.ObjectId.isValid(stateId)) {
      return res.status(400).json({ success: false, message: "Invalid country or state ID" });
    }

    const country = await PickupCountry.findById(countryId).select("name states");
    if (!country) {
      return res.status(404).json({ success: false, message: "Pickup country not found" });
    }

    const state = country.states.id(stateId);
    if (!state || !state.isActive) {
      return res.status(404).json({ success: false, message: "Pickup state not found" });
    }

    const locations = (state.locations || [])
      .filter((location) => location.isActive)
      .map((location) => ({
        _id: location._id,
        name: canonicalName(location.name),
        address: normalizeName(location.address),
        isActive: true,
      }));
    return res.status(200).json({
      success: true,
      message: "Pickup locations retrieved successfully",
      data: {
        countryId: country._id,
        country: country.name,
        stateId: state._id,
        state: state.name,
        locations,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getPickupHierarchy = async (req, res, next) => {
  try {
    const countries = await PickupCountry.find({ isActive: true }).sort({ name: 1 }).lean();
    const sanitized = countries.map((country) => ({
      _id: country._id,
      name: canonicalName(country.name),
      states: mergeStatesByName(country.states || []),
    }));

    return res.status(200).json({
      success: true,
      message: "Pickup hierarchy retrieved successfully",
      data: sanitized,
    });
  } catch (error) {
    next(error);
  }
};



export const createDeliveryRate = async (req, res, next) => {
    try {
        const { amount, deliveryType, currency } = req.body;

        if (!amount) {
            return res.status(400).json({ message: 'Amount is required' });
        }

        if (!deliveryType) {
            return res.status(400).json({ message: 'Delivery type is required' });
        }

        const currencyValue = (currency || "NGN").toUpperCase();
        const existingRate = await DeliveryRate.findOne({ deliveryType, currency: currencyValue });
        if (existingRate) {
            return res.status(400).json({
                success: false,
                message: `A delivery rate already exists for '${deliveryType}' (${currencyValue}). You can update it instead.`,
            });
        }

        const deliveryRate = await DeliveryRate.create({ amount, deliveryType, currency: currencyValue });

        return res.status(201).json({
            success: true,
            message: 'Delivery rate created successfully',
            deliveryRate,
        });
    } catch (error) {
        next(error);
    }
};



export const getDeliveryRates = async (req, res, next) => {
    try {
        const deliveryRates = await DeliveryRate.find();
        return res.status(200).json({ success: true, message: 'Delivery rates retrieved successfully', deliveryRates });
    } catch (error) {
        next(error);
    }
}


export const updateDeliveryRate = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { amount, currency } = req.body;
        const updates = { amount };
        if (currency) updates.currency = currency.toUpperCase();
        const deliveryRate = await DeliveryRate.findByIdAndUpdate(id, updates, { new: true });
        if (!deliveryRate) {
            return res.status(404).json({ success: false, message: 'Delivery rate not found' });
        }
        return res.status(200).json({ success: true, message: 'Delivery rate updated successfully', deliveryRate });
    } catch (error) {
        next(error);
    }
}


export const deleteDeliveryRate = async (req, res, next) => {
    try {
        const { id } = req.params;
        const deliveryRate = await DeliveryRate.findByIdAndDelete(id);
        if (!deliveryRate) {
            return res.status(404).json({ message: 'Delivery rate not found' });
        }
        return res.status(200).json({ success: true, message: 'Delivery rate deleted successfully' });
    } catch (error) {
        next(error);
    }
}


export const deliveryCost = async (req, res, next) => {
  try {
    const { id } = req.user;
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const { shipmentMethod, address, pickupCountryId, pickupStateId, pickupLocationId } = req.body;
    const { reviewId } = req.params;

    if (!reviewId || !mongoose.Types.ObjectId.isValid(reviewId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid review ID" });
    }

    const review = await Review.findById(reviewId);
    if (!review) {
      return res
        .status(404)
        .json({ success: false, message: "Review not found" });
    }

    // Fetch vendor + buyer for addresses
    const vendor = await Vendor.findById(review.vendorId).populate("userId");
    if (!vendor) {
      return res.status(404).json({ success: false, message: "Vendor not found" });
    }
    const buyer = await User.findById(review.userId);
    if (!buyer) {
      return res.status(404).json({ success: false, message: "Buyer not found" });
    }

    // Determine pickup (vendor) and delivery (buyer) addresses
    const pickupAddress = vendor.address || vendor.userId?.address;
    let deliveryAddress = address || buyer.address;
    let selectedPickupLocation = null;

    if (pickupCountryId || pickupStateId || pickupLocationId) {
      if (
        !mongoose.Types.ObjectId.isValid(pickupCountryId) ||
        !mongoose.Types.ObjectId.isValid(pickupStateId) ||
        !mongoose.Types.ObjectId.isValid(pickupLocationId)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid pickup country/state/location ID",
        });
      }

      const pickupCountry = await PickupCountry.findById(pickupCountryId).select("name states");
      if (!pickupCountry) {
        return res.status(404).json({ success: false, message: "Pickup country not found" });
      }

      const pickupState = pickupCountry.states.id(pickupStateId);
      if (!pickupState || !pickupState.isActive) {
        return res.status(404).json({ success: false, message: "Pickup state not found" });
      }

      const pickupLocation = pickupState.locations.id(pickupLocationId);
      if (!pickupLocation || !pickupLocation.isActive) {
        return res.status(404).json({ success: false, message: "Pickup location not found" });
      }

      selectedPickupLocation = {
        countryId: pickupCountry._id,
        country: pickupCountry.name,
        stateId: pickupState._id,
        state: pickupState.name,
        locationId: pickupLocation._id,
        locationName: pickupLocation.name,
        locationAddress: pickupLocation.address,
      };
      deliveryAddress = pickupLocation.address;
    }

    if (!pickupAddress || !deliveryAddress) {
      return res.status(400).json({
        success: false,
        message: "Both pickup and delivery addresses are required.",
      });
    }

    // Use buyer-provided delivery address as-is (no country append)
    const deliveryAddressNormalized = normalizeAddressForGeocode(deliveryAddress);
    const pickupAddressNormalized = normalizeAddressForGeocode(pickupAddress, vendor.userId?.country || vendor.country);
    const deliveryCurrency = resolveDeliveryCurrency(buyer.country, vendor.userId?.country || vendor.country);

    const [deliveryLocation, senderLocation] = await Promise.all([
      geocodeWithOpenCage(deliveryAddressNormalized),
      geocodeWithOpenCage(pickupAddressNormalized),
    ]);

    if (!deliveryLocation || !senderLocation) {
      return res.status(400).json({
        success: false,
        message: "Invalid pickup or delivery address provided.",
        error: {
          pickupAddress: pickupAddressNormalized,
          deliveryAddress: deliveryAddressNormalized,
        },
      });
    }

    // Shipment cost calculation
    const numberOfPackages = 1;
    const method = (shipmentMethod || "").trim().toLowerCase();
    if (!method) {
    return res.status(400).json({ success: false, message: "shipmentMethod is required" });
    }

    let shipmentCost;

    switch (method) {
    case "express":
        shipmentCost = await expressCalculateCost(deliveryLocation, senderLocation, numberOfPackages, deliveryCurrency);
        break;
    case "cargo":
        shipmentCost = await cargoCalculateCost(deliveryLocation, senderLocation, numberOfPackages, deliveryCurrency);
        break;
    case "regular":
        shipmentCost = await regularCalculateCost(deliveryLocation, senderLocation, numberOfPackages, deliveryCurrency);
        break;
    default:
        return res.status(400).json({
        success: false,
        message: "Invalid shipment method. Choose Express, Cargo, or Regular.",
        });
    }

    const cost = Math.round(shipmentCost);
    return res.status(200).json({
      success: true,
      message: "Delivery cost calculated successfully",
      cost,
      currency: deliveryCurrency,
      selectedPickupLocation,
    });
  } catch (error) {
    next(error);
  }
};
