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
  // Hindi and Punjabi names for everyday groceries
  'toor dal', 'arhar dal', 'moong dal', 'masoor dal', 'chana dal', 'urad dal', 'rajma', 'chana', 'kabuli chana',
  'chole', 'bhindi', 'tamatar', 'aloo', 'pyaaz', 'pyaz', 'gobhi', 'gobi', 'matar', 'adrak', 'lehsun', 'dhaniya',
  'mirchi', 'hari mirch', 'methi', 'lauki', 'baingan', 'shimla mirch', 'kheera', 'nimbu', 'doodh', 'anda',
  'ande', 'chawal', 'basmati rice', 'cheeni', 'namak', 'ajwain', 'rai', 'maida', 'sooji', 'rava', 'makhana',
  'gur', 'jaggery', 'sarson ka tel', 'desi ghee', 'pav', 'kulcha', 'papad', 'achaar', 'pickle', 'ketchup',
  'mayonnaise', 'lassi', 'chaach', 'buttermilk', 'cream', 'malai', 'khoya', 'coconut', 'coconut oil',
  'mustard seeds', 'cumin', 'turmeric', 'red chilli powder', 'dry fruits', 'kaju', 'badam', 'kishmish',
  'tea leaves', 'tea bags', 'green tea', 'coffee powder', 'milk powder', 'bournvita', 'horlicks',
  // Brands people say instead of the thing
  'harpic', 'lizol', 'dettol', 'savlon', 'colgate', 'surf excel', 'ariel', 'tide', 'rin', 'vim', 'vim bar',
  'odonil', 'good knight', 'all out', 'hit', 'phenyl', 'scotch brite', 'colin', 'amul butter', 'nutella',
  'kurkure', 'parle g', 'oreo', 'bourbon', 'frooti', 'maaza', 'thums up', 'sprite', 'pepsi', 'bisleri',
  'cold drinks', 'cold drink', 'red bull', 'crocin', 'dolo', 'paracetamol', 'ors', 'eno', 'vicks',
  'cough syrup', 'band aid', 'cotton', 'ear buds', 'face wash', 'body lotion', 'lotion', 'hair oil',
  // Around the house, school and pets
  'kitchen towels', 'tissue paper', 'napkins', 'aluminium foil', 'zip lock bags', 'trash bags', 'dustbin bags',
  'broom', 'mop', 'bucket', 'sponge', 'scrubber', 'chart paper', 'glue stick', 'glue sticks', 'crayons',
  'colour pencils', 'sketch pens', 'a4 sheets', 'geometry box', 'tiffin box', 'lunch box', 'water bottle',
  'phone cover', 'screen guard', 'earphones', 'power bank', 'extension board', 'birthday card', 'gift wrap',
  'wrapping paper', 'balloons', 'rangoli colours', 'mithai', 'crackers', 'marigold', 'agarbatti',
  'incense sticks', 'camphor', 'litter', 'dog treats', 'pet shampoo', 'gift', 'gifts', 'card',
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
  'add', 'shopping list', 'groceries we need', 'groceries', 'grocery list', 'grocery run', 'grocery', 'shopping', 'we need', 'we are out of',
  "we're out of", "i'm out of", 'we ran out of', 'ran out of', 'running low on', 'low on', 'out of',
  "we don't have any", 'need to buy', 'need to get', 'have to buy', 'have to get', 'need more',
  'need new', 'wanting to buy', 'want to buy', 'to buy', 'to get', 'buy', 'get', 'grab', 'order', 'pick up',
  'purchase', 'look for', 'need', 'put', 'stock up on', 'restock', "we've run out of", 'run out of',
  'almost out of', 'need a new', 'need a', 'get a new', 'buy a new',
].sort((a, b) => b.length - a.length);

/** Where the item list ends. */
const STOPS = [
  'on the way', 'from the', 'from', 'on amazon', 'on blinkit', 'on zepto', 'at the', 'at', 'tonight',
  'tomorrow', 'today', 'this', 'next', 'by', 'before', 'after', 'when', 'because', 'since', 'asap',
  'later', 'to the', 'for the week', 'for tomorrow', 'for the party', 'for the trip', 'is finished',
  'is over', 'are finished', 'are over', 'left', 'please', 'again', 'soon', 'as well', 'too', 'also',
  'if', 'so', 'mine', 'it', 'its', "it's", 'they', 'which', 'that', 'for guests',
  'to my', 'on my', 'on the', 'in my', 'to the shopping list', 'to the list', 'please',
  'is', 'are', 'was', 'were', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'on monday', 'on tuesday', 'on wednesday', 'on thursday', 'on friday', 'on saturday', 'on sunday', 'on the weekend',
];
/** Stops that can come first, before the items: "groceries for the week: atta, dal". */
const LEADING_STOPS = /^(?:[\s,]*(?:for the week|for tomorrow|for the party|for the trip|for guests|today|tomorrow|tonight|this week|this weekend|next week|later|too|also|again|please|soon|from the market|from the store)(?=[\s,]|$))+[\s,]*/i;
const DETERMINERS = new Set([
  'some', 'a', 'an', 'the', 'more', 'few', 'couple', 'of', 'any', 'extra', 'proper', 'fresh', 'enough', 'and', 'also', 'like',
  'her', 'him', 'them', 'me', 'us', 'my', 'our', 'his', 'their', 'your', 'new',
]);
/** Words that can't end an item: "a birthday cake for", "flowers from". */
const TRAILING = new Set(['for', 'on', 'at', 'from', 'to', 'with', 'in', 'by', 'of', 'and', 'or', 'the', 'a', 'some']);
/** A comma part that is a clause about the items, not an item: "the old one cracked", "mine broke". */
const CLAUSE = /\b(i|i'm|we|we're|he|she|they|it|it's|its|mine|ours|one|ones|old|is|are|was|were|has|have|had|got|broke|broken|cracked|torn|finished|over|done|don't|doesn't|didn't|isn't|aren't|won't|can't|keeps|looks|seems|almost|nearly|already|still)\b/i;

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

/** Known items mentioned anywhere in a phrase, longest first: "the rice and dal are over" -> ["rice", "dal"]. */
function knownItemsIn(phrase: string): string[] {
  const tokens = phrase.toLowerCase().match(/[a-z0-9']+/g) ?? [];
  const found: string[] = [];
  for (let i = 0; i < tokens.length; ) {
    let matched = 0;
    for (let n = Math.min(MAX_ITEM_WORDS, tokens.length - i); n >= 1; n--) {
      if (ITEM_SET.has(tokens.slice(i, i + n).join(' '))) {
        matched = n;
        break;
      }
    }
    if (matched) {
      found.push(tokens.slice(i, i + matched).join(' '));
      i += matched;
    } else {
      i++;
    }
  }
  return found;
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
    // The earliest buying phrase wins; "need to stock up on ..." moves on from "need" to "stock up on".
    let best: { index: number; end: number } | null = null;
    let from = 0;
    for (let round = 0; round < 3; round++) {
      best = null;
      for (const trigger of TRIGGERS) {
        const match = new RegExp(`(^|[\\s,])${escape(trigger)}(?=[\\s,]|$)`, 'i').exec(text.slice(from));
        if (!match) continue;
        const index = from + match.index + match[1].length;
        if (!best || index < best.index) best = { index, end: from + match.index + match[0].length };
      }
      if (!best || !/^\s*to\s/i.test(text.slice(best.end))) break;
      from = best.end;
    }
    if (best) text = text.slice(best.end);
    hadTrigger = best !== null;
  }

  // "need to apologize to her": a thing to do, not to buy.
  if (hadTrigger && /^\s*to\s/i.test(text)) return [];
  text = text.replace(LEADING_STOPS, ' ');

  // Comma parts after the first that read like a clause ("the old one cracked") are dropped,
  // keeping any known items inside them.
  const commaParts = text.split(',');
  text = commaParts
    .map((part, i) => {
      if (i === 0 || !CLAUSE.test(part)) return part;
      const known = knownItemsIn(part);
      return known.length ? known.join(' and ') : '';
    })
    .join(',');

  const stop = new RegExp(`[\\s,]+(?:${STOPS.map(escape).join('|')})(?=[\\s,]|$)`, 'i').exec(` ${text}`);
  if (stop) text = ` ${text}`.slice(0, stop.index);

  const items: string[] = [];
  for (const raw of text.split(/,|\band\b|\bplus\b|&/i)) {
    const tokens = raw.trim().split(/\s+/).filter(Boolean);
    while (tokens.length && DETERMINERS.has(tokens[0].toLowerCase())) tokens.shift();
    while (tokens.length && (DETERMINERS.has(tokens[tokens.length - 1].toLowerCase()) || TRAILING.has(tokens[tokens.length - 1].toLowerCase()))) tokens.pop();
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
