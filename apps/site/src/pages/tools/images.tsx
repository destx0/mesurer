import { useEffect, useRef, useState, type DragEvent } from "react";
import ToolPage, { Section, type Faq } from "./layout";
import { Panel } from "./ui";

type Kind = "webp" | "svg";

type Item = {
  id: number;
  file: File;
  // The PNG, once it is made. `null` while it is being made, and `false` when it could not be.
  result: { url: string; width: number; height: number; size: number } | null | false;
};

const SCALES = [1, 2, 3, 4];
// Past this a browser will not draw: its canvas has a largest side.
const LARGEST_SIDE = 16384;

const KINDS: Record<Kind, { accept: string; matches: (file: File) => boolean; noun: string }> = {
  webp: { accept: "image/webp,.webp", matches: (file) => file.type === "image/webp" || /\.webp$/i.test(file.name), noun: "WebP" },
  svg: { accept: "image/svg+xml,.svg", matches: (file) => file.type === "image/svg+xml" || /\.svg$/i.test(file.name), noun: "SVG" },
};

const loadImage = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The image could not be read."));
    image.src = url;
  });

// An SVG says how large it is in its width and height, or failing that its viewBox. It is given
// the size to be drawn at before it is read as an image, so that it is drawn sharp at any scale.
const sizedSvg = async (file: File, scale: number) => {
  const document = new DOMParser().parseFromString(await file.text(), "image/svg+xml");
  const svg = document.documentElement;
  if (svg.nodeName !== "svg") throw new Error("Not an SVG.");
  const length = (name: string) => {
    const value = svg.getAttribute(name) ?? "";
    return /^\s*[\d.]+(px)?\s*$/.test(value) ? Number.parseFloat(value) : null;
  };
  const box = (svg.getAttribute("viewBox") ?? "").trim().split(/[\s,]+/).map(Number);
  const width = length("width") ?? (box.length === 4 && box[2] > 0 ? box[2] : 300);
  const height = length("height") ?? (box.length === 4 && box[3] > 0 ? box[3] : 150);
  if (box.length !== 4) svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("width", String(width * scale));
  svg.setAttribute("height", String(height * scale));
  return new Blob([new XMLSerializer().serializeToString(document)], { type: "image/svg+xml" });
};

const toPng = async (file: File, kind: Kind, scale: number) => {
  const source = URL.createObjectURL(kind === "svg" ? await sizedSvg(file, scale) : file);
  try {
    const image = await loadImage(source);
    const [width, height] = [image.naturalWidth, image.naturalHeight];
    if (!width || !height || Math.max(width, height) > LARGEST_SIDE) throw new Error("The image is too large.");
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d")?.drawImage(image, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("The PNG could not be made.");
    return { url: URL.createObjectURL(blob), width, height, size: blob.size };
  } finally {
    URL.revokeObjectURL(source);
  }
};

const bytes = (size: number) => (size < 1024 * 1024 ? `${Math.max(1, Math.round(size / 1024))} KB` : `${(size / 1024 / 1024).toFixed(1)} MB`);
const pngName = (name: string) => `${name.replace(/\.[^.]+$/, "")}.png`;

function Converter({ kind }: { kind: Kind }) {
  const { accept, matches, noun } = KINDS[kind];
  const [items, setItems] = useState<Item[]>([]);
  const [scale, setScale] = useState(1);
  const [over, setOver] = useState(false);
  const nextId = useRef(0);
  const made = useRef(new Set<string>());

  // Counts the changes of scale, so that a PNG made at a scale since left is not kept.
  const round = useRef(0);

  const convert = (list: Item[], at: number) => {
    const started = round.current;
    for (const item of list) {
      void toPng(item.file, kind, at)
        .then((result) => {
          made.current.add(result.url);
          return result;
        })
        .catch(() => false as const)
        .then((result) => {
          if (started !== round.current) {
            if (result) URL.revokeObjectURL(result.url);
            return;
          }
          setItems((previous) =>
            previous.map((entry) => {
              if (entry.id !== item.id) return entry;
              if (entry.result) URL.revokeObjectURL(entry.result.url);
              return { ...entry, result };
            }),
          );
        });
    }
  };

  const add = (files: Iterable<File>) => {
    const added = [...files].filter(matches).map((file) => ({ id: nextId.current++, file, result: null }));
    if (added.length === 0) return;
    setItems((previous) => [...previous, ...added]);
    convert(added, scale);
  };

  // The PNGs are kept by the browser until they are let go of.
  useEffect(() => {
    const urls = made.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const done = items.filter((item) => item.result);

  return (
    <Panel className="flex flex-col gap-5">
      <label
        className={`flex cursor-pointer flex-col items-center gap-1 rounded-lg border border-dashed px-4 py-10 text-center transition-colors has-[:focus-visible]:border-strong ${
          over ? "border-strong bg-subtle" : "border-neutral-300 hover:bg-subtle"
        }`}
        onDragOver={(event: DragEvent) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event: DragEvent) => {
          event.preventDefault();
          setOver(false);
          add(event.dataTransfer.files);
        }}
      >
        <span className="text-strong">Drop {noun} files here, or click to choose</span>
        <span className="text-[13px] text-muted">Converted in your browser. Nothing is uploaded.</span>
        <input
          type="file"
          accept={accept}
          multiple
          className="sr-only"
          onChange={(event) => {
            add(event.target.files ?? []);
            event.target.value = "";
          }}
        />
      </label>

      {kind === "svg" ? (
        <div className="flex items-center gap-3">
          <span className="text-[13px] text-muted">Scale</span>
          <div className="flex gap-1.5" role="group" aria-label="Scale">
            {SCALES.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={scale === value}
                className={`h-8 rounded-full border px-3 font-mono text-[13px] transition-colors ${
                  scale === value ? "border-strong bg-strong text-bg" : "border-border text-strong hover:bg-subtle"
                }`}
                onClick={() => {
                  round.current += 1;
                  setScale(value);
                  setItems((previous) => previous.map((item) => ({ ...item, result: item.result || null })));
                  convert(items, value);
                }}
              >
                {value}×
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {items.length > 0 ? (
        <ul className="m-0 flex list-none flex-col p-0">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 border-t border-border py-3">
              <span
                className="size-10 shrink-0 rounded-md border border-black/10 bg-contain bg-center bg-no-repeat"
                style={{
                  backgroundImage: `${item.result ? `url(${item.result.url}), ` : ""}repeating-conic-gradient(#e5e5e5 0 25%, #fff 0 50%)`,
                  backgroundSize: "contain, 10px 10px",
                  backgroundRepeat: "no-repeat, repeat",
                }}
                aria-hidden="true"
              />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-strong">{pngName(item.file.name)}</span>
                <span className="text-[13px] text-muted" role="status">
                  {item.result
                    ? `${item.result.width} × ${item.result.height} · ${bytes(item.result.size)}`
                    : item.result === false
                      ? "Could not be converted"
                      : "Converting…"}
                </span>
              </div>
              {item.result ? (
                <a
                  href={item.result.url}
                  download={pngName(item.file.name)}
                  className="inline-flex h-7 shrink-0 items-center rounded-md border border-border px-2.5 text-[13px] text-strong transition-colors hover:bg-subtle"
                >
                  Download
                </a>
              ) : null}
              <button
                type="button"
                aria-label={`Remove ${item.file.name}`}
                className="h-7 shrink-0 rounded-md px-1.5 text-[13px] text-muted transition-colors hover:text-strong"
                onClick={() => setItems((previous) => previous.filter((entry) => entry.id !== item.id))}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {done.length > 1 ? (
        <button
          type="button"
          className="h-9 w-fit rounded-full bg-strong px-4 text-[14px] font-medium text-bg transition-opacity hover:opacity-90"
          onClick={() => {
            for (const item of done) {
              if (!item.result) continue;
              const link = document.createElement("a");
              link.href = item.result.url;
              link.download = pngName(item.file.name);
              link.click();
            }
          }}
        >
          Download all ({done.length})
        </button>
      ) : null}
    </Panel>
  );
}

const webpFaq: Faq[] = [
  {
    question: "How do I convert WebP to PNG?",
    answer: "Drop your WebP files above. Each one is converted right away, and you download the PNG.",
  },
  {
    question: "Are my images uploaded?",
    answer: "No. The conversion happens in your browser. The files never leave your device.",
  },
  {
    question: "Does PNG keep transparency?",
    answer: "Yes. Transparent areas in the WebP stay transparent in the PNG.",
  },
  {
    question: "Does it lose quality?",
    answer: "No. PNG is lossless, so the image is kept exactly as the WebP shows it. The file is usually larger.",
  },
  {
    question: "What about animated WebP?",
    answer: "Only the first frame is converted. PNG does not hold animation.",
  },
];

const svgFaq: Faq[] = [
  {
    question: "How do I convert SVG to PNG?",
    answer: "Drop your SVG files above, pick a scale, and download the PNG.",
  },
  {
    question: "How do I get a larger or sharper PNG?",
    answer: "Raise the scale. An SVG is drawn from shapes, so 2×, 3×, or 4× gives more pixels with no blur.",
  },
  {
    question: "Are my files uploaded?",
    answer: "No. The conversion happens in your browser. The files never leave your device.",
  },
  {
    question: "Is the background transparent?",
    answer: "Yes, unless the SVG draws a background of its own.",
  },
  {
    question: "Why does my SVG look different?",
    answer: "Fonts and images the SVG links to from elsewhere are not loaded. Convert text to outlines and embed images first.",
  },
];

export function WebpToPng() {
  return (
    <ToolPage
      slug="webp-to-png"
      name="WebP to PNG"
      title="WebP to PNG Converter | Mesurer"
      description="Convert WebP to PNG in your browser. Free, no upload, transparency kept. Drop your files and download."
      heading="WebP to PNG converter"
      intro="Drop WebP images and download them as PNG. Nothing is uploaded."
      tool={<Converter kind="webp" />}
      faq={webpFaq}
      cta="Capture and annotate any part of a live page as an image."
    >
      <Section title="WebP and PNG">
        <p className="m-0">
          WebP makes smaller files and is what most websites serve. PNG is lossless and opens everywhere, which makes it the safer choice for editing, slides, and older apps.
        </p>
      </Section>
    </ToolPage>
  );
}

export function SvgToPng() {
  return (
    <ToolPage
      slug="svg-to-png"
      name="SVG to PNG"
      title="SVG to PNG Converter | Mesurer"
      description="Convert SVG to PNG in your browser, at 1× to 4× size. Free, no upload, transparent background kept."
      heading="SVG to PNG converter"
      intro="Drop SVG files and download them as PNG, at any scale. Nothing is uploaded."
      tool={<Converter kind="svg" />}
      faq={svgFaq}
      cta="Capture and annotate any part of a live page as an image."
    >
      <Section title="SVG and PNG">
        <p className="m-0">
          SVG is made of shapes and stays sharp at any size. PNG is made of pixels and works where SVG does not: email, chat, slides, and most upload forms. Pick the scale to match where the PNG will be shown.
        </p>
      </Section>
    </ToolPage>
  );
}
