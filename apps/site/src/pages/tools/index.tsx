import AspectRatioCalculator from "./aspect-ratio";
import ColorPickerTool from "./color-picker";
import { HexToRgb, RgbToHex } from "./converters";
import { ToolsHub } from "./layout";

export default function ToolsPage({ path }: { path: string }) {
  if (path === "/tools/aspect-ratio-calculator") return <AspectRatioCalculator />;
  if (path === "/tools/color-picker") return <ColorPickerTool />;
  if (path === "/tools/rgb-to-hex") return <RgbToHex />;
  if (path === "/tools/hex-to-rgb") return <HexToRgb />;
  return <ToolsHub />;
}
