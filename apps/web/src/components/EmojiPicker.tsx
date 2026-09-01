import { useState } from 'react';

interface Entry {
  e: string;
  k: string; // search keywords
}

const CATEGORIES: { name: string; items: Entry[] }[] = [
  {
    name: 'Home & family',
    items: [
      { e: '🏡', k: 'home house garden' },
      { e: '🏠', k: 'home house' },
      { e: '🧹', k: 'clean cleaning sweep chores broom' },
      { e: '🧺', k: 'laundry washing basket' },
      { e: '🛋️', k: 'sofa couch lounge living room furniture' },
      { e: '🛏️', k: 'bed bedroom sleep' },
      { e: '🚿', k: 'shower bathroom' },
      { e: '🪴', k: 'plant pot indoor' },
      { e: '🔑', k: 'key keys lock' },
      { e: '🗑️', k: 'trash rubbish bin garbage' },
      { e: '🧼', k: 'soap wash hygiene' },
      { e: '🚪', k: 'door' },
      { e: '👶', k: 'baby kids child children' },
      { e: '👨‍👩‍👧‍👦', k: 'family kids parents' },
      { e: '🐾', k: 'pet pets paw animal' },
      { e: '🐕', k: 'dog puppy pet' },
      { e: '🐈', k: 'cat kitten pet' },
      { e: '🐟', k: 'fish aquarium pet' },
    ],
  },
  {
    name: 'Work & school',
    items: [
      { e: '💼', k: 'work briefcase job office business' },
      { e: '📝', k: 'notes memo write list' },
      { e: '📚', k: 'books study school read reading' },
      { e: '🎓', k: 'graduation uni university school study' },
      { e: '💻', k: 'laptop computer code tech' },
      { e: '📅', k: 'calendar schedule date' },
      { e: '📌', k: 'pin important' },
      { e: '✏️', k: 'pencil write draw' },
      { e: '📊', k: 'chart report stats graph' },
      { e: '🗂️', k: 'files folder organise admin' },
      { e: '📧', k: 'email mail inbox' },
      { e: '☎️', k: 'phone call' },
      { e: '🔬', k: 'science lab research' },
      { e: '🏫', k: 'school class' },
      { e: '🧠', k: 'brain ideas mind think learn' },
      { e: '💡', k: 'idea ideas light bulb' },
      { e: '🎯', k: 'goal goals target focus aim' },
      { e: '🚀', k: 'rocket launch project startup' },
    ],
  },
  {
    name: 'Food & drink',
    items: [
      { e: '🛒', k: 'shopping groceries cart supermarket' },
      { e: '🍽️', k: 'dinner meal plate food eat' },
      { e: '🍎', k: 'apple fruit healthy' },
      { e: '🥦', k: 'broccoli veggies vegetables healthy' },
      { e: '🍞', k: 'bread bakery toast' },
      { e: '🧀', k: 'cheese dairy' },
      { e: '🥩', k: 'meat steak butcher bbq barbecue' },
      { e: '🍗', k: 'chicken roast' },
      { e: '🍕', k: 'pizza takeaway' },
      { e: '🍔', k: 'burger takeaway' },
      { e: '🌮', k: 'taco mexican' },
      { e: '🍜', k: 'noodles ramen soup' },
      { e: '🍱', k: 'lunch bento meal prep' },
      { e: '🥗', k: 'salad healthy diet' },
      { e: '🎂', k: 'cake birthday' },
      { e: '🧁', k: 'cupcake baking sweet' },
      { e: '🍪', k: 'cookie biscuit baking' },
      { e: '☕', k: 'coffee cafe tea' },
      { e: '🍺', k: 'beer drinks pub' },
      { e: '🍷', k: 'wine drinks' },
    ],
  },
  {
    name: 'Travel & places',
    items: [
      { e: '✈️', k: 'travel flight holiday plane trip' },
      { e: '🧳', k: 'luggage trip pack suitcase holiday' },
      { e: '🏖️', k: 'beach holiday vacation summer' },
      { e: '⛺', k: 'camping tent outdoors' },
      { e: '🗺️', k: 'map adventure explore' },
      { e: '🚗', k: 'car drive road trip' },
      { e: '🚌', k: 'bus transport' },
      { e: '🚂', k: 'train travel' },
      { e: '⛽', k: 'fuel petrol gas' },
      { e: '🏨', k: 'hotel stay booking' },
      { e: '🏔️', k: 'mountain hike hiking' },
      { e: '🚢', k: 'cruise ship boat sailing' },
      { e: '🎡', k: 'theme park fair fun' },
      { e: '🌏', k: 'world globe earth global' },
    ],
  },
  {
    name: 'Sport & hobbies',
    items: [
      { e: '🏃', k: 'run running exercise fitness' },
      { e: '🏋️', k: 'gym weights workout lifting' },
      { e: '🚴', k: 'bike cycling ride' },
      { e: '🧘', k: 'yoga meditation mindfulness' },
      { e: '⚽', k: 'soccer football sport' },
      { e: '🏀', k: 'basketball sport' },
      { e: '🎾', k: 'tennis sport' },
      { e: '🏊', k: 'swim swimming pool' },
      { e: '🎣', k: 'fishing' },
      { e: '⛳', k: 'golf' },
      { e: '🎮', k: 'games gaming video controller' },
      { e: '🎨', k: 'art paint craft creative' },
      { e: '🎵', k: 'music songs playlist' },
      { e: '🎸', k: 'guitar band music' },
      { e: '🎬', k: 'movies film cinema watch' },
      { e: '📷', k: 'photo photography camera' },
      { e: '🧶', k: 'knitting crochet yarn craft' },
      { e: '♟️', k: 'chess board games' },
      { e: '🎳', k: 'bowling' },
      { e: '📖', k: 'reading book novel' },
    ],
  },
  {
    name: 'Garden & nature',
    items: [
      { e: '🌱', k: 'garden plant seedling grow' },
      { e: '🌻', k: 'flower sunflower garden' },
      { e: '🌹', k: 'rose flower' },
      { e: '🌳', k: 'tree yard park' },
      { e: '🍂', k: 'autumn fall leaves' },
      { e: '☀️', k: 'sun sunny summer weather' },
      { e: '🌧️', k: 'rain weather' },
      { e: '❄️', k: 'snow winter cold' },
      { e: '🌊', k: 'ocean sea waves surf' },
      { e: '🐝', k: 'bee bees honey' },
      { e: '🦜', k: 'bird parrot' },
      { e: '🌵', k: 'cactus desert' },
      { e: '🍄', k: 'mushroom forage' },
      { e: '🌙', k: 'moon night' },
    ],
  },
  {
    name: 'Money & errands',
    items: [
      { e: '💰', k: 'money budget savings finance' },
      { e: '💳', k: 'card payment bills bank' },
      { e: '🏦', k: 'bank finance' },
      { e: '🧾', k: 'receipt bills invoice tax' },
      { e: '🛠️', k: 'tools fix repair diy maintenance' },
      { e: '🔧', k: 'wrench fix repair' },
      { e: '🔨', k: 'hammer build renovate' },
      { e: '📦', k: 'package delivery parcel post' },
      { e: '🚚', k: 'moving truck removal delivery' },
      { e: '🏥', k: 'doctor hospital health medical appointment' },
      { e: '💊', k: 'medicine pills pharmacy chemist' },
      { e: '🦷', k: 'dentist teeth' },
      { e: '💇', k: 'haircut hair salon barber' },
      { e: '👗', k: 'clothes fashion dress wardrobe' },
      { e: '👟', k: 'shoes sneakers' },
      { e: '🎁', k: 'gift gifts presents' },
      { e: '🚙', k: 'car service rego mechanic' },
      { e: '🐶', k: 'vet dog appointment' },
    ],
  },
  {
    name: 'Fun & symbols',
    items: [
      { e: '⭐', k: 'star favourite favorite' },
      { e: '✨', k: 'sparkle magic special' },
      { e: '❤️', k: 'love heart' },
      { e: '🎉', k: 'party celebrate event' },
      { e: '🥳', k: 'party celebrate birthday' },
      { e: '🔥', k: 'fire hot streak' },
      { e: '✅', k: 'done check tick complete' },
      { e: '⏰', k: 'alarm time reminder clock' },
      { e: '🚨', k: 'urgent alert important' },
      { e: '🌈', k: 'rainbow colours' },
      { e: '💪', k: 'strong strength motivation' },
      { e: '🙏', k: 'thanks please gratitude' },
      { e: '😀', k: 'smile happy face' },
      { e: '🎄', k: 'christmas xmas holidays' },
      { e: '🎃', k: 'halloween pumpkin' },
      { e: '🐣', k: 'easter chick' },
      { e: '☘️', k: 'luck clover shamrock' },
      { e: '🏆', k: 'trophy win achievement' },
    ],
  },
];

const ALL: Entry[] = CATEGORIES.flatMap((c) => c.items);

// Anything the user types/pastes that contains an emoji can be used directly,
// even if it's not in the curated set.
const EMOJI_RE = /\p{Extended_Pictographic}/u;

interface EmojiPickerProps {
  value: string;
  onChange: (emoji: string) => void;
}

export function EmojiPicker({ value, onChange }: EmojiPickerProps) {
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  const custom = EMOJI_RE.test(q.trim()) && q.trim().length <= 12 ? q.trim() : null;
  const matches = query && !custom ? ALL.filter((it) => it.k.includes(query) || it.e === query) : null;

  const cell = (e: string) => (
    <button
      key={e}
      type="button"
      onClick={() => onChange(e)}
      className="grid aspect-square place-items-center rounded-lg text-lg"
      style={{
        background: value === e ? 'var(--color-accent-soft)' : 'var(--color-chip-bg)',
        boxShadow: value === e ? 'inset 0 0 0 2px var(--color-accent)' : 'none',
      }}
      aria-pressed={value === e}
    >
      {e}
    </button>
  );

  return (
    <div>
      <div className="mb-2 flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
        <span className="text-muted" style={{ fontSize: 14 }}>🔍</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search, or type any emoji…"
          className="w-full bg-transparent outline-none"
          style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text)' }}
        />
        {q && (
          <button type="button" className="text-muted" style={{ fontSize: 14 }} onClick={() => setQ('')} aria-label="Clear search">
            ✕
          </button>
        )}
      </div>

      <div className="overflow-y-auto" style={{ maxHeight: 230 }}>
        {custom ? (
          <button
            type="button"
            onClick={() => onChange(custom)}
            className="flex items-center gap-2 rounded-lg px-3 py-2 font-semibold"
            style={{
              fontSize: 'var(--fs-sm)',
              background: value === custom ? 'var(--color-accent-soft)' : 'var(--color-chip-bg)',
              boxShadow: value === custom ? 'inset 0 0 0 2px var(--color-accent)' : 'none',
            }}
          >
            <span className="text-lg">{custom}</span> Use this emoji
          </button>
        ) : matches ? (
          matches.length ? (
            <div className="grid grid-cols-8 gap-1">{matches.map((it) => cell(it.e))}</div>
          ) : (
            <p className="py-2 text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
              No matches — you can paste any emoji into the search box.
            </p>
          )
        ) : (
          CATEGORIES.map((c) => (
            <div key={c.name}>
              <h4 className="mb-1 mt-2 font-bold uppercase text-muted" style={{ fontSize: 'var(--fs-xs)', letterSpacing: '.07em' }}>
                {c.name}
              </h4>
              <div className="grid grid-cols-8 gap-1">{c.items.map((it) => cell(it.e))}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
