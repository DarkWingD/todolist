/**
 * What goes off, and what you can only buy more of than one recipe needs.
 *
 * This is what makes "share ingredients across the week" worth anything: a
 * bunch of coriander bought for Tuesday's curry is half wasted unless Thursday
 * uses it too, while a tin of tomatoes keeps for a year and sharing it saves
 * nothing. Only these count when the planner looks for meals that go together.
 *
 * `pack` is how it is sold, for saying "1 bunch (Tue + Thu)"; `days` is roughly
 * how long it lasts in the fridge once bought, so two meals ten days apart are
 * not counted as sharing a bunch of mint that would never have survived.
 */
export interface Perishable {
  pack: string;
  days: number;
}

const P = (pack: string, days: number): Perishable => ({ pack, days });

export const PERISHABLES: Record<string, Perishable> = {
  coriander: P('bunch', 5),
  parsley: P('bunch', 6),
  basil: P('bunch', 4),
  'thai basil': P('bunch', 4),
  mint: P('bunch', 5),
  dill: P('bunch', 5),
  chive: P('bunch', 5),
  'spring onion': P('bunch', 6),
  lemongrass: P('stalk', 10),
  'baby spinach': P('bag', 5),
  spinach: P('bunch', 4),
  rocket: P('bag', 4),
  kale: P('bunch', 6),
  'salad mix': P('bag', 4),
  lettuce: P('head', 7),
  'cos lettuce': P('head', 7),
  'bean sprout': P('bag', 3),
  mushroom: P('punnet', 5),
  celery: P('bunch', 14),
  cabbage: P('head', 14),
  'red cabbage': P('head', 14),
  cauliflower: P('head', 7),
  broccoli: P('head', 6),
  broccolini: P('bunch', 5),
  'bok choy': P('bunch', 5),
  zucchini: P('each', 7),
  eggplant: P('each', 7),
  capsicum: P('each', 7),
  'red capsicum': P('each', 7),
  cucumber: P('each', 7),
  avocado: P('each', 3),
  'cherry tomato': P('punnet', 6),
  tomato: P('each', 6),
  lemon: P('each', 14),
  lime: P('each', 10),
  'thickened cream': P('300 ml', 7),
  cream: P('300 ml', 7),
  'sour cream': P('tub', 10),
  'cream cheese': P('tub', 10),
  buttermilk: P('carton', 10),
  ricotta: P('tub', 6),
  feta: P('block', 10),
  haloumi: P('block', 14),
  halloumi: P('block', 14),
  mozzarella: P('ball', 6),
  bocconcini: P('tub', 5),
  'greek yoghurt': P('tub', 10),
  yoghurt: P('tub', 10),
  'coconut milk': P('tin', 4),
  'coconut cream': P('tin', 4),
  'chicken stock': P('carton', 5),
  'beef stock': P('carton', 5),
  'vegetable stock': P('carton', 5),
  passata: P('jar', 5),
  'tomato paste': P('tin', 7),
  'puff pastry': P('sheet', 3),
  tortilla: P('pack', 7),
  wrap: P('pack', 7),
  bread: P('loaf', 4),
  'pita bread': P('pack', 4),
  naan: P('pack', 4),
  'beef mince': P('pack', 2),
  'pork mince': P('pack', 2),
  'chicken mince': P('pack', 2),
  'chicken thigh': P('pack', 2),
  'chicken breast': P('pack', 2),
  bacon: P('pack', 7),
  chorizo: P('pack', 10),
};

export function perishableOf(key: string): Perishable | null {
  return PERISHABLES[key] ?? null;
}
