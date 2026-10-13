import { useState } from "react";
import ToolPage, { Formula, Section, Table, type Faq } from "./layout";
import { CopyCode, NumberField, Output, Panel, useQueryState } from "./ui";

const SIZES = [4, 8, 10, 12, 14, 16, 18, 20, 24, 32, 40, 48, 64, 96];

const toNumber = (text: string) => {
  const value = Number(text.trim().replace(",", "."));
  return text.trim() !== "" && Number.isFinite(value) ? value : null;
};

const trim = (value: number) => String(Number(value.toFixed(4)));

const pxToRemFaq: Faq[] = [
  {
    question: "How do I convert px to rem?",
    answer: "Divide the pixels by the root font size, which is 16px in most browsers. 24px ÷ 16 = 1.5rem.",
  },
  {
    question: "What is 16px in rem?",
    answer: "1rem, when the root font size is the default 16px.",
  },
  {
    question: "Why use rem instead of px?",
    answer: "rem follows the font size the reader set in their browser, so text and spacing scale with it. px does not.",
  },
  {
    question: "What is the difference between rem and em?",
    answer: "rem is relative to the root font size. em is relative to the font size of the element itself.",
  },
];

const remToPxFaq: Faq[] = [
  {
    question: "How do I convert rem to px?",
    answer: "Multiply the rem by the root font size, which is 16px in most browsers. 1.5rem × 16 = 24px.",
  },
  {
    question: "How many pixels is 1rem?",
    answer: "16px, unless the page or the reader changed the root font size.",
  },
  {
    question: "What base should I use?",
    answer: "16, the browser default. Change it only if your CSS sets another font-size on the html element.",
  },
  {
    question: "Is rem the same as em?",
    answer: "No. rem is relative to the root font size. em is relative to the font size of the element itself.",
  },
];

// Both pages are the same converter: either side can be typed, and the page it is on decides
// which comes first and which is the answer.
function Units({ from }: { from: "px" | "rem" }) {
  const [typed, setTyped] = useState<{ unit: "px" | "rem"; value: string }>({ unit: from, value: from === "px" ? "24" : "1.5" });
  const [base, setBase] = useState("16");

  useQueryState({ [typed.unit]: typed.value, base }, (params) => {
    const [px, rem, root] = ["px", "rem", "base"].map((key) => params.get(key));
    if (root && toNumber(root)) setBase(root);
    if (rem && toNumber(rem) !== null) setTyped({ unit: "rem", value: rem });
    else if (px && toNumber(px) !== null) setTyped({ unit: "px", value: px });
  });

  const root = toNumber(base);
  const value = toNumber(typed.value);
  const valid = root !== null && root > 0;
  const solved = valid && value !== null ? trim(typed.unit === "px" ? value / root : value * root) : "";
  const px = typed.unit === "px" ? typed.value : solved;
  const rem = typed.unit === "rem" ? typed.value : solved;
  const to = from === "px" ? "rem" : "px";

  const fields = {
    px: <NumberField key="px" label="PX" min={-100000} max={100000} value={px} onValue={(next) => setTyped({ unit: "px", value: next })} />,
    rem: <NumberField key="rem" label="REM" min={-10000} max={10000} step={0.125} value={rem} onValue={(next) => setTyped({ unit: "rem", value: next })} />,
  };

  const isPx = from === "px";
  return (
    <ToolPage
      slug={isPx ? "px-to-rem" : "rem-to-px"}
      name={isPx ? "PX to REM" : "REM to PX"}
      title={isPx ? "PX to REM Converter | Mesurer" : "REM to PX Converter | Mesurer"}
      description={
        isPx
          ? "Convert pixels to rem for CSS. Type a px value, set your root font size, and copy the rem. Free, with a conversion table."
          : "Convert rem to pixels for CSS. Type a rem value, set your root font size, and copy the px. Free, with a conversion table."
      }
      heading={isPx ? "PX to REM converter" : "REM to PX converter"}
      intro={isPx ? "Type pixels and copy the rem." : "Type rem and copy the pixels."}
      faq={isPx ? pxToRemFaq : remToPxFaq}
      cta="Read the size, spacing, and font size of anything on a live page."
      tool={
        <Panel className="flex flex-col gap-5">
          <div className="flex items-end gap-2">
            {fields[from]}
            <span className="pb-2.5 text-muted" aria-hidden="true">=</span>
            {fields[to]}
            <div className="w-24 shrink-0">
              <NumberField label="Base" min={1} max={1000} value={base} onValue={setBase} aria-invalid={!valid} />
            </div>
          </div>
          {px !== "" && rem !== "" ? (
            <div className="flex flex-col">
              <Output label={to.toUpperCase()} value={to === "rem" ? `${rem}rem` : `${px}px`} />
            </div>
          ) : (
            <p className="m-0 border-t border-border pt-3 text-muted" role="status">Enter a number, and a base above zero.</p>
          )}
        </Panel>
      }
    >
      <Section title="Formula">
        <Formula>{isPx ? `rem = px ÷ base\n24px ÷ 16 = 1.5rem` : `px = rem × base\n1.5rem × 16 = 24px`}</Formula>
      </Section>

      <Section title={isPx ? "PX to REM table" : "REM to PX table"}>
        {valid ? (
          <Table
            head={isPx ? ["Pixels", "REM"] : ["REM", "Pixels"]}
            rows={SIZES.map((size) => {
              const cells = [<CopyCode>{`${size}px`}</CopyCode>, <CopyCode>{`${trim(size / root)}rem`}</CopyCode>];
              return isPx ? cells : cells.reverse();
            })}
          />
        ) : null}
      </Section>
    </ToolPage>
  );
}

export const PxToRem = () => <Units from="px" />;
export const RemToPx = () => <Units from="rem" />;
