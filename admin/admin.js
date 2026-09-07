// لوحة إدارة المنتجات — تتعامل مباشرة مع Firestore (بدون خادم خلفي)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { firebaseConfig, PRODUCTS_COLLECTION } from "../js/firebase-config.js";

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

let products = [];
let editingId = null;

// ---------------- DOM refs ----------------
const statusCard = document.getElementById("statusCard");
const seedBtn = document.getElementById("seedBtn");
const refreshBtn = document.getElementById("refreshBtn");
const productsTableBody = document.getElementById("productsTableBody");

const productForm = document.getElementById("productForm");
const formTitle = document.getElementById("formTitle");
const cancelEditBtn = document.getElementById("cancelEditBtn");
const fields = {
  id: document.getElementById("f_id"),
  name: document.getElementById("f_name"),
  brand: document.getElementById("f_brand"),
  price: document.getElementById("f_price"),
  image: document.getElementById("f_image"),
  type: document.getElementById("f_type"),
  capacity: document.getElementById("f_capacity"),
  mode: document.getElementById("f_mode"),
  compressor_type: document.getElementById("f_compressor_type"),
  description: document.getElementById("f_description"),
  power_saving: document.getElementById("f_power_saving"),
  in_stock: document.getElementById("f_in_stock"),
};

init();

function init() {
  seedBtn.addEventListener("click", handleSeed);
  refreshBtn.addEventListener("click", loadProducts);
  productForm.addEventListener("submit", handleFormSubmit);
  cancelEditBtn.addEventListener("click", resetForm);
  loadProducts();
}

function showStatus(message, type) {
  statusCard.hidden = false;
  statusCard.innerHTML = `<div class="status-box status-${type}">${escapeHtml(message)}</div>`;
}

// ---------------- Firestore ops ----------------

async function loadProducts() {
  showStatus("جارٍ تحميل المنتجات من Firestore...", "info");
  try {
    const snap = await getDocs(collection(db, PRODUCTS_COLLECTION));
    products = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
    statusCard.hidden = true;
    renderTable();
  } catch (err) {
    showStatus(describeFirestoreError(err, "تحميل المنتجات"), "error");
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
    showStatus(describeFirestoreError(err, "الحفظ"), "error");
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
    showStatus(describeFirestoreError(err, "التحديث"), "error");
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
    showStatus(describeFirestoreError(err, "الحذف"), "error");
    console.error(err);
    return false;
  }
}

function describeFirestoreError(err, action) {
  const code = err && err.code ? err.code : "";
  if (code === "permission-denied") {
    return `تم رفض ${action}: قواعد أمان Firestore (Security Rules) لا تسمح بهذه العملية. راجع قسم الأمان في README.`;
  }
  if (code === "unavailable" || err instanceof TypeError) {
    return `فشل الاتصال بـ Firestore أثناء ${action}. تحقق من اتصالك بالإنترنت وحاول مجدداً.`;
  }
  return `خطأ أثناء ${action}: ${err && err.message ? err.message : "خطأ غير معروف"}`;
}

async function handleSeed() {
  showStatus("جارٍ استيراد data/products.json...", "info");
  try {
    const res = await fetch("../data/products.json");
    const seedData = await res.json();
    let imported = 0;
    let skipped = 0;
    for (const item of seedData) {
      const existing = await getDoc(doc(db, PRODUCTS_COLLECTION, item.id));
      if (existing.exists()) {
        skipped++;
        continue;
      }
      await setDoc(doc(db, PRODUCTS_COLLECTION, item.id), item);
      imported++;
    }
    showStatus(`تم الاستيراد: ${imported} منتج جديد، تم تخطي ${skipped} موجود مسبقاً.`, "ok");
    await loadProducts();
  } catch (err) {
    showStatus(describeFirestoreError(err, "الاستيراد"), "error");
    console.error(err);
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
    brand: fields.brand.value.trim(),
    type: fields.type.value,
    capacity: fields.capacity.value.trim(),
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
  fields.brand.value = p.brand;
  fields.price.value = p.price;
  fields.image.value = p.image;
  fields.type.value = p.type;
  fields.capacity.value = p.capacity;
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
