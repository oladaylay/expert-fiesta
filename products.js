// === Product catalog ===
// Real Chow Republic products and pricing (from invoice history). `image` is an emoji
// placeholder — swap for a real photo path (e.g. "images/chicken-laps.jpg") any time.
const PRODUCTS = [
  {
    id: "chicken-laps",
    name: "Chicken Laps",
    category: "Fresh Poultry",
    price: 5800,
    unit: "per kg",
    image: "🐔",
    description: "Fresh chicken laps (thigh and drumstick), sold by the kilo."
  },
  {
    id: "chicken-quarters",
    name: "Chicken Quarters",
    category: "Fresh Poultry",
    price: 5800,
    unit: "per kg",
    image: "🐔",
    description: "Fresh chicken leg quarters, sold by the kilo."
  },
  {
    id: "boneless-chicken-breast",
    name: "Boneless Chicken Breast",
    category: "Fresh Poultry",
    price: 7000,
    unit: "per kg",
    image: "🐔",
    description: "Fresh boneless chicken breast, sold by the kilo."
  },
  {
    id: "chicken-wings",
    name: "Chicken Wings",
    category: "Fresh Poultry",
    price: 6000,
    unit: "per kg",
    image: "🐔",
    description: "Fresh chicken wings, sold by the kilo."
  },
  {
    id: "chicken-gizzard",
    name: "Chicken Gizzard",
    category: "Fresh Poultry",
    price: 6000,
    unit: "per kg",
    image: "🐔",
    description: "Fresh chicken gizzards, sold by the kilo."
  },
  {
    id: "chicken-head-feet",
    name: "Chicken Head & Feet",
    category: "Fresh Poultry",
    price: 3200,
    unit: "per kg",
    image: "🐔",
    description: "Chicken head and feet for stock and pepper soup, sold by the kilo."
  },
  {
    id: "whole-chicken",
    name: "Whole Chicken",
    category: "Fresh Poultry",
    price: 15000,
    unit: "per each",
    image: "🐔",
    description: "One whole fresh chicken."
  },
  {
    id: "smoked-chicken-pack",
    name: "Smoked Chicken Pack",
    category: "Smoked & Grilled",
    price: 7500,
    unit: "per pack",
    image: "🔥",
    description: "Ready-to-eat smoked chicken, packed per serving."
  },
  {
    id: "smoked-chicken-laps",
    name: "Smoked Chicken Laps",
    category: "Smoked & Grilled",
    price: 7500,
    unit: "per pack",
    image: "🔥",
    description: "Smoked chicken laps, packed and ready to eat."
  },
  {
    id: "smoked-turkey-pack",
    name: "Smoked Turkey Pack",
    category: "Turkey",
    price: 15500,
    unit: "per pack",
    image: "🦃",
    description: "Ready-to-eat smoked turkey, packed per serving."
  },
  {
    id: "smoked-mackerel-pack",
    name: "Smoked Mackerel Pack",
    category: "Fish",
    price: 12000,
    unit: "per pack",
    image: "🐟",
    description: "Smoked mackerel, packed and ready to eat."
  },
  {
    id: "bulk-5kg-chicken-quarters",
    name: "5kg Chicken Quarters",
    category: "Bulk Packs",
    price: 25000,
    unit: "per 5kg box",
    image: "📦",
    description: "Five-kilo box of fresh chicken quarters."
  },
  {
    id: "bulk-5kg-chicken-laps",
    name: "5kg Chicken Laps",
    category: "Bulk Packs",
    price: 28500,
    unit: "per 5kg box",
    image: "📦",
    description: "Five-kilo box of fresh chicken laps."
  },
  {
    id: "bulk-10kg-chicken-quarters",
    name: "10kg Chicken Quarters",
    category: "Bulk Packs",
    price: 58000,
    unit: "per 10kg box",
    image: "📦",
    description: "Ten-kilo box of fresh chicken quarters."
  },
  {
    id: "bulk-10kg-chicken-laps",
    name: "10kg Chicken Laps",
    category: "Bulk Packs",
    price: 58000,
    unit: "per 10kg box",
    image: "📦",
    description: "Ten-kilo box of fresh chicken laps. Our best seller."
  },
  {
    id: "bulk-5kg-smoked-chicken-box",
    name: "5kg Smoked Chicken Box",
    category: "Bulk Packs",
    price: 40000,
    unit: "per 5kg box",
    image: "📦",
    description: "Five-kilo box of smoked chicken for events and stocking up."
  },
  {
    id: "bulk-5kg-smoked-turkey-box",
    name: "5kg Smoked Turkey Box",
    category: "Bulk Packs",
    price: 75000,
    unit: "per 5kg box",
    image: "📦",
    description: "Five-kilo box of smoked turkey."
  },
  {
    id: "bulk-10kg-turkey-quarters",
    name: "10kg Turkey Quarters",
    category: "Bulk Packs",
    price: 58000,
    unit: "per 10kg box",
    image: "📦",
    description: "Ten-kilo box of fresh turkey quarters."
  },
  {
    id: "platter-20pc-chicken",
    name: "20-Piece Chicken Platter",
    category: "Platters & Bundles",
    price: 37000,
    unit: "per platter",
    image: "🍽️",
    description: "Platter of 20 pieces of grilled chicken, made for sharing."
  },
  {
    id: "platter-bbq-gizzards",
    name: "BBQ Chicken Gizzards",
    category: "Platters & Bundles",
    price: 35000,
    unit: "per platter",
    image: "🍽️",
    description: "Grilled chicken gizzards, served as a platter."
  },
  {
    id: "platter-love-bbq-combo",
    name: "Love (BBQ Combo) Platter",
    category: "Platters & Bundles",
    price: 35000,
    unit: "per platter",
    image: "🍽️",
    description: "Mixed BBQ combo platter for two."
  },
  {
    id: "platter-fried-plantain",
    name: "Fried Plantain Platter",
    category: "Platters & Bundles",
    price: 10000,
    unit: "per platter",
    image: "🍽️",
    description: "Platter of fried plantain, a side for grills."
  },
  {
    id: "bundle-smoky-goodness",
    name: "Smoky-Goodness Bundle",
    category: "Platters & Bundles",
    price: 57500,
    unit: "per bundle",
    image: "🍽️",
    description: "Value bundle from the Smoky-Goodness range."
  },

  // --- Previously sold items, re-added below. Not invoiced since 2025 — prices are the last
  // one quoted, so confirm/update before relying on them. ---
  {
    id: "smoked-goat-meat-pack",
    name: "Smoked Goat Meat Pack",
    category: "Goat, Ram & Pork",
    price: 8250,
    unit: "per pack",
    image: "🐐",
    description: "Smoked goat meat, packed and ready to eat."
  },
  {
    id: "smoked-ram-pack",
    name: "Smoked Ram Pack",
    category: "Goat, Ram & Pork",
    price: 10000,
    unit: "per pack",
    image: "🐐",
    description: "Smoked ram meat, packed and ready to eat."
  },
  {
    id: "bulk-5kg-smoked-ram-box",
    name: "5kg Smoked Ram Box",
    category: "Goat, Ram & Pork",
    price: 33500,
    unit: "per 5kg box",
    image: "🐐",
    description: "Five-kilo box of smoked ram."
  },
  {
    id: "bulk-5kg-smoked-goat-box",
    name: "5kg Smoked Goat Box",
    category: "Goat, Ram & Pork",
    price: 32000,
    unit: "per 5kg box",
    image: "🐐",
    description: "Five-kilo box of smoked goat meat."
  },
  {
    id: "fresh-goat-meat-pack",
    name: "Fresh Goat Meat Pack",
    category: "Goat, Ram & Pork",
    price: 5000,
    unit: "per pack",
    image: "🐐",
    description: "Fresh goat meat, packed by the portion."
  },
  {
    id: "fresh-ram-pack",
    name: "Fresh Ram Pack",
    category: "Goat, Ram & Pork",
    price: 4000,
    unit: "per pack",
    image: "🐐",
    description: "Fresh ram meat, packed by the portion."
  },
  {
    id: "fresh-pork",
    name: "Fresh Pork",
    category: "Goat, Ram & Pork",
    price: 2500,
    unit: "per kg",
    image: "🐐",
    description: "Fresh pork, sold by the kilo."
  },
  {
    id: "smoked-pork",
    name: "Smoked Pork",
    category: "Goat, Ram & Pork",
    price: 3500,
    unit: "per pack",
    image: "🐐",
    description: "Smoked pork, packed and ready to eat."
  },
  {
    id: "smoked-catfish-pack",
    name: "Smoked Catfish Pack",
    category: "Fish",
    price: 6000,
    unit: "per pack",
    image: "🐟",
    description: "Smoked catfish, packed and ready to eat."
  },
  {
    id: "bulk-5kg-smoked-catfish-box",
    name: "5kg Smoked Catfish Box",
    category: "Fish",
    price: 29000,
    unit: "per 5kg box",
    image: "🐟",
    description: "Five-kilo box of smoked catfish."
  },
  {
    id: "fresh-catfish",
    name: "Fresh Catfish",
    category: "Fish",
    price: 1500,
    unit: "per kg",
    image: "🐟",
    description: "Fresh catfish, sold by the kilo."
  },
  {
    id: "bulk-10kg-boneless-chicken-breast",
    name: "10kg Boneless Chicken Breast",
    category: "Bulk Packs",
    price: 52000,
    unit: "per 10kg box",
    image: "📦",
    description: "Ten-kilo box of boneless chicken breast."
  },
  {
    id: "bulk-10kg-chicken-gizzards",
    name: "10kg Chicken Gizzards",
    category: "Bulk Packs",
    price: 5500,
    unit: "per 10kg box",
    image: "📦",
    description: "Ten-kilo box of chicken gizzards."
  },
  {
    id: "bulk-5kg-fresh-turkey",
    name: "5kg Fresh Turkey",
    category: "Turkey",
    price: 25000,
    unit: "per 5kg box",
    image: "🦃",
    description: "Five-kilo box of fresh turkey."
  },
  {
    id: "fresh-turkey",
    name: "Fresh Turkey",
    category: "Turkey",
    price: 4000,
    unit: "per kg",
    image: "🦃",
    description: "Fresh turkey, sold by the kilo."
  },
  {
    id: "turkey",
    name: "Turkey",
    category: "Turkey",
    price: 9000,
    unit: "per each",
    image: "🦃",
    description: "One whole turkey."
  },
  {
    id: "platter-20pc-turkey",
    name: "20-Piece Turkey Platter",
    category: "Platters & Bundles",
    price: 20000,
    unit: "per platter",
    image: "🍽️",
    description: "Platter of 20 pieces of grilled turkey, made for sharing."
  },
  {
    id: "platter-20pc-fish-bbq",
    name: "20-Piece Fish BBQ Platter",
    category: "Platters & Bundles",
    price: 20000,
    unit: "per platter",
    image: "🍽️",
    description: "Platter of 20 pieces of grilled fish BBQ."
  },
  {
    id: "platter-20pc-bbq-chicken-drumstick-thigh",
    name: "20-Piece BBQ Chicken Drumstick/Thigh",
    category: "Platters & Bundles",
    price: 15000,
    unit: "per platter",
    image: "🍽️",
    description: "Platter of 20 pieces of BBQ chicken drumstick and thigh."
  },
  {
    id: "platter-20pc-grilled-corn",
    name: "20-Piece Grilled Corn Platter",
    category: "Platters & Bundles",
    price: 10000,
    unit: "per platter",
    image: "🍽️",
    description: "Platter of 20 pieces of grilled corn."
  },
  {
    id: "platter-fried-sweet-potato",
    name: "Fried Sweet Potato",
    category: "Platters & Bundles",
    price: 8000,
    unit: "per platter",
    image: "🍽️",
    description: "Platter of fried sweet potato, a side for grills."
  },
  {
    id: "bundle-mega-xmas-gift-box",
    name: "Mega Xmas Gift Box",
    category: "Platters & Bundles",
    price: 25000,
    unit: "per box",
    image: "🍽️",
    description: "Mega gift box bundle for the Christmas season."
  },
  {
    id: "marinated-chicken-pack",
    name: "Marinated Chicken Pack",
    category: "Smoked & Grilled",
    price: 3000,
    unit: "per pack",
    image: "🔥",
    description: "Marinated chicken, ready to grill."
  },
  {
    id: "eggs-regular",
    name: "Eggs (Regular)",
    category: "Eggs",
    price: 4200,
    unit: "per crate",
    image: "🥚",
    description: "Regular-size eggs, sold by the crate."
  },
  {
    id: "eggs-xl",
    name: "Eggs - XL",
    category: "Eggs",
    price: 4500,
    unit: "per crate",
    image: "🥚",
    description: "Extra-large eggs, sold by the crate."
  },
  {
    id: "eggs-family-pack",
    name: "Eggs (Family Pack)",
    category: "Eggs",
    price: 2400,
    unit: "per pack",
    image: "🥚",
    description: "Smaller family-size pack of eggs."
  },
  {
    id: "chicken-neck",
    name: "Chicken Neck",
    category: "Fresh Poultry",
    price: 1200,
    unit: "per kg",
    image: "🐔",
    description: "Fresh chicken necks, sold by the kilo."
  },
  {
    id: "chicken-liver",
    name: "Chicken Liver",
    category: "Fresh Poultry",
    price: 950,
    unit: "per kg",
    image: "🐔",
    description: "Fresh chicken liver, sold by the kilo."
  },
  {
    id: "chicken-bone",
    name: "Chicken Bone",
    category: "Fresh Poultry",
    price: 1050,
    unit: "per kg",
    image: "🐔",
    description: "Chicken bones for stock, sold by the kilo."
  }
];

const PRODUCT_CATEGORIES = ["All", ...new Set(PRODUCTS.map(p => p.category))];

function getProductById(id) {
  return PRODUCTS.find(p => p.id === id);
}
