import { resolveStyle, safeDim, safeHref, safeImageSrc, defaultAtoms, type BuilderNode } from '@noidmejs/atomkit';

// The compiler emits STANDALONE React (TSX) — the only runtime dependency of the
// output is React itself. Styles are resolved at compile time (via atomkit's
// whitelist) into literal objects, hrefs/srcs are guarded, and text is emitted as
// JS-string expressions so nothing needs escaping. This is the no-lock-in proof:
// the generated component is plain React you own.
//
// v0.1 scope: static structure + style + a11y + analytics attributes. Dynamic
// concerns (API data-binding, responsive media queries, runtime PII/consent
// gating, the client `video` atom) are runtime features — the compiled output
// covers static/public pages; use the atomkit runtime renderer for the rest.

// Anything the compiler cannot reproduce faithfully is OMITTED and reported via
// `warn` — never emitted as a silent approximation. A compiled page that quietly
// differs from the SSR page is worse than one that tells you what it dropped.

const BOX_TAGS = new Set(['div', 'section', 'header', 'footer', 'main', 'article', 'aside', 'nav', 'ul', 'ol', 'li']);
const TEXT_TAGS = new Set(['p', 'span', 'div', 'small', 'strong', 'em', 'label', 'blockquote']);

// Atoms whose behaviour is inherently runtime-only (client JS). A stand-in <div>
// would silently change the page, so they are dropped and reported instead.
const RUNTIME_ONLY = new Set(['video']);

/** Reported when the compiler cannot reproduce a node faithfully. */
export interface Warning { node: string; type: string; reason: string }
export type Warn = (w: Warning) => void;

// Value coercion MUST match the runtime's or the same document renders
// differently once compiled: AQL yields the string 'false' as often as `false`.
const isFalse = (v: unknown): boolean => v === false || v === 'false';
const isTrue = (v: unknown): boolean => v === true || v === 'true';

// JSON.stringify + escape U+2028/U+2029 (valid in JSON strings but line
// terminators in ES source) so emitted string literals parse on every toolchain.
const j = (v: unknown): string =>
  JSON.stringify(v ?? '').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

// `safeDim` is imported from @noidmejs/atomkit: the runtime and the compiler must
// sanitise dimension props identically, and a second hand-maintained copy here is
// precisely how that guarantee drifts apart.

/** Atom default styles, replicated so compiled output matches the runtime atoms. */
function defaultStyle(node: BuilderNode): Record<string, string | number | undefined> {
  const p = node.props ?? {};
  switch (node.type) {
    case 'section':
      return { paddingTop: '72px', paddingBottom: '72px' };
    case 'stack':
      return { display: 'flex', flexDirection: 'column', gap: '12px' };
    case 'row':
      return { display: 'flex', flexDirection: 'row', gap: '16px', flexWrap: isFalse(p.wrap) ? 'nowrap' : 'wrap', alignItems: 'center' };
    case 'grid': {
      const cols = Math.min(24, Math.max(0, Math.round(Number(p.cols)) || 0));
      const min = p.min ? safeDim(p.min, '') : '';
      const template = min ? `repeat(auto-fit,minmax(${min},1fr))` : cols ? `repeat(${cols},minmax(0,1fr))` : '';
      const s: Record<string, string> = { display: 'grid', gap: '16px' };
      if (template) s.gridTemplateColumns = template;
      return s;
    }
    case 'container':
      return { maxWidth: safeDim(p.width, '1200px'), marginLeft: 'auto', marginRight: 'auto', paddingLeft: safeDim(p.gutter, '20px'), paddingRight: safeDim(p.gutter, '20px') };
    case 'chip':
      return { display: 'inline-block', borderRadius: '999px', padding: '4px 12px', fontSize: '12px', fontWeight: 700 };
    // The runtime List is a marker-less flex column, not a native bulleted <ul>.
    // Emitting the browser default here made the compiled page look different AND
    // dropped the WCAG 1.3.1 list-role restoration that 0.5.0 added.
    case 'list':
      return { display: 'flex', flexDirection: 'column', gap: '8px', listStyle: p.marker ? undefined : 'none', margin: 0, padding: 0 };
    default:
      return {};
  }
}

function tagFor(node: BuilderNode): string {
  const p = node.props ?? {};
  const as = typeof p.as === 'string' ? p.as : '';
  switch (node.type) {
    case 'box': return BOX_TAGS.has(as) ? as : 'div';
    case 'text': return TEXT_TAGS.has(as) ? as : 'p';
    case 'heading': return `h${Math.min(6, Math.max(1, Math.round(Number(p.level)) || 2))}`;
    case 'chip': return 'span';
    default: return 'div';
  }
}

function attrs(node: BuilderNode): string {
  const out: Record<string, unknown> = {};
  const a = node.a11y;
  if (a) {
    if (a.role) out.role = a.role;
    if (a.ariaLabel) out['aria-label'] = a.ariaLabel;
    if (a.ariaHidden) out['aria-hidden'] = true;
    if (a.ariaDescribedby) out['aria-describedby'] = a.ariaDescribedby;
    if (typeof a.tabIndex === 'number') out.tabIndex = a.tabIndex;
    if (a.lang) out.lang = a.lang;
  }
  const an = node.meta?.analytics;
  if (an) {
    if (an.id) out['data-analytics-id'] = an.id;
    if (an.event) out['data-analytics-event'] = an.event;
    if (an.category) out['data-analytics-category'] = an.category;
  }
  const parts = Object.entries(out).map(([k, v]) => (v === true ? k : `${k}={${j(v)}}`));
  return parts.length ? ' ' + parts.join(' ') : '';
}

function styleAttr(node: BuilderNode): string {
  const style = { ...defaultStyle(node), ...(resolveStyle(node.style) as Record<string, unknown>) };
  for (const k of Object.keys(style)) if (style[k] === undefined) delete style[k];
  return Object.keys(style).length ? ` style={${JSON.stringify(style)}}` : '';
}

const text = (node: BuilderNode): string => (node.props?.text == null ? '' : String(node.props.text));

/** Emit one node (+ subtree) as JSX source at the given indent. Returns '' when
 *  the node cannot be compiled faithfully (reported through `warn`). */
export function emitNode(node: BuilderNode, indent: string, warn: Warn = () => {}): string {
  // Fail CLOSED on an unknown atom, exactly as the runtime renderer does
  // (renderNode returns null). Emitting a generic <div> carrying the node's text
  // meant an unregistered/custom atom silently rendered as raw content in the
  // compiled build while rendering as nothing under SSR.
  if (!Object.hasOwn(defaultAtoms, node.type)) {
    warn({ node: node.id, type: node.type, reason: 'unknown atom type — omitted (the runtime renderer also renders nothing)' });
    return '';
  }
  if (RUNTIME_ONLY.has(node.type)) {
    warn({ node: node.id, type: node.type, reason: 'runtime-only atom (needs client JS) — omitted from compiled output' });
    return '';
  }
  // Report, rather than silently discard, the dynamic features static TSX can't carry.
  if (node.style?.responsive) warn({ node: node.id, type: node.type, reason: 'responsive overrides (sm:/md:/lg:) are not emitted — base styles only' });
  if (node.data) warn({ node: node.id, type: node.type, reason: 'data binding is not emitted — the compiled component renders the authored fallback, it does NOT fetch' });

  const s = styleAttr(node);
  const a = attrs(node);
  const emitKids = (ind: string): string[] => (node.children ?? []).map((c) => emitNode(c, ind, warn)).filter(Boolean);
  const kids = emitKids(indent + '  ').join('\n');
  const child = indent + '  ';

  switch (node.type) {
    case 'image': {
      const src = safeImageSrc(node.props?.src) ?? '';
      const alt = String(node.a11y?.alt ?? node.props?.alt ?? '');
      return `${indent}<img src={${j(src)}} alt={${j(alt)}} loading="lazy"${s}${a} />`;
    }
    case 'divider':
      return `${indent}<hr${s}${a} />`;
    case 'spacer':
      return `${indent}<div style={${JSON.stringify({ height: safeDim(node.props?.height, '24px') })}} aria-hidden />`;
    case 'icon': {
      const d = String(node.props?.path ?? '');
      if (!/^[\dMLHVCSQTAZmlhvcsqtaz\s.,-]+$/.test(d)) return `${indent}<span${a} />`;
      const size = String(node.props?.size ?? '24');
      const iconA11y = node.a11y?.ariaLabel ? ' role="img"' : ' aria-hidden';
      return `${indent}<svg width={${j(size)}} height={${j(size)}} viewBox={${j(String(node.props?.viewBox ?? '0 0 24 24'))}} fill="none" stroke="currentColor" strokeWidth={2}${s}${a}${iconA11y}><path d={${j(d)}} strokeLinecap="round" strokeLinejoin="round" /></svg>`;
    }
    case 'button': {
      const label = text(node) || 'Button';
      if (node.props?.href != null) {
        const ext = node.props.external ? ' target="_blank" rel="noopener noreferrer"' : '';
        return `${indent}<a href={${j(safeHref(node.props.href))}}${ext}${s}${a}>{${j(label)}}</a>`;
      }
      return `${indent}<button type="button"${s}${a}>{${j(label)}}</button>`;
    }
    case 'link': {
      const ext = node.props?.external ? ' target="_blank" rel="noopener noreferrer"' : '';
      return `${indent}<a href={${j(safeHref(node.props?.href))}}${ext}${s}${a}>{${j(text(node) || 'link')}}</a>`;
    }
    case 'list': {
      // Mirror the runtime List: `ordered`/`marker` accept the string forms AQL
      // produces, and removing markers strips the list role in Safari/VoiceOver —
      // so role="list"/"listitem" are restored explicitly (WCAG 1.3.1).
      const tag = isTrue(node.props?.ordered) ? 'ol' : 'ul';
      const noMarker = !node.props?.marker;
      const li = noMarker ? '<li role="listitem">' : '<li>';
      const items = emitKids(child + '  ')
        .map((emitted) => `${child}${li}\n${emitted}\n${child}</li>`)
        .join('\n');
      const role = noMarker ? ' role="list"' : '';
      return `${indent}<${tag}${role}${s}${a}>\n${items}\n${indent}</${tag}>`;
    }
    case 'accordion-item': {
      const summary = String(node.props?.summary ?? node.props?.text ?? 'Details');
      return `${indent}<details${s}${a}>\n${child}<summary style={{ cursor: 'pointer' }}>{${j(summary)}}</summary>\n${kids}\n${indent}</details>`;
    }
    case 'section': {
      const contain = !isFalse(node.props?.contain);
      const inner = contain
        ? `${child}<div style={${JSON.stringify({ maxWidth: safeDim(node.props?.width, '1200px'), marginLeft: 'auto', marginRight: 'auto', paddingLeft: safeDim(node.props?.gutter, '20px'), paddingRight: safeDim(node.props?.gutter, '20px') })}}>\n${emitKids(child + '  ').join('\n')}\n${child}</div>`
        : kids;
      return `${indent}<section${s}${a}>\n${inner}\n${indent}</section>`;
    }
  }

  // Generic element: text (as a JS-string child) then children.
  const tag = tagFor(node);
  const t = text(node);
  const body = [t ? `${child}{${j(t)}}` : '', kids].filter(Boolean).join('\n');
  if (!body) return `${indent}<${tag}${s}${a} />`;
  return `${indent}<${tag}${s}${a}>\n${body}\n${indent}</${tag}>`;
}
