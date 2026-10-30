/**
 * Script to batch generate & assign authentic high-res food images
 * for all products in MongoDB Atlas GridFS.
 */
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const Product = require('../models/Product');
const { generateAndSaveProductImage } = require('../utils/aiImageService');
const { getGridFSBucket } = require('../utils/gridfs');

async function run() {
  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected.');

  // Clean up any test files
  try {
    const bucket = getGridFSBucket();
    if (bucket) {
      const testFiles = await bucket.find({ filename: /prod-ai-test/ }).toArray();
      for (const tf of testFiles) {
        await bucket.delete(tf._id);
      }
      if (testFiles.length > 0) {
        console.log(`Cleaned up ${testFiles.length} temporary test files.`);
      }
    }
  } catch (_) {}

  // Find products missing images
  const products = await Product.find({
    $or: [{ imageUrl: { $exists: false } }, { imageUrl: '' }, { imageUrl: null }],
  });

  console.log(`Found ${products.length} products needing images.`);

  let updated = 0;
  let failed = 0;

  for (let i = 0; i < products.length; i++) {
    const prod = products[i];
    try {
      console.log(`[${i + 1}/${products.length}] Processing "${prod.name}" (${prod.category})...`);
      const res = await generateAndSaveProductImage(prod);
      prod.imageUrl = res.imageUrl;
      await prod.save();
      updated++;
      console.log(`  -> SUCCESS: ${res.imageUrl} (${Math.round((res.bufferLength || 0) / 1024)} KB)`);
    } catch (err) {
      failed++;
      console.error(`  -> ERROR for "${prod.name}":`, err.message);
    }
    // Small delay to be polite to APIs
    await new Promise((r) => setTimeout(r, 150));
  }

  console.log(`\n========================================`);
  console.log(`Batch complete!`);
  console.log(`Successfully updated: ${updated}`);
  console.log(`Failed: ${failed}`);
  console.log(`========================================\n`);

  process.exit(0);
}

run().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
