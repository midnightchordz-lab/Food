// Client-side shopping-list helpers: parse an ingredient string into quantity +
// unit + name, categorise it into a grocery aisle, and merge duplicate
// ingredients (summing compatible quantities) grouped by aisle for display.

export type RawItem = { name: string; checked: boolean };

export type MergedRow = {
  key: string;
  display: string;   // e.g. "3 cups flour" or "garlic (2 cloves + 1 tbsp)"
  names: string[];   // underlying raw item names this row represents
  checked: boolean;  // true only when every underlying item is checked
};

export type AisleSection = { aisle: string; rows: MergedRow[] };

const UNIT_MAP: Record<string, string> = {
  cup: 'cup', cups: 'cup',
  tbsp: 'tbsp', tablespoon: 'tbsp', tablespoons: 'tbsp',
  tsp: 'tsp', teaspoon: 'tsp', teaspoons: 'tsp',
  g: 'g', gram: 'g', grams: 'g', gm: 'g',
  kg: 'kg', kilogram: 'kg', kilograms: 'kg',
  ml: 'ml', l: 'l', liter: 'l', litre: 'l', liters: 'l', litres: 'l',
  oz: 'oz', ounce: 'oz', ounces: 'oz',
  lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb',
  clove: 'clove', cloves: 'clove',
  can: 'can', cans: 'can', tin: 'can', tins: 'can',
  slice: 'slice', slices: 'slice',
  piece: 'piece', pieces: 'piece', pcs: 'piece',
  pinch: 'pinch', pinches: 'pinch',
  bunch: 'bunch', bunches: 'bunch',
  stick: 'stick', sticks: 'stick',
  packet: 'packet', packets: 'packet', pack: 'packet',
};

const UNIT_PLURAL: Record<string, string> = {
  cup: 'cups', clove: 'cloves', can: 'cans', slice: 'slices', piece: 'pieces',
  pinch: 'pinches', bunch: 'bunches', stick: 'sticks', packet: 'packets',
};

function parseQty(token: string): number | null {
  // supports "1", "1.5", "1/2", "1 1/2", "2-3" (takes lower bound)
  const t = token.replace(/–|—/g, '-').trim();
  const range = t.match(/^(\d+(?:\.\d+)?)\s*-\s*\d+(?:\.\d+)?$/);
  if (range) return parseFloat(range[1]);
  const mixed = t.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return parseInt(mixed[1], 10) + parseInt(mixed[2], 10) / parseInt(mixed[3], 10);
  const frac = t.match(/^(\d+)\/(\d+)$/);
  if (frac) return parseInt(frac[1], 10) / parseInt(frac[2], 10);
  const num = t.match(/^\d+(?:\.\d+)?$/);
  if (num) return parseFloat(t);
  return null;
}

export function parseIngredient(raw: string): { qty: number | null; unit: string | null; name: string; base: string; raw: string } {
  let s = raw.trim();
  // strip leading list markers just in case
  s = s.replace(/^([-*•·]|\d+[.)])\s+/, '');
  // pull a leading quantity (incl. mixed/fraction/range)
  let qty: number | null = null;
  const qMatch = s.match(/^((?:\d+\s+\d+\/\d+)|(?:\d+(?:\.\d+)?\s*[-–—]\s*\d+(?:\.\d+)?)|(?:\d+\/\d+)|(?:\d+(?:\.\d+)?))\s*/);
  if (qMatch) {
    qty = parseQty(qMatch[1]);
    s = s.slice(qMatch[0].length);
  }
  // drop a parenthetical metric hint like "(200g)"
  s = s.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  // pull a unit if the next word is one
  let unit: string | null = null;
  const uMatch = s.match(/^([a-zA-Z]+)\b\.?\s*/);
  if (uMatch) {
    const cand = uMatch[1].toLowerCase();
    if (UNIT_MAP[cand]) { unit = UNIT_MAP[cand]; s = s.slice(uMatch[0].length); }
  }
  if (unit && /^of\s+/i.test(s)) s = s.replace(/^of\s+/i, '');
  const name = s.trim() || raw.trim();
  // base name for grouping: drop descriptors after a comma, lowercase, singularise
  let base = name.split(',')[0].toLowerCase().trim();
  base = base.replace(/\b(fresh|dried|ground|chopped|sliced|minced|large|small|medium|boneless|skinless|ripe|whole)\b/g, '').replace(/\s+/g, ' ').trim();
  if (base.length > 3) {
    if (base.endsWith('ies')) base = base.slice(0, -3) + 'y';
    else if (/(oes|shes|ches|sses|xes)$/.test(base)) base = base.slice(0, -2);
    else if (base.endsWith('s') && !base.endsWith('ss')) base = base.slice(0, -1);
  }
  return { qty, unit, name, base: base || name.toLowerCase(), raw: raw.trim() };
}

const AISLES: { aisle: string; test: (n: string) => boolean }[] = [
  { aisle: 'Produce', test: (n) =>
      /\b(onion|garlic|tomato|potato|carrot|spinach|ginger|lemon|lime|cilantro|coriander|mint|lettuce|cucumber|mushroom|avocado|apple|banana|celery|broccoli|cauliflower|corn|pea|scallion|spring onion|leek|zucchini|eggplant|aubergine|cabbage|kale|basil|parsley|chilli|chili|jalapeno|bell pepper|green pepper|red pepper|capsicum|fruit|vegetable|lettuce|beetroot|radish|squash|pumpkin|okra|beans? \(?fresh)\b/.test(n)
      || /\bpepper\b/.test(n) && !/\bblack pepper|peppercorn|white pepper|red pepper flakes\b/.test(n) },
  { aisle: 'Meat & Seafood', test: (n) => /\b(chicken|beef|pork|lamb|mutton|fish|salmon|tuna|shrimp|prawn|bacon|sausage|turkey|mince|steak|meat|cod|tilapia|crab)\b/.test(n) },
  { aisle: 'Dairy & Eggs', test: (n) => /\b(milk|cheese|butter|yogurt|yoghurt|cream|ghee|paneer|egg|eggs|curd|mozzarella|parmesan|feta|ricotta)\b/.test(n) },
  { aisle: 'Bakery', test: (n) => /\b(bread|tortilla|bun|naan|pita|bagel|roll|baguette|croissant|wrap)\b/.test(n) },
  { aisle: 'Spices & Seasoning', test: (n) => /\b(salt|black pepper|peppercorn|cumin|turmeric|garam masala|paprika|cinnamon|cardamom|clove|bay leaf|chilli powder|chili powder|coriander powder|oregano|thyme|nutmeg|spice|seasoning|masala|saffron|vanilla|cayenne|curry powder|red pepper flakes|dried)\b/.test(n) },
  { aisle: 'Pantry', test: (n) => /\b(rice|flour|pasta|noodle|oil|vinegar|sugar|honey|sauce|stock|broth|can|canned|lentil|chickpea|dal|tomato paste|coconut milk|soy sauce|ketchup|mustard|mayonnaise|mayo|baking|cornstarch|corn starch|breadcrumb|oats|quinoa|nut|seed|jam|syrup|tea|coffee|cereal|beans?)\b/.test(n) },
  { aisle: 'Frozen', test: (n) => /\bfrozen\b/.test(n) },
];

export const AISLE_ORDER = ['Produce', 'Meat & Seafood', 'Dairy & Eggs', 'Bakery', 'Pantry', 'Spices & Seasoning', 'Frozen', 'Other'];

export const AISLE_ICON: Record<string, string> = {
  'Produce': 'carrot',
  'Meat & Seafood': 'food-drumstick',
  'Dairy & Eggs': 'cheese',
  'Bakery': 'bread-slice',
  'Pantry': 'sack',
  'Spices & Seasoning': 'shaker-outline',
  'Frozen': 'snowflake',
  'Other': 'basket-outline',
};

export function aisleFor(name: string): string {
  const n = name.toLowerCase();
  for (const a of AISLES) if (a.test(n)) return a.aisle;
  return 'Other';
}

function pluralUnit(unit: string, qty: number): string {
  if (qty > 1 && UNIT_PLURAL[unit]) return UNIT_PLURAL[unit];
  return unit;
}

function fmtQty(qty: number): string {
  // render nice fractions for common halves/quarters
  const rounded = Math.round(qty * 100) / 100;
  if (Number.isInteger(rounded)) return String(rounded);
  const whole = Math.floor(rounded);
  const frac = rounded - whole;
  const map: Record<string, string> = { '0.25': '¼', '0.5': '½', '0.75': '¾', '0.33': '⅓', '0.67': '⅔' };
  const key = frac.toFixed(2);
  if (map[key]) return (whole ? `${whole} ` : '') + map[key];
  return String(rounded);
}

// Build aisle-grouped, duplicate-merged display rows from the raw stored items.
export function buildShoppingView(items: RawItem[]): AisleSection[] {
  const groups = new Map<string, { aisle: string; base: string; entries: { parsed: ReturnType<typeof parseIngredient>; item: RawItem }[] }>();
  for (const item of items) {
    const parsed = parseIngredient(item.name);
    const aisle = aisleFor(parsed.base || parsed.name);
    const key = `${aisle}::${parsed.base}`;
    if (!groups.has(key)) groups.set(key, { aisle, base: parsed.base, entries: [] });
    groups.get(key)!.entries.push({ parsed, item });
  }

  const byAisle = new Map<string, MergedRow[]>();
  for (const g of groups.values()) {
    const names = g.entries.map((e) => e.item.name);
    const checked = g.entries.every((e) => e.item.checked);
    const displayName = g.entries[0].parsed.name;

    let display: string;
    if (g.entries.length === 1) {
      display = g.entries[0].item.name;
    } else {
      const units = new Set(g.entries.map((e) => e.parsed.unit || ''));
      const allSameUnit = units.size === 1;
      const allNumeric = g.entries.every((e) => e.parsed.qty != null);
      if (allNumeric && allSameUnit) {
        const total = g.entries.reduce((s, e) => s + (e.parsed.qty || 0), 0);
        const unit = g.entries[0].parsed.unit;
        display = unit
          ? `${fmtQty(total)} ${pluralUnit(unit, total)} ${displayName}`
          : `${fmtQty(total)} ${displayName}`;
      } else {
        const parts = g.entries
          .map((e) => [e.parsed.qty != null ? fmtQty(e.parsed.qty) : '', e.parsed.unit || ''].join(' ').trim())
          .filter(Boolean);
        display = parts.length ? `${displayName} (${parts.join(' + ')})` : displayName;
      }
    }

    if (!byAisle.has(g.aisle)) byAisle.set(g.aisle, []);
    byAisle.get(g.aisle)!.push({ key: `${g.aisle}::${g.base}`, display, names, checked });
  }

  const sections: AisleSection[] = [];
  for (const aisle of AISLE_ORDER) {
    const rows = byAisle.get(aisle);
    if (rows && rows.length) {
      rows.sort((a, b) => (a.checked === b.checked ? a.display.localeCompare(b.display) : a.checked ? 1 : -1));
      sections.push({ aisle, rows });
    }
  }
  return sections;
}
