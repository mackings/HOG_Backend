import mongoose from 'mongoose';
import dotenv from 'dotenv';
import DeliveryRate from './src/modules/deliveryRate/model/deliveryRate.model.js';

// Load environment variables
dotenv.config();

// Delivery rate configurations
const deliveryRates = [
  {
    deliveryType: "Regular",
    amount: 1000,
    currency: "NGN",
  },
  {
    deliveryType: "Express",
    amount: 2500,
    currency: "NGN",
  },
  {
    deliveryType: "Cargo",
    amount: 1500,
    currency: "NGN",
  },
  {
    deliveryType: "Regular",
    amount: 1,
    currency: "USD",
  },
  {
    deliveryType: "Express",
    amount: 2,
    currency: "USD",
  },
  {
    deliveryType: "Cargo",
    amount: 1.5,
    currency: "USD",
  }
];

// Connect to MongoDB and seed delivery rates
const seedDeliveryRates = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('✅ Connected to MongoDB');

    // Check if delivery rates already exist
    const existingCount = await DeliveryRate.countDocuments();

    if (existingCount > 0) {
      console.log(`⚠️  Found ${existingCount} existing delivery rates`);
      console.log('Do you want to:');
      console.log('1. Skip seeding (keep existing rates)');
      console.log('2. Delete existing and seed new rates');
      console.log('3. Update existing rates');
      console.log('\nRun with flag: --skip, --replace, or --update');

      const flag = process.argv[2];

      if (flag === '--skip') {
        console.log('✅ Skipping seed. Existing delivery rates preserved.');
        process.exit(0);
      } else if (flag === '--replace') {
        console.log('🗑️  Deleting existing delivery rates...');
        await DeliveryRate.deleteMany({});
        console.log('✅ Deleted existing delivery rates');
      } else if (flag === '--update') {
        console.log('🔄 Updating existing delivery rates...');
        for (const rate of deliveryRates) {
          await DeliveryRate.findOneAndUpdate(
            { deliveryType: rate.deliveryType },
            { amount: rate.amount },
            { upsert: true, new: true }
          );
        }
        console.log('✅ Updated delivery rates successfully!');

        const allRates = await DeliveryRate.find();
        console.log('\n📋 Current Delivery Rates:');
        allRates.forEach((rate) => {
          console.log(`  ${rate.deliveryType.padEnd(10)} → ₦${rate.amount.toLocaleString()} (ID: ${rate._id})`);
        });

        console.log('\n🎉 Database update completed successfully!');
        process.exit(0);
      } else {
        console.log('❌ Please specify a flag: --skip, --replace, or --update');
        process.exit(1);
      }
    }

    // Insert delivery rates
    console.log(`📝 Inserting ${deliveryRates.length} delivery rates...`);
    const result = await DeliveryRate.insertMany(deliveryRates);

    console.log(`✅ Successfully seeded ${result.length} delivery rates!`);
    console.log('\n📋 Delivery Rates Added:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    result.forEach((rate) => {
    console.log(`  ${rate.deliveryType.padEnd(10)} → ${rate.currency} ${rate.amount.toLocaleString()} per km`);
      console.log(`                ID: ${rate._id}`);
    });

    console.log('\n💡 How delivery cost is calculated:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Total Cost = (Rate Per KM × Distance KM) × Number of Packages');
    console.log('');
    console.log('Example (10km, 1 package):');
    console.log('  Regular: rate × 10km');

    console.log('\n🎉 Database seeding completed successfully!');

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
};

// Run the seed function
seedDeliveryRates();
