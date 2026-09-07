// صورة افتراضية مختلفة لكل نوع جهاز (سبليت/شباك/كاسيت) — رسومات أصلية بسيطة، لا صور فعلية للمنتج.
export const TYPE_IMAGES = {
  "سبليت": "assets/images/ac-split.svg",
  "شباك": "assets/images/ac-window.svg",
  "كاسيت": "assets/images/ac-cassette.svg",
};

export function imageForType(type) {
  return TYPE_IMAGES[type] || "assets/images/placeholder.svg";
}
