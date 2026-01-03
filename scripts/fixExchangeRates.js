import mongoose from 'mongoose';
import dotenv from '@dotenvx/dotenvx';

dotenv.config();

const reviewSchema = new mongoose.Schema({}, { strict: false });
const Review = mongoose.model('Review', reviewSchema);

async function fixExchangeRates() {
  try {
    await mongoose.connect(process.env.MONGODB_URL);
    console.log('✅ Connected to database');

    // Find all reviews with inverted exchange rates (less than 1)
    // Correct rate should be ~1438 (1 USD = X NGN)
    // Inverted rate is ~0.000692 (1 NGN = X USD)
    const invertedReviews = await Review.find({
      exchangeRate: { $gt: 0, $lt: 1 },
      isInternationalVendor: true
    });

    console.log(`\n📋 Found ${invertedReviews.length} reviews with inverted exchange rates\n`);

    for (const review of invertedReviews) {
      const oldRate = review.exchangeRate;
      const newRate = Math.round((1 / oldRate) * 100) / 100; // Invert it back

      console.log(`🔄 Fixing Review ${review._id}:`);
      console.log(`   Old Rate: ${oldRate} (WRONG: 1 NGN = $${oldRate})`);
      console.log(`   New Rate: ${newRate} (CORRECT: 1 USD = ₦${newRate})`);

      // Recalculate USD amounts with correct rate
      const materialTotalCostUSD = review.materialTotalCost && newRate > 0
        ? Math.round(review.materialTotalCost / newRate * 100) / 100
        : review.materialTotalCostUSD || 0;

      const workmanshipTotalCostUSD = review.workmanshipTotalCost && newRate > 0
        ? Math.round(review.workmanshipTotalCost / newRate * 100) / 100
        : review.workmanshipTotalCostUSD || 0;

      const totalCostUSD = review.totalCost && newRate > 0
        ? Math.round(review.totalCost / newRate * 100) / 100
        : review.totalCostUSD || 0;

      const amountToPayUSD = review.amountToPay && newRate > 0
        ? Math.round(review.amountToPay / newRate * 100) / 100
        : review.amountToPayUSD || 0;

      console.log(`   Material Cost: ₦${review.materialTotalCost} → $${materialTotalCostUSD}`);
      console.log(`   Workmanship Cost: ₦${review.workmanshipTotalCost} → $${workmanshipTotalCostUSD}`);
      console.log(`   Total Cost: ₦${review.totalCost} → $${totalCostUSD}`);
      console.log(`   Amount To Pay: ₦${review.amountToPay} → $${amountToPayUSD}\n`);

      await Review.findByIdAndUpdate(review._id, {
        $set: {
          exchangeRate: newRate,
          materialTotalCostUSD,
          workmanshipTotalCostUSD,
          totalCostUSD,
          amountToPayUSD,
          subTotalCostUSD: totalCostUSD
        }
      });

      console.log(`   ✅ Updated!\n`);
    }

    console.log(`\n🎉 Migration complete! Fixed ${invertedReviews.length} reviews`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

fixExchangeRates();
