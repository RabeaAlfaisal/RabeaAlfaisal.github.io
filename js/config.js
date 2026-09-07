// إعدادات عامة للموقع
// رقم الواتساب الخاص بالمتجر (بصيغة محلية سعودية 05XXXXXXXX) — غيّره هنا فقط عند الحاجة
const STORE_CONFIG = {
  WHATSAPP_NUMBER_LOCAL: "0558742544",
  STORE_NAME: "متجر المكيفات",
};

// يحوّل رقم محلي سعودي 05XXXXXXXX إلى صيغة دولية 9665XXXXXXXX لاستخدامه في روابط wa.me
function toInternationalSaudiNumber(localNumber) {
  const digitsOnly = localNumber.replace(/\D/g, "");
  const withoutLeadingZero = digitsOnly.startsWith("0") ? digitsOnly.slice(1) : digitsOnly;
  return "966" + withoutLeadingZero;
}

const WHATSAPP_NUMBER = toInternationalSaudiNumber(STORE_CONFIG.WHATSAPP_NUMBER_LOCAL);

// معرّض على window لأن js/app.js يُحمَّل كـ ES module (نطاق منفصل عن هذا الملف)
window.WHATSAPP_NUMBER = WHATSAPP_NUMBER;
window.STORE_CONFIG = STORE_CONFIG;
