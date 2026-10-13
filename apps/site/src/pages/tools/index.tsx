import AspectRatioCalculator from "./aspect-ratio";
import ColorPickerTool from "./color-picker";
import { HexToRgb, RgbToHex } from "./converters";
import { SvgToPng, WebpToPng } from "./images";
import { ToolsHub } from "./layout";
import { PxToRem, RemToPx } from "./units";

export default function ToolsPage({ path }: { path: string }) {
  if (path === "/tools/aspect-ratio-calculator") return <AspectRatioCalculator />;
  if (path === "/tools/color-picker") return <ColorPickerTool />;
  if (path === "/tools/rgb-to-hex") return <RgbToHex />;
  if (path === "/tools/hex-to-rgb") return <HexToRgb />;
  if (path === "/tools/webp-to-png") return <WebpToPng />;
  if (path === "/tools/svg-to-png") return <SvgToPng />;
  if (path === "/tools/px-to-rem") return <PxToRem />;
  if (path === "/tools/rem-to-px") return <RemToPx />;
  return <ToolsHub />;
}
