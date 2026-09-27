// === Product catalog ===
// Placeholder products with illustrative Lagos-market pricing. Replace with real names,
// prices (in Naira, whole numbers), units and descriptions when ready. `image` is an emoji
// placeholder — swap for a real photo path (e.g. "images/chicken-breast.jpg") any time.
const PRODUCTS = [
  {
    id: "poultry-whole-dressed",
    name: "Whole Dressed Chicken",
    category: "Poultry",
    price: 3500,
    unit: "per kg",
    image: "🐔",
    description: "Cleaned, dressed whole chicken, ready for the pot."
  },
  {
    id: "poultry-breast-fillet",
    name: "Chicken Breast Fillet",
    category: "Poultry",
    price: 4200,
    unit: "per kg",
    image: "🐔",
    description: "Boneless, skinless breast fillet, trimmed and portioned."
  },
  {
    id: "poultry-wings",
    name: "Chicken Wings",
    category: "Poultry",
    price: 3000,
    unit: "per kg pack",
    image: "🐔",
    description: "Party-ready wings, cleaned and packed."
  },
  {
    id: "beef-boneless-cuts",
    name: "Boneless Beef Cuts",
    category: "Beef",
    price: 6500,
    unit: "per kg",
    image: "🥩",
    description: "Trimmed boneless beef, cut for stew or grilling."
  },
  {
    id: "beef-minced",
    name: "Minced Beef",
    category: "Beef",
    price: 3200,
    unit: "per 500g pack",
    image: "🥩",
    description: "Fresh ground beef, packed in convenient 500g portions."
  },
  {
    id: "fish-titus",
    name: "Titus Fish",
    category: "Fish",
    price: 4000,
    unit: "per kg",
    image: "🐟",
    description: "Cleaned Titus fish, whole and ready to cook."
  },
  {
    id: "fish-catfish-fillet",
    name: "Catfish Fillet",
    category: "Fish",
    price: 4800,
    unit: "per kg",
    image: "🐟",
    description: "Deboned catfish fillet, cleaned and portioned."
  },
  {
    id: "bulk-mixed-protein-carton",
    name: "Mixed Protein Carton",
    category: "Bulk Packs",
    price: 55000,
    unit: "per 10kg carton",
    image: "📦",
    description: "A mix of poultry, beef and fish — built for restaurants and caterers."
  },
  {
    id: "bulk-chicken-carton",
    name: "Chicken Carton",
    category: "Bulk Packs",
    price: 85000,
    unit: "per 25kg carton",
    image: "📦",
    description: "Bulk dressed chicken for institutional kitchens and resellers."
  }
];

const PRODUCT_CATEGORIES = ["All", ...new Set(PRODUCTS.map(p => p.category))];

function getProductById(id) {
  return PRODUCTS.find(p => p.id === id);
}
