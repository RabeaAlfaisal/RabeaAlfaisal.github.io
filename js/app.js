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
import { imageForType } from "./type-images.js";
import { KNOWN_BRANDS } from "./brands.js";

(function () {
  "use strict";

  const CART_STORAGE_KEY = "ac_store_cart";
  const BRANDS_COLLECTION = "brands";

  const firebaseApp = initializeApp(firebaseConfig);
  const db = getFirestore(firebaseApp);

  let brandLogoByName = {};

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
  const filterBrand = document.getElementById("filterBrand");
  const filterType = document.getElementById("filterType");
  const filterMode = document.getElementById("filterMode");
  const filterCompressor = document.getElementById("filterCompressor");
  const filterPowerSaving = document.getElementById("filterPowerSaving");
  const sortByPrice = document.getElementById("sortByPrice");
  const sortByCapacity = document.getElementById("sortByCapacity");
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

    await loadBrandLogos();
    populateBrandFilter();
    populateTypeFilter();
    bindEvents();
    renderCatalog();
    renderCart();
  }

  async function loadBrandLogos() {
    brandLogoByName = {};
    KNOWN_BRANDS.forEach((b) => {
      brandLogoByName[b.name] = b.logo;
    });
    try {
      const snap = await getDocs(collection(db, BRANDS_COLLECTION));
      snap.docs.forEach((d) => {
        const data = d.data();
        if (data.name && data.logo && !brandLogoByName[data.name]) {
          brandLogoByName[data.name] = data.logo;
        }
      });
    } catch (err) {
      // القراءة العامة يجب أن تعمل حتى لو فشلت الكتابة؛ نكتفي بشعارات الماركات المعروفة محلياً عند الفشل
      console.error("Failed to load brand logos from Firestore", err);
    }
  }

  function populateBrandFilter() {
    const brands = Array.from(new Set(allProducts.map((p) => p.brand))).sort();
    brands.forEach((b) => {
      const opt = document.createElement("option");
      opt.value = b;
      opt.textContent = b;
      filterBrand.appendChild(opt);
    });
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
    [filterBrand, filterType, filterMode, filterCompressor, sortByPrice, sortByCapacity].forEach((el) =>
      el.addEventListener("change", renderCatalog)
    );
    filterPowerSaving.addEventListener("click", () => {
      const isOn = filterPowerSaving.getAttribute("aria-checked") === "true";
      filterPowerSaving.setAttribute("aria-checked", String(!isOn));
      renderCatalog();
    });
    resetFiltersBtn.addEventListener("click", () => {
      filterBrand.value = "";
      filterType.value = "";
      filterMode.value = "";
      filterCompressor.value = "";
      filterPowerSaving.setAttribute("aria-checked", "false");
      sortByPrice.value = "";
      sortByCapacity.value = "";
      renderCatalog();
    });

    cartToggleBtn.addEventListener("click", openCart);
    cartCloseBtn.addEventListener("click", closeCart);
    cartOverlay.addEventListener("click", closeCart);
    checkoutBtn.addEventListener("click", handleCheckout);
  }

  function getFilteredProducts() {
    let list = allProducts.slice();

    if (filterBrand.value) list = list.filter((p) => p.brand === filterBrand.value);
    if (filterType.value) list = list.filter((p) => p.type === filterType.value);
    if (filterMode.value) list = list.filter((p) => p.mode === filterMode.value);
    if (filterCompressor.value) list = list.filter((p) => p.compressor_type === filterCompressor.value);
    if (filterPowerSaving.getAttribute("aria-checked") === "true") list = list.filter((p) => p.power_saving === true);

    // ترتيب السعة أولاً كترتيب ثانوي، ثم السعر فوق (الترتيب مستقر فيبقى ترتيب السعة كفاصل عند تساوي السعر)
    if (sortByCapacity.value === "asc") list.sort((a, b) => (a.capacity_ton ?? 0) - (b.capacity_ton ?? 0));
    if (sortByCapacity.value === "desc") list.sort((a, b) => (b.capacity_ton ?? 0) - (a.capacity_ton ?? 0));
    if (sortByPrice.value === "asc") list.sort((a, b) => a.price - b.price);
    if (sortByPrice.value === "desc") list.sort((a, b) => b.price - a.price);

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
        <img src="${product.image || imageForType(product.type)}" alt="${escapeHtml(product.model)}"
             onerror="this.src='${imageForType(product.type)}'" />
        ${outOfStock ? '<span class="badge-oos">غير متوفر حالياً</span>' : ""}
      </div>
      <div class="product-body">
        <div class="product-brand-row">
          ${
            brandLogoByName[product.brand]
              ? `<img class="product-brand-logo" src="${brandLogoByName[product.brand]}" alt="شعار ${escapeHtml(product.brand)}" />`
              : ""
          }
          <span class="product-brand">${escapeHtml(product.brand)}</span>
        </div>
        <h2 class="product-name">${escapeHtml(product.model)}</h2>
        <div class="badge-row">
          <span class="badge badge-type">${escapeHtml(product.type)}</span>
          <span class="badge">${formatCapacity(product)}</span>
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
        ${
          product.installation_fee > 0
            ? `
        <div class="installation-toggle" role="radiogroup" aria-label="خيار التركيب">
          <label>
            <input type="radio" name="installation-${product.id}" value="no" checked />
            بدون تركيب
          </label>
          <label>
            <input type="radio" name="installation-${product.id}" value="yes" />
            مع تركيب (+${formatPrice(product.installation_fee)} ر.س)
          </label>
        </div>`
            : ""
        }
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
        const installationChoice = card.querySelector(`input[name="installation-${product.id}"]:checked`);
        const withInstallation = installationChoice ? installationChoice.value === "yes" : false;
        addToCart(product, qty, withInstallation);
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

  function addToCart(product, qty, withInstallation) {
    const installationFee = withInstallation ? Number(product.installation_fee) || 0 : 0;
    const lineId = `${product.id}::${withInstallation ? "inst" : "noinst"}`;
    const existing = cart.find((item) => item.lineId === lineId);
    if (existing) {
      existing.qty += qty;
    } else {
      cart.push({
        lineId,
        id: product.id,
        model: product.model,
        price: product.price,
        installation_fee: installationFee,
        with_installation: !!withInstallation,
        image: product.image,
        type: product.type,
        brand: product.brand,
        capacity_ton: product.capacity_ton,
        capacity_btu: product.capacity_btu,
        power_saving: product.power_saving,
        mode: product.mode,
        qty: qty,
      });
    }
    saveCart();
    renderCart();
    openCart();
  }

  function updateQty(lineId, qty) {
    const item = cart.find((i) => i.lineId === lineId);
    if (!item) return;
    if (qty <= 0) {
      cart = cart.filter((i) => i.lineId !== lineId);
    } else {
      item.qty = qty;
    }
    saveCart();
    renderCart();
  }

  function removeFromCart(lineId) {
    cart = cart.filter((i) => i.lineId !== lineId);
    saveCart();
    renderCart();
  }

  function cartTotal() {
    return cart.reduce((sum, item) => sum + (item.price + (item.installation_fee || 0)) * item.qty, 0);
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
      const unitPrice = item.price + (item.installation_fee || 0);
      row.innerHTML = `
        <img src="${item.image || imageForType(item.type)}" alt="${escapeHtml(item.model)}"
             onerror="this.src='${imageForType(item.type)}'" />
        <div class="cart-item-info">
          <p class="cart-item-name">${escapeHtml(item.model)}</p>
          ${item.with_installation ? '<p class="cart-item-installation">شامل تركيب</p>' : ""}
          <p class="cart-item-price">${formatPrice(unitPrice)} ر.س ×
            <input type="number" min="0" value="${item.qty}" class="cart-qty-input" style="width:44px" aria-label="الكمية" />
          </p>
          <button type="button" class="cart-item-remove">إزالة</button>
        </div>
        <div class="cart-item-subtotal">${formatPrice(unitPrice * item.qty)} ر.س</div>
      `;

      row.querySelector(".cart-qty-input").addEventListener("change", (e) => {
        const val = Math.max(0, parseInt(e.target.value || "0", 10) || 0);
        updateQty(item.lineId, val);
      });
      row.querySelector(".cart-item-remove").addEventListener("click", () => removeFromCart(item.lineId));

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
      const parts = [item.type, item.brand, `${item.capacity_ton} طن`];
      if (item.power_saving) parts.push("موفر للكهرباء");
      const modeShort = MODE_SHORT[item.mode] || item.mode;
      parts.push(modeShort);
      if (item.with_installation) parts.push("مع تركيب");
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

  function formatCapacity(product) {
    const parts = [];
    if (product.capacity_ton != null) parts.push(`${product.capacity_ton} طن`);
    if (product.capacity_btu != null) parts.push(`${formatPrice(product.capacity_btu)} BTU`);
    return parts.join(" / ");
  }

  function formatPrice(value) {
    return Number(value).toLocaleString("ar-SA");
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = String(str == null ? "" : str);
    return div.innerHTML;
  }
})();
