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
  }
];

const PRODUCT_CATEGORIES = ["All", ...new Set(PRODUCTS.map(p => p.category))];

function getProductById(id) {
  return PRODUCTS.find(p => p.id === id);
}
