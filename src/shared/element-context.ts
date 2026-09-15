import type { Annotation, Box, Priority } from './types';

const STYLE_PROPERTIES = [
  'display',
  'position',
  'width',
  'height',
  'margin',
  'padding',
  'gap',
  'color',
  'background-color',
  'border',
  'border-radius',
  'font-family',
  'font-size',
  'font-weight',
  'line-height',
  'text-align',
  'opacity',
  'z-index',
] as const;

const STABLE_ATTRIBUTES = ['data-testid', 'data-test', 'data-cy', 'name', 'aria-label'] as const;

function escapeCss(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }
  return value.replace(/(^-?\d)|[^a-zA-Z0-9_-]/g, (match, digit) => digit ? `\\3${digit} ` : `\\${match}`);
}

function uniqueInDocument(selector: string, documentRef: Document): boolean {
  try {
    return documentRef.querySelectorAll(selector).length === 1;
  } catch {
    return false;
  }
}

function usefulClasses(element: Element): string[] {
  return Array.from(element.classList)
    .filter((name) => name.length <= 64 && !/^[a-zA-Z0-9_-]*[0-9a-f]{7,}[a-zA-Z0-9_-]*$/i.test(name))
    .slice(0, 3);
}

function localSegment(element: Element): string {
  const tag = element.tagName.toLowerCase();
  const classes = usefulClasses(element);
  let segment = `${tag}${classes.map((name) => `.${escapeCss(name)}`).join('')}`;
  const parent = element.parentElement;
  if (!parent) return segment;
  const sameTag = Array.from(parent.children).filter((child) => child.tagName === element.tagName);
  if (sameTag.length > 1) segment += `:nth-of-type(${sameTag.indexOf(element) + 1})`;
  return segment;
}

export function createSelector(element: Element, documentRef: Document = document): string {
  if (element.id) {
    const idSelector = `#${escapeCss(element.id)}`;
    if (uniqueInDocument(idSelector, documentRef)) return idSelector;
  }

  for (const attribute of STABLE_ATTRIBUTES) {
    const value = element.getAttribute(attribute);
    if (!value) continue;
    const selector = `[${attribute}="${escapeCss(value)}"]`;
    if (uniqueInDocument(selector, documentRef)) return selector;
  }

  const parts: string[] = [];
  let current: Element | null = element;
  while (current && current !== documentRef.documentElement) {
    parts.unshift(localSegment(current));
    const selector = parts.join(' > ');
    if (uniqueInDocument(selector, documentRef)) return selector;
    current = current.parentElement;
  }
  return parts.join(' > ') || element.tagName.toLowerCase();
}

export function createFullPath(element: Element): string {
  const parts: string[] = [];
  let current: Element | null = element;
  while (current) {
    parts.unshift(localSegment(current));
    current = current.parentElement;
  }
  return parts.join(' > ');
}

function normalizeText(value: string | null | undefined, maxLength = 180): string {
  const normalized = (value ?? '').replace(/\s+/g, ' ').trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}…` : normalized;
}

function implicitRole(element: Element): string {
  const tag = element.tagName.toLowerCase();
  if (tag === 'a' && element.hasAttribute('href')) return 'link';
  if (tag === 'button') return 'button';
  if (tag === 'img') return 'img';
  if (tag === 'textarea') return 'textbox';
  if (tag === 'select') return 'combobox';
  if (tag === 'nav') return 'navigation';
  if (tag === 'main') return 'main';
  if (tag === 'header') return 'banner';
  if (tag === 'footer') return 'contentinfo';
  if (tag === 'input') {
    const type = element.getAttribute('type') ?? 'text';
    if (type === 'checkbox') return 'checkbox';
    if (type === 'radio') return 'radio';
    if (type === 'button' || type === 'submit' || type === 'reset') return 'button';
    return 'textbox';
  }
  return '';
}

function accessibleName(element: Element): string {
  const aria = element.getAttribute('aria-label');
  if (aria) return normalizeText(aria);
  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy) {
    const text = labelledBy
      .split(/\s+/)
      .map((id) => element.ownerDocument.getElementById(id)?.textContent ?? '')
      .join(' ');
    if (text.trim()) return normalizeText(text);
  }
  if (element instanceof HTMLInputElement && element.id) {
    const label = element.ownerDocument.querySelector(`label[for="${escapeCss(element.id)}"]`);
    if (label?.textContent) return normalizeText(label.textContent);
  }
  return normalizeText(element.getAttribute('alt') || element.getAttribute('title') || element.textContent, 100);
}

export function describeAccessibility(element: Element): string {
  const role = element.getAttribute('role') || implicitRole(element) || 'generic';
  const name = accessibleName(element) || '(이름 없음)';
  const states = ['disabled', 'expanded', 'pressed', 'checked', 'selected', 'current']
    .map((key) => [key, element.getAttribute(`aria-${key}`)] as const)
    .filter(([, value]) => value !== null)
    .map(([key, value]) => `${key}=${value}`)
    .join(', ');
  return `role=${role}; name="${name}"${states ? `; ${states}` : ''}`;
}

export function describeComputedStyles(element: Element): string {
  const view = element.ownerDocument.defaultView;
  if (!view) return '';
  const styles = view.getComputedStyle(element);
  return STYLE_PROPERTIES.map((property) => `${property}: ${styles.getPropertyValue(property)};`).join('\n');
}

export function captureElement(element: HTMLElement, comment: string, priority: Priority): Annotation {
  const rect = element.getBoundingClientRect();
  const selection = element.ownerDocument.defaultView?.getSelection()?.toString();
  return {
    id: crypto.randomUUID(),
    url: location.href,
    pageTitle: document.title,
    createdAt: Date.now(),
    comment: comment.trim(),
    priority,
    element: element.tagName.toLowerCase(),
    selector: createSelector(element),
    fullPath: createFullPath(element),
    cssClasses: Array.from(element.classList).join(' '),
    nearbyText: normalizeText(element.textContent),
    selectedText: selection ? normalizeText(selection, 300) : undefined,
    boundingBox: {
      x: Math.round(rect.x),
      y: Math.round(rect.y + window.scrollY),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    },
    accessibility: describeAccessibility(element),
    computedStyles: describeComputedStyles(element),
    targetType: 'element',
  };
}

export function captureRegion(region: Box, comment: string, priority: Priority): Annotation {
  const boundingBox = {
    x: Math.round(region.x),
    y: Math.round(region.y),
    width: Math.round(region.width),
    height: Math.round(region.height),
  };
  const viewportX = boundingBox.x - window.scrollX + boundingBox.width / 2;
  const viewportY = boundingBox.y - window.scrollY + boundingBox.height / 2;
  const anchor = document.elementFromPoint(viewportX, viewportY);
  const anchorElement = anchor instanceof HTMLElement ? anchor : null;

  return {
    id: crypto.randomUUID(),
    url: location.href,
    pageTitle: document.title,
    createdAt: Date.now(),
    comment: comment.trim(),
    priority,
    element: '드래그 영역',
    selector: `영역(x=${boundingBox.x}, y=${boundingBox.y}, width=${boundingBox.width}, height=${boundingBox.height})`,
    fullPath: anchorElement ? createFullPath(anchorElement) : '(영역 중심의 DOM 요소를 찾지 못함)',
    cssClasses: anchorElement ? Array.from(anchorElement.classList).join(' ') : '',
    nearbyText: anchorElement ? normalizeText(anchorElement.textContent) : '사용자가 드래그한 화면 영역',
    boundingBox,
    accessibility: 'role=region; name="사용자가 드래그한 화면 영역"',
    computedStyles: `selection-area: ${boundingBox.width}px × ${boundingBox.height}px;`,
    targetType: 'region',
  };
}

function safeInline(value: string): string {
  return value.replace(/\r?\n/g, ' ').replace(/`/g, '\\`');
}

export function annotationsToMarkdown(annotations: Annotation[]): string {
  const ordered = [...annotations].sort((a, b) => a.createdAt - b.createdAt);
  const sections = ordered.map((annotation, index) => {
    const box = annotation.boundingBox;
    const selectedText = annotation.selectedText ? `\n- 선택 텍스트: \`${safeInline(annotation.selectedText)}\`` : '';
    return `### ${index + 1}. ${annotation.element} — ${annotation.priority}\n\n${annotation.comment}\n\n- Selector: \`${safeInline(annotation.selector)}\`\n- 위치: x=${box.x}, y=${box.y}, width=${box.width}, height=${box.height}\n- 접근성: ${annotation.accessibility}\n- 주변 텍스트: \`${safeInline(annotation.nearbyText)}\`${selectedText}\n\n<details>\n<summary>추가 문맥</summary>\n\n- 전체 경로: \`${safeInline(annotation.fullPath)}\`\n- 클래스: \`${safeInline(annotation.cssClasses || '(없음)')}\`\n\n\`\`\`css\n${annotation.computedStyles}\n\`\`\`\n</details>`;
  });
  const title = ordered[0]?.pageTitle || '웹 페이지';
  const url = ordered[0]?.url || globalThis.location?.href || '';
  return `## UI 피드백: ${title}\n\n페이지: ${url}\n주석 수: ${ordered.length}\n\n${sections.join('\n\n---\n\n')}`;
}
