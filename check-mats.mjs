import { config } from "@dotenvx/dotenvx";
config({ path: "/Users/mac/Backend Projects/hog/.env" });
import mongoose from "mongoose";
await mongoose.connect(process.env.MONGODB_URL);
const M = mongoose.model("Mat", new mongoose.Schema({}, { strict: false, collection: "materials" }));
const U = mongoose.model("Us2", new mongoose.Schema({}, { strict: false, collection: "users" }));
const mats = await M.find({ clothMaterial: { $in: ["Ankara cotton", "Silk chiffon"] } }).lean();
for (const m of mats) {
  const u = await U.findById(m.userId).lean();
  console.log(`Material: ${m.clothMaterial} | matId: ${m._id} | userId: ${m.userId} | buyer: ${u?.email} | country: ${u?.country}`);
}
// also check review documents
const R = mongoose.model("Rev", new mongoose.Schema({}, { strict: false, collection: "reviews" }));
const revs = await R.find({ materialId: { $in: mats.map(m => m._id) } }).lean();
for (const r of revs) {
  const buyer = await U.findById(r.userId).lean();
  console.log(`Review: ${r._id} | materialId: ${r.materialId} | userId: ${r.userId} | buyer: ${buyer?.email} | country: ${buyer?.country}`);
}
await mongoose.disconnect();
