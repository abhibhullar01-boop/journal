/**
 * Shopping lists: "groceries, we need eggs bread and atta" -> ["Eggs", "Bread", "Atta"].
 */

/** Everyday things people buy. Multi-word items are matched before single words. */
const ITEMS = [
  'milk', 'eggs', 'egg', 'bread', 'atta', 'flour', 'rice', 'dal', 'paneer', 'ghee', 'onions', 'onion',
  'tomatoes', 'tomato', 'potatoes', 'potato', 'curd', 'dahi', 'butter', 'coffee', 'tea', 'sugar', 'salt',
  'oil', 'cooking oil', 'mustard oil', 'olive oil', 'bananas', 'apples', 'oranges', 'grapes', 'mangoes',
  'fruits', 'fruit', 'vegetables', 'veggies', 'chicken', 'mutton', 'fish', 'maggi', 'biscuits',
  'coriander', 'dhania', 'chillies', 'green chillies', 'ginger', 'garlic', 'lemons', 'cheese', 'yogurt',
  'oats', 'cornflakes', 'cereal', 'peanut butter', 'jam', 'honey', 'spinach', 'palak', 'cucumber',
  'carrots', 'peas', 'frozen peas', 'noodles', 'pasta', 'chips', 'juice', 'soft drinks', 'coke',
  'ice cream', 'chocolate', 'chocolates', 'almonds', 'cashews', 'dry fruits', 'besan', 'poha', 'suji',
  'masala', 'garam masala', 'haldi', 'jeera', 'water', 'soda', 'beer', 'wine', 'snacks', 'namkeen',
  'detergent', 'dish soap', 'dishwash', 'toilet paper', 'tissues', 'garbage bags', 'toothpaste',
  'toothbrush', 'shampoo', 'conditioner', 'soap', 'handwash', 'body wash', 'light bulbs', 'bulbs',
  'batteries', 'mosquito repellent', 'floor cleaner', 'dog food', 'cat food', 'cat litter', 'diapers',
  'baby wipes', 'wipes', 'sanitary pads', 'pads', 'razor', 'razor blades', 'deodorant', 'sunscreen',
  'moisturiser', 'moisturizer', 'medicine', 'medicines', 'vitamins', 'cake', 'sweets', 'flowers',
  'groceries', 'paper towels', 'foil', 'cling wrap', 'matchbox', 'candles', 'diyas', 'charger',
  'cable', 'pen', 'pens', 'notebooks', 'stationery', 'socks', 'towels', 'bedsheets', 'pillows',
];
const ITEM_SET = new Set(ITEMS);
/** Things people "need more of" that you can't buy. */
const NOT_THINGS = new Set([
  'sleep', 'rest', 'time', 'break', 'a break', 'help', 'space', 'motivation', 'focus', 'energy', 'patience',
  'money', 'exercise', 'discipline', 'peace', 'vacation', 'holiday', 'fun', 'sunlight', 'balance', 'me time',
  'practice', 'confidence', 'support', 'clarity', 'courage', 'hugs', 'love', 'friends', 'quiet',
]);
const MAX_ITEM_WORDS = 3;

/** "Maybe I need more sleep": things you can't buy. */
export function mentionsOnlyIntangibles(sentence: string): boolean {
  const tokens = sentence.toLowerCase().match(/[a-z']+/g) ?? [];
  return tokens.some((t) => NOT_THINGS.has(t)) && !tokens.some((t) => ITEM_SET.has(t));
}

export function isShoppingItem(phrase: string): boolean {
  return ITEM_SET.has(phrase.toLowerCase().trim());
}

/** Phrases that introduce what to buy. Longer ones first. */
const TRIGGERS = [
  'add', 'shopping list', 'groceries we need', 'groceries', 'grocery list', 'we need', 'we are out of',
  "we're out of", "i'm out of", 'we ran out of', 'ran out of', 'running low on', 'low on', 'out of',
  "we don't have any", 'need to buy', 'need to get', 'have to buy', 'have to get', 'need more',
  'need new', 'wanting to buy', 'want to buy', 'to buy', 'to get', 'buy', 'get', 'grab', 'order', 'pick up',
  'purchase', 'look for', 'need',
].sort((a, b) => b.length - a.length);

/** Where the item list ends. */
const STOPS = [
  'on the way', 'from the', 'from', 'on amazon', 'on blinkit', 'on zepto', 'at the', 'at', 'tonight',
  'tomorrow', 'today', 'this', 'next', 'by', 'before', 'after', 'when', 'because', 'since', 'asap',
  'later', 'to the', 'for the week', 'for tomorrow', 'for the party', 'for the trip', 'is finished',
  'is over', 'are finished', 'are over', 'left', 'please', 'again', 'soon', 'as well', 'too', 'also',
  'if', 'so', 'mine', 'it', 'its', "it's", 'they', 'which', 'that', 'for guests',
];
const DETERMINERS = new Set(['some', 'a', 'an', 'the', 'more', 'few', 'couple', 'of', 'any', 'extra', 'proper', 'fresh', 'enough', 'and', 'also', 'like']);

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '[,\\s]+');

/** Splits "eggs bread milk" into known items when every word is covered; otherwise keeps it whole. */
function segment(chunk: string): string[] {
  const tokens = chunk.split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return tokens.length ? [chunk] : [];
  const out: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    let matched = 0;
    for (let n = Math.min(MAX_ITEM_WORDS, tokens.length - i); n >= 1; n--) {
      if (ITEM_SET.has(tokens.slice(i, i + n).join(' ').toLowerCase())) {
        matched = n;
        break;
      }
    }
    if (!matched) return [chunk];
    out.push(tokens.slice(i, i + matched).join(' '));
    i += matched;
  }
  return out;
}

function cap(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/** The individual things to buy in a sentence, in the user's words. */
export function shoppingItems(sentence: string): string[] {
  let text = sentence.replace(/’/g, "'").replace(/[.!?;:]+/g, ' ').replace(/\s+/g, ' ').trim();

  // "Milk is finished" / "coffee is over": the item comes first.
  const before = text.match(/^(?:(?:um|so|and|also|oh|okay|ok)[,\s]+)*(.+?)\s+(?:is|are)\s+(?:finished|over|out|done)\b/i);
  let hadTrigger = true;
  if (before) {
    text = before[1];
  } else {
    let best: { index: number; end: number } | null = null;
    for (const trigger of TRIGGERS) {
      const match = new RegExp(`(^|[\\s,])${escape(trigger)}(?=[\\s,]|$)`, 'i').exec(text);
      if (!match) continue;
      const index = match.index + match[1].length;
      if (!best || index < best.index) best = { index, end: match.index + match[0].length };
    }
    if (best) text = text.slice(best.end);
    hadTrigger = best !== null;
  }

  const stop = new RegExp(`[\\s,]+(?:${STOPS.map(escape).join('|')})(?=[\\s,]|$)`, 'i').exec(` ${text}`);
  if (stop) text = ` ${text}`.slice(0, stop.index);

  const items: string[] = [];
  for (const raw of text.split(/,|\band\b|\bplus\b|&/i)) {
    const tokens = raw.trim().split(/\s+/).filter(Boolean);
    while (tokens.length && DETERMINERS.has(tokens[0].toLowerCase())) tokens.shift();
    while (tokens.length && DETERMINERS.has(tokens[tokens.length - 1].toLowerCase())) tokens.pop();
    if (!tokens.length) continue;
    for (const item of segment(tokens.join(' '))) items.push(cap(item));
  }
  // "Maybe I need more sleep" is not shopping.
  if (items.length && items.every((i) => NOT_THINGS.has(i.toLowerCase()))) return [];
  // Without a buying phrase, only accept known items ("milk eggs bread"), not "cut down on coffee".
  if (!hadTrigger && !items.every((i) => segment(i.toLowerCase()).every((x) => ITEM_SET.has(x)))) return [];
  const useful = items.filter((i) => !['groceries', 'stuff', 'things', 'shopping', 'it'].includes(i.toLowerCase()));
  if (useful.length) return useful;
  return items.length ? ['Groceries'] : [];
}
