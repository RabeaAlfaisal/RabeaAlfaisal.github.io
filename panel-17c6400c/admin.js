// لوحة إدارة المنتجات — تتعامل مباشرة مع Firestore (بدون خادم خلفي)
// ملاحظة: لا نستخدم Firebase Storage عمداً لأنه يتطلب خطة Blaze المدفوعة على هذا المشروع.
// صورة المنتج وشعار الماركة يُكتبان كمسار/رابط نصي بدلاً من رفع ملف.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { firebaseConfig, PRODUCTS_COLLECTION } from "../js/firebase-config.js";
import { KNOWN_BRANDS, makeBrandLogo } from "../js/brands.js";

const BRANDS_COLLECTION = "brands";
const BTU_PER_TON = 12000;

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

let products = [];
let allBrands = [];
let editingId = null;

// ---------------- DOM refs ----------------
const statusCard = document.getElementById("statusCard");
const productsTableBody = document.getElementById("productsTableBody");

const productForm = document.getElementById("productForm");
const formTitle = document.getElementById("formTitle");
const cancelEditBtn = document.getElementById("cancelEditBtn");

const brandSelect = document.getElementById("f_brand");
const brandLogoPreview = document.getElementById("brandLogoPreview");
const addBrandToggleBtn = document.getElementById("addBrandToggleBtn");
const newBrandBox = document.getElementById("newBrandBox");
const newBrandName = document.getElementById("newBrandName");
const saveBrandBtn = document.getElementById("saveBrandBtn");
const cancelBrandBtn = document.getElementById("cancelBrandBtn");

const imagePreview = document.getElementById("imagePreview");

const fields = {
  id: document.getElementById("f_id"),
  name: document.getElementById("f_name"),
  brand: brandSelect,
  price: document.getElementById("f_price"),
  image: document.getElementById("f_image"),
  type: document.getElementById("f_type"),
  capacity_ton: document.getElementById("f_capacity_ton"),
  capacity_btu: document.getElementById("f_capacity_btu"),
  mode: document.getElementById("f_mode"),
  compressor_type: document.getElementById("f_compressor_type"),
  description: document.getElementById("f_description"),
  power_saving: document.getElementById("f_power_saving"),
  in_stock: document.getElementById("f_in_stock"),
};

init();

async function init() {
  productForm.addEventListener("submit", handleFormSubmit);
  cancelEditBtn.addEventListener("click", resetForm);
  brandSelect.addEventListener("change", updateBrandLogoPreview);
  addBrandToggleBtn.addEventListener("click", () => {
    newBrandBox.hidden = false;
    newBrandName.value = "";
  });
  cancelBrandBtn.addEventListener("click", () => {
    newBrandBox.hidden = true;
  });
  saveBrandBtn.addEventListener("click", handleSaveBrand);
  fields.image.addEventListener("input", () => {
    const url = fields.image.value.trim();
    imagePreview.src = url || "assets/images/placeholder.svg";
    imagePreview.hidden = !url;
  });

  fields.capacity_ton.addEventListener("input", () => {
    const ton = parseFloat(fields.capacity_ton.value);
    fields.capacity_btu.value = isNaN(ton) ? "" : Math.round(ton * BTU_PER_TON);
  });
  fields.capacity_btu.addEventListener("input", () => {
    const btu = parseFloat(fields.capacity_btu.value);
    fields.capacity_ton.value = isNaN(btu) ? "" : Math.round((btu / BTU_PER_TON) * 2) / 2;
  });

  await loadBrands();
  await loadProducts();
}

function showStatus(message, type) {
  statusCard.hidden = false;
  statusCard.innerHTML = `<div class="status-box status-${type}">${escapeHtml(message)}</div>`;
}

function describeFirebaseError(err, action) {
  const code = err && err.code ? err.code : "";
  if (code === "permission-denied") {
    return `تم رفض ${action}: قواعد الأمان (Security Rules) لا تسمح بهذه العملية. راجع قسم الأمان في README.`;
  }
  if (code === "unavailable" || err instanceof TypeError) {
    return `فشل الاتصال بالشبكة أثناء ${action}. تحقق من اتصالك بالإنترنت وحاول مجدداً.`;
  }
  return `خطأ أثناء ${action}: ${err && err.message ? err.message : "خطأ غير معروف"}`;
}

// ---------------- Brands ----------------

async function loadBrands() {
  try {
    const snap = await getDocs(collection(db, BRANDS_COLLECTION));
    const customBrands = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const knownNames = new Set(KNOWN_BRANDS.map((b) => b.name));
    allBrands = [...KNOWN_BRANDS, ...customBrands.filter((b) => !knownNames.has(b.name))];
    populateBrandSelect();
  } catch (err) {
    // القراءة العامة يجب أن تعمل حتى بدون كتابة؛ إن فشلت نكتفي بالماركات المعروفة محلياً
    allBrands = KNOWN_BRANDS.slice();
    populateBrandSelect();
    console.error("Failed to load brands from Firestore", err);
  }
}

function populateBrandSelect(selectedName) {
  const previousValue = selectedName || brandSelect.value;
  brandSelect.innerHTML = "";
  allBrands.forEach((b) => {
    const opt = document.createElement("option");
    opt.value = b.name;
    opt.textContent = b.name;
    brandSelect.appendChild(opt);
  });
  if (previousValue && allBrands.some((b) => b.name === previousValue)) {
    brandSelect.value = previousValue;
  }
  updateBrandLogoPreview();
}

function ensureBrandOptionExists(name) {
  if (!name) return;
  if (!allBrands.some((b) => b.name === name)) {
    allBrands.push({ name, logo: makeBrandLogo(name.slice(0, 2).toUpperCase(), "#607d8b") });
    populateBrandSelect(name);
  }
}

function updateBrandLogoPreview() {
  const brand = allBrands.find((b) => b.name === brandSelect.value);
  brandLogoPreview.innerHTML = brand && brand.logo ? `<img src="${brand.logo}" alt="شعار ${escapeHtml(brand.name)}" />` : "";
}

async function handleSaveBrand() {
  const name = newBrandName.value.trim();
  if (!name) {
    showStatus("الرجاء كتابة اسم الماركة الجديدة.", "error");
    return;
  }

  showStatus("جارٍ حفظ الماركة...", "info");
  try {
    const logo = makeBrandLogo(name.slice(0, 2).toUpperCase(), "#607d8b");
    await addDoc(collection(db, BRANDS_COLLECTION), { name, logo });
    showStatus(`تم حفظ الماركة: ${name}`, "ok");
    newBrandBox.hidden = true;
    await loadBrands();
    brandSelect.value = name;
    updateBrandLogoPreview();
  } catch (err) {
    showStatus(describeFirebaseError(err, "حفظ الماركة"), "error");
    console.error(err);
  }
}

// ---------------- Firestore: products ----------------

async function loadProducts() {
  showStatus("جارٍ تحميل المنتجات من Firestore...", "info");
  try {
    const snap = await getDocs(collection(db, PRODUCTS_COLLECTION));
    products = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
    statusCard.hidden = true;
    renderTable();
  } catch (err) {
    showStatus(describeFirebaseError(err, "تحميل المنتجات"), "error");
    console.error(err);
  }
}

async function saveProduct(product, commitMessage) {
  showStatus("جارٍ الحفظ على Firestore...", "info");
  try {
    await setDoc(doc(db, PRODUCTS_COLLECTION, product.id), product);
    showStatus(`تم الحفظ: ${commitMessage}`, "ok");
    return true;
  } catch (err) {
    showStatus(describeFirebaseError(err, "الحفظ"), "error");
    console.error(err);
    return false;
  }
}

async function patchProduct(id, partial, commitMessage) {
  showStatus("جارٍ التحديث على Firestore...", "info");
  try {
    await updateDoc(doc(db, PRODUCTS_COLLECTION, id), partial);
    showStatus(`تم التحديث: ${commitMessage}`, "ok");
    return true;
  } catch (err) {
    showStatus(describeFirebaseError(err, "التحديث"), "error");
    console.error(err);
    return false;
  }
}

async function removeProduct(id, commitMessage) {
  showStatus("جارٍ الحذف من Firestore...", "info");
  try {
    await deleteDoc(doc(db, PRODUCTS_COLLECTION, id));
    showStatus(`تم الحذف: ${commitMessage}`, "ok");
    return true;
  } catch (err) {
    showStatus(describeFirebaseError(err, "الحذف"), "error");
    console.error(err);
    return false;
  }
}

// ---------------- Table rendering ----------------

function renderTable() {
  productsTableBody.innerHTML = "";

  if (products.length === 0) {
    productsTableBody.innerHTML = '<tr><td colspan="6">لا توجد منتجات بعد.</td></tr>';
    return;
  }

  products.forEach((p) => {
    const tr = document.createElement("tr");
    if (p.archived) tr.className = "archived-row";

    tr.innerHTML = `
      <td>${escapeHtml(p.name)}</td>
      <td>${escapeHtml(p.brand)}</td>
      <td>${escapeHtml(String(p.price))} ر.س</td>
      <td>${escapeHtml(p.type)}</td>
      <td>
        ${p.archived ? '<span class="tag tag-archived">مؤرشف</span>' : ""}
        ${p.in_stock === false ? '<span class="tag tag-oos">غير متوفر</span>' : ""}
        ${!p.archived && p.in_stock !== false ? '<span class="tag">نشط</span>' : ""}
      </td>
      <td class="actions-cell">
        <button class="btn-secondary btn-small" data-action="edit">تعديل</button>
        <button class="btn-secondary btn-small" data-action="toggle-archive">${p.archived ? "إلغاء الأرشفة" : "أرشفة"}</button>
        <button class="btn-danger btn-small" data-action="delete">حذف نهائي</button>
      </td>
    `;

    tr.querySelector('[data-action="edit"]').addEventListener("click", () => startEdit(p.id));
    tr.querySelector('[data-action="toggle-archive"]').addEventListener("click", () => toggleArchive(p.id));
    tr.querySelector('[data-action="delete"]').addEventListener("click", () => deleteProduct(p.id));

    productsTableBody.appendChild(tr);
  });
}

// ---------------- Form handling ----------------

async function handleFormSubmit(e) {
  e.preventDefault();

  const product = {
    id: fields.id.value || generateId(),
    name: fields.name.value.trim(),
    image: fields.image.value.trim() || "assets/images/placeholder.svg",
    price: Number(fields.price.value),
    brand: fields.brand.value,
    type: fields.type.value,
    capacity_ton: Number(fields.capacity_ton.value),
    capacity_btu: Number(fields.capacity_btu.value),
    power_saving: fields.power_saving.checked,
    mode: fields.mode.value,
    compressor_type: fields.compressor_type.value,
    in_stock: fields.in_stock.checked,
    description: fields.description.value.trim(),
  };

  if (editingId) {
    const existing = products.find((p) => p.id === editingId);
    product.archived = existing ? !!existing.archived : false;
    const ok = await saveProduct(product, `تعديل ${product.name}`);
    if (ok) {
      resetForm();
      await loadProducts();
    }
  } else {
    product.archived = false;
    const ok = await saveProduct(product, `إضافة منتج ${product.name}`);
    if (ok) {
      resetForm();
      await loadProducts();
    }
  }
}

function startEdit(id) {
  const p = products.find((x) => x.id === id);
  if (!p) return;
  editingId = id;
  fields.id.value = p.id;
  fields.name.value = p.name;
  ensureBrandOptionExists(p.brand);
  fields.brand.value = p.brand;
  updateBrandLogoPreview();
  fields.price.value = p.price;
  fields.image.value = p.image;
  imagePreview.src = p.image || "assets/images/placeholder.svg";
  imagePreview.hidden = !p.image;
  fields.type.value = p.type;
  fields.capacity_ton.value = p.capacity_ton;
  fields.capacity_btu.value = p.capacity_btu;
  fields.mode.value = p.mode;
  fields.compressor_type.value = p.compressor_type;
  fields.description.value = p.description || "";
  fields.power_saving.checked = !!p.power_saving;
  fields.in_stock.checked = p.in_stock !== false;

  formTitle.textContent = `تعديل منتج: ${p.name}`;
  cancelEditBtn.hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetForm() {
  editingId = null;
  productForm.reset();
  fields.id.value = "";
  fields.in_stock.checked = true;
  fields.image.value = "";
  imagePreview.hidden = true;
  imagePreview.src = "";
  newBrandBox.hidden = true;
  populateBrandSelect();
  formTitle.textContent = "إضافة منتج جديد";
  cancelEditBtn.hidden = true;
}

async function toggleArchive(id) {
  const p = products.find((x) => x.id === id);
  if (!p) return;
  const newArchived = !p.archived;
  const ok = await patchProduct(id, { archived: newArchived }, `${newArchived ? "أرشفة" : "إلغاء أرشفة"} ${p.name}`);
  if (ok) await loadProducts();
}

async function deleteProduct(id) {
  const p = products.find((x) => x.id === id);
  if (!p) return;
  const confirmed = confirm(`هل أنت متأكد من حذف "${p.name}" نهائياً؟ لا يمكن التراجع عن هذا الإجراء.`);
  if (!confirmed) return;
  const ok = await removeProduct(id, `حذف ${p.name}`);
  if (ok) await loadProducts();
}

function generateId() {
  return "p-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = String(str == null ? "" : str);
  return div.innerHTML;
}
