import { getRectFromDom } from "../dom"
import { getAccessibleFrameDocument } from "../document-tree"
import { getElementSelector } from "../selector"
import type { DomContext, DomFingerprint, DomAccessibilityFingerprint, DomTargetId } from "./model"

const MAX_TEXT_LENGTH = 240
const MAX_HTML_LENGTH = 4000

type Root = Document | ShadowRoot

export type DomTargetResolution = {
  status: "attached" | "detached" | "ambiguous"
  confidence: "high" | "medium" | "low"
  element: Element | null
  candidates: number
}

export type DomContextResolution = Record<DomTargetId, DomTargetResolution>

const getElementName = (element: Element) => element.tagName.toLowerCase()

const getElementAttributes = (element: Element) => {
  const attributes: Record<string, string> = {}
  for (const attribute of Array.from(element.attributes)) {
    if (attribute.name.startsWith("on") || attribute.name === "style") continue
    attributes[attribute.name] = attribute.value.slice(0, MAX_TEXT_LENGTH)
  }
  return attributes
}

const getShadowPath = (element: Element) => {
  const path: string[] = []
  let root: Node = element.getRootNode()
  while (root.nodeType === Node.DOCUMENT_FRAGMENT_NODE && "host" in root) {
    const host = (root as ShadowRoot).host
    path.unshift(getElementSelector(host))
    root = host.getRootNode()
  }
  return path
}

const getFramePath = (element: Element) => {
  const path: string[] = []
  const shadowPaths: string[][] = []
  let frame = element.ownerDocument.defaultView?.frameElement
  while (frame) {
    path.unshift(getElementSelector(frame))
    shadowPaths.unshift(getShadowPath(frame))
    frame = frame.ownerDocument.defaultView?.frameElement
  }
  return { path, shadowPaths }
}

const getAccessibility = (element: Element): DomAccessibilityFingerprint | undefined => {
  const role = element.getAttribute("role") ?? undefined
  const label = element.getAttribute("aria-label") ?? undefined
  const name = element.getAttribute("aria-labelledby") ?? undefined
  if (!role && !label && !name) return undefined
  return { role, label, name }
}

const getStyles = (element: Element): Record<string, string> => {
  const style = element.ownerDocument.defaultView?.getComputedStyle(element)
  if (!style) return {}
  return {
    display: style.display,
    position: style.position,
    width: style.width,
    height: style.height,
    padding: style.padding,
    margin: style.margin,
    font: style.font,
    color: style.color,
    background: style.backgroundColor,
  }
}

export const captureDomFingerprint = (element: Element): DomFingerprint => {
  const html = element.outerHTML.replace(/\s+/g, " ").trim()
  const frame = getFramePath(element)
  const text = (element.textContent ?? "").replace(/\s+/g, " ").trim()
  return {
    selector: getElementSelector(element),
    framePath: frame.path,
    frameShadowPaths: frame.shadowPaths,
    shadowPath: getShadowPath(element),
    tagName: getElementName(element),
    ...(element.id ? { id: element.id } : {}),
    attributes: getElementAttributes(element),
    ...(text ? { text: text.slice(0, MAX_TEXT_LENGTH) } : {}),
    ...(html ? { htmlPreview: html.slice(0, MAX_HTML_LENGTH) } : {}),
    accessibility: getAccessibility(element),
    bounds: getRectFromDom(element),
    styles: getStyles(element),
  }
}

export const captureDomContext = (
  targets: Record<DomTargetId, Element | null | undefined>,
): DomContext => ({
  fingerprints: Object.fromEntries(
    Object.entries(targets)
      .filter((entry): entry is [string, Element] => Boolean(entry[1] && entry[1].nodeType === 1))
      .map(([id, element]) => [id, captureDomFingerprint(element)]),
  ),
})

const resolveShadowRoot = (root: Root, selectors: string[]) => {
  let current: Root = root
  for (const selector of selectors) {
    const host = current.querySelector(selector)
    if (!host?.shadowRoot) return null
    current = host.shadowRoot
  }
  return current
}

const resolveFrameDocument = (root: Root, selector: string, shadowPath: string[]) => {
  const frameRoot = resolveShadowRoot(root, shadowPath)
  if (!frameRoot) return null
  const frame = frameRoot.querySelector(selector)
  return frame ? getAccessibleFrameDocument(frame) : null
}

const normalizedText = (value: string | null | undefined) =>
  (value ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_TEXT_LENGTH)

const scoreCandidate = (candidate: Element, fingerprint: DomFingerprint) => {
  if (getElementName(candidate) !== fingerprint.tagName) return -1
  let score = 10
  if (fingerprint.id && candidate.id === fingerprint.id) score += 100

  for (const [name, value] of Object.entries(fingerprint.attributes)) {
    if (candidate.getAttribute(name) === value) score += name.startsWith("data-") ? 25 : 8
  }

  if (fingerprint.text && normalizedText(candidate.textContent) === fingerprint.text) score += 20
  if (fingerprint.htmlPreview && candidate.outerHTML.replace(/\s+/g, " ").trim().startsWith(fingerprint.htmlPreview)) score += 12

  const accessibility = fingerprint.accessibility
  if (accessibility?.role && candidate.getAttribute("role") === accessibility.role) score += 8
  if (accessibility?.label && candidate.getAttribute("aria-label") === accessibility.label) score += 8
  return score
}

export const resolveDomFingerprint = (
  fingerprint: DomFingerprint,
  ownerDocument: Document = document,
): DomTargetResolution => {
  try {
    let targetDocument = ownerDocument
    for (const [index, frameSelector] of (fingerprint.framePath ?? []).entries()) {
      const nextDocument = resolveFrameDocument(
        targetDocument,
        frameSelector,
        fingerprint.frameShadowPaths?.[index] ?? [],
      )
      if (!nextDocument) {
        return { status: "detached", confidence: "low", element: null, candidates: 0 }
      }
      targetDocument = nextDocument
    }

    const root = resolveShadowRoot(targetDocument, fingerprint.shadowPath ?? [])
    if (!root || !fingerprint.selector) {
      return { status: "detached", confidence: "low", element: null, candidates: 0 }
    }

    const candidates = Array.from(root.querySelectorAll(fingerprint.selector))
      .map((element) => ({ element, score: scoreCandidate(element, fingerprint) }))
      .filter((candidate) => candidate.score >= 0)
      .sort((a, b) => b.score - a.score)

    const best = candidates[0]
    if (!best) return { status: "detached", confidence: "low", element: null, candidates: 0 }
    const tied = candidates.filter((candidate) => candidate.score === best.score)
    if (tied.length > 1 && best.score < 35) {
      return { status: "ambiguous", confidence: "low", element: null, candidates: tied.length }
    }

    return {
      status: "attached",
      confidence: best.score >= 100 ? "high" : best.score >= 35 ? "medium" : "low",
      element: best.element,
      candidates: candidates.length,
    }
  } catch {
    return { status: "detached", confidence: "low", element: null, candidates: 0 }
  }
}

export const resolveDomContext = (
  context: DomContext,
  ownerDocument: Document = document,
): DomContextResolution =>
  Object.fromEntries(
    Object.entries(context.fingerprints).map(([id, fingerprint]) => [
      id,
      resolveDomFingerprint(fingerprint, ownerDocument),
    ]),
  )
