/**
 * Multi-Station Inventory & Routing Helper
 * ─────────────────────────────────────────────────────────────
 * Baba Roti Café & Restaurant Multi-Location Architecture:
 * 1. Main Store: Central storage warehouse (Purchases arrive here)
 * 2. Kitchen Station: Food preparation (Buns, Sandwiches, Breakfast, Pastry, Meals)
 * 3. Bar Station: Beverage service (Espresso, Latte, Tea, Juice, Soft Drinks, Cocktails, Water)
 */

function determineProductStation(product) {
  if (!product) return 'kitchen';

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
  getStationField,
  getStationLabel,
};
