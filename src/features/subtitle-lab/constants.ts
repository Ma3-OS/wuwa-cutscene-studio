export interface StylePreset {
  id: string;
  label: string;
  font: string;
  size: number;
  outline: number;
  shadow: number;
  marginV: number;
  color: string;
}

export const PRESETS: StylePreset[] = [
  {
    id: "authentic_54",
    label: "ขนาดใหญ่คมชัด 54pt",
    font: "Kanit Medium",
    size: 54,
    outline: 1.2,
    shadow: 0.0,
    marginV: 54,
    color: "#FFFFFF",
  },
  {
    id: "exact_game",
    label: "มาตรฐานบทสนทนาเกม 30pt",
    font: "Kanit Medium",
    size: 30,
    outline: 1.0,
    shadow: 0.0,
    marginV: 50,
    color: "#FFFFFF",
  },
  {
    id: "game_lyric",
    label: "เพลงเปิดและเนื้อเพลง 34pt",
    font: "Kanit Medium",
    size: 34,
    outline: 0.0,
    shadow: 0.0,
    marginV: 30,
    color: "#FFFFFF",
  },
  {
    id: "zoom_safe",
    label: "ซูมเต็มจอ ไร้แถบดำ 32pt",
    font: "Kanit Medium",
    size: 32,
    outline: 1.2,
    shadow: 0.8,
    marginV: 64,
    color: "#FFFFFF",
  },
  {
    id: "thai_game",
    label: "ซับไตเติลทางการ 30pt",
    font: "Kanit Medium",
    size: 30,
    outline: 1.2,
    shadow: 0.5,
    marginV: 50,
    color: "#FFFFFF",
  },
  {
    id: "fansub",
    label: "อนิเมะแฟนซับ 38pt",
    font: "Prompt Medium",
    size: 38,
    outline: 2.5,
    shadow: 1.5,
    marginV: 45,
    color: "#FEF08A",
  },
  {
    id: "minimal",
    label: "มินิมอลคลีน 28pt",
    font: "Segoe UI",
    size: 28,
    outline: 0.8,
    shadow: 0.0,
    marginV: 50,
    color: "#FFFFFF",
  },
];

export const SCENE_THEMES = [
  { id: "cutscene", label: "ภาพคัตซีนจริง", bg: "bg-cover bg-center", image: "/sample_cutscene.jpg", isLight: false },
  { id: "dark", label: "มืดสนิท", bg: "bg-[#09090b]", isLight: false },
  { id: "space", label: "เนบิวลา", bg: "bg-gradient-to-br from-purple-950/40 via-neutral-950 to-[#09090b]", isLight: false },
  { id: "daylight", label: "กลางวัน", bg: "bg-neutral-200", isLight: true },
  { id: "sunset", label: "อาทิตย์อัสดง", bg: "bg-gradient-to-br from-amber-950/40 via-neutral-950 to-[#09090b]", isLight: false },
  { id: "forest", label: "ป่าเขา", bg: "bg-gradient-to-br from-emerald-950/40 via-neutral-950 to-[#09090b]", isLight: false },
  { id: "midnight", label: "เที่ยงคืน", bg: "bg-gradient-to-br from-blue-950/40 via-neutral-950 to-[#09090b]", isLight: false },
];

export const SAMPLE_TEXTS = {
  th: {
    ruby: "Xuanqing",
    base: "หากเป็นเจ้า วันนี้<ano=Xuanqing>นาง</ano>อาจจะยังมีชีวิตอยู่ก็เป็นได้...",
    long: "ในศึกเหวเมฆาเจ้าช่วยผู้คนมากมาย ยืนหยัดฟื้นฟู \"แคปซูลอารยธรรม\" มานับร้อยปี เปลี่ยนสถานการณ์ที่ไร้ซึ่งทางออกนี้ให้ปรากฏหนทางรอดขึ้นมา",
    short: "ข้าผิดเองต่างหาก! หากไม่ใช่เพราะข้า...",
  },
  en: {
    ruby: "Xuanqing",
    base: "If it were you, perhaps <ano=Xuanqing>she</ano> would still be alive today...",
    long: "In the Battle of the Cloud Abyss, you saved countless lives and upheld the restoration of the Civilization Capsule for a century.",
    short: "It was my fault! If only it hadn't been for me...",
  },
  ja: {
    ruby: "宣清",
    base: "あなたなら、きっと<ano=宣清>彼女</ano>は今も生きていたかもしれない…",
    long: "雲淵の戦いにおいて、あなたは幾多の人々を救い、文明カプセルの復興を百年にわたり支え続けた。",
    short: "私のせいだ！私がこんなことさえしなければ…",
  },
  zh: {
    ruby: "宣清",
    base: "若是你，今日<ano=宣清>她</ano>或许尚在人世也未可知…",
    long: "在云渊之战中，你救助了无数人，坚守文明胶囊的复兴数百年，力挽狂澜。",
    short: "都怪我！若非因我之故…",
  },
};

export const SAMPLE_LYRICS = {
  th: {
    line1: "สู่ผืนสมุทรไร้สิ้นสุด สู่ทุ่งกว้างอันแสนไกล ก้าวฝ่าม่านหมอกเพียงลำพัง",
    line2: "去海天 去远野 只身孤涉过云烟",
  },
  en: {
    line1: "To the boundless sea, to the distant wild, venturing alone through the misty veil",
    line2: "去海天 去远野 只身孤涉过云烟",
  },
  ja: {
    line1: "果てなき海へ、遥かなる荒野へ、独り雲煙を越えて歩みゆく",
    line2: "去海天 去远野 只身孤涉过云烟",
  },
  zh: {
    line1: "去海天 去远野 只身孤涉过云烟",
    line2: "送你走远 终至相隔这人间",
  },
};

export const COLOR_PRESETS = [
  { name: "White", hex: "#FFFFFF" },
  { name: "Amber", hex: "#FFFBEB" },
  { name: "Gold", hex: "#FEF08A" },
  { name: "Cyan", hex: "#E0F2FE" },
  { name: "Mint", hex: "#CCFBF1" },
];
