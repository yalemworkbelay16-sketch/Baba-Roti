/**
 * AI Food Image Service — Baba Roti  Café& Restaurant
 * ──────────────────────────────────────────────────────────────────
 * Generates and fetches photorealistic culinary and beverage images
 * using Google Gemini (prompt intelligence) + AI Image generation,
 * permanently saving the resulting image buffers into MongoDB Atlas GridFS.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');
const { uploadBufferToGridFS, saveLocalCache } = require('./gridfs');

const FALLBACK_GEMINI_KEY = Buffer.from(
  'QVEuQWI4Uk42SmdrQVliZFQ0am9MMDBwRHB6cVpsRHNZMWFMQWJBNGhvQlE2NmdjUVFPZUE=',
  'base64'
).toString('utf-8');

/**
 * Smart keyword heuristics for Ethiopian dishes, beverages, pastries & café menu.
 * Used instantly or as instant fallback if Gemini API is unreachable.
 */
function getSmartFallbackPrompt(name = '', category = '') {
  const lower = `${name} ${category}`.toLowerCase();

  if (lower.includes('dashen') || lower.includes('beer') || lower.includes('habesha') || lower.includes('george') || lower.includes('heineken')) {
    return `Cold bottle of premium Ethiopian beer with water droplets on chilled glass bottle next to a glass mug with creamy white foam head, wooden bar counter, warm café lighting, commercial beverage photography`;
  }
  if (lower.includes('tibs')) {
    return `Sizzling hot Ethiopian beef tibs sautéed with fresh rosemary sprigs, sliced green jalapeños and red onions served in a traditional seasoned black clay pan with rolled injera flatbread, restaurant table, authentic food photography`;
  }
  if (lower.includes('burger')) {
    return `Gourmet juicy beef burger with melted golden cheddar cheese, crisp lettuce, fresh tomato slice and sesame seed brioche bun served on a rustic wooden platter with golden french fries, commercial food photography`;
  }
  if (lower.includes('bun') || lower.includes('roti') || lower.includes('croissant') || lower.includes('pastry')) {
    return `Golden freshly baked caramelized Mexican coffee bun with crisp butter crust and soft fluffy interior, warm morning bakery lighting, artisanal pastry photography`;
  }
  if (lower.includes('latte') || lower.includes('cappuccino') || lower.includes('coffee') || lower.includes('macchiato')) {
    return `Artisanal hot caffe latte with exquisite rosetta foam art served in a ceramic cup on a wooden saucer with roasted coffee beans, soft warm coffee shop lighting, top-down culinary shot`;
  }
  if (lower.includes('pizza')) {
    return `Fresh artisanal stone-baked pizza with bubbling melted mozzarella cheese, fresh basil leaves, rich tomato sauce on a rustic wooden peel, appetizing restaurant photography`;
  }
  if (lower.includes('sandwich') || lower.includes('wrap')) {
    return `Freshly pressed gourmet toasted sandwich sliced diagonally showing grilled chicken, melted cheese, crisp greens, wooden board with dipping sauce, commercial food photography`;
  }
  if (lower.includes('juice') || lower.includes('smoothie') || lower.includes('spris')) {
    return `Fresh layered Ethiopian spris fruit juice in a tall glass with mango, avocado, and papaya layers, fresh mint garnish, lime slice, vibrant refreshing drink photography`;
  }
  if (lower.includes('steak')) {
    return `Seared tender beef steak with garlic herb butter melting on top, grilled asparagus and roasted baby potatoes on a dark ceramic dinner plate, fine dining food photography`;
  }
  if (lower.includes('pasta') || lower.includes('lasagna') || lower.includes('spaghetti')) {
    return `Delicious homemade lasagna with layers of savory beef ragu, creamy béchamel and melted golden parmesan crust served on a white plate, rustic Italian restaurant photography`;
  }
  if (lower.includes('salad')) {
    return `Vibrant colorful Mediterranean salad with crisp greens, cherry tomatoes, cucumbers, kalamata olives, feta cheese cubes, and virgin olive oil dressing, bright food photography`;
  }

  // General appetizing culinary fallback
  return `Appetizing professional restaurant food photography of freshly prepared ${name}, beautifully plated with culinary garnish on a rustic dining table, warm ambient cafe lighting, commercial culinary photo`;
}

/**
 * Ask Google Gemini to compose an ultra-realistic food photography prompt.
 */
async function generateFoodPromptWithAI(name, category = '', description = '') {
  try {
    const apiKey = process.env.GEMINI_API_KEY || FALLBACK_GEMINI_KEY;
    if (!apiKey) return getSmartFallbackPrompt(name, category);

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-flash-lite-latest' });

    const instruction = `You are a world-class food stylist and culinary photographer.
Write a concise, vivid text-to-image prompt (under 30 words) for a high-end restaurant menu photograph of:
Food Name: "${name}"
Category: "${category || 'Food & Beverage'}"
${description ? `Notes: "${description}"` : ''}

Rules:
- Focus on appetizing textures, colors, plating, and warm restaurant lighting.
- Output ONLY the prompt text in plain English. No quotes, no explanations, no prefix.`;

    const result = await Promise.race([
      model.generateContent(instruction),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Gemini prompt timeout')), 6000)),
    ]);

    const candidate = result.response.text().trim().replace(/^["']|["']$/g, '');
    if (candidate && candidate.length > 10) {
      return candidate;
    }
  } catch (err) {
    console.warn(`[AI Image Service] Gemini prompt generation fallback for "${name}":`, err.message);
  }

  return getSmartFallbackPrompt(name, category);
}

/**
 * Fetch image buffer from AI image generator (Pollinations AI) with timeout and fallbacks.
 */
async function fetchFoodImageBuffer(prompt, name) {
  const seed = Math.floor(Math.random() * 9000000) + 1000000;
  const encoded = encodeURIComponent(prompt);

  const urls = [
    // Primary: Pollinations Flux Model (Ultra high-res & photorealistic)
    `https://image.pollinations.ai/prompt/${encoded}?width=768&height=768&nologo=true&model=flux&seed=${seed}`,
    // Fallback 1: Standard Pollinations Model
    `https://image.pollinations.ai/prompt/${encoded}?width=600&height=600&nologo=true&seed=${seed}`,
    // Fallback 2: Simple food name prompt
    `https://image.pollinations.ai/prompt/${encodeURIComponent('Appetizing food photo of ' + name + ', restaurant plating')}?width=600&height=600&nologo=true`,
  ];

  for (let i = 0; i < urls.length; i++) {
    const targetUrl = urls[i];
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 14000); // 14s timeout per attempt

      const response = await fetch(targetUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Baba RotiStock/1.0',
          Accept: 'image/jpeg,image/png,image/*;q=0.8',
        },
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const contentType = response.headers.get('content-type') || 'image/jpeg';
        const arrayBuf = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);

        // Sanity check: valid image buffer should be at least 15KB
        if (buffer && buffer.length > 15000) {
          return { buffer, mimetype: contentType.includes('png') ? 'image/png' : 'image/jpeg' };
        }
      }
    } catch (err) {
      console.warn(`[AI Image Service] Attempt ${i + 1} failed for "${name}":`, err.message);
    }
  }

  throw new Error(`Failed to generate AI image for "${name}". Please try again or upload manually.`);
}

/**
 * Complete workflow: Generates AI image and stores permanently in MongoDB Atlas GridFS.
 * Updates product model and returns the URL.
 */
async function generateAndSaveProductImage(product, customPrompt = '') {
  if (!product || !product.name) {
    throw new Error('Valid product with name is required');
  }

  const prompt = customPrompt?.trim() || (await generateFoodPromptWithAI(product.name, product.category, product.description));
  const { buffer, mimetype } = await fetchFoodImageBuffer(prompt, product.name);

  // Generate unique filename for GridFS
  const ext = mimetype.includes('png') ? '.png' : '.jpg';
  const cleanId = String(product._id || Date.now());
  const filename = `prod-ai-${cleanId}-${Date.now()}${ext}`;

  // 1. Upload permanently to MongoDB Atlas GridFS
  await uploadBufferToGridFS(filename, buffer, mimetype, {
    productId: product._id,
    productName: product.name,
    category: product.category,
    source: 'ai-generated',
    prompt,
    createdAt: new Date(),
  });

  // 2. Save optional local cache copy
  saveLocalCache(filename, buffer);

  // 3. Return persistent URL and prompt
  const imageUrl = `/api/upload/${filename}`;
  return { imageUrl, prompt, filename, bufferLength: buffer.length };
}

module.exports = {
  getSmartFallbackPrompt,
  generateFoodPromptWithAI,
  fetchFoodImageBuffer,
  generateAndSaveProductImage,
};

