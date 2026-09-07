// متجر المكيفات — منطق الواجهة (الكتالوج + السلة + الطلب عبر واتساب)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { firebaseConfig, PRODUCTS_COLLECTION } from "./firebase-config.js";

(function () {
  "use strict";

  const CART_STORAGE_KEY = "ac_store_cart";

  const firebaseApp = initializeApp(firebaseConfig);
  const db = getFirestore(firebaseApp);

  const MODE_SHORT = {
    "بارد فقط": "بارد",
    "حار فقط": "حار",
    "حار وبارد": "حار بارد",
  };

  let allProducts = [];
  let cart = loadCart();

  const catalogGrid = document.getElementById("catalogGrid");
  const emptyState = document.getElementById("emptyState");
  const resultsCount = document.getElementById("resultsCount");
  const filterType = document.getElementById("filterType");
  const filterMode = document.getElementById("filterMode");
  const filterCompressor = document.getElementById("filterCompressor");
  const filterPowerSaving = document.getElementById("filterPowerSaving");
  const sortBy = document.getElementById("sortBy");
  const resetFiltersBtn = document.getElementById("resetFiltersBtn");

  const cartToggleBtn = document.getElementById("cartToggleBtn");
  const cartCloseBtn = document.getElementById("cartCloseBtn");
  const cartOverlay = document.getElementById("cartOverlay");
  const cartDrawer = document.getElementById("cartDrawer");
  const cartItemsEl = document.getElementById("cartItems");
  const cartTotalEl = document.getElementById("cartTotal");
  const cartBadge = document.getElementById("cartBadge");
  const checkoutBtn = document.getElementById("checkoutBtn");
  const cartConfirmNote = document.getElementById("cartConfirmNote");

  init();

  async function init() {
    try {
      // نطلب فقط المنتجات غير المؤرشفة من Firestore حتى لا تصل بيانات الأرشيف لجهاز العميل أصلاً
      const q = query(collection(db, PRODUCTS_COLLECTION), where("archived", "==", false));
      const snap = await getDocs(q);
      allProducts = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
    } catch (err) {
      catalogGrid.innerHTML = "";
      emptyState.hidden = false;
      emptyState.textContent = "تعذّر تحميل المنتجات حالياً. حاول تحديث الصفحة.";
      console.error("Failed to load products from Firestore", err);
      return;
    }

    populateTypeFilter();
    bindEvents();
    renderCatalog();
    renderCart();
  }

  function populateTypeFilter() {
    const types = Array.from(new Set(allProducts.map((p) => p.type))).sort();
    types.forEach((t) => {
      const opt = document.createElement("option");
      opt.value = t;
      opt.textContent = t;
      filterType.appendChild(opt);
    });
  }

  function bindEvents() {
    [filterType, filterMode, filterCompressor, filterPowerSaving, sortBy].forEach((el) =>
      el.addEventListener("change", renderCatalog)
    );
    resetFiltersBtn.addEventListener("click", () => {
      filterType.value = "";
      filterMode.value = "";
      filterCompressor.value = "";
      filterPowerSaving.value = "";
      sortBy.value = "default";
      renderCatalog();
    });

    cartToggleBtn.addEventListener("click", openCart);
    cartCloseBtn.addEventListener("click", closeCart);
    cartOverlay.addEventListener("click", closeCart);
    checkoutBtn.addEventListener("click", handleCheckout);
  }

  function getFilteredProducts() {
    let list = allProducts.slice();

    if (filterType.value) list = list.filter((p) => p.type === filterType.value);
    if (filterMode.value) list = list.filter((p) => p.mode === filterMode.value);
    if (filterCompressor.value) list = list.filter((p) => p.compressor_type === filterCompressor.value);
    if (filterPowerSaving.value === "yes") list = list.filter((p) => p.power_saving === true);
    if (filterPowerSaving.value === "no") list = list.filter((p) => p.power_saving === false);

    if (sortBy.value === "price-asc") list.sort((a, b) => a.price - b.price);
    if (sortBy.value === "price-desc") list.sort((a, b) => b.price - a.price);

    return list;
  }

  function renderCatalog() {
    const list = getFilteredProducts();
    catalogGrid.innerHTML = "";

    if (list.length === 0) {
      emptyState.hidden = false;
    } else {
      emptyState.hidden = true;
      list.forEach((p) => catalogGrid.appendChild(buildProductCard(p)));
    }

    resultsCount.textContent = `عدد المنتجات المعروضة: ${list.length}`;
  }

  function buildProductCard(product) {
    const card = document.createElement("article");
    card.className = "product-card";

    const outOfStock = product.in_stock === false;

    const modeShort = MODE_SHORT[product.mode] || product.mode;

    card.innerHTML = `
      <div class="product-image-wrap">
        <img src="${product.image || "assets/images/placeholder.svg"}" alt="${escapeHtml(product.name)}"
             onerror="this.src='assets/images/placeholder.svg'" />
        ${outOfStock ? '<span class="badge-oos">غير متوفر حالياً</span>' : ""}
      </div>
      <div class="product-body">
        <span class="product-brand">${escapeHtml(product.brand)}</span>
        <h2 class="product-name">${escapeHtml(product.name)}</h2>
        <div class="badge-row">
          <span class="badge badge-type">${escapeHtml(product.type)}</span>
          <span class="badge">${escapeHtml(product.capacity)}</span>
          <span class="badge badge-mode">${escapeHtml(modeShort)}</span>
          <span class="badge ${product.compressor_type === "انفرتر" ? "badge-inverter" : ""}">
            ${product.compressor_type === "انفرتر" ? "⚡ انفرتر" : "كمبروسر عادي"}
          </span>
          ${
            product.power_saving
              ? '<span class="badge badge-power-saving">🔋 موفر للكهرباء</span>'
              : '<span class="badge">غير موفر للكهرباء</span>'
          }
        </div>
        <p class="product-price">${formatPrice(product.price)} <small>ر.س</small></p>
        <div class="product-actions">
          <div class="qty-control">
            <button type="button" class="qty-decrease" aria-label="تقليل الكمية">−</button>
            <input type="number" min="1" value="1" class="qty-input" aria-label="الكمية" />
            <button type="button" class="qty-increase" aria-label="زيادة الكمية">+</button>
          </div>
          <button type="button" class="add-to-cart-btn" ${outOfStock ? "disabled" : ""}>
            ${outOfStock ? "غير متوفر" : "أضف إلى السلة"}
          </button>
        </div>
      </div>
    `;

    const qtyInput = card.querySelector(".qty-input");
    card.querySelector(".qty-decrease").addEventListener("click", () => {
      qtyInput.value = Math.max(1, parseInt(qtyInput.value || "1", 10) - 1);
    });
    card.querySelector(".qty-increase").addEventListener("click", () => {
      qtyInput.value = Math.max(1, parseInt(qtyInput.value || "1", 10) + 1);
    });
    qtyInput.addEventListener("change", () => {
      const val = Math.max(1, parseInt(qtyInput.value || "1", 10) || 1);
      qtyInput.value = val;
    });

    if (!outOfStock) {
      card.querySelector(".add-to-cart-btn").addEventListener("click", () => {
        const qty = Math.max(1, parseInt(qtyInput.value || "1", 10) || 1);
        addToCart(product, qty);
        qtyInput.value = 1;
      });
    }

    return card;
  }

  // ---------- Cart ----------

  function loadCart() {
    try {
      const raw = sessionStorage.getItem(CART_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (err) {
      console.error("Failed to read cart from sessionStorage", err);
      return [];
    }
  }

  function saveCart() {
    try {
      sessionStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch (err) {
      console.error("Failed to save cart to sessionStorage", err);
    }
  }

  function addToCart(product, qty) {
    const existing = cart.find((item) => item.id === product.id);
    if (existing) {
      existing.qty += qty;
    } else {
      cart.push({
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.image,
        type: product.type,
        brand: product.brand,
        capacity: product.capacity,
        power_saving: product.power_saving,
        mode: product.mode,
        qty: qty,
      });
    }
    saveCart();
    renderCart();
    openCart();
  }

  function updateQty(id, qty) {
    const item = cart.find((i) => i.id === id);
    if (!item) return;
    if (qty <= 0) {
      cart = cart.filter((i) => i.id !== id);
    } else {
      item.qty = qty;
    }
    saveCart();
    renderCart();
  }

  function removeFromCart(id) {
    cart = cart.filter((i) => i.id !== id);
    saveCart();
    renderCart();
  }

  function cartTotal() {
    return cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  }

  function cartCount() {
    return cart.reduce((sum, item) => sum + item.qty, 0);
  }

  function renderCart() {
    cartBadge.textContent = cartCount();
    cartTotalEl.textContent = `${formatPrice(cartTotal())} ر.س`;
    checkoutBtn.disabled = cart.length === 0;
    cartConfirmNote.hidden = true;

    if (cart.length === 0) {
      cartItemsEl.innerHTML = '<p class="cart-empty-msg">سلتك فارغة حالياً. أضف منتجات من الكتالوج.</p>';
      return;
    }

    cartItemsEl.innerHTML = "";
    cart.forEach((item) => {
      const row = document.createElement("div");
      row.className = "cart-item";
      row.innerHTML = `
        <img src="${item.image || "assets/images/placeholder.svg"}" alt="${escapeHtml(item.name)}"
             onerror="this.src='assets/images/placeholder.svg'" />
        <div class="cart-item-info">
          <p class="cart-item-name">${escapeHtml(item.name)}</p>
          <p class="cart-item-price">${formatPrice(item.price)} ر.س ×
            <input type="number" min="0" value="${item.qty}" class="cart-qty-input" style="width:44px" aria-label="الكمية" />
          </p>
          <button type="button" class="cart-item-remove">إزالة</button>
        </div>
        <div class="cart-item-subtotal">${formatPrice(item.price * item.qty)} ر.س</div>
      `;

      row.querySelector(".cart-qty-input").addEventListener("change", (e) => {
        const val = Math.max(0, parseInt(e.target.value || "0", 10) || 0);
        updateQty(item.id, val);
      });
      row.querySelector(".cart-item-remove").addEventListener("click", () => removeFromCart(item.id));

      cartItemsEl.appendChild(row);
    });
  }

  function openCart() {
    cartDrawer.classList.add("open");
    cartOverlay.classList.add("open");
  }

  function closeCart() {
    cartDrawer.classList.remove("open");
    cartOverlay.classList.remove("open");
  }

  // ---------- Checkout via WhatsApp ----------

  function buildOrderMessage() {
    const lines = cart.map((item) => {
      const unit = item.qty === 1 ? "مكيف" : "مكيفات";
      const parts = [item.type, item.brand, item.capacity];
      if (item.power_saving) parts.push("موفر للكهرباء");
      const modeShort = MODE_SHORT[item.mode] || item.mode;
      parts.push(modeShort);
      return `${item.qty} ${unit} ${parts.join(" ")}`;
    });

    return `السلام عليكم ورحمه الله وبركاته\n\nاود الاستفسار عن\n${lines.join("\n")}`;
  }

  function handleCheckout() {
    if (cart.length === 0) return;
    const message = buildOrderMessage();
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    cartConfirmNote.hidden = false;
  }

  // ---------- Helpers ----------

  function formatPrice(value) {
    return Number(value).toLocaleString("ar-SA");
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = String(str == null ? "" : str);
    return div.innerHTML;
  }
})();
