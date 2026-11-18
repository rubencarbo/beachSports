// Descompresor zlib/DEFLATE mínimo (los recursos van incrustados comprimidos; en la consola no hay zlib ni Image()).
const LBASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
const LEXT = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
const DBASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
const DEXT = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
const CLORD = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

interface Huff { count: Uint16Array; sym: Uint16Array }
function build(lens: Uint8Array, n: number): Huff {
  const count = new Uint16Array(16), sym = new Uint16Array(n), offs = new Uint16Array(16);
  for (let i = 0; i < n; i++) count[lens[i]]++;
  count[0] = 0;
  for (let i = 1; i < 16; i++) offs[i] = offs[i - 1] + count[i - 1];
  for (let i = 0; i < n; i++) if (lens[i]) sym[offs[lens[i]]++] = i;
  return { count, sym };
}

export function inflate(src: Uint8Array, outSize: number): Uint8Array {
  const out = new Uint8Array(outSize);
  let pos = 2, bit = 0, buf = 0, op = 0; // salta la cabecera zlib (2 bytes)
  const bits = (n: number) => {
    while (bit < n) { buf |= src[pos++] << bit; bit += 8; }
    const v = buf & ((1 << n) - 1); buf >>>= n; bit -= n; return v;
  };
  const decode = (h: Huff) => {
    let code = 0, first = 0, index = 0;
    for (let len = 1; len < 16; len++) {
      code |= bits(1);
      const c = h.count[len];
      if (code - c < first) return h.sym[index + (code - first)];
      index += c; first += c; first <<= 1; code <<= 1;
    }
    throw new Error('inflate: código no válido');
  };
  // tablas fijas
  const fl = new Uint8Array(288);
  for (let i = 0; i < 144; i++) fl[i] = 8; for (let i = 144; i < 256; i++) fl[i] = 9; for (let i = 256; i < 280; i++) fl[i] = 7; for (let i = 280; i < 288; i++) fl[i] = 8;
  const fixL = build(fl, 288), fd = new Uint8Array(30).fill(5), fixD = build(fd, 30);
  let last = 0;
  while (!last) {
    last = bits(1);
    const type = bits(2);
    if (type === 0) {
      buf = 0; bit = 0;
      const len = src[pos] | (src[pos + 1] << 8); pos += 4;
      out.set(src.subarray(pos, pos + len), op); pos += len; op += len;
      continue;
    }
    let L = fixL, D = fixD;
    if (type === 2) {
      const hl = bits(5) + 257, hd = bits(5) + 1, hc = bits(4) + 4;
      const cl = new Uint8Array(19);
      for (let i = 0; i < hc; i++) cl[CLORD[i]] = bits(3);
      const ch = build(cl, 19);
      const lens = new Uint8Array(hl + hd);
      for (let i = 0; i < hl + hd;) {
        const s = decode(ch);
        if (s < 16) lens[i++] = s;
        else if (s === 16) { const p = lens[i - 1]; for (let r = 3 + bits(2); r > 0; r--) lens[i++] = p; }
        else if (s === 17) i += 3 + bits(3);
        else i += 11 + bits(7);
      }
      L = build(lens.subarray(0, hl), hl); D = build(lens.subarray(hl), hd);
    }
    for (;;) {
      const s = decode(L);
      if (s < 256) out[op++] = s;
      else if (s === 256) break;
      else {
        const li = s - 257, len = LBASE[li] + bits(LEXT[li]);
        const di = decode(D), dist = DBASE[di] + bits(DEXT[di]);
        for (let k = 0; k < len; k++) { out[op] = out[op - dist]; op++; }
      }
    }
  }
  return out;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64I = new Uint8Array(128);
for (let i = 0; i < 64; i++) B64I[B64.charCodeAt(i)] = i;
export function b64(s: string): Uint8Array {
  let n = s.length; while (s[n - 1] === '=') n--;
  const out = new Uint8Array((n * 3) >> 2);
  let o = 0;
  for (let i = 0; i < n; i += 4) {
    const a = B64I[s.charCodeAt(i)], b = B64I[s.charCodeAt(i + 1)], c = B64I[s.charCodeAt(i + 2)] || 0, d = B64I[s.charCodeAt(i + 3)] || 0;
    const v = (a << 18) | (b << 12) | (c << 6) | d;
    out[o++] = v >> 16; if (o < out.length) out[o++] = (v >> 8) & 255; if (o < out.length) out[o++] = v & 255;
  }
  return out;
}
