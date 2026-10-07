/**
 * Where things are in a supermarket, so the shopping list reads in the order you
 * walk the shop. Rules, not a model: a few hundred words cover nearly everything
 * a family cooks, and an unknown item lands in "Other" rather than somewhere
 * confidently wrong.
 *
 * Matching is on the ingredient key (see `ingredientKey`), last word first:
 * "chicken thigh" is meat because of "chicken", "coconut milk" is a tin because
 * the whole phrase is listed before "milk" is.
 */

export interface Aisle {
  id: string;
  label: string;
  emoji: string;
}

export const AISLES: Aisle[] = [
  { id: 'produce', label: 'Fruit & veg', emoji: '🥬' },
  { id: 'meat', label: 'Meat & seafood', emoji: '🥩' },
  { id: 'dairy', label: 'Dairy & eggs', emoji: '🧀' },
  { id: 'bakery', label: 'Bread & bakery', emoji: '🍞' },
  { id: 'pantry', label: 'Pantry', emoji: '🥫' },
  { id: 'spices', label: 'Herbs, spices & sauces', emoji: '🧂' },
  { id: 'international', label: 'International', emoji: '🌏' },
  { id: 'frozen', label: 'Frozen', emoji: '🧊' },
  { id: 'drinks', label: 'Drinks', emoji: '🧃' },
  { id: 'other', label: 'Other', emoji: '🛒' },
];

const WORDS: Record<string, string> = {};
function put(aisle: string, list: string) {
  for (const w of list.split(',')) {
    const t = w.trim();
    if (t) WORDS[t] = aisle;
  }
}

put(
  'produce',
  `onion,red onion,spring onion,eschalot,garlic,ginger,potato,sweet potato,carrot,celery,
  tomato,cherry tomato,cucumber,lettuce,cos lettuce,iceberg lettuce,spinach,baby spinach,rocket,kale,cabbage,
  red cabbage,broccoli,broccolini,cauliflower,zucchini,eggplant,capsicum,red capsicum,green capsicum,
  yellow capsicum,chilli,mushroom,corn,sweetcorn,pea,snow pea,sugar snap pea,green beans,bean,bok choy,
  pak choy,asparagus,pumpkin,butternut pumpkin,pea,snow pea,leek,fennel,beetroot,radish,parsnip,turnip,avocado,lemon,
  lime,orange,apple,banana,pear,mango,pineapple,strawberry,blueberry,raspberry,grape,watermelon,
  rockmelon,kiwi,kiwifruit,peach,nectarine,plum,coriander,parsley,basil,thai basil,mint,dill,chive,
  rosemary,thyme,sage,oregano leaf,lemongrass,bean sprout,sprout,salad,salad mix,mixed leaf,herb,
  shallot,silverbeet,chard,okra,squash,artichoke,pomegranate,date,fig,passionfruit,lychee,papaya,
  potatoes,kumara,cherry,berry,apricot,celeriac,radicchio,watercress,iceberg`,
);
put(
  'meat',
  `chicken,chicken thigh,chicken breast,chicken drumstick,chicken wing,chicken mince,beef,beef mince,
  steak,rump,sirloin,scotch fillet,brisket,chuck,lamb,lamb shoulder,lamb leg,lamb chop,lamb mince,pork,
  pork mince,pork belly,pork chop,pork shoulder,bacon,ham,prosciutto,chorizo,salami,sausage,mince,
  turkey,duck,veal,salmon,fish,white fish,barramundi,snapper,tuna steak,prawn,shrimp,mussel,squid,
  calamari,scallop,crab,lobster,ling,cod,trout,meatball,schnitzel,cutlet,drumstick,wing,thigh,breast`,
);
put(
  'dairy',
  `milk,butter,cheese,cheddar,parmesan,mozzarella,feta,ricotta,haloumi,halloumi,cream cheese,
  bocconcini,brie,camembert,gouda,swiss cheese,tasty cheese,egg,yoghurt,yogurt,greek yoghurt,cream,
  thickened cream,sour cream,pure cream,creme fraiche,buttermilk,mascarpone,custard,ghee,paneer`,
);
put(
  'bakery',
  `bread,sourdough,baguette,roll,bread roll,bun,burger bun,wrap,tortilla,pita,pita bread,naan,
  flatbread,croissant,english muffin,crumpet,bagel,brioche,ciabatta,turkish bread,taco shell,pizza base`,
);
put(
  'pantry',
  `flour,plain flour,self-raising flour,cornflour,sugar,brown sugar,caster sugar,icing sugar,
  white sugar,rice,brown rice,white rice,jasmine rice,basmati rice,arborio rice,pasta,spaghetti,penne,
  fettuccine,linguine,lasagne sheet,macaroni,noodle,egg noodle,rice noodle,oats,rolled oats,couscous,
  quinoa,lentils,red lentils,lentil,red lentil,chickpeas,chickpea,kidney bean,black bean,cannellini bean,baked bean,tinned tomato,
  passata,tomato paste,coconut milk,coconut cream,stock,chicken stock,beef stock,vegetable stock,
  breadcrumb,panko,honey,maple syrup,golden syrup,jam,peanut butter,nut,almond,cashew,walnut,peanut,
  pine nut,sesame seed,seed,olive,caper,tuna,tinned tuna,sardine,corn chip,cracker,biscuit,chocolate,
  cocoa,baking powder,baking soda,bicarbonate of soda,yeast,vanilla,vanilla extract,gelatine,olive oil,
  oil,vegetable oil,canola oil,sesame oil,coconut oil,vinegar,white vinegar,red wine vinegar,
  white wine vinegar,balsamic vinegar,apple cider vinegar,rice vinegar,raisin,sultana,dried fruit,
  polenta,semolina,water`,
);
put(
  'spices',
  `salt,lemongrass paste,spice paste,tikka paste,korma paste,black pepper,white pepper,peppercorn,cumin,ground cumin,coriander seed,ground coriander,
  paprika,smoked paprika,sweet paprika,chilli flake,chilli powder,cayenne,turmeric,cinnamon,ground cinnamon,
  nutmeg,clove,cardamom,star anise,bay leaf,dried oregano,dried thyme,dried basil,mixed herb,italian herb,
  garam masala,curry powder,curry paste,red curry paste,green curry paste,yellow curry paste,
  ground ginger,garlic powder,onion powder,mustard,dijon mustard,wholegrain mustard,tomato sauce,ketchup,
  bbq sauce,barbecue sauce,worcestershire sauce,soy sauce,light soy sauce,dark soy sauce,fish sauce,
  oyster sauce,hoisin sauce,sweet chilli sauce,sriracha,hot sauce,mayonnaise,mayo,aioli,pesto,
  tahini,harissa,stock powder,gravy,seasoning,taco seasoning,cajun seasoning,five spice,sumac,za'atar`,
);
put(
  'international',
  `kecap manis,miso,gochujang,mirin,sake,rice paper,nori,wasabi,tamarind,palm sugar,
  shaoxing wine,black bean sauce,ponzu,teriyaki sauce,salsa,refried bean,jalapeno,chipotle`,
);
put(
  'frozen',
  `frozen peas,frozen corn,frozen berries,frozen vegetable,ice cream,frozen pastry,puff pastry,
  shortcrust pastry,filo pastry,frozen chip,chip,hash brown,fish finger,frozen prawn`,
);
put(
  'drinks',
  `wine,red wine,white wine,beer,juice,orange juice,soda,soda water,tonic,coffee,tea,cider`,
);

/** The aisle an ingredient key belongs in; 'other' when it is not known. */
export function aisleOf(key: string): string {
  const k = key.toLowerCase().trim();
  if (!k) return 'other';
  if (k.startsWith('tinned ')) return 'pantry';
  if (WORDS[k]) return WORDS[k]!;
  const words = k.split(' ');
  // Longest tail first: "red wine vinegar" before "vinegar", "coconut milk" before "milk".
  for (let i = 1; i < words.length; i++) {
    const tail = words.slice(i).join(' ');
    if (WORDS[tail]) return WORDS[tail]!;
  }
  for (const w of words) if (WORDS[w]) return WORDS[w]!;
  return 'other';
}
