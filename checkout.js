function renderCart() {
  const lines = getCartLines();
  const emptyState = document.getElementById("emptyCart");
  const cartTable = document.getElementById("cartTable");
  const checkoutForm = document.getElementById("checkoutFormSection");

  if (lines.length === 0) {
    emptyState.style.display = "block";
    cartTable.style.display = "none";
    checkoutForm.style.display = "none";
    return;
  }

  emptyState.style.display = "none";
  cartTable.style.display = "table";
  checkoutForm.style.display = "grid";

  const body = document.getElementById("cartBody");
  body.innerHTML = lines.map(line => `
    <tr data-id="${line.product.id}">
      <td class="cart-product">
        ${line.product.photo
          ? `<img class="cart-thumb" src="${line.product.photo}" alt="${line.product.name}" loading="lazy">`
          : `<span class="cart-emoji">${line.product.image}</span>`}
        <div>
          <div class="cart-name">${line.product.name}</div>
          <div class="cart-unit">${line.product.unit} · ${formatNaira(line.product.price)}</div>
        </div>
      </td>
      <td>
        <div class="qty-stepper qty-stepper-sm">
          <button type="button" class="qty-btn" data-action="dec" aria-label="Decrease quantity">−</button>
          <input type="number" class="qty-input" value="${line.qty}" min="1" inputmode="numeric">
          <button type="button" class="qty-btn" data-action="inc" aria-label="Increase quantity">+</button>
        </div>
      </td>
      <td class="cart-subtotal">${formatNaira(line.subtotal)}</td>
      <td><button type="button" class="remove-btn" aria-label="Remove item">✕</button></td>
    </tr>
  `).join("");

  body.querySelectorAll("tr").forEach(row => {
    const id = row.dataset.id;
    const input = row.querySelector(".qty-input");
    row.querySelector('[data-action="dec"]').addEventListener("click", () => {
      const next = Math.max(1, (parseInt(input.value, 10) || 1) - 1);
      input.value = next;
      updateCartQty(id, next);
      renderCart();
    });
    row.querySelector('[data-action="inc"]').addEventListener("click", () => {
      const next = (parseInt(input.value, 10) || 1) + 1;
      input.value = next;
      updateCartQty(id, next);
      renderCart();
    });
    input.addEventListener("change", () => {
      updateCartQty(id, parseInt(input.value, 10) || 1);
      renderCart();
    });
    row.querySelector(".remove-btn").addEventListener("click", () => {
      removeFromCart(id);
      renderCart();
    });
  });

  document.getElementById("cartTotal").textContent = formatNaira(getCartTotal());
}

function showPaystackWarningIfNeeded() {
  const warning = document.getElementById("paystackWarning");
  const payBtn = document.getElementById("payBtn");
  if (!isPaystackConfigured()) {
    warning.style.display = "block";
    payBtn.disabled = true;
    payBtn.textContent = "Payments not yet configured";
  }
}

function showConfirmation(reference) {
  const total = getCartTotal();
  document.getElementById("checkoutFormSection").style.display = "none";
  document.getElementById("cartTable").style.display = "none";
  const confirmation = document.getElementById("orderConfirmation");
  confirmation.style.display = "block";
  document.getElementById("confirmationRef").textContent = reference;
  document.getElementById("confirmationTotal").textContent = formatNaira(total);
}

document.addEventListener("DOMContentLoaded", () => {
  renderCart();
  showPaystackWarningIfNeeded();

  const form = document.getElementById("checkoutForm");
  form.addEventListener("submit", (e) => {
    e.preventDefault();

    if (!isPaystackConfigured()) {
      alert("Online payment isn't set up yet. Please contact Chow Republic directly to complete this order.");
      return;
    }

    const lines = getCartLines();
    if (lines.length === 0) return;

    const data = new FormData(form);
    const name = (data.get("name") || "").toString().trim();
    const phone = (data.get("phone") || "").toString().trim();
    const email = (data.get("email") || "").toString().trim();
    const address = (data.get("address") || "").toString().trim();
    const business = (data.get("business") || "").toString().trim();
    const notes = (data.get("notes") || "").toString().trim();

    const total = getCartTotal();
    const itemsSummary = lines
      .map(l => `${l.qty} x ${l.product.name} (${formatNaira(l.subtotal)})`)
      .join("; ");

    const handler = PaystackPop.setup({
      key: PAYSTACK_PUBLIC_KEY,
      email: email,
      amount: Math.round(total * 100), // Paystack expects kobo
      currency: "NGN",
      ref: "CR-" + Date.now(),
      metadata: {
        custom_fields: [
          { display_name: "Customer Name", variable_name: "customer_name", value: name },
          { display_name: "Phone", variable_name: "phone", value: phone },
          { display_name: "Delivery Address", variable_name: "address", value: address },
          { display_name: "Business Name", variable_name: "business", value: business || "N/A" },
          { display_name: "Notes", variable_name: "notes", value: notes || "N/A" },
          { display_name: "Order Items", variable_name: "order_items", value: itemsSummary }
        ]
      },
      callback: function (response) {
        clearCart();
        showConfirmation(response.reference);
      },
      onClose: function () {
        // Customer closed the payment popup without paying — cart is left intact.
      }
    });
    handler.openIframe();
  });
});
