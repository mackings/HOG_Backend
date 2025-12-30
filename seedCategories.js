import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Category from './src/modules/category/model/category.model.js';

// Load environment variables
dotenv.config();

// Nigerian and International Attire Categories
const categories = [
  // NIGERIAN TRADITIONAL WEAR
  {
    name: "Agbada",
    description: "Traditional Nigerian flowing gown worn by men, typically made with rich fabrics and intricate embroidery. Popular for special occasions and ceremonies.",
    image: "https://images.unsplash.com/photo-1583562835057-a62d1beffbf5?w=800"
  },
  {
    name: "Kaftan",
    description: "Elegant flowing robe worn by both men and women. Perfect for casual and formal events. Available in various lengths and designs.",
    image: "https://images.unsplash.com/photo-1617127365659-c47fa864d8bc?w=800"
  },
  {
    name: "Ankara Styles",
    description: "Vibrant African print fabric styles including dresses, skirts, tops, and jumpsuits. Known for colorful patterns and bold designs.",
    image: "https://images.unsplash.com/photo-1564557287817-3785e38ec1f5?w=800"
  },
  {
    name: "Buba and Sokoto",
    description: "Traditional Yoruba men's outfit consisting of a loose top (Buba) and matching trousers (Sokoto). Often worn with a cap.",
    image: "https://images.unsplash.com/photo-1622396481328-9b1b78cdd9fd?w=800"
  },
  {
    name: "Iro and Buba",
    description: "Traditional Yoruba women's attire consisting of a wrapper (Iro), blouse (Buba), and head tie (Gele). Perfect for weddings and ceremonies.",
    image: "https://images.unsplash.com/photo-1595522183098-b213c3b70e1d?w=800"
  },
  {
    name: "George Wrapper",
    description: "Luxurious wrapper fabric, typically embellished with sequins or embroidery. Worn by women for special occasions.",
    image: "https://images.unsplash.com/photo-1617127365659-c47fa864d8bc?w=800"
  },
  {
    name: "Senator Wear",
    description: "Modern Nigerian men's formal wear featuring tailored tops and trousers. Popular among professionals and for formal events.",
    image: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=800"
  },
  {
    name: "Dashiki",
    description: "Colorful garment covering the top half of the body, worn by both men and women. Features intricate embroidery around the neckline.",
    image: "https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=800"
  },
  {
    name: "Aso Oke",
    description: "Hand-woven cloth from Yoruba land, used for special occasions. Available in various colors and patterns.",
    image: "https://images.unsplash.com/photo-1583562835057-a62d1beffbf5?w=800"
  },
  {
    name: "Native Gown",
    description: "Traditional Nigerian gown for women, featuring various necklines and sleeve styles. Perfect for both casual and formal settings.",
    image: "https://images.unsplash.com/photo-1595522183098-b213c3b70e1d?w=800"
  },

  // MODERN/WESTERN STYLES
  {
    name: "Corporate Suit",
    description: "Professional business attire including blazers, trousers, and shirts. Perfect for office wear and business meetings.",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800"
  },
  {
    name: "Casual Wear",
    description: "Everyday comfortable clothing including t-shirts, jeans, shorts, and casual dresses. Perfect for relaxed settings.",
    image: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800"
  },
  {
    name: "Evening Gown",
    description: "Elegant formal dresses for special evening events, galas, and formal dinners. Features luxurious fabrics and sophisticated designs.",
    image: "https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=800"
  },
  {
    name: "Wedding Dress",
    description: "Bridal gowns and wedding attire for brides, grooms, and wedding parties. Includes various styles from traditional to modern.",
    image: "https://images.unsplash.com/photo-1519741497674-611481863552?w=800"
  },
  {
    name: "Party Dress",
    description: "Trendy dresses and outfits for parties, celebrations, and social gatherings. Available in various styles and lengths.",
    image: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=800"
  },
  {
    name: "Jumpsuit",
    description: "One-piece garment combining top and trousers. Perfect for both casual and formal occasions with modern styling.",
    image: "https://images.unsplash.com/photo-1583562835057-a62d1beffbf5?w=800"
  },
  {
    name: "Skirt and Blouse",
    description: "Classic combination of skirt and matching or contrasting blouse. Suitable for office, church, and semi-formal events.",
    image: "https://images.unsplash.com/photo-1564557287817-3785e38ec1f5?w=800"
  },
  {
    name: "Trouser and Shirt",
    description: "Professional combination for both men and women. Perfect for office wear and business casual settings.",
    image: "https://images.unsplash.com/photo-1490367532201-b9bc1dc483f6?w=800"
  },

  // FUSION/CONTEMPORARY
  {
    name: "Ankara Fusion",
    description: "Modern designs combining African prints with Western styles. Includes blazers, pencil skirts, and contemporary dresses.",
    image: "https://images.unsplash.com/photo-1595522183098-b213c3b70e1d?w=800"
  },
  {
    name: "Smart Casual",
    description: "Blend of formal and casual wear, perfect for semi-formal events and creative workplaces. Includes chinos, polo shirts, and casual blazers.",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800"
  },

  // CHILDREN'S WEAR
  {
    name: "Children's Traditional",
    description: "Traditional Nigerian attire designed for children including mini Agbadas, Ankara dresses, and native wear for boys and girls.",
    image: "https://images.unsplash.com/photo-1503944583220-79d8926ad5e2?w=800"
  },
  {
    name: "Children's Casual",
    description: "Comfortable everyday wear for children including t-shirts, shorts, dresses, and play clothes.",
    image: "https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?w=800"
  },

  // RELIGIOUS/CULTURAL
  {
    name: "Muslim Wear",
    description: "Modest Islamic clothing including Hijabs, Abayas, Jalabiyas, and prayer garments for men and women.",
    image: "https://images.unsplash.com/photo-1583562835057-a62d1beffbf5?w=800"
  },
  {
    name: "Choir Robe",
    description: "Church and choir robes in various colors and styles. Suitable for religious ceremonies and performances.",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800"
  },

  // ACCESSORIES & OTHERS
  {
    name: "Traditional Accessories",
    description: "Traditional Nigerian accessories including caps, beads, coral beads, walking sticks, and hand fans.",
    image: "https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=800"
  }
];

// Connect to MongoDB and seed categories
const seedCategories = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('✅ Connected to MongoDB');

    // Check if categories already exist
    const existingCount = await Category.countDocuments();

    if (existingCount > 0) {
      console.log(`⚠️  Found ${existingCount} existing categories`);
      console.log('Do you want to:');
      console.log('1. Skip seeding (keep existing categories)');
      console.log('2. Delete existing and seed new categories');
      console.log('3. Add new categories without deleting existing ones');
      console.log('\nRun with flag: --skip, --replace, or --add');

      const flag = process.argv[2];

      if (flag === '--skip') {
        console.log('✅ Skipping seed. Existing categories preserved.');
        process.exit(0);
      } else if (flag === '--replace') {
        console.log('🗑️  Deleting existing categories...');
        await Category.deleteMany({});
        console.log('✅ Deleted existing categories');
      } else if (flag === '--add') {
        console.log('➕ Adding new categories alongside existing ones...');
      } else {
        console.log('❌ Please specify a flag: --skip, --replace, or --add');
        process.exit(1);
      }
    }

    // Insert categories
    console.log(`📝 Inserting ${categories.length} categories...`);
    const result = await Category.insertMany(categories);

    console.log(`✅ Successfully seeded ${result.length} categories!`);
    console.log('\n📋 Categories added:');
    result.forEach((cat, index) => {
      console.log(`${index + 1}. ${cat.name} (ID: ${cat._id})`);
    });

    console.log('\n🎉 Database seeding completed successfully!');
    console.log('\n📌 You can now use these category IDs in your API calls.');

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
};

// Run the seed function
seedCategories();
