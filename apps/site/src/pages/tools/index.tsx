import AspectRatioCalculator from "./aspect-ratio";
import ColorPickerTool from "./color-picker";
import { HexToRgb, RgbToHex } from "./converters";
import { AvifToPng, HeicToJpg, ImageToSvg, JpegToJpg, JpgToPng, PngToJpg, SvgToJpg, SvgToPng, WebpToPng } from "./images";
import PaletteGenerator from "./palette";
import { ToolsHub } from "./layout";
import { PxToRem, RemToPx } from "./units";

export default function ToolsPage({ path }: { path: string }) {
  if (path === "/tools/aspect-ratio-calculator") return <AspectRatioCalculator />;
  if (path === "/tools/color-picker") return <ColorPickerTool />;
  if (path === "/tools/rgb-to-hex") return <RgbToHex />;
  if (path === "/tools/hex-to-rgb") return <HexToRgb />;
  if (path === "/tools/webp-to-png") return <WebpToPng />;
  if (path === "/tools/svg-to-png") return <SvgToPng />;
  if (path === "/tools/svg-to-jpg") return <SvgToJpg />;
  if (path === "/tools/png-to-jpg") return <PngToJpg />;
  if (path === "/tools/jpg-to-png") return <JpgToPng />;
  if (path === "/tools/image-to-svg") return <ImageToSvg />;
  if (path === "/tools/heic-to-jpg") return <HeicToJpg />;
  if (path === "/tools/avif-to-png") return <AvifToPng />;
  if (path === "/tools/jpeg-to-jpg") return <JpegToJpg />;
  if (path === "/tools/random-color-palette-generator") return <PaletteGenerator />;
  if (path === "/tools/px-to-rem") return <PxToRem />;
  if (path === "/tools/rem-to-px") return <RemToPx />;
  return <ToolsHub />;
}
