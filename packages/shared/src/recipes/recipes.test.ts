// The recipe rules, checked against lines as real recipes write them.
//   pnpm --filter @todolist/shared test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  aisleOf,
  extractRecipe,
  findTimers,
  formatQty,
  ingredientKey,
  isoMinutes,
  mergeForShopping,
  parseIngredient,
  parseRecipeText,
  pantryKeys,
  scaleLine,
  sharedThisWeek,
  suggestWeek,
  tidyIngredient,
} from '../index.js';

const p = (s: string) => {
  const i = parseIngredient(s);
  return { qty: i.qty, qtyMax: i.qtyMax, unit: i.unit?.name ?? null, key: i.key, note: i.note };
};

test('amounts, units and names from ordinary lines', () => {
  assert.deepEqual(p('2 brown onions, finely diced'), {
    qty: 2,
    qtyMax: null,
    unit: null,
    key: 'onion',
    note: 'finely diced',
  });
  assert.deepEqual(p('500g chicken thigh fillets'), {
    qty: 500,
    qtyMax: null,
    unit: 'g',
    key: 'chicken thigh',
    note: null,
  });
  assert.deepEqual(p('1 1/2 cups (375ml) chicken stock'), {
    qty: 1.5,
    qtyMax: null,
    unit: 'cup',
    key: 'chicken stock',
    note: '375ml',
  });
  assert.deepEqual(p('1½ tbsp olive oil'), {
    qty: 1.5,
    qtyMax: null,
    unit: 'tbsp',
    key: 'olive oil',
    note: null,
  });
  assert.deepEqual(p('¼ cup fresh coriander leaves, chopped'), {
    qty: 0.25,
    qtyMax: null,
    unit: 'cup',
    key: 'coriander',
    note: 'chopped',
  });
  assert.deepEqual(p('2-3 garlic cloves, crushed'), {
    qty: 2,
    qtyMax: 3,
    unit: null,
    key: 'garlic',
    note: 'crushed',
  });
  assert.deepEqual(p('3 cloves garlic'), {
    qty: 3,
    qtyMax: null,
    unit: 'clove',
    key: 'garlic',
    note: null,
  });
  assert.deepEqual(p('2 x 400g tins diced tomatoes'), {
    qty: 2,
    qtyMax: null,
    unit: 'tin',
    key: 'tinned tomato',
    note: '400g',
  });
  assert.deepEqual(p('a pinch of salt'), {
    qty: 1,
    qtyMax: null,
    unit: 'pinch',
    key: 'salt',
    note: null,
  });
  // "Salt and pepper" reads as pepper; what matters is that the pantry has it, so it never reaches the list.
  assert.ok(pantryKeys(null).has(p('Salt and pepper, to taste').key));
  assert.equal(aisleOf(p('2 x 400g tins diced tomatoes').key), 'pantry');
  assert.deepEqual(p('▢ 1 tsp ground cumin'), {
    qty: 1,
    qtyMax: null,
    unit: 'tsp',
    key: 'ground cumin',
    note: null,
  });
  assert.equal(p('1 T butter').unit, 'tbsp');
  assert.equal(p('1 t vanilla').unit, 'tsp');
});

test('the same thing written differently meets on one key', () => {
  assert.equal(ingredientKey('cilantro'), 'coriander');
  assert.equal(ingredientKey('Fresh coriander'), 'coriander');
  assert.equal(ingredientKey('spring onions'), 'spring onion');
  assert.equal(ingredientKey('scallions'), 'spring onion');
  assert.equal(ingredientKey('red onion'), 'red onion');
  assert.equal(ingredientKey('brown onion'), 'onion');
  assert.equal(ingredientKey('tomatoes'), 'tomato');
  assert.equal(ingredientKey('extra virgin olive oil'), 'olive oil');
  assert.equal(ingredientKey('lean beef mince'), 'beef mince');
  assert.equal(ingredientKey('chickpeas'), 'chickpea');
  assert.equal(ingredientKey('chicken or vegetable broth'), 'chicken stock');
  assert.equal(ingredientKey('Thai basil or cilantro/coriander'), 'thai basil');
  assert.equal(ingredientKey('can chopped tomatoes'), 'tinned tomato');
  assert.equal(ingredientKey('thumb-sized piece of ginger'), 'ginger');
  assert.equal(ingredientKey('snow peas'), 'snow pea');
  assert.equal(ingredientKey('baby spinach leaves'), 'baby spinach');
});

test('amounts print the way a cook writes them, and scale', () => {
  assert.equal(formatQty(0.5), '½');
  assert.equal(formatQty(1.25), '1¼');
  assert.equal(formatQty(2), '2');
  assert.equal(formatQty(437, 'g'), '435');
  assert.equal(formatQty(12.4), '12');
  assert.equal(scaleLine('2 onions, diced', 1.5), '3 onions, diced');
  assert.equal(scaleLine('500g beef mince', 2), '1000g beef mince');
  assert.equal(scaleLine('1/2 cup rice', 2), '1 cup rice');
  assert.equal(scaleLine('salt to taste', 2), 'salt to taste');
});

test('recipe-site debris is tidied, and scaling reaches brackets and tiny amounts', () => {
  assert.equal(tidyIngredient('2 large garlic cloves (, minced)'), '2 large garlic cloves, minced');
  assert.equal(
    tidyIngredient('4 - 6 tbsp Thai Green Curry Paste (Maesri best) OR ((Note 1))'),
    '4 - 6 tbsp Thai Green Curry Paste (Maesri best) OR',
  );
  assert.equal(
    tidyIngredient('400 g/14oz coconut milk (, full fat (Note 4))'),
    '400 g coconut milk, full fat',
  );
  assert.equal(tidyIngredient('1/2 - 1 1/2 tsp fish sauce *'), '1/2 - 1 1/2 tsp fish sauce');
  assert.equal(scaleLine('1 cup (250ml) chicken stock', 2), '2 cup (500ml) chicken stock');
  assert.equal(scaleLine('1/4 tsp salt', 0.25), '⅛ tsp salt');
  assert.equal(formatQty(0.05), '⅛');
});

test('lines saved before tidying still read cleanly, and the list buys whole things', () => {
  assert.equal(
    parseIngredient('350 g/12 oz chicken thigh (, skinless boneless, sliced (Note 6))').key,
    'chicken thigh',
  );
  assert.equal(
    parseIngredient('6 kaffir lime leaves (, torn in half (Note 5))').note,
    'torn in half',
  );
  const list = mergeForShopping(
    [
      {
        mealName: 'Tacos',
        date: '2026-10-08',
        ingredients: '2 limes\nJuice of 1/2 lime\n1 onion thinly sliced\n1 bunch coriander',
        factor: 0.25,
      },
    ],
    pantryKeys(''),
  );
  const items = Object.fromEntries(list.aisles.flatMap((a) => a.items).map((i) => [i.key, i]));
  assert.equal(items['lime']!.title, 'Lime — 1 (Tacos)'); // ½ a lime is a lime
  assert.equal(items['onion']!.title, 'Onion — 1 (Tacos)'); // not "Onion thinly sliced — ¼"
  assert.equal(items['coriander']!.amount, '1 bunch'); // never "¼ bunch"
  const cups = mergeForShopping(
    [{ mealName: 'Curry', date: '2026-10-07', ingredients: '1 1/2 cups snow peas', factor: 0.25 }],
    pantryKeys(''),
  );
  assert.equal(cups.aisles[0]!.items[0]!.amount, '⅓ cup'); // the recipe's own unit, not "95 ml"
});

test('aisles', () => {
  assert.equal(aisleOf('onion'), 'produce');
  assert.equal(aisleOf('chicken thigh'), 'meat');
  assert.equal(aisleOf('coconut milk'), 'pantry');
  assert.equal(aisleOf('sour cream'), 'dairy');
  assert.equal(aisleOf('fish sauce'), 'spices');
  assert.equal(aisleOf('red wine vinegar'), 'pantry');
  assert.equal(aisleOf('dragonfruit chutney'), 'other');
  assert.equal(aisleOf(ingredientKey('snow peas')), 'produce');
  assert.equal(aisleOf(ingredientKey('chicken or vegetable broth')), 'pantry');
  assert.equal(aisleOf(ingredientKey('can chopped tomatoes')), 'pantry');
});

test('a week merges into one list: added up, scaled, pantry left off, perishables by the pack', () => {
  const list = mergeForShopping(
    [
      {
        mealName: 'Curry',
        date: '2026-10-06',
        ingredients: '2 onions\n500g chicken thighs\n¼ cup coriander\n1 tbsp olive oil\nsalt',
        factor: 1,
      },
      {
        mealName: 'Tacos',
        date: '2026-10-08',
        ingredients: '1 onion, diced\n500g beef mince\ncoriander, to serve\n1 kg chicken thighs',
        factor: 1,
      },
      {
        mealName: 'Soup',
        date: '2026-10-09',
        ingredients: '1 onion\n1 tbsp sour cream\nbasil, to serve',
        factor: 2,
      },
    ],
    pantryKeys(null),
  );
  const items = Object.fromEntries(list.aisles.flatMap((a) => a.items).map((i) => [i.key, i]));
  assert.equal(items['onion']!.amount, '5'); // 2 + 1 + (1 × 2)
  assert.equal(items['chicken thigh']!.amount, '1.5 kg'); // 500 g + 1 kg
  assert.equal(items['coriander']!.amount, '1 bunch'); // herbs are bought by the bunch
  assert.match(items['coriander']!.title, /\(Tue \+ Thu\)/); // and the list says which nights
  assert.equal(items['coriander']!.optional, false); // one recipe needs it, one only serves it
  assert.equal(items['sour cream']!.amount, '2 tbsp'); // scaled ×2
  assert.ok(!items['olive oil'] && !items['salt']);
  assert.deepEqual(list.pantry, ['Olive oil', 'Salt']);
  assert.deepEqual(
    list.aisles.map((a) => a.id),
    ['produce', 'meat', 'dairy'],
  );
  assert.ok(list.spare.some((s) => s.key === 'basil')); // a bunch, one meal: it will go limp
  assert.ok(!list.spare.some((s) => s.key === 'sour cream')); // a tub keeps
});

test('the planner fills empty nights, favouring meals that share perishables', () => {
  const catalog = [
    {
      id: 'curry',
      name: 'Green curry',
      ingredients: '2 chicken thighs\n1 bunch coriander\n1 tin coconut milk',
      isFavourite: false,
      lastCooked: null,
    },
    {
      id: 'tacos',
      name: 'Fish tacos',
      ingredients: '4 tortillas\ncoriander\n1 lime\n500g white fish',
      isFavourite: false,
      lastCooked: null,
    },
    {
      id: 'pasta',
      name: 'Bolognese',
      ingredients: '500g beef mince\n1 jar passata',
      isFavourite: false,
      lastCooked: null,
    },
    {
      id: 'roast',
      name: 'Roast lamb',
      ingredients: 'lamb shoulder\nrosemary',
      isFavourite: false,
      lastCooked: '2026-10-01',
    },
  ];
  const out = suggestWeek({
    catalog,
    planned: [{ date: '2026-10-06', mealId: 'curry' }],
    empty: ['2026-10-07'],
    seed: 7,
  });
  assert.equal(out[0]!.mealId, 'tacos');
  assert.match(out[0]!.reasons[0]!, /uses up the coriander from Tue/);
  const week = suggestWeek({
    catalog,
    planned: [],
    empty: ['2026-10-06', '2026-10-07', '2026-10-08'],
    seed: 3,
  });
  assert.equal(new Set(week.map((w) => w.mealId)).size, 3); // no repeats
  assert.ok(!week.some((w) => w.mealId === 'roast')); // had five days ago
  const far = suggestWeek({
    catalog: catalog.slice(0, 3),
    planned: [{ date: '2026-10-01', mealId: 'curry' }],
    empty: ['2026-10-12'],
    seed: 7,
  });
  assert.ok(!far[0]!.reasons.some((r) => /coriander/.test(r))); // eleven days later the bunch is long gone
  assert.deepEqual(
    sharedThisWeek([
      { date: '2026-10-06', mealName: 'Curry', ingredients: 'coriander\n1 tin coconut milk' },
      { date: '2026-10-08', mealName: 'Tacos', ingredients: 'coriander' },
    ]),
    [{ key: 'coriander', label: 'coriander', days: ['Tue', 'Thu'] }],
  );
});

test('a recipe page with schema.org JSON-LD is read exactly', () => {
  const html = `<html><head><script type="application/ld+json">{"@context":"https://schema.org","@graph":[
    {"@type":"WebPage","name":"x"},
    {"@type":["Recipe"],"name":"Chicken &amp; Corn Soup","recipeYield":["4","4 serves"],"prepTime":"PT15M","cookTime":"PT1H5M",
     "recipeIngredient":["1 tbsp olive oil","2 cups (500ml) chicken stock","&frac12; cup corn kernels"],
     "recipeInstructions":[{"@type":"HowToSection","name":"Soup","itemListElement":[{"@type":"HowToStep","text":"Heat the oil."},{"@type":"HowToStep","text":"Simmer for 20 minutes."}]}],
     "recipeCategory":"Dinner","recipeCuisine":"Chinese","keywords":"soup, quick"}]}</script></head></html>`;
  const r = extractRecipe(html)!;
  assert.equal(r.name, 'Chicken & Corn Soup');
  assert.deepEqual(r.ingredients, [
    '1 tbsp olive oil',
    '2 cups (500ml) chicken stock',
    '½ cup corn kernels',
  ]);
  assert.deepEqual(r.method, ['Soup:', 'Heat the oil.', 'Simmer for 20 minutes.']);
  assert.equal(r.servings, 4);
  assert.equal(r.prepMinutes, 15);
  assert.equal(r.cookMinutes, 65);
  assert.deepEqual(r.tags, ['dinner', 'chinese', 'soup', 'quick']);
  assert.deepEqual(
    extractRecipe(
      html.replace(
        '"keywords":"soup, quick"',
        '"keywords":"Esther Clark, 1 of 5-a-day, Chicken & Corn Soup, Main course, slow cooker"',
      ),
    )!.tags,
    ['dinner', 'chinese', 'mains', 'slow-cooker'],
  );
  assert.equal(extractRecipe('<html><p>no recipe here</p></html>'), null);
  assert.equal(isoMinutes('PT1H30M'), 90);
});

test('a pasted recipe, with and without headings', () => {
  const a = parseRecipeText(
    'Easy Fried Rice\nServes 4\n\nIngredients\n- 2 cups cooked rice\n- 2 eggs\n\nMethod\n1. Heat the wok.\n2. Fry for 5 minutes.',
  );
  assert.deepEqual(
    [a.name, a.servings, a.ingredients, a.method],
    [
      'Easy Fried Rice',
      4,
      ['2 cups cooked rice', '2 eggs'],
      ['Heat the wok.', 'Fry for 5 minutes.'],
    ],
  );
  const b = parseRecipeText('Toast\n2 slices bread\n1 tbsp butter\nToast the bread and butter it.');
  assert.deepEqual(
    [b.name, b.ingredients, b.method],
    ['Toast', ['2 slices bread', '1 tbsp butter'], ['Toast the bread and butter it.']],
  );
});

test('timers in a step', () => {
  assert.deepEqual(
    findTimers('Simmer for 20 minutes, then rest 5 mins.').map((t) => t.seconds),
    [1200, 300],
  );
  assert.deepEqual(
    findTimers('Roast for 1-1.5 hours').map((t) => t.seconds),
    [3600],
  );
  assert.deepEqual(
    findTimers('Bake for half an hour').map((t) => t.seconds),
    [1800],
  );
  assert.deepEqual(findTimers('Season well.'), []);
});
