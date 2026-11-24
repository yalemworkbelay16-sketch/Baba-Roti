/**
 * Multi-Station Inventory & Routing Helper
 * ─────────────────────────────────────────────────────────────
 * Baba Roti Café & Restaurant Multi-Location Architecture:
 * 1. Main Store: Central storage warehouse (Purchases arrive here)
 * 2. Kitchen Station: Food preparation (Buns, Sandwiches, Breakfast, Pastry, Meals)
 * 3. Bar Station: Beverage service (Espresso, Latte, Tea, Juice, Soft Drinks, Cocktails, Water)
 */

function determineProductStation(product, stationCategoryMapping = null) {
  if (!product) return 'kitchen';

  // Check custom product mapping from Settings if available
  const pMap = stationCategoryMapping?.productMap;
  if (pMap && product.category && pMap[product.category]) {
    return pMap[product.category];
  }

  const parent = String(product.parentCategory || '').toUpperCase();
  if (parent === 'BEVERAGE' || parent === 'DRINK' || parent === 'BAR') {
    return 'bar';
  }
  if (parent === 'FOOD' || parent === 'KITCHEN') {
    return 'kitchen';
  }

  const category = String(product.category || '').toLowerCase();
  const name = String(product.name || '').toLowerCase();
  const text = `${category} ${name}`;

  const barKeywords = [
    'beverage', 'drink', 'coffee', 'tea', 'latte', 'espresso', 'cappuccino',
    'juice', 'smoothie', 'water', 'soda', 'cocktail', 'mocktail', 'beer',
    'wine', 'shake', 'cold drink', 'bar', 'macchiato', 'barista', 'soft drink'
  ];

  if (barKeywords.some((k) => text.includes(k))) {
    return 'bar';
  }

  return 'kitchen';
}

function determineMaterialStation(material, stationCategoryMapping = null, productStation = null) {
  if (!material) return 'kitchen';

  // 1. If material is an internally produced item, ALWAYS deduct from its production station!
  if (material.isProduced && material.productionStation && material.productionStation !== 'none') {
    return material.productionStation;
  }

  const cat = String(material.category || '').trim();
  const lowerCat = cat.toLowerCase();
  const lowerName = String(material.name || '').toLowerCase();

  // 2. Check custom raw material mapping in Settings
  const rawMap = stationCategoryMapping?.rawMaterialMap;
  if (rawMap && rawMap[cat]) {
    const mapped = String(rawMap[cat]).toLowerCase();
    if (mapped === 'bar' || mapped === 'barista') return 'bar';
    if (mapped === 'kitchen') return 'kitchen';
    if (mapped === 'mainstore' || mapped === 'main') return 'mainStore';
  }

  // 3. Known Bar categories and keywords
  const isBar =
    lowerCat === 'bar' ||
    /beverage|drink|coffee|tea|juice|soda|beer|wine|water|liquor|spirit/i.test(lowerCat) ||
    /coffee|tea|espresso|latte|cappuccino|macchiato|juice|smoothie|soda|cocktail|beer|wine|whisky|vodka/i.test(lowerName);

  // 4. Known Kitchen categories and keywords
  const isKitchen =
    lowerCat === 'kitchen' ||
    lowerCat === 'ferash bazare' ||
    lowerCat === 'fresh bazar' ||
    lowerCat === 'fresh bazaar' ||
    lowerCat === 'mendi' ||
    lowerCat === 'pastery' ||
    lowerCat === 'pastry' ||
    lowerCat === 'food' ||
    /produce|meat|poultry|dairy|egg|bakery|grain|spice|seasoning|food|fresh|fruit|veg|oil|sauce|salt|sugar|flour|injera/i.test(lowerCat) ||
    /meat|siga|shinkurt|onion|tomato|tibs|injera|bread|flour|butter|oil|egg|spice|garlic|ginger|salt|sugar/i.test(lowerName);

  if (isBar && !isKitchen) return 'bar';
  if (isKitchen) return 'kitchen';

  // 5. If used inside a product recipe, deduct from the station where that product is prepared!
  if (productStation) {
    const pSt = String(productStation).toLowerCase();
    if (pSt === 'bar' || pSt === 'barista') return 'bar';
    if (pSt === 'kitchen') return 'kitchen';
  }

  // 6. Explicit storeLocation ONLY if specifically assigned to Kitchen or Bar
  const loc = String(material.storeLocation || '').toLowerCase();
  if (loc.includes('bar') && !loc.includes('main')) return 'bar';
  if (loc.includes('kitchen') && !loc.includes('main')) return 'kitchen';

  // 7. Check if item has working stock in kitchen or bar:
  const kStock = Number(material.kitchenStock || 0);
  const bStock = Number(material.barStock || 0);
  if (kStock > 0 && bStock === 0) return 'kitchen';
  if (bStock > 0 && kStock === 0) return 'bar';

  // 8. Explicit Non-Station supply (cleaning, housekeeping, stationery) -> mainStore
  if (/clean|detergent|bleach|soap|mop|broom|tissue|napkin|stationery|office/i.test(lowerCat)) {
    return 'mainStore';
  }

  // 9. Default for restaurant food/cooking ingredients: kitchen
  return 'kitchen';
}

function getStationField(station) {
  if (station === 'bar' || station === 'barista') return 'barStock';
  if (station === 'kitchen') return 'kitchenStock';
  return 'mainStoreStock';
}

function getStationLabel(station) {
  if (station === 'bar' || station === 'barista') return 'Bar Station';
  if (station === 'kitchen') return 'Kitchen Station';
  return 'Main Store';
}

module.exports = {
  determineProductStation,
  determineMaterialStation,
  getStationField,
  getStationLabel,
};
