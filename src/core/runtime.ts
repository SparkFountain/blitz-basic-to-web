export const rt = (() => {
  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let fg = { r: 255, g: 255, b: 255 };
  let lastFlip = performance.now();
  let keys = new Set<number>();
  let mouse = { x: 0, y: 0 };

  function ensure() {
    if (!canvas || !ctx) throw new Error("Graphics not initialized");
  }

  function Graphics(w: number, h: number, depth?: number) {
    canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    document.body.appendChild(canvas);
    const c = canvas.getContext("2d");
    if (!c) throw new Error("ctx");
    ctx = c;
    window.addEventListener("mousemove", (e) => {
      if (!canvas) return;
      const r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
    });
    window.addEventListener("keydown", (e) => keys.add(e.keyCode));
    window.addEventListener("keyup", (e) => keys.delete(e.keyCode));
  }
  function Cls() {
    ensure();
    ctx!.fillStyle = `rgb(0,0,0)`;
    ctx!.fillRect(0, 0, canvas!.width, canvas!.height);
  }
  function Color(r: number, g: number, b: number) {
    fg = { r, g, b };
    if (ctx) ctx.strokeStyle = ctx.fillStyle = `rgb(${r},${g},${b})`;
  }
  function Plot(x: number, y: number) {
    ensure();
    ctx!.fillRect(x | 0, y | 0, 1, 1);
  }
  function Line(x1: number, y1: number, x2: number, y2: number) {
    ensure();
    ctx!.beginPath();
    ctx!.moveTo(x1, y1);
    ctx!.lineTo(x2, y2);
    ctx!.stroke();
  }
  function Rect(x: number, y: number, w: number, h: number, solid: number = 0) {
    ensure();
    if (solid) {
      ctx!.fillRect(x, y, w, h);
    } else {
      ctx!.strokeRect(x, y, w, h);
    }
  }
  function Oval(x: number, y: number, w: number, h: number, solid: number = 0) {
    ensure();
    ctx!.beginPath();
    ctx!.ellipse(
      x + w / 2,
      y + h / 2,
      Math.abs(w / 2),
      Math.abs(h / 2),
      0,
      0,
      Math.PI * 2
    );
    if (solid) ctx!.fill();
    else ctx!.stroke();
  }
  function Text(x: number, y: number, s: string) {
    ensure();
    ctx!.fillText(String(s), x, y);
  }
  function Flip() {
    /* noop: immediate mode; könnte später Double-Buffering/Timing machen */ lastFlip =
      performance.now();
  }

  function MilliSecs() {
    return Math.floor(performance.now());
  }
  function KeyDown(code: number) {
    return keys.has(code) ? 1 : 0;
  }
  function MouseX() {
    return mouse.x | 0;
  }
  function MouseY() {
    return mouse.y | 0;
  }

  // RNG kompatibel-ish
  let _seed = 1234567;
  function SeedRnd(s: number) {
    _seed = (s | 0) >>> 0;
  }
  function Rnd(a: number, b?: number) {
    // LCG
    _seed = (1664525 * _seed + 1013904223) >>> 0;
    const u = _seed / 0xffffffff;
    if (b === undefined) return u * a;
    else return a + u * (b - a);
  }

  return {
    Graphics,
    Cls,
    Color,
    Plot,
    Line,
    Rect,
    Oval,
    Text,
    Flip,
    MilliSecs,
    KeyDown,
    MouseX,
    MouseY,
    Rnd,
    SeedRnd,
  };
})();
