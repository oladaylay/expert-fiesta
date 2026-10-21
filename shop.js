function renderCategoryTabs() {
  const wrap = document.getElementById("categoryTabs");
  wrap.innerHTML = PRODUCT_CATEGORIES.map((cat, i) =>
    `<button class="tab${i === 0 ? " active" : ""}" data-category="${cat}">${cat}</button>`
  ).join("");

  wrap.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
      wrap.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      renderProducts(tab.dataset.category);
    });
  });
}

function productImageHtml(product) {
  if (!product.photo) return product.image;
  const position = product.photoPosition || "center";
  return `<img src="${product.photo}" alt="${product.name}" loading="lazy" style="object-position: ${position}">`;
}

function productCard(product) {
  return `
    <div class="product-card" data-id="${product.id}">
      <div class="product-image">${productImageHtml(product)}</div>
      <div class="product-body">
        <span class="product-category">${product.category}</span>
        <h3>${product.name}</h3>
        <p class="product-desc">${product.description}</p>
        <div class="product-price">
          <span class="price">${formatNaira(product.price)}</span>
          <span class="unit">${product.unit}</span>
        </div>
        <div class="product-actions">
          <div class="qty-stepper">
            <button type="button" class="qty-btn" data-action="dec" aria-label="Decrease quantity">−</button>
            <input type="number" class="qty-input" value="1" min="1" inputmode="numeric">
            <button type="button" class="qty-btn" data-action="inc" aria-label="Increase quantity">+</button>
          </div>
          <button type="button" class="btn btn-primary add-btn">Add to Cart</button>
        </div>
      </div>
    </div>`;
}

function renderProducts(category) {
  const grid = document.getElementById("productGrid");
  const list = category && category !== "All"
    ? PRODUCTS.filter(p => p.category === category)
    : PRODUCTS;
  grid.innerHTML = list.map(productCard).join("");

  grid.querySelectorAll(".product-card").forEach(card => {
    const id = card.dataset.id;
    const input = card.querySelector(".qty-input");

    card.querySelector('[data-action="dec"]').addEventListener("click", () => {
      input.value = Math.max(1, (parseInt(input.value, 10) || 1) - 1);
    });
    card.querySelector('[data-action="inc"]').addEventListener("click", () => {
      input.value = (parseInt(input.value, 10) || 1) + 1;
    });
    card.querySelector(".add-btn").addEventListener("click", (e) => {
      const qty = Math.max(1, parseInt(input.value, 10) || 1);
      addToCart(id, qty);
      const btn = e.currentTarget;
      const original = btn.textContent;
      btn.textContent = "Added ✓";
      btn.disabled = true;
      setTimeout(() => {
        btn.textContent = original;
        btn.disabled = false;
      }, 900);
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  renderCategoryTabs();
  renderProducts("All");
});
