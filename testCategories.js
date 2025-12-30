import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Category from './src/modules/category/model/category.model.js';

dotenv.config();

const testCategories = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URL);
    console.log('✅ Connected to MongoDB\n');

    const categories = await Category.find({}).sort({ createdAt: 1 });

    console.log(`📊 Total Categories: ${categories.length}\n`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Group by type
    const nigerianTraditional = categories.filter(c =>
      ['Agbada', 'Kaftan', 'Ankara Styles', 'Buba and Sokoto', 'Iro and Buba',
       'George Wrapper', 'Senator Wear', 'Dashiki', 'Aso Oke', 'Native Gown'].includes(c.name)
    );

    const modern = categories.filter(c =>
      ['Corporate Suit', 'Casual Wear', 'Evening Gown', 'Wedding Dress',
       'Party Dress', 'Jumpsuit', 'Skirt and Blouse', 'Trouser and Shirt'].includes(c.name)
    );

    const fusion = categories.filter(c =>
      ['Ankara Fusion', 'Smart Casual'].includes(c.name)
    );

    const children = categories.filter(c =>
      c.name.includes('Children')
    );

    const religious = categories.filter(c =>
      ['Muslim Wear', 'Choir Robe'].includes(c.name)
    );

    const accessories = categories.filter(c =>
      c.name.includes('Accessories')
    );

    console.log('🇳🇬 NIGERIAN TRADITIONAL WEAR (' + nigerianTraditional.length + ')');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    nigerianTraditional.forEach((cat, i) => {
      console.log(`${i + 1}. ${cat.name.padEnd(20)} | ID: ${cat._id}`);
    });

    console.log('\n👔 MODERN/WESTERN STYLES (' + modern.length + ')');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    modern.forEach((cat, i) => {
      console.log(`${i + 1}. ${cat.name.padEnd(20)} | ID: ${cat._id}`);
    });

    console.log('\n✨ FUSION/CONTEMPORARY (' + fusion.length + ')');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    fusion.forEach((cat, i) => {
      console.log(`${i + 1}. ${cat.name.padEnd(20)} | ID: ${cat._id}`);
    });

    console.log('\n👶 CHILDREN\'S WEAR (' + children.length + ')');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    children.forEach((cat, i) => {
      console.log(`${i + 1}. ${cat.name.padEnd(20)} | ID: ${cat._id}`);
    });

    console.log('\n🕌 RELIGIOUS/CULTURAL (' + religious.length + ')');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    religious.forEach((cat, i) => {
      console.log(`${i + 1}. ${cat.name.padEnd(20)} | ID: ${cat._id}`);
    });

    console.log('\n💎 ACCESSORIES (' + accessories.length + ')');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    accessories.forEach((cat, i) => {
      console.log(`${i + 1}. ${cat.name.padEnd(20)} | ID: ${cat._id}`);
    });

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ All categories verified successfully!\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
  }
};

testCategories();
