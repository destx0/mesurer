// Turns a picture made of pixels into SVG shapes: its colours are brought down to a few, and
// the outline of each patch of one colour becomes a path.

type Rgb = [number, number, number];

// Brings the colours down to `count`, by k-means from an even spread over the picture's
// brightness. Gives the colours, and for each pixel which of them it is (-1 where see-through).
const quantize = (data: Uint8ClampedArray, width: number, height: number, count: number) => {
  const total = width * height;
  const step = Math.max(1, Math.floor(total / 20000));
  const samples: Rgb[] = [];
  for (let index = 0; index < total; index += step) {
    const at = index * 4;
    if (data[at + 3] >= 128) samples.push([data[at], data[at + 1], data[at + 2]]);
  }
  const index = new Int16Array(total).fill(-1);
  if (samples.length === 0) return { palette: [] as Rgb[], index };

  // They start as far from each other as the picture's colours go: the first is its average,
  // and each one after is the colour farthest from those already taken. A colour that covers
  // little of the picture, such as the white of a small mark, is then still one of them.
  const mean = samples.reduce((sum, [r, g, b]) => [sum[0] + r, sum[1] + g, sum[2] + b], [0, 0, 0]).map((value) => value / samples.length) as Rgb;
  let palette: Rgb[] = [mean];
  const apart = new Float64Array(samples.length).fill(Infinity);
  while (palette.length < count) {
    const [lr, lg, lb] = palette[palette.length - 1];
    let farthest = 0;
    for (let at = 0; at < samples.length; at += 1) {
      const [r, g, b] = samples[at];
      apart[at] = Math.min(apart[at], (r - lr) ** 2 + (g - lg) ** 2 + (b - lb) ** 2);
      if (apart[at] > apart[farthest]) farthest = at;
    }
    if (apart[farthest] === 0) break;
    palette.push([...samples[farthest]]);
  }
  const nearest = (r: number, g: number, b: number) => {
    let best = 0;
    let distance = Infinity;
    for (let at = 0; at < palette.length; at += 1) {
      const [pr, pg, pb] = palette[at];
      const d = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
      if (d < distance) {
        distance = d;
        best = at;
      }
    }
    return best;
  };
  for (let pass = 0; pass < 8; pass += 1) {
    const sums = palette.map(() => [0, 0, 0, 0]);
    for (const [r, g, b] of samples) {
      const sum = sums[nearest(r, g, b)];
      sum[0] += r;
      sum[1] += g;
      sum[2] += b;
      sum[3] += 1;
    }
    palette = palette.map((color, at) => {
      const [r, g, b, n] = sums[at];
      return n ? [r / n, g / n, b / n] : color;
    });
  }
  // Colours that came out the same are one colour.
  palette = palette
    .map(([r, g, b]) => [Math.round(r), Math.round(g), Math.round(b)] as Rgb)
    .filter((color, at, all) => all.findIndex((other) => other.join() === color.join()) === at);

  for (let pixel = 0; pixel < total; pixel += 1) {
    const at = pixel * 4;
    if (data[at + 3] >= 128) index[pixel] = nearest(data[at], data[at + 1], data[at + 2]);
  }
  return { palette, index };
};

// The outlines of every patch of one colour, each a closed loop of corner points. A patch's
// outer edge goes one way round and its holes the other, so the holes stay empty when filled.
const outlines = (index: Int16Array, width: number, height: number, color: number) => {
  const stride = width + 1;
  // From each corner point, the corner points an edge of this colour leads to. No point has
  // more than two.
  const next = new Map<number, number[]>();
  const edge = (from: number, to: number) => {
    const list = next.get(from);
    if (list) list.push(to);
    else next.set(from, [to]);
  };
  const is = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height && index[y * width + x] === color;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (index[y * width + x] !== color) continue;
      const [a, b, c, d] = [y * stride + x, y * stride + x + 1, (y + 1) * stride + x + 1, (y + 1) * stride + x];
      if (!is(x, y - 1)) edge(a, b);
      if (!is(x + 1, y)) edge(b, c);
      if (!is(x, y + 1)) edge(c, d);
      if (!is(x - 1, y)) edge(d, a);
    }
  }
  const loops: number[][] = [];
  for (const start of next.keys()) {
    let list = next.get(start);
    while (list && list.length > 0) {
      const loop: number[] = [];
      let at = start;
      let from = -1;
      do {
        loop.push(at % stride, Math.floor(at / stride));
        const out: number[] = next.get(at)!;
        // Where two patches touch only at a corner, the outline turns right, towards the
        // patch it is going round, so that each is outlined on its own.
        const [dx, dy] = [(at % stride) - (from % stride), Math.floor(at / stride) - Math.floor(from / stride)];
        const right = at + dx * stride - dy;
        const pick = out.length > 1 && from >= 0 && out.includes(right) ? out.indexOf(right) : out.length - 1;
        from = at;
        at = out.splice(pick, 1)[0];
      } while (at !== start);
      loops.push(loop);
      list = next.get(start);
    }
  }
  return loops;
};

const area = (loop: number[]) => {
  let sum = 0;
  for (let at = 0; at < loop.length; at += 2) {
    const to = (at + 2) % loop.length;
    sum += loop[at] * loop[to + 1] - loop[to] * loop[at + 1];
  }
  return sum / 2;
};

// Leaves out the points a line can do without: those within `tolerance` of the line between
// the points kept on either side of them.
const simplify = (loop: number[], tolerance: number) => {
  const count = loop.length / 2;
  if (count <= 4) return loop;
  // A loop has no ends: it is cut at its first point and at the point farthest from it.
  let far = 0;
  let farthest = -1;
  for (let at = 1; at < count; at += 1) {
    const d = (loop[at * 2] - loop[0]) ** 2 + (loop[at * 2 + 1] - loop[1]) ** 2;
    if (d > farthest) {
      farthest = d;
      far = at;
    }
  }
  const keep = new Uint8Array(count + 1);
  keep[0] = keep[far] = keep[count] = 1;
  const x = (at: number) => loop[(at % count) * 2];
  const y = (at: number) => loop[(at % count) * 2 + 1];
  const stack = [0, far, far, count];
  while (stack.length > 0) {
    const to = stack.pop()!;
    const from = stack.pop()!;
    const [dx, dy] = [x(to) - x(from), y(to) - y(from)];
    const length = Math.hypot(dx, dy) || 1;
    let worst = -1;
    let most = tolerance;
    for (let at = from + 1; at < to; at += 1) {
      const d = Math.abs(dy * (x(at) - x(from)) - dx * (y(at) - y(from))) / length;
      if (d > most) {
        most = d;
        worst = at;
      }
    }
    if (worst < 0) continue;
    keep[worst] = 1;
    stack.push(from, worst, worst, to);
  }
  const kept: number[] = [];
  for (let at = 0; at < count; at += 1) if (keep[at]) kept.push(loop[at * 2], loop[at * 2 + 1]);
  return kept;
};

const number = (value: number) => String(Math.round(value * 10) / 10);

// A loop as a path. It runs through the middle of each side, curving round the points between,
// except where the outline turns sharply: there it goes to the point, to keep the corner.
const toPath = (loop: number[]) => {
  const count = loop.length / 2;
  if (count < 3) return "";
  const x = (at: number) => loop[((at + count) % count) * 2];
  const y = (at: number) => loop[((at + count) % count) * 2 + 1];
  let path = `M${number((x(0) + x(1)) / 2)} ${number((y(0) + y(1)) / 2)}`;
  for (let at = 1; at <= count; at += 1) {
    const [ax, ay, bx, by] = [x(at) - x(at - 1), y(at) - y(at - 1), x(at + 1) - x(at), y(at + 1) - y(at)];
    const cos = (ax * bx + ay * by) / ((Math.hypot(ax, ay) || 1) * (Math.hypot(bx, by) || 1));
    const mid = `${number((x(at) + x(at + 1)) / 2)} ${number((y(at) + y(at + 1)) / 2)}`;
    path += cos < 0.3 ? `L${number(x(at))} ${number(y(at))}L${mid}` : `Q${number(x(at))} ${number(y(at))} ${mid}`;
  }
  return `${path}Z`;
};

const hex = ([r, g, b]: Rgb) => `#${[r, g, b].map((value) => value.toString(16).padStart(2, "0")).join("")}`;

/**
 * Traces a picture into an SVG of at most `colors` colours. `width` and `height` are those of
 * the pixels given; `size` is how large the SVG says it is, when the pixels were scaled down.
 */
export const traceToSvg = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  colors: number,
  size: { width: number; height: number } = { width, height },
) => {
  const { palette, index } = quantize(data, width, height, colors);
  const layers = palette
    .map((color, at) => {
      // Specks are left out, and each patch is cut to a few points.
      const loops = outlines(index, width, height, at).filter((loop) => Math.abs(area(loop)) >= 4);
      const covered = loops.reduce((sum, loop) => sum + area(loop), 0);
      const d = loops
        .map((loop) => {
          // A patch one pixel across comes down to a single line, which is no shape: it is
          // kept as it was.
          const fewer = simplify(loop, 0.9);
          return toPath(fewer.length >= 6 ? fewer : loop);
        })
        .join("");
      return { color: hex(color), d, covered: Math.abs(covered) };
    })
    .filter((layer) => layer.d)
    // The largest first, with a fine line round each in its own colour, so that no gap shows
    // where two patches meet.
    .sort((a, b) => b.covered - a.covered);
  const paths = layers
    .map(({ color, d }) => `<path fill="${color}" stroke="${color}" stroke-width="0.6" fill-rule="evenodd" d="${d}"/>`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}" height="${size.height}" viewBox="0 0 ${width} ${height}">${paths}</svg>`;
};
