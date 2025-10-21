import DeliveryRate from '../../src/modules/deliveryRate/model/deliveryRate.model.js';
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
  
) => {
   const deliveryRate = await DeliveryRate.findOne({ deliveryType: 'Express' });
   if (!deliveryRate) {
    throw new Error('Delivery rate not found, please set up delivery rates.');
  }
  const baseCost = deliveryRate.amount; // Base cost per package
  const weightMultiplier = 5; // Cost multiplier per kg
  const volumeMultiplier = 5; // Cost multiplier per cubic unit of volume
  const distanceMultiplier = 10; // Cost multiplier per km for express shipping

    const distance = haversineDistance(senderLocation, deliveryLocation ); // Calculate distance between locations

  const totalCost =
    (baseCost +
      weightMultiplier +
      volumeMultiplier +
      distanceMultiplier * distance) *
    numberOfPackages;
  return totalCost;
};

export const cargoCalculateCost = async (
  deliveryLocation,
  senderLocation,
  numberOfPackages,
) => {
  const deliveryRate = await DeliveryRate.findOne({ deliveryType: 'Cargo' });
   if (!deliveryRate) {
    throw new Error('Delivery rate not found, please set up delivery rates for Cargo.');
  }
  const baseCost = deliveryRate.amount; // Lower base cost for cargo shipping
  const weightMultiplier = 5; // Lower weight multiplier for cargo
  const volumeMultiplier = 5; // Lower volume multiplier for cargo shipments
  const distanceMultiplier = 10; // Lower distance multiplier for cargo

  const distance = haversineDistance(senderLocation,  deliveryLocation); // Calculate distance between locations

  const totalCost =
    (baseCost +
      weightMultiplier +
      volumeMultiplier +
      distanceMultiplier * distance) *
    numberOfPackages;
  return totalCost;
};

export const regularCalculateCost = async (
  deliveryLocation,
  senderLocation,
  numberOfPackages,
) => {
  const deliveryRate = await DeliveryRate.findOne({ deliveryType: 'Regular' });
   if (!deliveryRate) {
    throw new Error('Delivery rate not found, please set up delivery rates for Regular.');
  }
  const baseCost = deliveryRate.amount; // Lower base cost for cargo shipping
  const weightMultiplier = 5; // Lower weight multiplier for cargo
  const volumeMultiplier = 5; // Lower volume multiplier for cargo shipments
  const distanceMultiplier = 10; // Lower distance multiplier for cargo

  const distance = haversineDistance(senderLocation,  deliveryLocation); // Calculate distance between locations

  const totalCost =
    (baseCost +
      weightMultiplier +
      volumeMultiplier +
      distanceMultiplier * distance) *
    numberOfPackages;
  return totalCost;
};

