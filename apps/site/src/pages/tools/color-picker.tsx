import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import {
  clamp,
  cmykToRgb,
  contrast,
  formatCmyk,
  formatHsl,
  formatHsv,
  formatRgb,
  hslToHsv,
  hsvToHsl,
  hsvToRgb,
  numbersIn,
  parseHex,
  parseRgb,
  rgbToCmyk,
  rgbToHex,
  rgbToHsv,
  type Hsv,
  type Rgb,
} from "./color";
import ToolPage, { Section, Table, type Faq } from "./layout";
import { CopyButton, inputClassName, Panel, useQueryState } from "./ui";

const WHITE = { r: 255, g: 255, b: 255 };
const BLACK = { r: 0, g: 0, b: 0 };

// A code that can be typed over: while it is being typed it is left as it is, and it sets the
// colour as soon as it reads as one.
function CodeField({ label, value, onCommit }: { label: string; value: string; onCommit: (text: string) => boolean }) {
  const [draft, setDraft] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  return (
    <div className="flex items-end gap-2">
      <label className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="text-[13px] text-muted">{label}</span>
        <input
          value={draft ?? value}
          spellCheck={false}
          autoComplete="off"
          aria-invalid={invalid}
          className={`${inputClassName} ${invalid ? "border-red-500 focus:border-red-500" : ""}`}
          onFocus={(event) => event.target.select()}
          onChange={(event) => {
            setDraft(event.target.value);
            setInvalid(!onCommit(event.target.value));
          }}
          onBlur={() => {
            setDraft(null);
            setInvalid(false);
          }}
        />
      </label>
      <div className="flex h-10 items-center">
        <CopyButton value={value} />
      </div>
    </div>
  );
}

type EyeDropperWindow = Window & { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } };

function Picker() {
  // Kept as hue, saturation and value: grey has no hue and black no saturation, and reading
  // them back from the colour would throw the sliders to one end as they pass through.
  const [hsv, setHsv] = useState<Hsv>({ h: 217, s: 73, v: 96 });
  const [canSample, setCanSample] = useState(false);
  const areaRef = useRef<HTMLDivElement | null>(null);

  const rgb = hsvToRgb(hsv);
  const hex = rgbToHex(rgb);
  const hsl = hsvToHsl(hsv);

  const setRgb = (next: Rgb) => {
    const read = rgbToHsv(next);
    setHsv((previous) => ({ h: read.s === 0 ? previous.h : read.h, s: read.v === 0 ? previous.s : read.s, v: read.v }));
    return true;
  };
  const setHex = (text: string) => {
    const read = parseHex(text);
    return read ? setRgb(read.rgb) : false;
  };

  useEffect(() => setCanSample("EyeDropper" in window), []);
  useQueryState({ color: hex.slice(1).toLowerCase() }, (params) => {
    setHex(params.get("color") ?? "");
  });

  const moveTo = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = areaRef.current?.getBoundingClientRect();
    if (!bounds) return;
    setHsv((previous) => ({
      h: previous.h,
      s: clamp((event.clientX - bounds.left) / bounds.width, 0, 1) * 100,
      v: (1 - clamp((event.clientY - bounds.top) / bounds.height, 0, 1)) * 100,
    }));
  };

  const nudge = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 10 : 1;
    const move: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    const by = move[event.key];
    if (!by) return;
    event.preventDefault();
    setHsv((previous) => ({ h: previous.h, s: clamp(previous.s + by[0], 0, 100), v: clamp(previous.v + by[1], 0, 100) }));
  };

  const percents = (text: string, count: number) => {
    const values = numbersIn(text).map((part) => part.value);
    return values.length === count && values.slice(count === 4 ? 0 : 1).every((value) => value >= 0 && value <= 100) ? values : null;
  };

  const onWhite = contrast(rgb, WHITE);
  const onBlack = contrast(rgb, BLACK);
  const grade = (ratio: number) => (ratio >= 7 ? "AAA" : ratio >= 4.5 ? "AA" : ratio >= 3 ? "AA large" : "Fail");
  // The same hue and saturation, from dark to light.
  const shades = [10, 20, 30, 40, 50, 60, 70, 80, 90].map((l) => rgbToHex(hsvToRgb(hslToHsv({ h: hsl.h, s: hsl.s, l }))));

  return (
    <Panel className="grid gap-6 sm:grid-cols-2">
      <div className="flex flex-col gap-4">
        <div
          ref={areaRef}
          role="slider"
          tabIndex={0}
          aria-label="Saturation and brightness"
          aria-valuetext={`Saturation ${Math.round(hsv.s)}%, brightness ${Math.round(hsv.v)}%`}
          aria-valuenow={Math.round(hsv.s)}
          className="relative aspect-[4/3] w-full cursor-crosshair touch-none rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-strong focus-visible:ring-offset-2"
          style={{
            backgroundColor: `hsl(${hsv.h} 100% 50%)`,
            backgroundImage: "linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent)",
          }}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            moveTo(event);
          }}
          onPointerMove={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) moveTo(event);
          }}
          onKeyDown={nudge}
        >
          <span
            className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgb(0_0_0_/_30%),0_1px_3px_rgb(0_0_0_/_30%)]"
            style={{ left: `${hsv.s}%`, top: `${100 - hsv.v}%`, backgroundColor: hex }}
          />
        </div>
        <input
          type="range"
          min={0}
          max={360}
          value={Math.round(hsv.h)}
          aria-label="Hue"
          className="tool-hue"
          onChange={(event) => setHsv((previous) => ({ ...previous, h: Number(event.target.value) }))}
        />
        <div className="flex items-center gap-3">
          <span className="size-12 shrink-0 rounded-lg border border-black/10" style={{ backgroundColor: hex }} aria-hidden="true" />
          <div className="flex min-w-0 flex-col">
            <output className="font-mono text-xl text-strong">{hex}</output>
            <span className="text-[13px] text-muted">{formatRgb(rgb)}</span>
          </div>
          {canSample ? (
            <button
              type="button"
              className="ml-auto h-9 shrink-0 rounded-full border border-border px-3.5 text-[14px] text-strong transition-colors hover:bg-subtle"
              onClick={() => {
                const Sampler = (window as EyeDropperWindow).EyeDropper;
                if (!Sampler) return;
                // Leaving the sampler without picking is not an error.
                void new Sampler().open().then((result) => setHex(result.sRGBHex)).catch(() => undefined);
              }}
            >
              Pick from screen
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <CodeField label="HEX" value={hex} onCommit={setHex} />
        <CodeField
          label="RGB"
          value={formatRgb(rgb)}
          onCommit={(text) => {
            const read = parseRgb(text);
            return read ? setRgb(read.rgb) : false;
          }}
        />
        <CodeField
          label="HSL"
          value={formatHsl(hsl)}
          onCommit={(text) => {
            const values = percents(text, 3);
            if (!values) return false;
            setHsv(hslToHsv({ h: clamp(values[0], 0, 360), s: values[1], l: values[2] }));
            return true;
          }}
        />
        <CodeField
          label="HSV"
          value={formatHsv(hsv)}
          onCommit={(text) => {
            const values = percents(text, 3);
            if (!values) return false;
            setHsv({ h: clamp(values[0], 0, 360), s: values[1], v: values[2] });
            return true;
          }}
        />
        <CodeField
          label="CMYK"
          value={formatCmyk(rgbToCmyk(rgb))}
          onCommit={(text) => {
            const values = percents(text, 4);
            return values ? setRgb(cmykToRgb({ c: values[0], m: values[1], y: values[2], k: values[3] })) : false;
          }}
        />
      </div>

      <div className="flex flex-col gap-2 sm:col-span-2">
        <span className="text-[13px] text-muted">Shades and tints</span>
        <div className="flex overflow-hidden rounded-lg border border-black/10" role="group" aria-label="Shades and tints">
          {shades.map((shade) => (
            <button
              key={shade}
              type="button"
              aria-label={`Use ${shade}`}
              title={shade}
              className="h-10 flex-1 outline-none transition-transform hover:scale-y-110 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white"
              style={{ backgroundColor: shade }}
              onClick={() => setHex(shade)}
            />
          ))}
        </div>
      </div>

      <div className="grid gap-2 sm:col-span-2 sm:grid-cols-2">
        {[
          { name: "White text", text: "#FFFFFF", ratio: onWhite },
          { name: "Black text", text: "#000000", ratio: onBlack },
        ].map(({ name, text, ratio }) => (
          <div key={name} className="flex items-center justify-between gap-3 rounded-lg px-4 py-3" style={{ backgroundColor: hex, color: text }}>
            <span className="font-[450]">{name}</span>
            <span className="font-mono text-[13px]">
              {ratio.toFixed(2)}:1 · {grade(ratio)}
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

const faq: Faq[] = [
  {
    question: "How do I use the color picker?",
    answer:
      "Drag inside the square to set how strong and how bright the color is, and use the slider under it to change the hue. The HEX, RGB, HSL, HSV, and CMYK codes update as you go, and each has a button to copy it.",
  },
  {
    question: "Is this the Google color picker?",
    answer:
      "No. This is Mesurer's own color picker. It works like the one Google shows when you search for \"color picker\", with a color area, a hue slider, and HEX, RGB, HSL, HSV, and CMYK codes, and adds picking from the screen, shades, and contrast checks.",
  },
  {
    question: "How do I pick a color from an image or another website?",
    answer:
      "In Chrome, Edge, and other Chromium browsers, press \"Pick from screen\" and click any pixel on your screen. To sample colors straight from a live web page along with its spacing and type, use the Mesurer browser extension.",
  },
  {
    question: "What is the difference between HEX, RGB, and HSL?",
    answer:
      "They describe the same color in different ways. RGB gives the red, green, and blue light from 0 to 255. HEX is those three numbers written in base 16, such as #4285F4. HSL gives the hue as an angle with a saturation and a lightness, which is easier to adjust by hand.",
  },
  {
    question: "Can I type in a color code?",
    answer:
      "Yes. Type or paste a code into any of the five fields, for example #FF5733 or rgb(255, 87, 51), and the picker and the other formats follow.",
  },
  {
    question: "What do the contrast numbers mean?",
    answer:
      "They are WCAG contrast ratios between your color and white or black text. A ratio of 4.5:1 or more passes AA for normal text, 3:1 passes AA for large text, and 7:1 passes AAA.",
  },
];

export default function ColorPickerTool() {
  return (
    <ToolPage
      slug="color-picker"
      name="Color picker"
      title="Color Picker: HEX, RGB, HSL, HSV and CMYK Codes | Mesurer"
      description="Free online color picker. Pick any color, or sample one from your screen, and copy its HEX, RGB, HSL, HSV, or CMYK code. A fast alternative to the Google color picker, with shades and contrast."
      heading="Color picker"
      intro="Pick a color, or sample one from anywhere on your screen, and copy its code as HEX, RGB, HSL, HSV, or CMYK. You also get its shades and how it reads against white and black text."
      tool={<Picker />}
      faq={faq}
      cta="The Mesurer browser extension samples the color of any pixel on a live page, and reads the fonts, sizes, and spacing around it, without leaving the tab."
    >
      <Section title="How to pick a color">
        <ol className="m-0 flex list-decimal flex-col gap-1.5 pl-5">
          <li>Move the hue slider to the color family you want: red, green, blue, and everything between.</li>
          <li>Drag in the square. Left to right makes the color stronger, top to bottom makes it darker.</li>
          <li>Copy the code in the format you need, or type a code to start from an existing color.</li>
        </ol>
        <p className="m-0">The address of the page keeps the color you picked, so you can share it as a link.</p>
      </Section>

      <Section title="A Google color picker alternative">
        <p className="m-0">
          Searching Google for "color picker" opens a small widget with a color area, a hue slider, and a handful of codes. This page does the same job and goes a little further:
        </p>
        <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5">
          <li>Every code can be edited, so you can convert between HEX, RGB, HSL, HSV, and CMYK by typing.</li>
          <li>"Pick from screen" samples a pixel from any window, image, or website, in browsers that support it.</li>
          <li>A row of shades and tints gives you lighter and darker versions of the same color.</li>
          <li>Contrast ratios show whether white or black text is readable on it.</li>
        </ul>
      </Section>

      <Section title="Color formats explained">
        <Table
          head={["Format", "Example", "Where it is used"]}
          rows={[
            ["HEX", <code className="code">#4285F4</code>, "CSS, design tools, brand guidelines"],
            ["RGB", <code className="code">rgb(66, 133, 244)</code>, "CSS, screens, image editing"],
            ["HSL", <code className="code">hsl(217, 89%, 61%)</code>, "CSS, building color scales by hand"],
            ["HSV", <code className="code">hsv(217, 73%, 96%)</code>, "Color pickers in design software"],
            ["CMYK", <code className="code">cmyk(73%, 45%, 0%, 4%)</code>, "Print"],
          ]}
        />
        <p className="m-0">
          Need a single conversion? Use the <a href="/tools/rgb-to-hex" className="text-strong underline underline-offset-2">RGB to HEX</a> or <a href="/tools/hex-to-rgb" className="text-strong underline underline-offset-2">HEX to RGB</a> converter.
        </p>
      </Section>
    </ToolPage>
  );
}
