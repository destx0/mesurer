import { useState } from "react";
import ToolPage, { Section, Table, type Faq } from "./layout";
import { CopyButton, Field, Output, Panel, useQueryState } from "./ui";

const PRESETS = [
  { ratio: "16:9", width: 1920, height: 1080 },
  { ratio: "4:3", width: 1600, height: 1200 },
  { ratio: "3:2", width: 1080, height: 720 },
  { ratio: "1:1", width: 1080, height: 1080 },
  { ratio: "21:9", width: 2520, height: 1080 },
  { ratio: "9:16", width: 1080, height: 1920 },
  { ratio: "4:5", width: 1080, height: 1350 },
  { ratio: "2:3", width: 1000, height: 1500 },
];

// The ratios a size is likened to when its own does not come out as small numbers.
const NAMED: Array<[number, number]> = [[16, 9], [16, 10], [4, 3], [3, 2], [5, 4], [1, 1], [21, 9], [9, 16], [4, 5], [2, 3], [3, 4], [2, 1], [1.85, 1], [2.39, 1]];

const toNumber = (text: string) => {
  const value = Number(text.trim().replace(",", "."));
  return Number.isFinite(value) && value > 0 ? value : null;
};

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

const simplify = (width: number, height: number) => {
  // Sizes with decimals are counted in thousandths, so that 1.5 by 1 is 3:2.
  const [a, b] = [Math.round(width * 1000), Math.round(height * 1000)];
  const divisor = gcd(a, b) || 1;
  return [a / divisor, b / divisor] as const;
};

const trim = (value: number, digits = 2) => String(Number(value.toFixed(digits)));

const closest = (ratio: number) => {
  const [w, h] = NAMED.reduce((best, entry) =>
    Math.abs(entry[0] / entry[1] - ratio) < Math.abs(best[0] / best[1] - ratio) ? entry : best,
  );
  return Math.abs(w / h - ratio) / ratio < 0.02 ? `${w}:${h}` : null;
};

function Calculator() {
  const [width, setWidth] = useState("1920");
  const [height, setHeight] = useState("1080");
  // The side of the new size that was typed. The other is worked out from it.
  const [target, setTarget] = useState<{ side: "width" | "height"; value: string }>({ side: "width", value: "1280" });
  const [whole, setWhole] = useState(true);

  useQueryState({ w: width, h: height, [target.side === "width" ? "nw" : "nh"]: target.value }, (params) => {
    const [w, h, nw, nh] = ["w", "h", "nw", "nh"].map((key) => params.get(key));
    if (w && toNumber(w)) setWidth(w);
    if (h && toNumber(h)) setHeight(h);
    if (nh && toNumber(nh)) setTarget({ side: "height", value: nh });
    else if (nw && toNumber(nw)) setTarget({ side: "width", value: nw });
  });

  const w = toNumber(width);
  const h = toNumber(height);
  const ratio = w && h ? w / h : null;
  const [ratioW, ratioH] = w && h ? simplify(w, h) : [null, null];
  const label = ratioW && ratioH ? `${ratioW}:${ratioH}` : "";
  const near = ratio && label && !NAMED.some(([a, b]) => `${a}:${b}` === label) ? closest(ratio) : null;

  const typed = toNumber(target.value);
  const solved = ratio && typed ? (target.side === "width" ? typed / ratio : typed * ratio) : null;
  const solvedText = solved ? trim(solved, whole ? 0 : 2) : "";
  const newWidth = target.side === "width" ? target.value : solvedText;
  const newHeight = target.side === "height" ? target.value : solvedText;

  // The preview is drawn as large as fits in a square.
  const box = ratio ? (ratio >= 1 ? { width: "100%", aspectRatio: String(ratio) } : { height: "100%", aspectRatio: String(ratio) }) : null;

  return (
    <Panel className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Common aspect ratios">
        {PRESETS.map((preset) => (
          <button
            key={preset.ratio}
            type="button"
            aria-pressed={label === preset.ratio}
            className={`h-8 rounded-full border px-3 font-mono text-[13px] transition-colors ${
              label === preset.ratio ? "border-strong bg-strong text-bg" : "border-border text-strong hover:bg-subtle"
            }`}
            onClick={() => {
              setWidth(String(preset.width));
              setHeight(String(preset.height));
            }}
          >
            {preset.ratio}
          </button>
        ))}
      </div>

      <div className="grid gap-6 sm:grid-cols-[1fr_180px]">
        <div className="flex flex-col gap-5">
          <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
            <legend className="mb-2 p-0 font-[450] text-strong">Original size</legend>
            <div className="flex items-end gap-2">
              <Field label="Width" inputMode="decimal" value={width} onChange={(event) => setWidth(event.target.value)} aria-invalid={!w} />
              <span className="pb-2.5 text-muted" aria-hidden="true">×</span>
              <Field label="Height" inputMode="decimal" value={height} onChange={(event) => setHeight(event.target.value)} aria-invalid={!h} />
            </div>
          </fieldset>
          <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
            <legend className="mb-2 p-0 font-[450] text-strong">New size</legend>
            <div className="flex items-end gap-2">
              <Field label="Width" inputMode="decimal" value={newWidth} onChange={(event) => setTarget({ side: "width", value: event.target.value })} />
              <span className="pb-2.5 text-muted" aria-hidden="true">×</span>
              <Field label="Height" inputMode="decimal" value={newHeight} onChange={(event) => setTarget({ side: "height", value: event.target.value })} />
            </div>
            <p className="m-0 text-[13px] text-muted">Type either side. The other is worked out to keep the ratio.</p>
            <label className="flex w-fit items-center gap-2 text-[13px] text-muted">
              <input type="checkbox" checked={whole} onChange={(event) => setWhole(event.target.checked)} className="accent-[#111]" />
              Round to whole pixels
            </label>
          </fieldset>
        </div>

        <div className="flex aspect-square w-full max-w-[180px] items-center justify-center justify-self-center rounded-lg bg-subtle p-3" aria-hidden="true">
          {box ? (
            <div className="flex max-h-full max-w-full items-center justify-center rounded-[3px] border border-strong bg-bg font-mono text-[12px] text-strong" style={box}>
              {label.length <= 9 ? label : trim(ratio ?? 0)}
            </div>
          ) : null}
        </div>
      </div>

      {ratio && label ? (
        <div className="flex flex-col">
          <Output label={near ? `Aspect ratio (about ${near})` : "Aspect ratio"} value={label} large />
          <Output label="As a decimal" value={`${trim(ratio, 4)}:1`} />
          {solved ? <Output label="New size" value={`${newWidth} × ${newHeight}`} /> : null}
          <Output label="CSS" value={`aspect-ratio: ${ratioW} / ${ratioH};`} />
          <Output label="Padding-top fallback" value={`${trim(100 / ratio, 4)}%`} />
        </div>
      ) : (
        <p className="m-0 text-muted" role="status">Enter a width and a height above zero to see the ratio.</p>
      )}
    </Panel>
  );
}

const faq: Faq[] = [
  {
    question: "How do I calculate an aspect ratio?",
    answer:
      "Divide the width and the height by their greatest common divisor. For 1920 × 1080 that divisor is 120, which gives 16:9. Dividing the width by the height gives the same ratio as a decimal, 1.7778.",
  },
  {
    question: "How do I resize an image without stretching it?",
    answer:
      "Keep the ratio the same. Multiply the new width by the original height and divide by the original width to get the new height: 1280 × 1080 ÷ 1920 = 720. Enter the original size and one new side above and the calculator does it for you.",
  },
  {
    question: "What is the aspect ratio of 1920 × 1080?",
    answer: "1920 × 1080 is 16:9, the same ratio as 1280 × 720, 2560 × 1440, and 3840 × 2160 (4K UHD).",
  },
  {
    question: "What aspect ratio should I use for social media?",
    answer:
      "Vertical video for TikTok, Instagram Reels, and YouTube Shorts is 9:16 (1080 × 1920). Instagram feed posts work best at 4:5 (1080 × 1350) or 1:1 (1080 × 1080). Standard YouTube video is 16:9.",
  },
  {
    question: "How do I set an aspect ratio in CSS?",
    answer:
      "Use the aspect-ratio property, for example aspect-ratio: 16 / 9, on an element that has a width. For very old browsers, the fallback is a wrapper with padding-top set to the height divided by the width as a percentage, 56.25% for 16:9.",
  },
  {
    question: "Why does my size give a ratio like 683:384?",
    answer:
      "Some sizes do not reduce to small numbers. 1366 × 768 is exactly 683:384, which is very close to 16:9 but not equal to it. When that happens the calculator also shows the nearest common ratio.",
  },
];

export default function AspectRatioCalculator() {
  return (
    <ToolPage
      slug="aspect-ratio-calculator"
      name="Aspect ratio calculator"
      title="Aspect Ratio Calculator: Find and Resize Any Ratio | Mesurer"
      description="Free aspect ratio calculator. Enter a width and height to get the ratio (16:9, 4:3, 1:1), then resize to a new width or height without stretching. Copies the CSS too."
      heading="Aspect ratio calculator"
      intro="Enter a width and a height to get the aspect ratio. Then type a new width or height, and the other side is worked out so the image, video, or element keeps its shape."
      tool={<Calculator />}
      faq={faq}
      cta="Mesurer is a browser extension that measures the width, height, and spacing of anything on a live page, so you can read the real size of an element before working out its ratio."
    >
      <Section title="How to use the aspect ratio calculator">
        <ol className="m-0 flex list-decimal flex-col gap-1.5 pl-5">
          <li>Enter the original width and height, or pick a common ratio such as 16:9.</li>
          <li>Read the simplified ratio, its decimal value, and the CSS to copy.</li>
          <li>Type a new width or a new height. The other side updates to keep the same ratio.</li>
        </ol>
        <p className="m-0">
          The address of the page updates as you type, so you can copy it to share a calculation.
        </p>
      </Section>

      <Section title="The aspect ratio formula">
        <p className="m-0">
          An aspect ratio is the width of a shape compared to its height, written as two numbers such as 16:9. To find it, divide both sides by their greatest common divisor:
        </p>
        <pre className="m-0 overflow-x-auto rounded-md bg-subtle px-3 py-2 font-mono text-[13px] text-strong">
{`ratio      = (width ÷ gcd) : (height ÷ gcd)
new height = new width × height ÷ width
new width  = new height × width ÷ height`}
        </pre>
        <p className="m-0">
          For 1920 × 1080 the greatest common divisor is 120, so the ratio is 16:9. Resizing it to 1280 wide gives 1280 × 1080 ÷ 1920 = 720 high.
        </p>
      </Section>

      <Section title="Common aspect ratios and resolutions">
        <Table
          head={["Ratio", "Decimal", "Common sizes", "Used for"]}
          rows={[
            ["16:9", "1.78", "1280 × 720, 1920 × 1080, 3840 × 2160", "HD and 4K video, YouTube, most monitors"],
            ["16:10", "1.6", "1280 × 800, 1920 × 1200, 2560 × 1600", "Laptop screens"],
            ["4:3", "1.33", "1024 × 768, 1600 × 1200", "Older displays, tablets, presentations"],
            ["3:2", "1.5", "1080 × 720, 2160 × 1440", "Photography, 35mm film"],
            ["1:1", "1", "1080 × 1080", "Square posts, avatars"],
            ["4:5", "0.8", "1080 × 1350", "Instagram portrait posts"],
            ["9:16", "0.56", "1080 × 1920", "TikTok, Reels, Shorts, Stories"],
            ["21:9", "2.33", "2560 × 1080, 3440 × 1440", "Ultrawide monitors, cinematic video"],
          ]}
        />
      </Section>

      <Section title="Aspect ratio in CSS">
        <p className="m-0">
          The <code className="code">aspect-ratio</code> property keeps an element in proportion as its width changes. It is the simplest way to reserve space for images, video, and embeds before they load, which avoids layout shift.
        </p>
        <div className="flex items-start justify-between gap-3 rounded-md bg-subtle px-3 py-2">
          <pre className="m-0 overflow-x-auto font-mono text-[13px] text-strong">
{`.video {
  width: 100%;
  aspect-ratio: 16 / 9;
}`}
          </pre>
          <CopyButton value={".video {\n  width: 100%;\n  aspect-ratio: 16 / 9;\n}"} />
        </div>
      </Section>
    </ToolPage>
  );
}
