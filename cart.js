// === Cart storage (per-browser, via localStorage) ===
const CART_KEY = "chowrepublic_cart";

function getCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveCart(cart) {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  } catch (e) {
    // localStorage unavailable (private mode, blocked storage) — cart just won't persist.
  }
  updateCartBadges();
}

function addToCart(productId, qty) {
  qty = Math.max(1, Math.floor(qty) || 1);
  const cart = getCart();
  const existing = cart.find(item => item.id === productId);
  if (existing) {
    existing.qty += qty;
  } else {
    cart.push({ id: productId, qty });
  }
  saveCart(cart);
}

function updateCartQty(productId, qty) {
  qty = Math.floor(qty) || 0;
  let cart = getCart();
  if (qty <= 0) {
    cart = cart.filter(item => item.id !== productId);
  } else {
    const existing = cart.find(item => item.id === productId);
    if (existing) existing.qty = qty;
  }
  saveCart(cart);
}

function removeFromCart(productId) {
  const cart = getCart().filter(item => item.id !== productId);
  saveCart(cart);
}

function clearCart() {
  saveCart([]);
}

function getCartLines() {
  return getCart()
    .map(item => {
      const product = getProductById(item.id);
      if (!product) return null;
      return { product, qty: item.qty, subtotal: product.price * item.qty };
    })
    .filter(Boolean);
}

function getCartCount() {
  return getCart().reduce((sum, item) => sum + item.qty, 0);
}

function getCartTotal() {
  return getCartLines().reduce((sum, line) => sum + line.subtotal, 0);
}

function updateCartBadges() {
  const count = getCartCount();
  document.querySelectorAll("[data-cart-count]").forEach(el => {
    el.textContent = String(count);
    el.classList.toggle("badge-hidden", count === 0);
  });
}

document.addEventListener("DOMContentLoaded", updateCartBadges);
