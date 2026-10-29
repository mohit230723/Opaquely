'use client';

// Vendored React Bits SpecularButton (user-supplied, plan 07-03). Integration edits are marked OPAQUELY.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
// OPAQUELY: href renders next/link with the same classes, structure and canvas.
import Link from 'next/link';

import './SpecularButton.css';

const PAD = 24;
const TAU = Math.PI * 2;

// OPAQUELY: a module-level budget of live WebGL contexts. A button that cannot get a slot keeps the flat look and
// retries when another button releases its slot.
const MAX_LIVE_CONTEXTS = 8;
let liveContexts = 0;
const slotWaiters = new Set();
const acquireSlot = () => {
  if (liveContexts >= MAX_LIVE_CONTEXTS) return false;
  liveContexts += 1;
  return true;
};
const releaseSlot = () => {
  liveContexts = Math.max(0, liveContexts - 1);
  for (const waiter of [...slotWaiters]) waiter();
};

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

const VERTEX = `#version 300 es
in vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const FRAGMENT = `#version 300 es
precision highp float;
uniform vec2 uCenter;
uniform vec2 uHalf;
uniform float uRadius;
uniform float uPx;
uniform float uSpot;
uniform vec2 uEntry;
uniform vec3 uLineColor;
uniform vec3 uBaseColor;
uniform float uIntensity;
uniform vec2 uWindow;
uniform float uThickness;
uniform float uGlow;
out vec4 outColor;

float roundedBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

float loopPosition(vec2 p, vec2 b, float r) {
  vec2 inner = b - r;
  float arc = 1.5707963 * r;
  float quarter = inner.x + inner.y + arc;
  vec2 a = abs(p);
  vec2 q = a - inner;
  float s = q.x > 0.0 && q.y > 0.0
    ? inner.y + atan(q.y, q.x) * r
    : (q.x > q.y ? min(a.y, inner.y) : inner.y + arc + inner.x - min(a.x, inner.x));
  if (p.x < 0.0) s = p.y >= 0.0 ? 2.0 * quarter - s : 2.0 * quarter + s;
  else if (p.y < 0.0) s = 4.0 * quarter - s;
  return s / max(4.0 * quarter, 0.0001);
}

float lobe(float position, float center) {
  float gap = abs(fract(position - center + 0.5) - 0.5);
  return 1.0 - smoothstep(uWindow.x, uWindow.x + uWindow.y, gap);
}

void main() {
  vec2 p = gl_FragCoord.xy - uCenter;
  float d = roundedBox(p, uHalf, uRadius);
  float position = loopPosition(p, uHalf, uRadius);
  float key = lobe(position, uSpot);
  float back = lobe(position, uSpot + 0.5);
  float streak = key + back * 0.45;
  float width = max(uThickness * uPx * mix(1.0, max(key, back), 0.6), 0.35);
  float band = smoothstep(-width - 0.6, -width + 0.6, d) * (1.0 - smoothstep(-0.6, 0.6, d));
  float hair = smoothstep(-uPx - 0.6, -uPx + 0.6, d) * (1.0 - smoothstep(-0.6, 0.6, d));
  float inside = 1.0 - smoothstep(-0.6, 0.6, d);
  vec2 pool = (p - uEntry) / (uHalf.y * vec2(1.6, 1.1));
  float glow = streak * 0.2 * exp(-abs(d + width * 0.5) / (5.0 * uPx)) + inside * 0.08 * exp(-dot(pool, pool));
  float light = clamp((band * streak + glow * uGlow) * uIntensity, 0.0, 1.0);
  vec4 base = vec4(uBaseColor, 1.0) * hair * 0.6;
  outColor = vec4(uLineColor, 1.0) * light + base * (1.0 - light);
}`;

const UNIFORMS = [
  'uCenter',
  'uHalf',
  'uRadius',
  'uPx',
  'uSpot',
  'uEntry',
  'uLineColor',
  'uBaseColor',
  'uIntensity',
  'uWindow',
  'uThickness',
  'uGlow'
];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const wrap = value => value - Math.floor(value);

const loopPosition = (x, y, halfX, halfY, r) => {
  const innerX = halfX - r;
  const innerY = halfY - r;
  const arc = (Math.PI / 2) * r;
  const quarter = innerX + innerY + arc;
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  const qx = ax - innerX;
  const qy = ay - innerY;
  let s;
  if (qx > 0 && qy > 0) s = innerY + Math.atan2(qy, qx) * r;
  else if (qx > qy) s = Math.min(ay, innerY);
  else s = innerY + arc + innerX - Math.min(ax, innerX);
  if (x < 0) s = y >= 0 ? 2 * quarter - s : 2 * quarter + s;
  else if (y < 0) s = 4 * quarter - s;
  return wrap(s / Math.max(4 * quarter, 0.0001));
};

const rimPoint = (position, halfX, halfY, r) => {
  const innerX = halfX - r;
  const innerY = halfY - r;
  const arc = (Math.PI / 2) * r;
  const quarter = innerX + innerY + arc;
  let s = wrap(position) * 4 * quarter;
  let signX = 1;
  let signY = 1;
  if (s > 3 * quarter) {
    s = 4 * quarter - s;
    signY = -1;
  } else if (s > 2 * quarter) {
    s -= 2 * quarter;
    signX = -1;
    signY = -1;
  } else if (s > quarter) {
    s = 2 * quarter - s;
    signX = -1;
  }
  let x = innerX - (s - innerY - arc);
  let y = halfY;
  if (s <= innerY) {
    x = halfX;
    y = s;
  } else if (s <= innerY + arc) {
    const angle = (s - innerY) / Math.max(r, 0.0001);
    x = innerX + Math.cos(angle) * r;
    y = innerY + Math.sin(angle) * r;
  }
  return [x * signX, y * signY];
};

const compile = (gl, type, source) => {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
  gl.deleteShader(shader);
  return null;
};

const link = gl => {
  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
  const program = gl.createProgram();
  if (!vertex || !fragment || !program) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.bindAttribLocation(program, 0, 'aPosition');
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (gl.getProgramParameter(program, gl.LINK_STATUS)) return program;
  gl.deleteProgram(program);
  return null;
};

// OPAQUELY: the supplied effect body, unchanged apart from being a function so it can start and stop with the
// viewport. Returns a cleanup, or null when no WebGL2 context or program is available.
const startEngine = (button, canvas, settingsRef, wakeRef) => {
  const gl = canvas.getContext('webgl2', {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
    stencil: false
  });
  if (!gl) return null;
  const program = link(gl);
  if (!program) {
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return null;
  }
  const uniforms = {};
  for (const name of UNIFORMS) uniforms[name] = gl.getUniformLocation(program, name);
  const buffer = gl.createBuffer();
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  const probe = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  // Reduced motion is kept: with it autoAnimate never spins.
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const colors = new Map();
  const view = { width: 1, height: 1, ratio: 1 };
  const pointer = { x: 0, y: 0, known: false };
  const state = { spot: 0, level: 0, press: 0, ready: false };
  let raf = 0;
  let last = 0;
  const visible = true;

  const toRgb = value => {
    if (colors.has(value)) return colors.get(value);
    let rgb = [1, 1, 1];
    if (probe) {
      probe.clearRect(0, 0, 1, 1);
      probe.fillStyle = '#000000';
      probe.fillStyle = value;
      probe.fillRect(0, 0, 1, 1);
      const [r, g, b] = probe.getImageData(0, 0, 1, 1).data;
      rgb = [r / 255, g / 255, b / 255];
    }
    colors.set(value, rgb);
    return rgb;
  };

  const cornerRadius = s => Math.min(s.radius, view.width / 2, view.height / 2);

  const restSpot = s => {
    const r = cornerRadius(s);
    const inset = r * (1 - Math.SQRT1_2);
    return loopPosition(inset - view.width / 2, view.height / 2 - inset, view.width / 2, view.height / 2, r);
  };

  const aim = s => {
    if (!s.followMouse || s.disabled || !pointer.known) return null;
    const rect = button.getBoundingClientRect();
    const scale = rect.width / view.width || 1;
    const halfX = view.width / 2;
    const halfY = view.height / 2;
    const x = (pointer.x - rect.left - rect.width / 2) / scale;
    const y = (rect.top + rect.height / 2 - pointer.y) / scale;
    const distance = Math.hypot(Math.max(Math.abs(x) - halfX, 0), Math.max(Math.abs(y) - halfY, 0));
    const t = clamp(1 - distance / s.proximity, 0, 1);
    const near = t * t * (3 - 2 * t);
    const nearest = loopPosition(x, y, halfX, halfY, cornerRadius(s));
    if (distance > 0) return { spot: nearest, near };
    const depth = clamp(Math.min(halfX - Math.abs(x), halfY - Math.abs(y)) / (halfY * 0.8), 0, 1);
    const sway = restSpot(s) - (x / halfX) * 0.06 - (y / halfY) * 0.02;
    const offset = sway - nearest - Math.round(sway - nearest);
    return { spot: wrap(nearest + offset * depth * depth * (3 - 2 * depth)), near };
  };

  const draw = s => {
    const { width, height } = view;
    const scaleX = canvas.width / (width + PAD * 2);
    const scaleY = canvas.height / (height + PAD * 2);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);
    gl.uniform2f(uniforms.uCenter, (PAD + width / 2) * scaleX, (PAD + height / 2) * scaleY);
    gl.uniform2f(uniforms.uHalf, (width / 2) * scaleX, (height / 2) * scaleY);
    gl.uniform1f(uniforms.uRadius, Math.min(s.radius, width / 2, height / 2) * scaleX);
    gl.uniform1f(uniforms.uPx, view.ratio);
    const r = Math.min(s.radius, width / 2, height / 2);
    const [rimX, rimY] = rimPoint(state.spot, width / 2, height / 2, r);
    const pull = 1 - Math.min(0.35 * (height / 2), Math.hypot(rimX, rimY)) / Math.max(Math.hypot(rimX, rimY), 0.0001);
    gl.uniform1f(uniforms.uSpot, state.spot);
    gl.uniform2f(uniforms.uEntry, rimX * pull * scaleX, rimY * pull * scaleY);
    gl.uniform3fv(uniforms.uLineColor, toRgb(s.lineColor));
    gl.uniform3fv(uniforms.uBaseColor, toRgb(s.baseColor));
    gl.uniform1f(uniforms.uIntensity, s.intensity * (state.level + state.press * 0.8));
    gl.uniform2f(uniforms.uWindow, s.shineSize / 360 + state.press * 0.06, s.shineFade / 360 + 0.0001);
    gl.uniform1f(uniforms.uThickness, s.thickness);
    gl.uniform1f(uniforms.uGlow, s.glow);
    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  };

  const frame = now => {
    raf = 0;
    if (!visible) return;
    const s = settingsRef.current;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
    last = now;
    const target = aim(s);
    const spinning = s.autoAnimate && !reduce;
    const steering = !!target && target.near > 0;
    if (!state.ready) {
      state.spot = restSpot(s);
      state.level = s.autoAnimate ? 1 : s.idleIntensity;
      state.ready = true;
    }
    let diff = 0;
    if (spinning && !steering) state.spot = wrap(state.spot + (s.speed / TAU) * dt);
    else {
      diff = (steering ? target.spot : restSpot(s)) - state.spot;
      diff -= Math.round(diff);
      state.spot = wrap(state.spot + diff * (1 - Math.exp(-dt * 8)));
    }
    const level = s.autoAnimate ? 1 : s.idleIntensity + (1 - s.idleIntensity) * (target ? target.near : 0);
    state.level += (level - state.level) * (1 - Math.exp(-dt * 7));
    state.press *= Math.exp(-dt * 5);
    draw(s);
    const settling = Math.abs(diff) > 0.0002 || Math.abs(level - state.level) > 0.001 || state.press > 0.002;
    if (settling || (spinning && !steering)) raf = requestAnimationFrame(frame);
    else last = 0;
  };

  const wake = () => {
    if (!raf && visible) raf = requestAnimationFrame(frame);
  };

  const measure = entry => {
    const box = entry?.borderBoxSize?.[0];
    view.width = Math.max(1, box ? box.inlineSize : button.offsetWidth);
    view.height = Math.max(1, box ? box.blockSize : button.offsetHeight);
    view.ratio = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.max(1, Math.round((view.width + PAD * 2) * view.ratio));
    canvas.height = Math.max(1, Math.round((view.height + PAD * 2) * view.ratio));
    if (state.ready) draw(settingsRef.current);
    wake();
  };

  const onPointerMove = event => {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.known = true;
    wake();
  };

  const onPointerDown = event => {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.known = true;
    if (!settingsRef.current.disabled) state.press = 1;
    wake();
  };

  const onPointerEnd = event => {
    if (event.pointerType === 'mouse') return;
    pointer.known = false;
    wake();
  };

  const onPointerLeave = () => {
    pointer.known = false;
    wake();
  };

  const resizeObserver = new ResizeObserver(entries => measure(entries[entries.length - 1]));
  resizeObserver.observe(button);
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerup', onPointerEnd, { passive: true });
  window.addEventListener('pointercancel', onPointerEnd, { passive: true });
  document.documentElement.addEventListener('pointerleave', onPointerLeave);
  button.addEventListener('pointerdown', onPointerDown);
  measure();
  wakeRef.current = wake;

  return () => {
    cancelAnimationFrame(raf);
    wakeRef.current = null;
    resizeObserver.disconnect();
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerEnd);
    window.removeEventListener('pointercancel', onPointerEnd);
    document.documentElement.removeEventListener('pointerleave', onPointerLeave);
    button.removeEventListener('pointerdown', onPointerDown);
    gl.deleteBuffer(buffer);
    gl.deleteVertexArray(vao);
    gl.deleteProgram(program);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  };
};

const SpecularButton = ({
  children = 'Get Started',
  size = 'lg',
  radius = 18,
  tint = '#ffffff',
  tintOpacity = 0.04,
  blur = 0,
  textColor = '#f5f5f5',
  lineColor = '#ffffff',
  baseColor = '#525252',
  intensity = 1,
  idleIntensity = 0.35,
  shineSize = 10,
  shineFade = 34,
  thickness = 1.2,
  glow = 1,
  speed = 0.35,
  followMouse = true,
  proximity = 250,
  autoAnimate = false,
  disabled = false,
  onClick,
  className = '',
  type = 'button',
  style,
  href,
  ...rest
}) => {
  const buttonRef = useRef(null);
  const canvasRef = useRef(null);
  const wakeRef = useRef(null);
  // OPAQUELY: blocked (aria-disabled, aria-busy or native disabled) never takes a context.
  const blocked = disabled || rest['aria-disabled'] === true || rest['aria-disabled'] === 'true' ||
    rest['aria-busy'] === true || rest['aria-busy'] === 'true';
  // OPAQUELY: inView = intersecting the viewport with a non-zero size; live = a context is running (data-gl="on");
  // canvasKey remounts a fresh canvas after a context is released (a lost context cannot be reused);
  // retry re-runs the effect when a slot frees up.
  const [inView, setInView] = useState(false);
  const [live, setLive] = useState(false);
  const [canvasKey, setCanvasKey] = useState(0);
  const [retry, setRetry] = useState(0);
  const settings = {
    radius: Math.max(0, radius),
    lineColor: String(lineColor),
    baseColor: String(baseColor),
    intensity: Math.max(0, intensity),
    idleIntensity: clamp(idleIntensity, 0, 1),
    shineSize: Math.max(0, shineSize),
    shineFade: Math.max(0, shineFade),
    thickness: Math.max(0, thickness),
    glow: Math.max(0, glow),
    speed,
    followMouse,
    proximity: Math.max(1, proximity),
    autoAnimate,
    disabled: blocked
  };
  const settingsRef = useRef(settings);
  // OPAQUELY: the render-time ref assignment moved into a layout effect (react-hooks/refs).
  useIsomorphicLayoutEffect(() => {
    settingsRef.current = settings;
  });

  // OPAQUELY: lazy GL, gated by an IntersectionObserver plus a size check.
  useEffect(() => {
    const button = buttonRef.current;
    if (!button || typeof IntersectionObserver === 'undefined') return undefined;
    let intersecting = false;
    const update = () => {
      const sized = button.offsetWidth > 0 && button.offsetHeight > 0;
      setInView(intersecting && sized);
    };
    const intersection = new IntersectionObserver(entries => {
      intersecting = entries.some(entry => entry.isIntersecting);
      update();
    });
    intersection.observe(button);
    const resize = new ResizeObserver(update);
    resize.observe(button);
    return () => {
      intersection.disconnect();
      resize.disconnect();
    };
  }, []);

  useEffect(() => {
    const button = buttonRef.current;
    const canvas = canvasRef.current;
    if (!inView || blocked || !button || !canvas) return undefined;
    if (!acquireSlot()) {
      const waiter = () => setRetry(n => n + 1);
      slotWaiters.add(waiter);
      return () => slotWaiters.delete(waiter);
    }
    const stop = startEngine(button, canvas, settingsRef, wakeRef);
    if (!stop) {
      releaseSlot();
      return undefined;
    }
    setLive(true);
    return () => {
      stop();
      setLive(false);
      setCanvasKey(k => k + 1);
      releaseSlot();
    };
  }, [inView, blocked, retry]);

  useEffect(() => {
    wakeRef.current?.();
  });

  const shared = {
    ref: buttonRef,
    onClick,
    // OPAQUELY: data-gl="on" only while a context is live; "off" on the server, before hydration, off-screen,
    // without WebGL2, above the context cap and while blocked.
    'data-gl': live ? 'on' : 'off',
    className: `specular-button specular-button--${size}${className ? ` ${className}` : ''}`,
    style: {
      '--sb-radius': `${radius}px`,
      '--sb-tint': tint,
      '--sb-tint-opacity': tintOpacity,
      '--sb-blur': `${blur}px`,
      '--sb-text-color': textColor,
      ...style
    },
    ...rest
  };
  const inner = (
    <>
      <canvas key={canvasKey} ref={canvasRef} className="specular-button__light" aria-hidden="true" />
      <span className="specular-button__label">{children}</span>
    </>
  );

  if (href !== undefined) {
    return (
      <Link href={href} {...shared}>
        {inner}
      </Link>
    );
  }

  return (
    // OPAQUELY: native disabled only when a caller passes disabled directly; the app Button never does.
    <button type={type} disabled={disabled || undefined} {...shared}>
      {inner}
    </button>
  );
};

export default SpecularButton;
