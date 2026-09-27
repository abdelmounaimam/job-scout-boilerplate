// Decoder of Glassdoor's React Server Components payload.
//
// Glassdoor is a Next.js App Router site: pages are rendered server side and
// the data arrives INSIDE the HTML, as a flight payload, not through a JSON API.
// Their GraphQL endpoint /graph exists, but introspection is disabled and
// validation errors are masked as "Server error", so no schema can be derived
// from it. The reliable path is therefore: read the page, extract the flight,
// get the JSON out of it. See README.md, section "How it is derived".

/** Glues together the `self.__next_f.push([1,"..."])` chunks of a page. */
export function flightOf(html) {
  const chunks = [];
  const re = /self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    try {
      chunks.push(JSON.parse('"' + m[1] + '"'));
    } catch {
      /* one unreadable chunk must not kill the whole page */
    }
  }
  return chunks.join('');
}

/**
 * Table of the texts moved out of line in the flight.
 *
 * ⚠️ TRAP 1: long texts are not inline. The field reads `"$5e"` and the content
 * lives elsewhere as `5e:T544,<text>`, where `544` is the length in **UTF-8
 * bytes**, not in characters. Slicing on a character length truncates every
 * accented text, so every French or German text.
 *
 * ⚠️ TRAP 2, the one that cost a whole debugging pass: two consecutive text
 * blocks are **NOT separated by a newline**. One reads
 * `...candidate experience.4a:T774,Honestly, my experience...` in one piece. A
 * regex anchored on `^` or `\n` therefore misses one block out of two, silently:
 * the field stays `"$4a"` and the interview account disappears.
 */
export function refsOf(flight) {
  const table = new Map();
  const buf = Buffer.from(flight, 'utf8');
  const re = /([0-9a-f]{1,4}):T([0-9a-f]+),/g;

  // We move forward by scanning, never by anchoring on a newline, and we skip
  // the body of every text consumed. That avoids both traps at once: a glued
  // header is not missed, and a sequence `12:T34,` sitting INSIDE a text is not
  // taken for a header.
  let charPos = 0;
  let bytePos = 0;
  for (;;) {
    re.lastIndex = charPos;
    const m = re.exec(flight);
    if (!m) break;

    const headEnd = m.index + m[0].length;
    bytePos += Buffer.byteLength(flight.slice(charPos, headEnd), 'utf8');
    charPos = headEnd;

    const len = parseInt(m[2], 16);
    const text = buf.slice(bytePos, bytePos + len).toString('utf8');
    table.set(m[1], text);

    bytePos += len;
    charPos += text.length;
  }
  return table;
}

/** Recursively replaces the `"$5e"` references with their text. */
export function resolveRefs(value, table) {
  if (typeof value === 'string') {
    const m = /^\$([0-9a-f]+)$/.exec(value);
    return m && table.has(m[1]) ? table.get(m[1]) : value;
  }
  if (Array.isArray(value)) return value.map((v) => resolveRefs(v, table));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolveRefs(v, table)]));
  }
  return value;
}

/**
 * Slices the balanced JSON value starting at `i` (`{` or `[`), honouring
 * strings and escapes.
 */
export function sliceBalanced(s, i) {
  const open = s[i];
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let j = i; j < s.length; j += 1) {
    const c = s[j];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === open) depth += 1;
    else if (c === close) {
      depth -= 1;
      if (depth === 0) return s.slice(i, j + 1);
    }
  }
  return null;
}

/**
 * Every parsable value carried by `"key":` in the flight.
 *
 * A key appears several times (the flight also carries the description of the
 * render, not only the data), so every valid candidate is returned and the
 * caller chooses. `pick` takes the largest, which in practice is the right one.
 */
export function findValues(flight, key) {
  const out = [];
  const needle = `"${key}":`;
  let from = 0;
  for (;;) {
    const i = flight.indexOf(needle, from);
    if (i === -1) break;
    from = i + needle.length;
    const j = from;
    const c = flight[j];
    if (c !== '{' && c !== '[') continue;
    const raw = sliceBalanced(flight, j);
    if (!raw) continue;
    try {
      out.push(JSON.parse(raw));
    } catch {
      /* a fragment of render description, not data */
    }
  }
  return out;
}

/** The largest parsable value for this key, references resolved. */
export function pick(flight, key, table) {
  const all = findValues(flight, key);
  if (!all.length) return null;
  let best = all[0];
  let bestSize = JSON.stringify(best).length;
  for (const v of all.slice(1)) {
    const size = JSON.stringify(v).length;
    if (size > bestSize) {
      best = v;
      bestSize = size;
    }
  }
  return table ? resolveRefs(best, table) : best;
}

/** Scalar value carried by `"key":` (number, boolean, short string). */
export function pickScalar(flight, key) {
  const m = new RegExp(`"${key}":\\s*(-?[0-9.]+|true|false|null|"[^"]{0,120}")`).exec(flight);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}
