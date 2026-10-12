import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const extensionRoot = path.resolve(__dirname, "..");
const workspaceRoot = path.resolve(extensionRoot, "..", "..");

const baseManifestPath = path.join(extensionRoot, "manifest.base.json");
const packagePath = path.join(workspaceRoot, "packages", "mesurer", "package.json");
const outputPath = path.join(extensionRoot, "dist", "manifest.json");
const iconsSourceDir = path.join(extensionRoot, "icons");
const iconsOutputDir = path.join(extensionRoot, "dist", "icons");
const packageStylesPath = path.join(workspaceRoot, "packages", "mesurer", "dist", "styles.css");

const [baseManifestRaw, packageRaw] = await Promise.all([
  readFile(baseManifestPath, "utf8"),
  readFile(packagePath, "utf8"),
]);

const baseManifest = JSON.parse(baseManifestRaw);
const pkg = JSON.parse(packageRaw);

// review-capture.js is only built, and only offered to pages, in a build that saves reviews.
const withReview = process.env.MESURER_REVIEW === "1";
const webAccessibleResources = baseManifest.web_accessible_resources.map((entry) => ({
  ...entry,
  resources: entry.resources.filter((resource) => withReview || resource !== "review-capture.js"),
}));

const manifest = {
  ...baseManifest,
  web_accessible_resources: webAccessibleResources,
  name: "Mesurer - Inspect, annotate, and give feedback on any live interface",
  description:
    "Mesurer runs directly where you build. Share feedback with your agents and your team.",
  version: pkg.version,
};

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
await cp(iconsSourceDir, iconsOutputDir, { recursive: true });
await cp(path.join(extensionRoot, "recording-player.html"), path.join(extensionRoot, "dist", "recording-player.html"));
await cp(path.join(extensionRoot, "offscreen.html"), path.join(extensionRoot, "dist", "offscreen.html"));
await cp(packageStylesPath, path.join(extensionRoot, "dist", "mesurer.css"));
