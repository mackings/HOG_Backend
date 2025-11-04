import crypto from "crypto";
import axios from "axios";

const RAPYD_ACCESS_KEY = process.env.RAPYD_ACCESS_KEY;
const RAPYD_SECRET_KEY = process.env.RAPYD_SECRET_KEY;

export const generateRapydSignature = (method, urlPath, body = "") => {
  const salt = crypto.randomBytes(8).toString("hex");
  const timestamp = Math.floor(Date.now() / 1000);
  const bodyString = body ? JSON.stringify(body) : "";
  const toSign = method.toLowerCase() + urlPath + salt + timestamp + RAPYD_ACCESS_KEY + RAPYD_SECRET_KEY + bodyString;

  const hmac = crypto.createHmac("sha256", RAPYD_SECRET_KEY);
  hmac.update(toSign);
  const signature = Buffer.from(hmac.digest("hex")).toString("base64");

  return { salt, timestamp, signature };
};
