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

function determineMaterialStation(material, stationCategoryMapping = null) {
  if (!material) return 'mainStore';

  const cat = String(material.category || '').trim();

  // 1. Check custom raw material mapping in Settings
  const rawMap = stationCategoryMapping?.rawMaterialMap;
  if (rawMap && rawMap[cat]) {
    return rawMap[cat];
  }

  // 2. Explicit storeLocation if already assigned
  const loc = String(material.storeLocation || '').toLowerCase();
  if (loc.includes('kitchen')) return 'kitchen';
  if (loc.includes('bar')) return 'bar';

  // 3. Known Baba Roti categories default mapping
  const lowerCat = cat.toLowerCase();
  if (lowerCat === 'bar' || /beverage|drink|coffee|tea|juice|soda|beer|wine|water/i.test(lowerCat)) {
    return 'bar';
  }
  if (
    lowerCat === 'kitchen' ||
    lowerCat === 'ferash bazare' ||
    lowerCat === 'mendi' ||
    lowerCat === 'pastery' ||
    /produce|meat|poultry|dairy|bakery|grains|spices|food|fresh|fruit|veg/i.test(lowerCat)
  ) {
    return 'kitchen';
  }

  return 'mainStore';
}

function getStationField(station) {
  if (station === 'bar' || station === 'barista') return 'barStock';
  if (station === 'kitchen') return 'kitchenStock';
  return 'mainStoreStock';
}

function getStationLabel(station) {
  if (station === 'bar' || station === 'barista') return 'Bar Station';
  if (station === 'kitchen') return 'Kitchen Station';
  return 'Main Store Warehouse';
}

module.exports = {
  determineProductStation,
  determineMaterialStation,
  getStationField,
  getStationLabel,
};
