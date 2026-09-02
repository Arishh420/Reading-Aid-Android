/**
 * Content fingerprint — book identity for reading-position persistence.
 *
 * This is NOT a port. The web implementation (`computeFingerprint` in the web
 * repo's src/parsers/index.ts) cannot be ported: it takes a Web `File` and
 * calls `crypto.subtle.digest`, and React Native ships NEITHER `crypto.subtle`
 * NOR `TextEncoder`. Web issue #102 prescribes exactly what is done here
 * instead — "pin the fingerprint algorithm as an explicit, testable
 * specification independent of the Web File API — a pure function over bytes",
 * with a hard-coded-hash conformance test, before any RN implementation.
 *
 * The ALGORITHM is byte-for-byte the web one (issue #102: "the sampling
 * regions, their order, the size suffix encoding, and the digest must be
 * reproduced exactly, not approximately"):
 *
 *   size <= 96 KB : SHA-256 of the whole content.
 *   size >  96 KB : SHA-256 of [ first 32 KB | middle 32 KB | last 32 KB |
 *                   size as 8-byte big-endian ].
 *
 * Only the byte SOURCE and the DIGEST are reimplemented, because those are the
 * two platform-coupled halves. Both are self-contained here:
 *
 *   - `utf8Encode` replaces `TextEncoder`. It matches WHATWG encoding,
 *     including replacing an unpaired surrogate with U+FFFD, and its suite
 *     asserts equality against Node's real `TextEncoder` over a corpus.
 *   - `sha256Hex` replaces `crypto.subtle.digest('SHA-256', …)`. Its suite
 *     asserts the canonical published NIST vectors, so it is anchored to the
 *     standard rather than to itself.
 *
 * `BigInt` is deliberately avoided in the 8-byte size suffix (the web code uses
 * `DataView.setBigUint64`): the two 32-bit halves are computed arithmetically
 * instead, which is exact for any size up to 2^53 and removes one more engine
 * feature from the critical path.
 *
 * KNOWN CROSS-PLATFORM DIVERGENCE — see AD27. Web hashes RAW FILE BYTES; this
 * hashes a STRING re-encoded to UTF-8. Re-encoding itself is faithful, so for
 * the same bytes the two agree exactly (measured). The hazard is one step
 * earlier: the fingerprint is SENSITIVE to a UTF-8 BOM and to CRLF vs LF, so
 * if the two platforms' decode paths differ — one stripping a BOM or
 * normalizing line endings — the same book yields different keys and every
 * saved position is silently lost. Both sensitivities are pinned by the suite.
 */

/** Bytes sampled per region (start / middle / end) above the threshold. */
export const SAMPLE_BYTES = 32 * 1024;
/** At or below this size the whole content is hashed. 96 KB. */
export const FULL_THRESHOLD = SAMPLE_BYTES * 3;

// ─── UTF-8 encoding (replaces TextEncoder) ──────────────────────────────────

/**
 * Encode a JS string to UTF-8 bytes, matching `new TextEncoder().encode()`.
 *
 * Unpaired surrogates become U+FFFD (EF BF BD), as WHATWG requires — encoding
 * them as raw 3-byte sequences instead would make this disagree with every
 * other UTF-8 encoder and quietly change a fingerprint.
 */
export function utf8Encode(text: string): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < text.length; i++) {
    let cp = text.charCodeAt(i);

    if (cp >= 0xd800 && cp <= 0xdbff) {
      // High surrogate — pair it with the following low surrogate if present.
      const lo = i + 1 < text.length ? text.charCodeAt(i + 1) : -1;
      if (lo >= 0xdc00 && lo <= 0xdfff) {
        cp = 0x10000 + ((cp - 0xd800) << 10) + (lo - 0xdc00);
        i++;
      } else {
        cp = 0xfffd;
      }
    } else if (cp >= 0xdc00 && cp <= 0xdfff) {
      // Lone low surrogate.
      cp = 0xfffd;
    }

    if (cp < 0x80) {
      out.push(cp);
    } else if (cp < 0x800) {
      out.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
    } else if (cp < 0x10000) {
      out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    } else {
      out.push(
        0xf0 | (cp >> 18),
        0x80 | ((cp >> 12) & 0x3f),
        0x80 | ((cp >> 6) & 0x3f),
        0x80 | (cp & 0x3f),
      );
    }
  }
  return new Uint8Array(out);
}

// ─── SHA-256 (replaces crypto.subtle.digest) ────────────────────────────────

/** FIPS 180-4 round constants: the first 32 bits of the fractional parts of
 *  the cube roots of the first 64 primes. */
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const HEX = '0123456789abcdef';

function rotr(x: number, n: number): number {
  return ((x >>> n) | (x << (32 - n))) >>> 0;
}

/** SHA-256 of `bytes`, as lowercase hex — the same output shape as the web
 *  implementation's `Array.from(new Uint8Array(hash)).map(...).join('')`. */
export function sha256Hex(bytes: Uint8Array): string {
  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const len = bytes.length;
  // Message + 0x80 + zero padding + 8-byte length, rounded up to whole blocks.
  const total = ((len + 9 + 63) >>> 6) << 6;
  const m = new Uint8Array(total);
  m.set(bytes);
  m[len] = 0x80;

  // 64-bit big-endian BIT length, without BigInt. `len * 8` is exact well past
  // any document size, and >>> 0 takes it modulo 2^32 for the low word.
  const bitHi = Math.floor(len / 536870912); // len * 8 / 2^32
  const bitLo = (len * 8) >>> 0;
  m[total - 8] = (bitHi >>> 24) & 0xff;
  m[total - 7] = (bitHi >>> 16) & 0xff;
  m[total - 6] = (bitHi >>> 8) & 0xff;
  m[total - 5] = bitHi & 0xff;
  m[total - 4] = (bitLo >>> 24) & 0xff;
  m[total - 3] = (bitLo >>> 16) & 0xff;
  m[total - 2] = (bitLo >>> 8) & 0xff;
  m[total - 1] = bitLo & 0xff;

  const w = new Uint32Array(64);

  for (let off = 0; off < total; off += 64) {
    for (let i = 0; i < 16; i++) {
      const j = off + i * 4;
      w[i] = ((m[j] << 24) | (m[j + 1] << 16) | (m[j + 2] << 8) | m[j + 3]) >>> 0;
    }
    for (let i = 16; i < 64; i++) {
      const x = w[i - 15];
      const y = w[i - 2];
      const s0 = (rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3)) >>> 0;
      const s1 = (rotr(y, 17) ^ rotr(y, 19) ^ (y >>> 10)) >>> 0;
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let i = 0; i < 64; i++) {
      const S1 = (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) >>> 0;
      const ch = ((e & f) ^ (~e & g)) >>> 0;
      const t1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) >>> 0;
      const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      const t2 = (S0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  let out = '';
  for (const v of [h0, h1, h2, h3, h4, h5, h6, h7]) {
    for (let s = 28; s >= 0; s -= 4) out += HEX[(v >>> s) & 0xf];
  }
  return out;
}

// ─── The fingerprint itself ─────────────────────────────────────────────────

/** Write `value` as a 64-bit big-endian integer at `offset`. Replaces the web
 *  implementation's `DataView.setBigUint64(offset, BigInt(size), false)`. */
function writeU64BE(target: Uint8Array, offset: number, value: number): void {
  const hi = Math.floor(value / 4294967296);
  const lo = value >>> 0;
  target[offset] = (hi >>> 24) & 0xff;
  target[offset + 1] = (hi >>> 16) & 0xff;
  target[offset + 2] = (hi >>> 8) & 0xff;
  target[offset + 3] = hi & 0xff;
  target[offset + 4] = (lo >>> 24) & 0xff;
  target[offset + 5] = (lo >>> 16) & 0xff;
  target[offset + 6] = (lo >>> 8) & 0xff;
  target[offset + 7] = lo & 0xff;
}

/**
 * The pinned specification issue #102 asks for: the fingerprint as a pure
 * function over bytes, with no platform API anywhere in it.
 */
export function fingerprintBytes(bytes: Uint8Array): string {
  const size = bytes.length;

  if (size <= FULL_THRESHOLD) {
    return sha256Hex(bytes);
  }

  const mid = Math.floor(size / 2);
  const half = SAMPLE_BYTES / 2;

  const combined = new Uint8Array(SAMPLE_BYTES * 3 + 8);
  let offset = 0;
  combined.set(bytes.subarray(0, SAMPLE_BYTES), offset);
  offset += SAMPLE_BYTES;
  combined.set(bytes.subarray(mid - half, mid + half), offset);
  offset += SAMPLE_BYTES;
  combined.set(bytes.subarray(size - SAMPLE_BYTES), offset);
  offset += SAMPLE_BYTES;
  writeU64BE(combined, offset, size);

  return sha256Hex(combined);
}

/**
 * Fingerprint a document that arrived as a string — which, for the MVP, is
 * every document: AD24 ships the seeded sample plus a paste box and no file
 * picker, so there is no `File` to read bytes from.
 */
export function fingerprintText(text: string): string {
  return fingerprintBytes(utf8Encode(text));
}
