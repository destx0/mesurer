// Mesurer's mark. A copy of the one the toolbar draws: shared, the two would be split into a
// file of their own that every build then has to carry along.
const MESURER_MARK_VIEW_BOX = "0 0 166 97"
const MESURER_MARK_PATHS = [
  "M139.984 89C139.984 93.4183 143.568 97 147.989 97H157.995C162.416 97 166 93.4183 166 89V8C166 3.58172 162.416 0 157.995 0H146.738C144.48 0 142.44 0.934578 140.984 2.43784L61.2109 83.5171C59.8618 84.949 59.0352 86.878 59.0352 89C59.0352 93.4183 62.619 97 67.04 97H80.6483C82.8287 97 84.8055 96.1288 86.2492 94.7156L131.748 49.2462C132.477 48.4786 133.508 48 134.651 48H135.981C138.192 48 139.984 49.7909 139.984 52V89Z",
  "M0 89C0 93.4183 3.58388 97 8.00483 97H21.6131C23.7935 97 25.7704 96.1288 27.214 94.7156L72.7125 49.2462L104.62 17.3584C106.121 15.858 106.964 13.8224 106.964 11.6999V8C106.964 3.58172 103.381 0 98.9596 0H87.7028C85.4445 0 83.4046 0.934578 81.9493 2.43784L2.1757 83.5171C0.826663 84.949 0 86.878 0 89Z",
]

const SVG = "http://www.w3.org/2000/svg"

// What the tab a review will open in shows while the review is made: Mesurer's mark, and that
// both it and the page being saved are to be left open. It is built node by node and styled
// from script, since the tab starts as a blank page of the site being saved, whose own rules
// may refuse markup and styles written into it.
export const showReviewLoading = (view: Window) => {
  try {
    const page = view.document
    const dark = view.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false
    page.title = "Saving review… · Mesurer"
    page.body.style.cssText = `margin:0;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;font:14px/1.5 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;text-align:center;background:${dark ? "#18181b" : "#fafafa"};color:${dark ? "#fafafa" : "#18181b"}`

    const mark = page.createElementNS(SVG, "svg")
    mark.setAttribute("viewBox", MESURER_MARK_VIEW_BOX)
    mark.setAttribute("width", "56")
    mark.setAttribute("fill", "currentColor")
    mark.setAttribute("aria-hidden", "true")
    mark.style.marginBottom = "14px"
    for (const d of MESURER_MARK_PATHS) {
      const path = page.createElementNS(SVG, "path")
      path.setAttribute("d", d)
      mark.append(path)
    }
    // It breathes, to show that something is going on.
    mark.animate?.([{ opacity: 1 }, { opacity: 0.35 }, { opacity: 1 }], { duration: 1600, iterations: Infinity, easing: "ease-in-out" })

    const title = page.createElement("div")
    title.textContent = "Saving your review…"
    title.style.cssText = "font-size:16px;font-weight:500"
    const detail = page.createElement("div")
    detail.textContent = "This can take a moment. Don't close this window, or the page you are saving: the review opens here when it is ready."
    detail.style.cssText = `max-width:340px;padding:0 24px;color:${dark ? "#a1a1aa" : "#64748b"}`

    page.body.replaceChildren(mark, title, detail)
  } catch {
    // Left blank where the new tab cannot be written to.
  }
}
