import { converter, formatHex } from "culori";

const toOklch = converter("oklch");

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function paletteFromImage(file: File): Promise<{ colours: string[]; dataUrl: string }> {
  const src = URL.createObjectURL(file);
  try {
    const img = await loadImage(src);
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);

    const buckets = new Map<string, { n: number; r: number; g: number; b: number }>();
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3]! < 200) continue;
      const [r, g, b] = [data[i]!, data[i + 1]!, data[i + 2]!];
      const key = `${r >> 4},${g >> 4},${b >> 4}`;
      const e = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
      e.n++; e.r += r; e.g += g; e.b += b;
      buckets.set(key, e);
    }
    const scored = [...buckets.values()].map((e) => {
      const hex = formatHex({ mode: "rgb", r: e.r / e.n / 255, g: e.g / e.n / 255, b: e.b / e.n / 255 });
      const o = toOklch(hex)!;
      return { hex, o, score: e.n * (0.5 + (o.c ?? 0) * 4) };
    }).filter(({ o }) => (o.c ?? 0) >= 0.035 && o.l <= 0.97 && o.l >= 0.08)
      .sort((a, b) => b.score - a.score);

    const colours: string[] = [];
    for (const s of scored) {
      if (colours.some((c) => { const p = toOklch(c)!; return Math.abs((p.h ?? 0) - (s.o.h ?? 0)) < 20 && Math.abs(p.l - s.o.l) < 0.1; })) continue;
      colours.push(s.hex);
      if (colours.length === 4) break;
    }

    const avatar = document.createElement("canvas");
    avatar.width = avatar.height = 128;
    const actx = avatar.getContext("2d")!;
    const scale = Math.min(128 / img.width, 128 / img.height);
    const w = img.width * scale, h = img.height * scale;
    actx.drawImage(img, (128 - w) / 2, (128 - h) / 2, w, h);

    return { colours, dataUrl: avatar.toDataURL("image/png") };
  } finally {
    URL.revokeObjectURL(src);
  }
}
