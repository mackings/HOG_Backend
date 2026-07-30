const COUNTRY_MAP = {
  "nigeria": "NG",
  "ng": "NG",
  "nigerian": "NG",
  "united states": "US",
  "united states of america": "US",
  "us": "US",
  "usa": "US",
  "united kingdom": "GB",
  "uk": "GB",
  "gb": "GB",
  "great britain": "GB",
  "england": "GB",
  "ghana": "GH",
  "kenya": "KE",
  "south africa": "ZA",
  "canada": "CA",
  "germany": "DE",
  "france": "FR",
  "china": "CN",
  "india": "IN",
  "australia": "AU",
  "uae": "AE",
  "united arab emirates": "AE",
};

/**
 * Converts a country name or code to ISO 3166-1 alpha-2 code.
 * Falls back to the first two uppercase chars if not found.
 */
export const toISOCode = (country) => {
  const key = String(country || "").trim().toLowerCase();
  return COUNTRY_MAP[key] || String(country || "").trim().substring(0, 2).toUpperCase();
};
