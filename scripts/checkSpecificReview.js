import mongoose from 'mongoose';
import dotenv from '@dotenvx/dotenvx';

dotenv.config();

const reviewSchema = new mongoose.Schema({}, { strict: false });
const Review = mongoose.model('Review', reviewSchema);

async function checkReview() {
  try {
    await mongoose.connect(process.env.MONGODB_URL);
    console.log('✅ Connected to database');

    const reviewId = '6958ed516e46fcf2cc43c59e';
    const review = await Review.findById(reviewId);

    if (!review) {
      console.log(`❌ Review ${reviewId} not found`);
      process.exit(1);
    }

    console.log('\n📋 REVIEW DETAILS:');
    console.log(`   Review ID: ${review._id}`);
    console.log(`   Material Cost: ₦${review.materialTotalCost}`);
    console.log(`   Workmanship Cost: ₦${review.workmanshipTotalCost}`);
    console.log(`   Total Cost: ₦${review.totalCost}`);
    console.log(`   Amount To Pay: ₦${review.amountToPay}`);
    console.log(`   \n💱 CURRENCY INFO:`);
    console.log(`   Is International Vendor: ${review.isInternationalVendor}`);
    console.log(`   Exchange Rate: ${review.exchangeRate}`);
    console.log(`   Material Cost USD: $${review.materialTotalCostUSD || 0}`);
    console.log(`   Workmanship Cost USD: $${review.workmanshipTotalCostUSD || 0}`);
    console.log(`   Total Cost USD: $${review.totalCostUSD || 0}`);
    console.log(`   Amount To Pay USD: $${review.amountToPayUSD || 0}`);

    // Check if exchange rate is inverted
    if (review.exchangeRate > 0 && review.exchangeRate < 1) {
      console.log(`\n⚠️  INVERTED EXCHANGE RATE DETECTED!`);
      console.log(`   Current: ${review.exchangeRate} (1 NGN = $${review.exchangeRate})`);
      const correctRate = Math.round((1 / review.exchangeRate) * 100) / 100;
      console.log(`   Should be: ${correctRate} (1 USD = ₦${correctRate})`);

      // Fix it
      const materialTotalCostUSD = Math.round(review.materialTotalCost / correctRate * 100) / 100;
      const workmanshipTotalCostUSD = Math.round(review.workmanshipTotalCost / correctRate * 100) / 100;
      const totalCostUSD = Math.round(review.totalCost / correctRate * 100) / 100;
      const amountToPayUSD = Math.round(review.amountToPay / correctRate * 100) / 100;

      console.log(`\n✅ CORRECTED VALUES:`);
      console.log(`   Exchange Rate: ${correctRate}`);
      console.log(`   Material Cost USD: $${materialTotalCostUSD}`);
      console.log(`   Workmanship Cost USD: $${workmanshipTotalCostUSD}`);
      console.log(`   Total Cost USD: $${totalCostUSD}`);
      console.log(`   Amount To Pay USD: $${amountToPayUSD}`);

      await Review.findByIdAndUpdate(reviewId, {
        $set: {
          exchangeRate: correctRate,
          materialTotalCostUSD,
          workmanshipTotalCostUSD,
          totalCostUSD,
          amountToPayUSD,
          subTotalCostUSD: totalCostUSD,
          isInternationalVendor: true
        }
      });

      console.log(`\n🎉 Review ${reviewId} fixed!`);
    } else {
      console.log(`\n✅ Exchange rate is correct (${review.exchangeRate})`);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkReview();
