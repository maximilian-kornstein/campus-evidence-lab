#!/usr/bin/env python3
"""Generate the textured geometric artwork for the four Kornstein Lab papers.

The approved artwork (assets/artwork-research-*.png, assets/artwork-paper-*.png)
is built from large flat shapes in one hue family: arcs, rectangles and diagonal
planes, with translucent overlaps that give soft tonal steps, a paper texture
and a gentle vignette. This script draws new pieces in that language.

How it works
  * Every piece is drawn as a "tone" field (0 = palest, 1 = darkest) at twice
    the output size. Shapes are signed-distance masks with antialiased,
    very slightly irregular edges. They are combined with fill, darken
    (multiply-like) and lighten (screen-like) operations, so overlaps form
    tonal steps.
  * The field is downsampled, then low-frequency mottling, embossed paper
    fibres, fine grain and a vignette are added.
  * The tone is mapped to colour through a ramp measured from the approved
    PNGs (orange, lavender, sand; plus a deeper ochre built from sand). A
    second "hue mix" field can blend between two ramps (sand to orange).
  * The result is stored as an 8-bit palette PNG with a tone-sorted palette
    and per-row PNG filtering, which keeps the grainy texture affordable.

Everything is seeded, so repeated runs give identical files.

Usage
  python3 scripts/generate-artwork.py                 # all slugs, all sizes
  python3 scripts/generate-artwork.py --slug contagion
  python3 scripts/generate-artwork.py --contact-sheet /tmp/contact.png

Requires Python 3 with numpy and Pillow.
"""

from __future__ import annotations

import argparse
import math
import struct
import zlib
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"

SLUGS = ("dark-figure", "contagion", "attitudes", "amplification")

# Output sizes (2x the CSS display sizes).
SIZES = {
    "research": (928, 388),       # research row, display 464x194
    "paper": (1254, 566),         # paper hero, display 627x283
    "home-featured": (1476, 604), # home wide card, display ~738x302
    "home-card": (640, 500),      # home half card, display ~320x250
}

SUPERSAMPLE = 2
MIXED_PALETTE_COLOURS = 192

# Stable per-piece seeds (not Python's salted hash()).
def seed_for(slug: str, size_name: str) -> int:
    return zlib.crc32(f"kornstein-art/{slug}/{size_name}".encode()) & 0x7FFFFFFF


# --------------------------------------------------------------------------
# Colour ramps, measured from the approved artwork with Pillow.
# --------------------------------------------------------------------------

def _hex(h: str) -> tuple[int, int, int]:
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


class Ramp:
    def __init__(self, stops):
        self.t = np.array([s[0] for s in stops], np.float32)
        self.c = np.array([_hex(s[1]) for s in stops], np.float32)

    def __call__(self, d: np.ndarray) -> np.ndarray:
        return np.stack([np.interp(d, self.t, self.c[:, k]) for k in range(3)], -1)


ORANGE = Ramp([
    (0.00, "#fff0e6"), (0.12, "#fed8c1"), (0.22, "#fdc2a1"), (0.33, "#fd9d66"),
    (0.43, "#fc7f3d"), (0.53, "#fc6a24"), (0.61, "#f45b16"), (0.69, "#e8490a"),
    (0.77, "#d63c02"), (0.85, "#b42c01"), (0.93, "#8e2101"), (1.00, "#701800"),
])
LAVENDER = Ramp([
    (0.00, "#f8f3fd"), (0.12, "#ede2fa"), (0.22, "#e2d2f7"), (0.32, "#d3c1f2"),
    (0.42, "#c2adeb"), (0.52, "#ae99e2"), (0.60, "#9f8bd9"), (0.70, "#8d79cb"),
    (0.80, "#7766b3"), (0.90, "#625298"), (1.00, "#4a3d78"),
])
SAND = Ramp([
    (0.00, "#fcf6ef"), (0.12, "#f9eadb"), (0.22, "#f7dbba"), (0.32, "#f2c998"),
    (0.42, "#e5b47f"), (0.52, "#d6a26b"), (0.60, "#c79058"), (0.70, "#b47c44"),
    (0.80, "#9d6731"), (0.90, "#83532a"), (1.00, "#66411f"),
])
# Deeper, slightly yellower sand for The Dark Figure.
OCHRE = Ramp([
    (0.00, "#fcf4ea"), (0.12, "#f8e5cc"), (0.22, "#f4d3aa"), (0.32, "#ecbf8a"),
    (0.42, "#e0ab70"), (0.52, "#d0985a"), (0.60, "#c08648"), (0.70, "#a97138"),
    (0.80, "#8f5c2c"), (0.90, "#744923"), (1.00, "#573719"),
])


# --------------------------------------------------------------------------
# Noise helpers (numpy + Pillow only).
# --------------------------------------------------------------------------

def smooth_noise(rng: np.random.Generator, h: int, w: int, scale: float) -> np.ndarray:
    """Band-limited noise with features of about `scale` pixels, unit std."""
    gh = max(2, int(math.ceil(h / scale)) + 3)
    gw = max(2, int(math.ceil(w / scale)) + 3)
    coarse = rng.standard_normal((gh, gw)).astype(np.float32)
    big = Image.fromarray(coarse, "F").resize(
        (int(gw * scale), int(gh * scale)), Image.BICUBIC)
    a = np.asarray(big)
    oy = int(rng.integers(0, max(1, a.shape[0] - h)))
    ox = int(rng.integers(0, max(1, a.shape[1] - w)))
    a = a[oy:oy + h, ox:ox + w]
    return (a - a.mean()) / (a.std() + 1e-6)


def blur(a: np.ndarray, sigma: float) -> np.ndarray:
    """Separable Gaussian blur with edge padding."""
    r = max(1, int(math.ceil(sigma * 3)))
    x = np.arange(-r, r + 1, dtype=np.float32)
    k = np.exp(-(x * x) / (2 * sigma * sigma))
    k /= k.sum()
    p = np.pad(a, ((r, r), (0, 0)), mode="edge")
    out = sum(k[i] * p[i:i + a.shape[0]] for i in range(2 * r + 1))
    p = np.pad(out, ((0, 0), (r, r)), mode="edge")
    return sum(k[i] * p[:, i:i + a.shape[1]] for i in range(2 * r + 1))


def fibre_relief(rng: np.random.Generator, h: int, w: int, unit: float) -> np.ndarray:
    """Embossed swirl/fibre pattern like the hand-made paper in the originals."""
    img = Image.new("L", (w, h), 128)
    dr = ImageDraw.Draw(img)
    n = int(w * h / (unit * unit * 80))
    for _ in range(n):
        cx, cy = rng.uniform(-20, w + 20), rng.uniform(-20, h + 20)
        r = rng.uniform(3.5, 11.0) * unit
        ry = r * rng.uniform(0.55, 1.0)
        a0 = rng.uniform(0, 360)
        a1 = a0 + rng.uniform(70, 230)
        dr.arc((cx - r, cy - ry, cx + r, cy + ry), a0, a1,
               fill=int(rng.choice((100, 108, 150))), width=1)
    # A few long, faint fibres.
    for _ in range(int(n * 0.08)):
        x, y = rng.uniform(0, w), rng.uniform(0, h)
        pts = [(x, y)]
        ang = rng.uniform(0, 2 * math.pi)
        for _ in range(6):
            ang += rng.normal(0, 0.5)
            x += math.cos(ang) * 6 * unit
            y += math.sin(ang) * 6 * unit
            pts.append((x, y))
        dr.line(pts, fill=150, width=1)
    a = (np.asarray(img, np.float32) - 128.0) / 32.0
    a = blur(a, 0.45 * unit)
    # Emboss: light from the upper left.
    emb = a - np.roll(np.roll(a, 1, 0), 1, 1)
    return emb / (emb.std() + 1e-6)


# --------------------------------------------------------------------------
# Canvas, shapes and blend operations.
# Coordinates are in units of the canvas height: u in [0, A], v in [0, 1],
# with v growing downwards. A = width / height.
# --------------------------------------------------------------------------

class Canvas:
    def __init__(self, w: int, h: int, rng: np.random.Generator, ss: int = SUPERSAMPLE):
        self.w_out, self.h_out, self.ss = w, h, ss
        self.W, self.H = w * ss, h * ss
        self.A = w / h
        self.rng = rng
        yy, xx = np.mgrid[0:self.H, 0:self.W].astype(np.float32)
        self.u = (xx + 0.5) / self.H
        self.v = (yy + 0.5) / self.H
        self.px = 1.0 / self.H
        self.d = np.zeros((self.H, self.W), np.float32)   # tone
        self.m = np.zeros((self.H, self.W), np.float32)   # hue mix (0 = ramp A)
        # Slight edge irregularity, as if cut from paper (~0.5 output px).
        self.wobble = smooth_noise(rng, self.H, self.W, self.H / 6) * 0.8 * self.px

    # ---- masks ---------------------------------------------------------
    def mask(self, sdf: np.ndarray, soft: float = 1.0) -> np.ndarray:
        return np.clip(0.5 - (sdf + self.wobble) / (soft * self.px), 0.0, 1.0)

    def circle(self, c, r):
        return np.hypot(self.u - c[0], self.v - c[1]) - r

    def ring(self, c, r0, r1):
        dist = np.hypot(self.u - c[0], self.v - c[1])
        return np.abs(dist - (r0 + r1) / 2) - (r1 - r0) / 2

    def box(self, x0, y0, x1, y1):
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        hx, hy = abs(x1 - x0) / 2, abs(y1 - y0) / 2
        dx = np.abs(self.u - cx) - hx
        dy = np.abs(self.v - cy) - hy
        return (np.hypot(np.maximum(dx, 0), np.maximum(dy, 0))
                + np.minimum(np.maximum(dx, dy), 0))

    def side(self, p, q):
        """Signed distance to the line p->q; negative to the right of travel
        (below the line when p->q runs left to right)."""
        dx, dy = q[0] - p[0], q[1] - p[1]
        n = math.hypot(dx, dy)
        cross = dx * (self.v - p[1]) - dy * (self.u - p[0])
        return -cross / n

    @staticmethod
    def inter(*sdfs):
        out = sdfs[0]
        for s in sdfs[1:]:
            out = np.maximum(out, s)
        return out

    @staticmethod
    def union(*sdfs):
        out = sdfs[0]
        for s in sdfs[1:]:
            out = np.minimum(out, s)
        return out

    @staticmethod
    def minus(a, b):
        return np.maximum(a, -b)

    # ---- tone fields ---------------------------------------------------
    def lin(self, p0, p1, t0, t1):
        """Linear tone gradient from t0 at p0 to t1 at p1 (clamped)."""
        dx, dy = p1[0] - p0[0], p1[1] - p0[1]
        L2 = dx * dx + dy * dy
        s = ((self.u - p0[0]) * dx + (self.v - p0[1]) * dy) / L2
        return t0 + (t1 - t0) * np.clip(s, 0, 1)

    def radial(self, c, r, t0, t1):
        s = np.hypot(self.u - c[0], self.v - c[1]) / r
        return t0 + (t1 - t0) * np.clip(s, 0, 1)

    # ---- blend operations ---------------------------------------------
    def fill(self, mask, tone, a=1.0):
        self.d += (tone - self.d) * mask * a

    def darken(self, mask, a):
        self.d += a * mask * (1.0 - self.d)

    def lighten(self, mask, a):
        self.d -= a * mask * self.d

    def rim(self, sdf, a, width=2.0):
        """Lighten a thin band just inside a shape's edge, like the cut edge
        of a sheet of paper catching the light."""
        inner = self.mask(sdf + width * self.px)
        self.lighten(self.mask(sdf) * (1.0 - inner), a)

    def hue(self, mask, h, a=1.0):
        self.m += (h - self.m) * mask * a

    # ---- finishing -----------------------------------------------------
    def render(self, ramp: Ramp, ramp2: Ramp | None = None, *, mottle=0.035,
               fibre=0.007, grain=0.013, vignette=0.07) -> "Piece":
        ss, rng = self.ss, self.rng
        h, w = self.h_out, self.w_out
        d = self.d.reshape(h, ss, w, ss).mean(axis=(1, 3))
        m = self.m.reshape(h, ss, w, ss).mean(axis=(1, 3))
        unit = h / 388.0 * 2.0  # texture unit: about one display px at research size

        # Low-frequency mottling (watercolour-like unevenness).
        mot = (0.55 * smooth_noise(rng, h, w, h / 2.5)
               + 0.40 * smooth_noise(rng, h, w, h / 7)
               + 0.22 * smooth_noise(rng, h, w, h / 20))
        d = d + mottle * mot * (0.55 + 0.6 * d)

        # Vignette: subtle darkening towards the edges and corners.
        uu = (np.arange(w, dtype=np.float32) + 0.5) / w * 2 - 1
        vv = (np.arange(h, dtype=np.float32) + 0.5) / h * 2 - 1
        q = (uu[None, :] ** 2) * 0.75 + (vv[:, None] ** 2)
        d = d + vignette * np.clip(q / 1.75, 0, 1) ** 1.6

        # Paper fibres (embossed) and fine grain.
        d = d + fibre * fibre_relief(rng, h, w, unit)
        g = blur(rng.standard_normal((h, w)).astype(np.float32), 0.35 * unit)
        g /= g.std() + 1e-6
        d = d + grain * g

        return Piece(np.clip(d, 0.0, 1.0), np.clip(m, 0.0, 1.0), ramp, ramp2)


class Piece:
    """A finished tone field plus the ramp(s) that colour it."""

    def __init__(self, d, m, ramp: Ramp, ramp2: Ramp | None):
        self.d, self.m, self.ramp, self.ramp2 = d, m, ramp, ramp2

    def rgb(self) -> Image.Image:
        rgb = self.ramp(self.d)
        if self.ramp2 is not None:
            m = self.m[..., None]
            rgb = rgb * (1 - m) + self.ramp2(self.d) * m
        return Image.fromarray(np.clip(rgb + 0.5, 0, 255).astype(np.uint8), "RGB")


# --------------------------------------------------------------------------
# Motifs. Each lays out its shapes for the canvas aspect ratio (A = w / h).
# --------------------------------------------------------------------------

def dark_figure(cv: Canvas) -> Piece:
    """Ochre: a vast half-circle sunk below a horizon; only a sliver shows."""
    A = cv.A
    wide = A > 1.8
    horizon = 0.42 if wide else 0.45
    R = 1.06 if wide else 0.80
    sliver = 0.12 if wide else 0.105
    cx = A * (0.58 if wide else 0.56)
    cy = horizon + R - sliver

    # Sky: pale ochre, a little warmer towards the right.
    cv.fill(1.0, cv.lin((0, 0), (A, horizon), 0.10, 0.24))
    # A translucent diagonal plane across the sky.
    sky_edge = cv.side((A * (0.18 if wide else 0.05), horizon), (A * (0.62 if wide else 0.70), 0))
    cv.darken(1 - cv.mask(sky_edge), 0.12)
    cv.rim(sky_edge, 0.18)

    # The visible sliver: deep ochre, darker towards its right.
    mass = cv.mask(cv.circle((cx, cy), R))
    cv.fill(mass, cv.lin((cx - R * 0.5, cy - R), (cx + R * 0.6, cy - R * 0.6), 0.76, 0.88))

    # Ground: below the horizon the mass is veiled, still large but quiet.
    below = cv.mask(horizon - cv.v)
    cv.fill(below, cv.lin((0, horizon), (A * 0.3, 1.0), 0.38, 0.47))
    cv.darken(below * mass, 0.30)
    cv.fill(below * mass, cv.radial((cx, cy), R, 0.66, 0.54), 0.35)
    cv.darken(below * cv.mask(cv.circle((cx, cy), R * 0.58)), 0.12)
    # A veil that thins with depth: paler just under the horizon.
    cv.lighten(below, cv.lin((0, horizon), (0, 1.0), 0.22, 0.0))
    # A vertical translucent column, echoing the approved orange grid.
    colx = A * (0.17 if wide else 0.12)
    col = cv.mask(cv.box(colx, -1, colx + (0.24 if wide else 0.20), 2))
    cv.lighten(col, 0.16)
    return cv.render(OCHRE, mottle=0.036, vignette=0.085)


def contagion(cv: Canvas) -> Piece:
    """Orange: one large ripple (the shock) and the smaller arcs it sets off,
    each new one born on the rim of the last."""
    A = cv.A
    wide = A > 1.8
    cv.fill(1.0, cv.lin((0, 0), (A, 1), 0.50, 0.60))
    # Horizontal division, as in the approved orange piece.
    split = 0.56 if wide else 0.60
    cv.darken(cv.mask(split - cv.v), 0.10)

    base = 1.0
    if wide:
        x0, r0, shrink, n = 0.36, 0.92, 0.65, 4
    else:
        x0, r0, shrink, n = 0.18, 0.80, 0.60, 3
    # The shock: concentric bands radiating from one point on the baseline.
    src = (x0, base)
    cv.lighten(cv.mask(cv.circle(src, r0)), 0.52)
    cv.rim(cv.circle(src, r0), 0.22)
    cv.fill(cv.mask(cv.circle(src, r0 * 0.66)), cv.lin((x0 - r0, 0.4), (x0 + r0, 1), 0.46, 0.60), 0.9)
    cv.fill(cv.mask(cv.circle(src, r0 * 0.32)), 0.84, 0.95)
    # The cascade: each arc is centred on the rim of the previous one, so
    # neighbours overlap in lens-shaped steps.
    x, r = x0, r0
    for i in range(n):
        x, r = x + r, r * shrink
        msk = cv.mask(cv.circle((x, base), r))
        if i % 2 == 0:
            cv.darken(msk, 0.36)
        else:
            cv.lighten(msk, 0.40)
            cv.rim(cv.circle((x, base), r), 0.18)
    # A branch: a smaller arc set off from the shock's upper rim.
    ang = math.radians(-50 if wide else -48)
    bc = (x0 + r0 * math.cos(ang), base + r0 * math.sin(ang))
    br = r0 * (0.36 if wide else 0.38)
    cv.darken(cv.mask(cv.circle(bc, br)), 0.26)
    cv.lighten(cv.mask(cv.inter(cv.circle(bc, br), cv.circle(src, r0))), 0.30)
    return cv.render(ORANGE, mottle=0.038, vignette=0.085)


def attitudes(cv: Canvas) -> Piece:
    """Lavender: two overlapping circles meeting in a soft, pale lens."""
    A = cv.A
    wide = A > 1.8
    cv.fill(1.0, cv.lin((0, 0), (A, 1), 0.14, 0.34))
    # Diagonal plane across the lower right, as in the approved lavender piece.
    diag = cv.mask(cv.side((A * (0.28 if wide else 0.0), 1.0), (A, 0.0 if wide else 0.12)))
    cv.darken(diag, 0.20)
    cv.darken(diag, cv.lin((A * 0.5, 0.5), (A, 1.0), 0.0, 0.28))
    # A horizontal plane on the left.
    cv.darken(cv.mask(cv.box(-1, 0.58 if wide else 0.64, A * 0.45, 2)), 0.12)

    if wide:
        ra, rb = 0.66, 0.58
        ca = (A * 0.5 - 0.36, 0.60)
        cb = (A * 0.5 + 0.34, 0.40)
    else:
        ra, rb = 0.46, 0.40
        ca = (A * 0.5 - 0.20, 0.60)
        cb = (A * 0.5 + 0.22, 0.40)
    sa, sb = cv.circle(ca, ra), cv.circle(cb, rb)
    ma, mb = cv.mask(sa), cv.mask(sb)
    cv.darken(ma, 0.32)
    cv.fill(ma, cv.lin((ca[0] - ra, ca[1] - ra), (ca[0] + ra, ca[1] + ra), 0.44, 0.66), 0.5)
    cv.darken(mb, 0.16)
    cv.fill(mb, cv.lin((cb[0] - rb, cb[1] - rb), (cb[0] + rb, cb[1] + rb), 0.30, 0.50), 0.35)
    # The lens: the overlap, lighter and with softer edges.
    lens = cv.mask(cv.inter(sa, sb), soft=4.0)
    cv.lighten(lens, 0.62)
    halo = cv.mask(cv.inter(sa, sb) - 0.012, soft=16.0)
    cv.lighten(halo, 0.12)
    # Faint third circle, bleeding off the upper right.
    cc = (A * 0.5 + (0.98 if wide else 0.50), 0.0)
    cv.darken(cv.mask(cv.circle(cc, 0.34 if wide else 0.24)), 0.12)
    return cv.render(LAVENDER, mottle=0.034, vignette=0.08)


def amplification(cv: Canvas) -> Piece:
    """Sand to orange: overlapping rectangles that step up a diagonal,
    each larger and warmer than the last."""
    A = cv.A
    wide = A > 1.8
    cv.fill(1.0, cv.lin((0, 1), (A, 0), 0.16, 0.30))
    cv.hue(1.0, cv.lin((A * 0.1, 1), (A, 0), 0.0, 0.55))
    # Large diagonal plane through the lower right.
    diag = cv.mask(cv.side((A * (0.42 if wide else 0.25), 1.0), (A, 0.30 if wide else 0.42)))
    cv.darken(diag, 0.12)
    cv.hue(diag, 0.45, 0.5)

    if wide:
        rects = [  # (left, bottom, height); width = height * aspect
            (0.16, 0.90, 0.24), (0.36, 0.80, 0.36), (0.64, 0.68, 0.54),
            (1.04, 0.56, 0.80), (1.60, 0.46, 1.20)]
        aspect = 1.30
    else:
        rects = [(0.10, 0.92, 0.20), (0.26, 0.82, 0.31), (0.48, 0.70, 0.48),
                 (0.78, 0.58, 0.74)]
        aspect = 1.15
    n = len(rects)
    for i, (x, b, h) in enumerate(rects):
        t = i / (n - 1)
        w = h * aspect
        msk = cv.mask(cv.box(x, b - h, x + w, b))
        cv.hue(msk, 0.15 + 0.85 * t, 0.9)
        cv.darken(msk, cv.lin((x, b - h), (x + w, b), 0.12 + 0.07 * i, 0.22 + 0.07 * i))
    # A pale translucent plane over the lower left, crossing the first steps.
    veil = cv.side((0, 0.60 if wide else 0.64), (A * 0.48, 1.05))
    cv.lighten(cv.mask(veil), 0.26)
    cv.rim(veil, 0.15)
    # And a light band falling across the largest rectangles.
    band = cv.mask(cv.inter(cv.side((A * 0.55, 0.0), (A * 1.05, 0.62)),
                            -cv.side((A * 0.66, -0.12), (A * 1.16, 0.50))))
    cv.lighten(band, 0.14)
    return cv.render(SAND, ORANGE, mottle=0.034, vignette=0.08)


MOTIFS = {
    "dark-figure": dark_figure,
    "contagion": contagion,
    "attitudes": attitudes,
    "amplification": amplification,
}


# --------------------------------------------------------------------------
# Output.
# --------------------------------------------------------------------------

def _png_chunk(kind: bytes, data: bytes) -> bytes:
    return (struct.pack(">I", len(data)) + kind + data
            + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF))


def _filter_rows(idx: np.ndarray) -> bytes:
    """PNG scanline filtering, best of the five filters per row (minimum sum
    of absolute residuals). Pillow does not filter palette images, but with
    a palette sorted by tone the filters remove the smooth structure and the
    file shrinks by about a third."""
    a = idx.astype(np.int16)
    h = a.shape[0]
    left = np.zeros_like(a)
    left[:, 1:] = a[:, :-1]
    up = np.zeros_like(a)
    up[1:] = a[:-1]
    ul = np.zeros_like(a)
    ul[1:, 1:] = a[:-1, :-1]
    p = left + up - ul
    pa, pb, pc = np.abs(p - left), np.abs(p - up), np.abs(p - ul)
    paeth = np.where((pa <= pb) & (pa <= pc), left, np.where(pb <= pc, up, ul))
    res = np.stack([a, a - left, a - up, a - (left + up) // 2, a - paeth]) % 256
    cost = np.abs(res.astype(np.uint8).astype(np.int8).astype(np.int32)).sum(axis=2)
    best = cost.argmin(axis=0)
    rows = res[best, np.arange(h)].astype(np.uint8)
    return np.concatenate([best.astype(np.uint8)[:, None], rows], axis=1).tobytes()


def write_palette_png(path: Path, idx: np.ndarray, palette: np.ndarray) -> None:
    h, w = idx.shape
    raw = _filter_rows(idx)
    best = b""
    for strategy in (zlib.Z_DEFAULT_STRATEGY, zlib.Z_FILTERED):
        c = zlib.compressobj(9, zlib.DEFLATED, 15, 9, strategy)
        z = c.compress(raw) + c.flush()
        if not best or len(z) < len(best):
            best = z
    path.write_bytes(
        b"\x89PNG\r\n\x1a\n"
        + _png_chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 3, 0, 0, 0))
        + _png_chunk(b"PLTE", np.asarray(palette, np.uint8).tobytes())
        + _png_chunk(b"IDAT", best)
        + _png_chunk(b"IEND", b""))


def save_png(piece: Piece, path: Path) -> None:
    """Optimised 8-bit palette PNG.

    One-ramp pieces only contain colours on that ramp, so the palette is the
    ramp sampled at 256 tones (no visible loss). Two-ramp pieces are
    quantised to 192 colours, sorted by luminance.
    """
    if piece.ramp2 is None:
        palette = np.clip(piece.ramp(np.linspace(0, 1, 256)) + 0.5, 0, 255).astype(np.uint8)
        idx = np.round(piece.d * 255).astype(np.uint8)
    else:
        q = piece.rgb().quantize(colors=MIXED_PALETTE_COLOURS, method=Image.Quantize.MEDIANCUT)
        pal = np.array(q.getpalette()[:3 * MIXED_PALETTE_COLOURS], np.uint8).reshape(-1, 3)
        order = np.argsort(pal.astype(np.float32) @ np.array([0.299, 0.587, 0.114], np.float32),
                           kind="stable")
        rank = np.empty_like(order)
        rank[order] = np.arange(len(order))
        palette = pal[order]
        idx = rank[np.asarray(q)].astype(np.uint8)
    write_palette_png(path, idx, palette)


def render(slug: str, size_name: str) -> Piece:
    w, h = SIZES[size_name]
    rng = np.random.default_rng(seed_for(slug, size_name))
    cv = Canvas(w, h, rng)
    return MOTIFS[slug](cv)


def output_path(slug: str, size_name: str) -> Path:
    return ASSETS / f"artwork-{size_name}-{slug}.png"


def contact_sheet(path: Path) -> None:
    bg = (250, 248, 246)
    pad = 24
    existing = [ASSETS / f"artwork-research-{c}.png" for c in ("orange", "lavender", "sand")]
    tiles_row1 = [Image.open(p).convert("RGB").resize((464, 194), Image.LANCZOS) for p in existing]
    new_research = [Image.open(output_path(s, "research")).convert("RGB").resize((464, 194), Image.LANCZOS)
                    for s in SLUGS]
    rows = [tiles_row1 + [new_research[0]], new_research[1:] + [None]]
    others = []
    for s in SLUGS:
        others.append([
            Image.open(output_path(s, "paper")).convert("RGB").resize((627, 283), Image.LANCZOS),
            Image.open(output_path(s, "home-featured")).convert("RGB").resize((692, 283), Image.LANCZOS),
            Image.open(output_path(s, "home-card")).convert("RGB").resize((362, 283), Image.LANCZOS),
        ])
    W = pad + 4 * (464 + pad)
    H = pad + 2 * (194 + pad) + 4 * (283 + pad)
    sheet = Image.new("RGB", (W, H), bg)
    y = pad
    for row in rows:
        x = pad
        for t in row:
            if t is not None:
                sheet.paste(t, (x, y))
            x += 464 + pad
        y += 194 + pad
    for row in others:
        x = pad
        for t in row:
            sheet.paste(t, (x, y))
            x += t.width + pad
        y += 283 + pad
    path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(path)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--slug", choices=SLUGS, action="append",
                    help="only this slug (repeatable); default all")
    ap.add_argument("--size", choices=tuple(SIZES), action="append",
                    help="only this size (repeatable); default all")
    ap.add_argument("--contact-sheet", type=Path,
                    help="also write a contact sheet comparing new and approved artwork")
    args = ap.parse_args()
    for slug in args.slug or SLUGS:
        for size_name in args.size or tuple(SIZES):
            out = output_path(slug, size_name)
            save_png(render(slug, size_name), out)
            print(f"{out.relative_to(ROOT)}  {out.stat().st_size // 1024} KB")
    if args.contact_sheet:
        contact_sheet(args.contact_sheet)
        print(f"contact sheet: {args.contact_sheet}")


if __name__ == "__main__":
    main()
