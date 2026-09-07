// ماركات مكيفات معروفة مع شعارات مولّدة محلياً (دائرة/مربع بالحرفين الأولين) — لا تحميل من مصادر خارجية،
// لتفادي أي مشاكل حقوق أو الاعتماد على شبكة خارجية. يمكن للمشرف إضافة ماركة أخرى وشعارها من لوحة الإدارة.
export function makeBrandLogo(text, bg) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" rx="14" fill="${bg}"/><text x="32" y="41" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="#fff" text-anchor="middle">${text}</text></svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}

export const KNOWN_BRANDS = [
  { name: "تي سي ال", logo: makeBrandLogo("TCL", "#c8102e") },
  { name: "سامسونج", logo: makeBrandLogo("SS", "#1428a0") },
  { name: "إل جي", logo: makeBrandLogo("LG", "#a50034") },
  { name: "جري", logo: makeBrandLogo("GR", "#00843d") },
  { name: "مديا", logo: makeBrandLogo("MD", "#00a0e3") },
  { name: "هايير", logo: makeBrandLogo("HR", "#0067b1") },
  { name: "كاريير", logo: makeBrandLogo("CR", "#003da5") },
  { name: "دايكن", logo: makeBrandLogo("DK", "#e60012") },
  { name: "باناسونيك", logo: makeBrandLogo("PN", "#0b3d91") },
  { name: "شارب", logo: makeBrandLogo("SH", "#e2001a") },
  { name: "توشيبا", logo: makeBrandLogo("TB", "#ff0000") },
  { name: "هيسنس", logo: makeBrandLogo("HS", "#e21836") },
  { name: "يورك", logo: makeBrandLogo("YK", "#005596") },
  { name: "فريش", logo: makeBrandLogo("FR", "#f39200") },
];
