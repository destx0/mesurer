import { useState, type ClipboardEvent } from "react";
import {
  clamp,
  COMMON_COLORS,
  formatHsl,
  formatRgb,
  parseHex,
  parseRgb,
  rgbToHex,
  rgbToHsl,
  shortHex,
  type Rgb,
} from "./color";
import ToolPage, { Section, Table, type Faq } from "./layout";
import { Field, inputClassName, Output, Panel, useQueryState } from "./ui";

const link = "text-strong underline underline-offset-2";

function Swatch({ color }: { color: string | null }) {
  return (
    <div
      className="h-24 w-full rounded-lg border border-black/10 sm:h-auto sm:min-h-32"
      // A see-through colour is shown over a chequerboard.
      style={{
        backgroundImage: color
          ? `linear-gradient(${color}, ${color}), repeating-conic-gradient(#e5e5e5 0 25%, #fff 0 50%)`
          : "repeating-linear-gradient(45deg, #f0f0f0 0 6px, #fff 6px 12px)",
        backgroundSize: "auto, 16px 16px",
      }}
      aria-hidden="true"
    />
  );
}

const colorTable = (from: "rgb" | "hex") => (
  <Table
    head={from === "rgb" ? ["Color", "RGB", "HEX"] : ["Color", "HEX", "RGB"]}
    rows={COMMON_COLORS.map(({ name, hex }) => {
      const rgb = formatRgb(parseHex(hex)!.rgb);
      const cells = [<code className="code">{hex}</code>, <code className="code">{rgb}</code>];
      return [
        <span className="flex items-center gap-2">
          <span className="size-4 shrink-0 rounded-full border border-black/10" style={{ backgroundColor: hex }} aria-hidden="true" />
          {name}
        </span>,
        ...(from === "rgb" ? cells.reverse() : cells),
      ];
    })}
  />
);

const CHANNELS = [
  { key: "r", label: "Red", accent: "#ef4444" },
  { key: "g", label: "Green", accent: "#22c55e" },
  { key: "b", label: "Blue", accent: "#3b82f6" },
] as const;

function RgbToHexConverter() {
  const [channels, setChannels] = useState({ r: "66", g: "133", b: "244" });
  const [alpha, setAlpha] = useState("");

  const read = (text: string) => {
    const value = Number(text);
    return text.trim() !== "" && Number.isFinite(value) && value >= 0 && value <= 255 ? Math.round(value) : null;
  };
  const [r, g, b] = [read(channels.r), read(channels.g), read(channels.b)];
  const rgb: Rgb | null = r !== null && g !== null && b !== null ? { r, g, b } : null;
  const opacity = alpha.trim() === "" ? 1 : Number(alpha.replace(",", "."));
  const alphaValid = Number.isFinite(opacity) && opacity >= 0 && opacity <= 1;
  const hex = rgb && alphaValid ? rgbToHex(rgb, opacity) : null;
  const short = hex ? shortHex(hex) : null;

  const fill = (value: { rgb: Rgb; alpha: number }) => {
    setChannels({ r: String(value.rgb.r), g: String(value.rgb.g), b: String(value.rgb.b) });
    setAlpha(value.alpha < 1 ? String(value.alpha) : "");
  };
  // A whole colour pasted into one field, such as rgb(255, 87, 51), fills them all.
  const onPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const pasted = parseRgb(event.clipboardData.getData("text"));
    if (!pasted) return;
    event.preventDefault();
    fill(pasted);
  };

  useQueryState({ r: channels.r, g: channels.g, b: channels.b, ...(alpha ? { a: alpha } : null) }, (params) => {
    const pasted = parseRgb(["r", "g", "b", "a"].map((key) => params.get(key)).filter(Boolean).join(","));
    if (pasted) fill(pasted);
  });

  return (
    <Panel className="grid gap-6 sm:grid-cols-[1fr_200px]">
      <div className="flex flex-col gap-4">
        {CHANNELS.map(({ key, label, accent }) => (
          <div key={key} className="flex items-end gap-3">
            <div className="w-24 shrink-0">
              <Field
                label={`${label} (${key.toUpperCase()})`}
                inputMode="numeric"
                value={channels[key]}
                aria-invalid={read(channels[key]) === null}
                onPaste={onPaste}
                onChange={(event) => setChannels((previous) => ({ ...previous, [key]: event.target.value }))}
              />
            </div>
            <input
              type="range"
              min={0}
              max={255}
              value={read(channels[key]) ?? 0}
              aria-label={`${label} slider`}
              className="mb-3 h-1.5 min-w-0 flex-1"
              style={{ accentColor: accent }}
              onChange={(event) => setChannels((previous) => ({ ...previous, [key]: event.target.value }))}
            />
          </div>
        ))}
        <div className="w-24">
          <Field
            label="Alpha (0 to 1)"
            inputMode="decimal"
            placeholder="1"
            value={alpha}
            aria-invalid={!alphaValid}
            onChange={(event) => setAlpha(event.target.value)}
          />
        </div>
        <p className="m-0 text-[13px] text-muted">Tip: paste a whole color such as <code className="code">rgb(255, 87, 51)</code> into any field.</p>
      </div>
      <Swatch color={hex} />
      <div className="flex flex-col sm:col-span-2">
        {hex && rgb ? (
          <>
            <Output label="HEX" value={hex} large />
            {short ? <Output label="Short HEX" value={short.toUpperCase()} /> : null}
            <Output label="Lowercase" value={hex.toLowerCase()} />
            <Output label="RGB" value={formatRgb(rgb, opacity)} />
            <Output label="HSL" value={formatHsl(rgbToHsl(rgb), opacity)} />
          </>
        ) : (
          <p className="m-0 text-muted" role="status">Enter red, green, and blue values from 0 to 255, and an alpha from 0 to 1 if you need one.</p>
        )}
      </div>
    </Panel>
  );
}

const rgbToHexFaq: Faq[] = [
  {
    question: "How do I convert RGB to HEX?",
    answer:
      "Write each of the red, green, and blue values in base 16 as two digits and join them after a #. For rgb(66, 133, 244): 66 is 42, 133 is 85, and 244 is F4, which gives #4285F4.",
  },
  {
    question: "What is the HEX code for rgb(255, 255, 255)?",
    answer: "rgb(255, 255, 255) is white, #FFFFFF. rgb(0, 0, 0) is black, #000000.",
  },
  {
    question: "How do I convert RGBA to HEX?",
    answer:
      "Convert the red, green, and blue as usual, then add the alpha as a fourth pair of digits: multiply it by 255, round, and write it in base 16. rgba(66, 133, 244, 0.5) becomes #4285F480. Enter the alpha above to get the eight-digit code.",
  },
  {
    question: "Are HEX codes case sensitive?",
    answer: "No. #4285F4 and #4285f4 are the same color. The converter gives you both.",
  },
  {
    question: "When can a HEX code be shortened to three digits?",
    answer: "When each of its three pairs repeats a digit. #FF6600 can be written #F60, but #4285F4 cannot be shortened.",
  },
];

export function RgbToHex() {
  return (
    <ToolPage
      slug="rgb-to-hex"
      name="RGB to HEX"
      title="RGB to HEX Converter: Convert RGB Colors to HEX Codes | Mesurer"
      description="Free RGB to HEX converter. Enter red, green, and blue values, or paste rgb() or rgba(), and copy the HEX color code instantly. Supports alpha and short HEX."
      heading="RGB to HEX converter"
      intro="Enter red, green, and blue values from 0 to 255, or paste an rgb() color, and get its HEX code to copy. Add an alpha to get an eight-digit HEX."
      tool={<RgbToHexConverter />}
      faq={rgbToHexFaq}
      cta="The Mesurer browser extension reads the color of any element or pixel on a live page and copies it in the format you choose, HEX and RGB included."
    >
      <Section title="How to convert RGB to HEX">
        <p className="m-0">
          An RGB color is three numbers from 0 to 255. A HEX code is the same three numbers written in base 16, two digits each, after a <code className="code">#</code>. To convert one by hand:
        </p>
        <ol className="m-0 flex list-decimal flex-col gap-1.5 pl-5">
          <li>Divide the value by 16. The whole part is the first digit, the remainder is the second.</li>
          <li>Write 10 to 15 as the letters A to F.</li>
          <li>Do this for red, green, and blue, and join the three pairs.</li>
        </ol>
        <pre className="m-0 overflow-x-auto rounded-md bg-subtle px-3 py-2 font-mono text-[13px] text-strong">
{`rgb(66, 133, 244)
 66 ÷ 16 = 4 remainder 2   → 42
133 ÷ 16 = 8 remainder 5   → 85
244 ÷ 16 = 15 remainder 4  → F4
                           = #4285F4`}
        </pre>
      </Section>

      <Section title="RGB to HEX in JavaScript">
        <pre className="m-0 overflow-x-auto rounded-md bg-subtle px-3 py-2 font-mono text-[13px] text-strong">
{`const rgbToHex = (r, g, b) =>
  "#" + [r, g, b].map((value) => value.toString(16).padStart(2, "0")).join("");

rgbToHex(66, 133, 244); // "#4285f4"`}
        </pre>
      </Section>

      <Section title="RGB to HEX color chart">
        {colorTable("rgb")}
        <p className="m-0">
          Going the other way? Use the <a href="/tools/hex-to-rgb" className={link}>HEX to RGB converter</a>, or explore colors with the <a href="/tools/color-picker" className={link}>color picker</a>.
        </p>
      </Section>
    </ToolPage>
  );
}

function HexToRgbConverter() {
  const [text, setText] = useState("#4285F4");
  const parsed = parseHex(text);

  useQueryState({ hex: text.trim().replace(/^#/, "") }, (params) => {
    const value = params.get("hex");
    if (value && parseHex(value)) setText(`#${value.replace(/^#/, "")}`);
  });

  const rgb = parsed?.rgb;
  const alpha = parsed?.alpha ?? 1;
  const percent = (value: number) => `${Math.round((value / 255) * 1000) / 10}%`;

  return (
    <Panel className="grid gap-6 sm:grid-cols-[1fr_200px]">
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] text-muted">HEX color code</span>
          <span className="flex gap-2">
            <input
              value={text}
              spellCheck={false}
              autoComplete="off"
              autoCapitalize="off"
              placeholder="#4285F4"
              aria-invalid={!parsed}
              className={`${inputClassName} h-12 text-lg ${parsed ? "" : "border-red-500 focus:border-red-500"}`}
              onChange={(event) => setText(event.target.value)}
            />
            {/* The browser's own picker, for choosing a colour rather than typing one. */}
            <input
              type="color"
              aria-label="Choose a color"
              value={rgb ? rgbToHex(rgb).toLowerCase() : "#000000"}
              className="h-12 w-12 shrink-0 cursor-pointer rounded-md border border-border bg-bg p-1"
              onChange={(event) => setText(event.target.value.toUpperCase())}
            />
          </span>
        </label>
        <p className="m-0 text-[13px] text-muted">
          Accepts 3, 4, 6, and 8 digits, with or without the <code className="code">#</code>: <code className="code">#F60</code>, <code className="code">4285F4</code>, <code className="code">#4285F480</code>.
        </p>
        {rgb ? (
          <dl className="m-0 grid grid-cols-3 gap-2">
            {CHANNELS.map(({ key, label }) => (
              <div key={key} className="flex flex-col gap-0.5 rounded-lg bg-subtle px-3 py-2">
                <dt className="text-[13px] text-muted">{label}</dt>
                <dd className="m-0 font-mono text-xl text-strong">{rgb[key]}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
      <Swatch color={rgb ? formatRgb(rgb, alpha) : null} />
      <div className="flex flex-col sm:col-span-2">
        {rgb ? (
          <>
            <Output label={alpha < 1 ? "RGBA" : "RGB"} value={formatRgb(rgb, alpha)} large />
            <Output label="Values only" value={`${rgb.r}, ${rgb.g}, ${rgb.b}`} />
            <Output
              label="Modern CSS"
              value={`rgb(${rgb.r} ${rgb.g} ${rgb.b}${alpha < 1 ? ` / ${Math.round(clamp(alpha, 0, 1) * 100)}%` : ""})`}
            />
            <Output label="Percent" value={`rgb(${percent(rgb.r)}, ${percent(rgb.g)}, ${percent(rgb.b)})`} />
            <Output label="HSL" value={formatHsl(rgbToHsl(rgb), alpha)} />
          </>
        ) : (
          <p className="m-0 text-muted" role="status">That is not a HEX color. Use 3, 4, 6, or 8 characters from 0 to 9 and A to F.</p>
        )}
      </div>
    </Panel>
  );
}

const hexToRgbFaq: Faq[] = [
  {
    question: "How do I convert HEX to RGB?",
    answer:
      "Split the six digits into three pairs and read each pair as a base 16 number: the first digit times 16 plus the second. For #4285F4: 42 is 66, 85 is 133, and F4 is 244, which gives rgb(66, 133, 244).",
  },
  {
    question: "What is #FFFFFF in RGB?",
    answer: "#FFFFFF is white, rgb(255, 255, 255). #000000 is black, rgb(0, 0, 0).",
  },
  {
    question: "How do I read a three-digit HEX code?",
    answer: "Double each digit. #F60 is short for #FF6600, which is rgb(255, 102, 0).",
  },
  {
    question: "What do eight-digit HEX codes mean?",
    answer:
      "The last two digits are the alpha, how see-through the color is, from 00 (invisible) to FF (solid). #4285F480 is rgba(66, 133, 244, 0.5).",
  },
  {
    question: "Should I use HEX or RGB in CSS?",
    answer:
      "Both give the same color and work in every browser. HEX is shorter and common in design files. RGB is easier to read when you need to change the opacity or work with the values in code.",
  },
];

export function HexToRgb() {
  return (
    <ToolPage
      slug="hex-to-rgb"
      name="HEX to RGB"
      title="HEX to RGB Converter: Convert HEX Color Codes to RGB | Mesurer"
      description="Free HEX to RGB converter. Paste a HEX color code and copy its RGB or RGBA values instantly. Works with 3, 4, 6, and 8 digit HEX, and gives HSL too."
      heading="HEX to RGB converter"
      intro="Paste a HEX color code to get its red, green, and blue values, ready to copy as rgb() or rgba(). Short and eight-digit codes with alpha work too."
      tool={<HexToRgbConverter />}
      faq={hexToRgbFaq}
      cta="The Mesurer browser extension reads the color of any element or pixel on a live page and copies it in the format you choose, HEX and RGB included."
    >
      <Section title="How to convert HEX to RGB">
        <p className="m-0">
          A HEX code is three two-digit numbers in base 16: one each for red, green, and blue. To convert it by hand:
        </p>
        <ol className="m-0 flex list-decimal flex-col gap-1.5 pl-5">
          <li>Remove the <code className="code">#</code> and split the code into three pairs.</li>
          <li>Read the letters A to F as 10 to 15.</li>
          <li>For each pair, multiply the first digit by 16 and add the second.</li>
        </ol>
        <pre className="m-0 overflow-x-auto rounded-md bg-subtle px-3 py-2 font-mono text-[13px] text-strong">
{`#4285F4
42 →  4 × 16 + 2  = 66
85 →  8 × 16 + 5  = 133
F4 → 15 × 16 + 4  = 244
                  = rgb(66, 133, 244)`}
        </pre>
      </Section>

      <Section title="HEX to RGB in JavaScript">
        <pre className="m-0 overflow-x-auto rounded-md bg-subtle px-3 py-2 font-mono text-[13px] text-strong">
{`const hexToRgb = (hex) => {
  const value = parseInt(hex.replace("#", ""), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
};

hexToRgb("#4285F4"); // [66, 133, 244]`}
        </pre>
      </Section>

      <Section title="HEX to RGB color chart">
        {colorTable("hex")}
        <p className="m-0">
          Going the other way? Use the <a href="/tools/rgb-to-hex" className={link}>RGB to HEX converter</a>, or explore colors with the <a href="/tools/color-picker" className={link}>color picker</a>.
        </p>
      </Section>
    </ToolPage>
  );
}
