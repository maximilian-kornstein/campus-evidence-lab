#!/usr/bin/env python
"""Figures and the main LaTeX table for the simulation section (sec:simulation).

Reads ../results/sim_results.json (and ../results/raw/E4.json for the null
p-values) written by run_experiments.py, and writes
  ../figures/fig-sim-recovery.pdf     E1: relative bias / RMSE by parameter; CI coverage by quantity
  ../figures/fig-sim-spurious.pdf     E2: fitted n vs kappa with n* = 1 - (1+kappa)^{-1/2}; remedies
  ../figures/fig-sim-thinning.pdf     E3: fitted n vs p with n'(p); corrected estimates; heterogeneous recording
  ../figures/fig-sim-lrt.pdf          E4: size / power, null p-value P-P plot, common-shock false positives
  ../figures/fig-sim-attribution.pdf  E5: B / D / C and shares, exact vs Monte Carlo vs estimated
  ../figures/fig-sim-alert.pdf        E6: realised cost, precision / recall, PIT
  ../tables/tab-sim-main.tex          summary of E1-E5 (booktabs tabular only)
No titles inside plots; captions belong in LaTeX. Style matches Paper 1
(../dark-figure/code/make_figures.py): serif, stix mathtext, Okabe-Ito colours.
Usage (from code/): python make_figures.py [--results ../results] [--figures ../figures] [--tables ../tables]
"""

from __future__ import annotations

import argparse
import json
import math
import os

import numpy as np
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
from matplotlib.lines import Line2D  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))

plt.rcParams.update({
    "font.family": "serif",
    "font.serif": ["DejaVu Serif", "Times New Roman", "Times"],
    "mathtext.fontset": "stix",
    "font.size": 8.5,
    "axes.titlesize": 8.5,
    "axes.labelsize": 8.5,
    "xtick.labelsize": 7.5,
    "ytick.labelsize": 7.5,
    "legend.fontsize": 7.0,
    "axes.linewidth": 0.6,
    "xtick.major.width": 0.6,
    "ytick.major.width": 0.6,
    "xtick.major.size": 2.5,
    "ytick.major.size": 2.5,
    "lines.linewidth": 1.4,
    "axes.spines.top": False,
    "axes.spines.right": False,
    "pdf.fonttype": 42,
    "savefig.pad_inches": 0.02,
    "figure.constrained_layout.h_pad": 0.03,
    "figure.constrained_layout.w_pad": 0.03,
})

W2, W1 = 6.0, 2.9  # figure widths (inches)
GRID = "#d9d9d9"
INK2 = "#555555"
# Okabe-Ito (colour-blind safe; checked with the dataviz palette validator; the
# CVD separation of some pairs is in the 6-8 floor band, so every series also
# has its own marker / line style). Black = truth / theory.
C_BLUE, C_VERM, C_GREEN, C_PINK, C_ORANGE, C_SKY = "#0072B2", "#D55E00", "#009E73", "#CC79A7", "#E69F00", "#56B4E9"
TRUTH = "#000000"


def _f(x):
    if x is None:
        return float("nan")
    if x == "inf":
        return float("inf")
    if x == "-inf":
        return float("-inf")
    return float(x)


def _style(ax, grid_axis="y"):
    ax.grid(True, axis=grid_axis, color=GRID, lw=0.5, zorder=0)
    ax.set_axisbelow(True)
    ax.tick_params(colors="#222222")


def _panel(ax, letter):
    ax.text(-0.02, 1.02, f"({letter})", transform=ax.transAxes, ha="right", va="bottom", fontsize=8.5)


def load(results_dir):
    with open(os.path.join(results_dir, "sim_results.json")) as f:
        return json.load(f)


def load_raw(results_dir, name):
    p = os.path.join(results_dir, "raw", f"{name}.json")
    if not os.path.exists(p):
        return None
    with open(p) as f:
        return json.load(f)


def _ci_band(ax, R, x0, x1, level=0.95):
    half = 1.96 * math.sqrt(level * (1 - level) / R)
    ax.axhspan(level - half, level + half, color="#eeeeee", zorder=0, lw=0)
    ax.axhline(level, color=INK2, lw=0.7, ls="--", zorder=1)


# ---------------------------------------------------------------------------
# E1  Recovery
# ---------------------------------------------------------------------------
def _param_label(nm):
    if nm.startswith("mu["):
        return rf"$\mu_{{{int(nm[3]) + 1}}}$"
    if nm.startswith("alpha["):
        k, j = nm[6:-1].split(",")
        return rf"$\alpha_{{{int(k) + 1}{int(j) + 1}}}$"
    if nm == "beta":
        return r"$\beta$"
    if nm.startswith("shock_beta["):
        return rf"$\beta_{{{int(nm[11]) + 1}}}$"
    if nm == "eta":
        return r"$\eta$"
    return nm


def fig_recovery(res, path):
    e1 = res["experiments"]["E1"]["summary"]["by_T"]
    cols = [C_VERM, C_BLUE, C_GREEN]
    marks = ["s", "o", "D"]
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(W2, 2.7), layout="constrained", gridspec_kw=dict(width_ratios=[1.55, 1]))
    names = list(e1[0]["params"].keys())
    x = np.arange(len(names))
    off = np.linspace(-0.18, 0.18, len(e1)) if len(e1) > 1 else [0.0]
    _style(ax1)
    ax1.axhline(0, color=INK2, lw=0.6)
    for i, bt in enumerate(e1):
        rb = np.array([100 * _f(bt["params"][n]["rel_bias"]) for n in names])
        rr = np.array([100 * _f(bt["params"][n]["rel_rmse"]) for n in names])
        ax1.errorbar(x + off[i], rb, yerr=rr, fmt=marks[i], ms=3.6, color=cols[i], ecolor=cols[i], elinewidth=0.9,
                     capsize=0, label=rf"$T={_f(bt['T']):.0f}$ (R = {bt['R']})", zorder=3)
    ax1.set_xticks(x)
    ax1.set_xticklabels([_param_label(n) for n in names], fontsize=7)
    ax1.set_xlim(-0.6, len(names) - 0.4)
    ext = max(np.nanmax(np.abs([100 * _f(bt["params"][n]["rel_bias"]) for n in names])
                        + np.array([100 * _f(bt["params"][n]["rel_rmse"]) for n in names])) for bt in e1)
    ax1.set_ylim(-1.1 * ext, 1.45 * ext)
    ax1.set_ylabel("relative bias $\\pm$ relative RMSE (%)")
    ax1.legend(loc="upper center", frameon=False, ncol=2)
    _panel(ax1, "a")
    # (b) coverage by group
    groups = [("$\\mu_k$", lambda n, d: n.startswith("mu[") and not d),
              ("$\\alpha_{kj}$", lambda n, d: n.startswith("alpha[") and not d),
              ("$\\beta,\\eta$", lambda n, d: n in ("beta", "eta") and not d),
              ("$\\beta_k$", lambda n, d: n.startswith("shock_beta[") and not d),
              ("$M_{kj}$", lambda n, d: n.startswith("Mult[") and d),
              ("$\\varrho$", lambda n, d: n == "rho(A)" and d),
              ("$B_k$", lambda n, d: n.startswith("B[") and d),
              ("$D_k$", lambda n, d: n.startswith("D[") and d),
              ("$C_k$", lambda n, d: (n.startswith("C[") or n.startswith("Con[")) and d),
              ("shares", lambda n, d: (n.startswith("share[") or n.startswith("sigma[")) and d)]
    _style(ax2)
    R = min(bt["R"] for bt in e1)
    _ci_band(ax2, R, 0, len(groups))
    rng = np.random.default_rng(1)
    for i, bt in enumerate(e1):
        for gi, (lab, sel) in enumerate(groups):
            vals = [_f(v["coverage"]) for n, v in bt["params"].items() if sel(n, False)]
            vals += [_f(v["coverage"]) for n, v in bt["derived"].items() if sel(n, True)]
            if not vals:
                continue
            xx = gi + off[i] + rng.uniform(-0.06, 0.06, len(vals))
            ax2.plot(xx, vals, marks[i], ms=2.6, color=cols[i], alpha=0.85, mew=0, zorder=3)
    ax2.set_xticks(range(len(groups)))
    ax2.set_xticklabels([g[0] for g in groups], rotation=45, ha="right", fontsize=7)
    ax2.set_ylabel("coverage of nominal 95% intervals")
    lo = min(0.85, min(_f(v["coverage"]) for bt in e1 for v in list(bt["params"].values()) + list(bt["derived"].values())) - 0.03)
    ax2.set_ylim(lo, 1.0)
    ax2.set_xlim(-0.6, len(groups) - 0.4)
    _panel(ax2, "b")
    fig.savefig(path)
    plt.close(fig)


# ---------------------------------------------------------------------------
# E2  Spurious contagion
# ---------------------------------------------------------------------------
FAM_STYLE = {"rare": (C_BLUE, "o", "Rare large shocks"),
             "frequent": (C_VERM, "s", "Frequent small shocks"),
             "slow": (C_GREEN, "D", "Slow regime switching")}


def _family_label(c):
    col, mk, lab = FAM_STYLE.get(c["family"], ("#777777", "^", c["family"]))
    if c["kind"] == "shot":
        lab = f"{lab} ($m={_f(c['theory']['m']):g}$)"
    return col, mk, lab


def fig_spurious(res, path):
    confs = res["experiments"]["E2"]["summary"]["configs"]
    fams = []
    for c in confs:
        if c["family"] not in fams:
            fams.append(c["family"])
    kap_all = np.array([c["kappa"] for c in confs])
    kk = np.geomspace(kap_all.min() / 1.3, kap_all.max() * 1.3, 200)
    nstar = 1 - (1 + kk) ** -0.5
    fig, axes = plt.subplots(1, 2, figsize=(W2, 2.65), layout="constrained", sharey=True)
    for ax in axes:
        _style(ax, "both")
        ax.set_xscale("log")
        ax.plot(kk, nstar, color=TRUTH, lw=1.2, zorder=2)
        ax.axhline(0, color=INK2, lw=0.6)
        ax.set_xlabel(r"burstiness $\kappa$")
    ax1, ax2 = axes
    handles = [Line2D([], [], color=TRUTH, lw=1.2, label=r"$n^*=1-(1+\kappa)^{-1/2}$")]
    nfam = len(fams)
    offs = {f: 1.0 + 0.045 * (i - (nfam - 1) / 2) for i, f in enumerate(fams)}
    shown_moment = False
    for f in fams:
        cs = [c for c in confs if c["family"] == f]
        col, mk, lab = _family_label(cs[0])
        k = np.array([c["kappa"] for c in cs]) * offs[f]
        m = np.array([_f(c["fits"]["const"]["n_eff"]["mean"]) for c in cs])
        e = np.array([1.96 * _f(c["fits"]["const"]["n_eff"]["mcse"]) for c in cs])
        ax1.errorbar(k, m, yerr=e, fmt=mk + "-", ms=4, color=col, lw=0.9, capsize=0, zorder=3)
        handles.append(Line2D([], [], color=col, marker=mk, ms=4, lw=0.9, label=lab))
        if cs[0]["kind"] == "shot" and cs[0].get("moment"):
            mm = np.array([_f(c["moment"]["n_F"]["mean"]) for c in cs])
            me = np.array([1.96 * _f(c["moment"]["n_F"]["mcse"]) for c in cs])
            ax1.errorbar(k, mm, yerr=me, fmt=mk, ms=3.6, mfc="white", color=col, lw=0.7, capsize=0, zorder=3)
            shown_moment = True
    if shown_moment:
        handles.append(Line2D([], [], color=INK2, marker="o", mfc="white", ls="none", ms=3.6,
                              label=r"dispersion estimator $1-\hat F^{-1/2}$"))
    ax1.set_ylabel(r"fitted branching ratio $\hat n_{\mathrm{eff}}$")
    _panel(ax1, "a")
    ax1.legend(handles=handles, loc="upper left", frameon=False, fontsize=6.6)
    # (b) remedies
    h2 = [Line2D([], [], color=TRUTH, lw=1.2, label=r"$n^*$ (constant background)")]
    for f in fams:
        cs = [c for c in confs if c["family"] == f]
        col, mk, lab = _family_label(cs[0])
        k = np.array([c["kappa"] for c in cs]) * offs[f]
        if all("spline" in c["fits"] for c in cs):
            m = np.array([_f(c["fits"]["spline"]["n_eff"]["mean"]) for c in cs])
            e = np.array([1.96 * _f(c["fits"]["spline"]["n_eff"]["mcse"]) for c in cs])
            ax2.errorbar(k, m, yerr=e, fmt=mk + "--", ms=4, mfc="white", color=col, lw=0.9, capsize=0, zorder=3)
        ks = [(c["kappa"] * offs[f], c) for c in cs if "shocks" in c["fits"]]
        if ks:
            kx = np.array([a for a, _ in ks])
            m = np.array([_f(c["fits"]["shocks"]["n_eff"]["mean"]) for _, c in ks])
            e = np.array([1.96 * _f(c["fits"]["shocks"]["n_eff"]["mcse"]) for _, c in ks])
            ax2.errorbar(kx, m, yerr=e, fmt=mk + ":", ms=4, color=col, lw=0.9, capsize=0, zorder=3)
    h2 += [Line2D([], [], color=INK2, marker="o", mfc="white", ls="--", ms=4, lw=0.9, label="spline background"),
           Line2D([], [], color=INK2, marker="o", ls=":", ms=4, lw=0.9, label="shock times known")]
    ax2.legend(handles=h2, loc="upper left", frameon=False, fontsize=6.6)
    _panel(ax2, "b")
    ymax = max(0.9, max(_f(c["fits"]["const"]["n_eff"]["mean"]) for c in confs) + 0.2)
    ax1.set_ylim(-0.05, ymax)
    fig.savefig(path)
    plt.close(fig)


# ---------------------------------------------------------------------------
# E3  Thinning
# ---------------------------------------------------------------------------
N_STYLE = [(C_BLUE, "o"), (C_VERM, "s"), (C_GREEN, "D"), (C_PINK, "^")]


def _h(n, p):
    q = (1 - n) ** 2
    return 1 - (1 - n) / np.sqrt(q + p * (1 - q))


def fig_thinning(res, path):
    s = res["experiments"]["E3"]["summary"]
    hom = s["homogeneous"]
    fig, axes = plt.subplots(1, 3, figsize=(W2, 2.5), layout="constrained", gridspec_kw=dict(width_ratios=[1, 1, 1.05]))
    ax1, ax2, ax3 = axes
    pp = np.linspace(0.05, 1, 200)
    for ax in (ax1, ax2):
        _style(ax, "both")
        ax.set_xlabel(r"recording probability $p$")
        ax.set_xlim(0.1, 1.05)
    hd1, hd2 = [], []
    for i, h in enumerate(hom):
        col, mk = N_STYLE[i % len(N_STYLE)]
        n = _f(h["n"])
        p = np.array([_f(r["p"]) for r in h["by_p"]])
        m = np.array([_f(r["naive_vs_n"]["mean"]) for r in h["by_p"]])
        e = np.array([1.96 * _f(r["naive_vs_n"]["sd"]) / math.sqrt(max(r["naive_vs_n"]["n"], 1)) for r in h["by_p"]])
        ax1.plot(pp, _h(n, pp), color=col, lw=1.0, zorder=2)
        ax1.plot(pp, n * pp, color=col, lw=0.6, ls=":", zorder=2)
        ax1.errorbar(p, m, yerr=e, fmt=mk, ms=4, color=col, capsize=0, zorder=3)
        hd1.append(Line2D([], [], color=col, marker=mk, ms=4, lw=1.0, label=f"$n={n:g}$"))
        mk_ = np.array([_f(r["corrected_known_p"]["mean"]) for r in h["by_p"]])
        ek = np.array([1.96 * _f(r["corrected_known_p"]["sd"]) / math.sqrt(max(r["corrected_known_p"]["n"], 1)) for r in h["by_p"]])
        me = np.array([_f(r["corrected_est_p"]["mean"]) for r in h["by_p"]])
        ee = np.array([1.96 * _f(r["corrected_est_p"]["sd"]) / math.sqrt(max(r["corrected_est_p"]["n"], 1)) for r in h["by_p"]])
        ax2.axhline(n, color=col, lw=0.8, zorder=1)
        ax2.errorbar(p - 0.012, mk_, yerr=ek, fmt=mk, ms=4, color=col, capsize=0, zorder=3)
        ax2.errorbar(p + 0.012, me, yerr=ee, fmt=mk, ms=4, mfc="white", color=col, capsize=0, zorder=3)
    hd1 += [Line2D([], [], color=INK2, lw=1.0, label=r"$n'=h_p(n)$"), Line2D([], [], color=INK2, lw=0.6, ls=":", label=r"$pn$")]
    ax1.legend(handles=hd1, loc="upper left", frameon=False, fontsize=6.6)
    ax1.set_ylabel(r"fitted $\hat n'$ (recorded incidents)")
    ax1.set_ylim(0, 1.0)
    hd2 = [Line2D([], [], color=INK2, marker="o", ls="none", ms=4, label=r"$h_p^{-1}(\hat n')$, $p$ known"),
           Line2D([], [], color=INK2, marker="o", mfc="white", ls="none", ms=4, label=r"$h_{\hat p}^{-1}(\hat n')$, $p$ estimated")]
    ax2.legend(handles=hd2, loc="upper left", frameon=False, fontsize=6.6)
    ax2.set_ylabel(r"corrected $\hat n$")
    ax2.set_ylim(0, 1.0)
    _panel(ax1, "a")
    _panel(ax2, "b")
    # (c) heterogeneous recording
    het = s["heterogeneous"]
    _style(ax3, "y")
    x = np.arange(len(het))
    for i, h in enumerate(het):
        th = h["theory"]
        ax3.plot([i - 0.32, i - 0.04], [th["n_app_theory"]] * 2, color=TRUTH, lw=1.1, zorder=2)
        ax3.plot([i + 0.04, i + 0.32], [th["n_naive_theory"]] * 2, color=TRUTH, lw=1.1, zorder=2)
        a = h["n_app_vs_theory"]
        b = h["n_corrected_vs_naive_theory"]
        ax3.errorbar(i - 0.18, _f(a["mean"]), yerr=1.96 * _f(a["sd"]) / math.sqrt(max(a["n"], 1)), fmt="o", ms=4,
                     color=C_BLUE, capsize=0, zorder=3)
        ax3.errorbar(i + 0.18, _f(b["mean"]), yerr=1.96 * _f(b["sd"]) / math.sqrt(max(b["n"], 1)), fmt="s", ms=4,
                     color=C_VERM, capsize=0, zorder=3)
    nbar = het[0]["theory"]["n_bar"]
    ax3.axhline(nbar, color=INK2, lw=0.7, ls="--", zorder=1)
    ax3.set_xticks(x)
    short = {"positive": "Cov$>0$", "homogeneous": "$p$ equal", "negative": "Cov$<0$", "complete": "$p=1$"}
    labs = []
    for h in het:
        px = h["theory"]["p_x"]
        labs.append(f"{short.get(h['case'], h['case'])}\n({px[0]:g},{px[1]:g})")
    ax3.set_xticklabels(labs, fontsize=6.2)
    nx = het[0]["theory"]["n_x"]
    ax3.set_xlabel(rf"$(p_1,p_2)$, with $(n_1,n_2)=({nx[0]:g},{nx[1]:g})$", fontsize=7.5)
    ax3.set_ylabel("branching ratio")
    ax3.set_ylim(0.2, 0.75)
    ax3.legend(handles=[Line2D([], [], color=C_BLUE, marker="o", ls="none", ms=4, label=r"fitted $\hat n''$"),
                        Line2D([], [], color=C_VERM, marker="s", ls="none", ms=4, label=r"$h_{\bar p}^{-1}(\hat n'')$"),
                        Line2D([], [], color=TRUTH, lw=1.1, label="theory"),
                        Line2D([], [], color=INK2, lw=0.7, ls="--", label=r"true $\bar n$")],
               loc="upper left", frameon=False, fontsize=6.3, ncol=2)
    _panel(ax3, "c")
    fig.savefig(path)
    plt.close(fig)


# ---------------------------------------------------------------------------
# E4  LRT
# ---------------------------------------------------------------------------
def fig_lrt(res, raw4, path):
    sc = res["experiments"]["E4"]["summary"]["scenarios"]
    fig, axes = plt.subplots(1, 3, figsize=(W2, 2.4), layout="constrained", gridspec_kw=dict(width_ratios=[1.1, 1, 0.9]))
    ax1, ax2, ax3 = axes
    # (a) size and power
    _style(ax1, "y")
    pw = [r for r in sc if r["name"] == "size" or r["name"].startswith("power")]
    a = np.array([_f(r["alpha_true"]) for r in pw])
    for key, col, mk, lab, dx in (("reject_0.05", C_BLUE, "o", r"boundary LRT ($\bar\chi^2$)", -0.003),
                                  ("reject_naive_chi2_1_0.05", C_VERM, "s", r"naive $\chi^2_1$", 0.003)):
        r = np.array([_f(x["without_shocks"][key]["rate"]) for x in pw])
        e = np.array([1.96 * _f(x["without_shocks"][key]["mcse"]) for x in pw])
        ax1.errorbar(a + dx, r, yerr=e, fmt=mk + "-", ms=4, lw=0.9, color=col, capsize=0, label=lab, zorder=3)
    ax1.axhline(0.05, color=INK2, lw=0.7, ls="--")
    ax1.set_xlabel(r"true $\alpha_{\mathrm{off},\mathrm{on}}$")
    ax1.set_ylabel("rejection rate at 5%")
    ax1.set_ylim(0, 1.02)
    ax1.legend(loc="lower right", frameon=False, fontsize=6.6)
    _panel(ax1, "a")
    # (b) null p-values P-P
    _style(ax2, "both")
    if raw4 is not None:
        p = np.array([_f(r["p"]) for r in raw4["reps"] if r.get("ok") and r["si"] == 0])
        u = np.linspace(0, 0.5, 101)
        ecdf = np.array([np.mean(p <= x) for x in u])
        ax2.plot(u, u, color=TRUTH, lw=1.0, label="uniform")
        ax2.step(u, ecdf, where="post", color=C_BLUE, lw=1.1, label=f"empirical (R = {p.size})")
        n = p.size
        band = 1.36 / math.sqrt(n)
        ax2.fill_between(u, np.clip(u - band, 0, 1), u + band, color="#eeeeee", lw=0, zorder=0)
        p0 = np.mean(p >= 1 - 1e-12)
        ax2.text(0.02, 0.47, rf"$\Pr(\mathrm{{LR}}=0)={p0:.2f}$", fontsize=6.8, va="top")
    ax2.set_xlim(0, 0.5)
    ax2.set_ylim(0, 0.5)
    ax2.set_xlabel(r"nominal level $u$")
    ax2.set_ylabel(r"$\Pr(p\text{-value}\leq u)$ under $H_0$")
    ax2.legend(loc="lower right", frameon=False, fontsize=6.6)
    _panel(ax2, "b")
    # (c) common shock
    _style(ax3, "y")
    cs = [r for r in sc if r["name"] == "common_shock"]
    size = [r for r in sc if r["name"] == "size"]
    bars = []
    if size:
        bars.append(("no\nshock", size[0]["without_shocks"]["reject_0.05"], "#bbbbbb"))
    if cs:
        bars.append(("shock,\nomitted", cs[0]["without_shocks"]["reject_0.05"], C_VERM))
        bars.append(("shock,\nin model", cs[0]["with_shocks"]["reject_0.05"], C_BLUE))
    for i, (lab, r, col) in enumerate(bars):
        ax3.bar(i, _f(r["rate"]), width=0.6, color=col, zorder=2)
        ax3.errorbar(i, _f(r["rate"]), yerr=1.96 * _f(r["mcse"]), fmt="none", ecolor="#222222", elinewidth=0.8, zorder=3)
        ax3.text(i, _f(r["rate"]) + 1.96 * _f(r["mcse"]) + 0.02, f"{_f(r['rate']):.2f}", ha="center", fontsize=6.8)
    ax3.axhline(0.05, color=INK2, lw=0.7, ls="--")
    ax3.set_xticks(range(len(bars)))
    ax3.set_xticklabels([b[0] for b in bars], fontsize=6.6)
    ax3.set_ylabel(r"rejection rate of $\alpha_{\mathrm{off},\mathrm{on}}=0$")
    ax3.set_ylim(0, 1.05)
    _panel(ax3, "c")
    fig.savefig(path)
    plt.close(fig)


# ---------------------------------------------------------------------------
# E5  Attribution
# ---------------------------------------------------------------------------
STREAM_SHORT = ["offline A", "offline B", "online"]


def fig_attribution(res, path):
    s = res["experiments"]["E5"]["summary"]
    H = s["H_list"][-1]
    tag = f"H{H:g}"
    val = [v for v in s["mc_validation"] if abs(_f(v["H"]) - H) < 1e-9][0]
    ests = s["estimated"]
    cols = [C_VERM, C_BLUE]
    marks = ["s", "o"]
    M = max(r["stream"] for r in val["rows"]) + 1
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(W2, 2.7), layout="constrained", gridspec_kw=dict(width_ratios=[1.6, 1]))
    _style(ax1, "y")
    comps = ["B", "D", "C"]
    xt, xl = [], []
    for k in range(M):
        for ci, comp in enumerate(comps):
            x = k * (len(comps) + 1) + ci
            xt.append(x)
            xl.append(f"${comp}_{k + 1}$")
            row = [r for r in val["rows"] if r["component"] == comp and r["stream"] == k][0]
            ax1.plot([x - 0.36, x + 0.36], [row["exact"]] * 2, color=TRUTH, lw=1.2, zorder=2)
            ax1.plot(x - 0.24, row["mc_mean"], marker="D", ms=3.8, mfc="white", color=INK2, ls="none", zorder=4)
            for ti, e in enumerate(ests):
                q = e["quantities"].get(f"{comp}[{k}]@{tag}")
                if q is None:
                    continue
                ax1.errorbar(x + 0.02 + 0.2 * ti, _f(q["mean"]), yerr=_f(q["sd"]), fmt=marks[ti % 2], ms=3.6,
                             color=cols[ti % 2], capsize=0, elinewidth=0.9, zorder=3)
        if k < M - 1:
            ax1.axvline(k * (len(comps) + 1) + len(comps), color=GRID, lw=0.6)
    for k in range(M):
        ax1.text(k * (len(comps) + 1) + 1, 1.0, STREAM_SHORT[k] if k < len(STREAM_SHORT) else f"stream {k + 1}",
                 transform=ax1.get_xaxis_transform(), ha="center", va="bottom", fontsize=7)
    ax1.set_xticks(xt)
    ax1.set_xticklabels(xl, fontsize=7)
    ax1.set_ylabel(rf"expected incidents in $(\tau_e,\tau_e+{H:g}]$")
    ax1.set_ylim(bottom=0)
    hd = [Line2D([], [], color=TRUTH, lw=1.2, label="exact (Thm attribution)"),
          Line2D([], [], color=INK2, marker="D", mfc="white", ls="none", ms=3.8, label=f"branching labels (MC, {s['n_mc']} paths)")]
    for ti, e in enumerate(ests):
        hd.append(Line2D([], [], color=cols[ti % 2], marker=marks[ti % 2], ms=3.6, label=rf"estimated, $T={_f(e['T']):.0f}$ (mean $\pm$ SD)"))
    ax1.legend(handles=hd, loc="upper left", frameon=False, fontsize=6.3, bbox_to_anchor=(0.0, 0.97))
    _panel(ax1, "a")
    # (b) shares
    _style(ax2, "y")
    items = []
    for k in range(M):
        items.append((f"share[{k}]@{tag}", rf"$\frac{{C_{k + 1}}}{{D_{k + 1}+C_{k + 1}}}$", "share", k))
    for sh in val["shares"]:
        if "sigma_exact" in sh:
            k = sh["stream"]
            items.append((f"sigma[{k}]@{tag}", rf"$\sigma_{k + 1}$", "sigma", k))
    for i, (key, lab, kind, k) in enumerate(items):
        sh = [x for x in val["shares"] if x["stream"] == k][0]
        ex = sh["share_exact"] if kind == "share" else sh["sigma_exact"]
        mc = sh["share_mc"] if kind == "share" else sh["sigma_mc"]
        ax2.plot([i - 0.36, i + 0.36], [ex] * 2, color=TRUTH, lw=1.2, zorder=2)
        ax2.plot(i - 0.24, mc, marker="D", ms=3.8, mfc="white", color=INK2, ls="none", zorder=4)
        for ti, e in enumerate(ests):
            q = e["quantities"].get(key)
            if q is None:
                continue
            ax2.errorbar(i + 0.02 + 0.2 * ti, _f(q["mean"]), yerr=_f(q["sd"]), fmt=marks[ti % 2], ms=3.6,
                         color=cols[ti % 2], capsize=0, elinewidth=0.9, zorder=3)
    ax2.set_xticks(range(len(items)))
    ax2.set_xticklabels([it[1] for it in items], fontsize=7.5)
    ax2.set_ylim(0, 1)
    ax2.set_ylabel(rf"share, $H={H:g}$")
    _panel(ax2, "b")
    fig.savefig(path)
    plt.close(fig)


# ---------------------------------------------------------------------------
# E6  Alerting
# ---------------------------------------------------------------------------
M_STYLE = {
    "oracle": (TRUTH, "o", "-", "Hawkes, true parameters"),
    "fitted": (C_BLUE, "o", "-", "Hawkes, fitted"),
    "ma_poisson": (C_VERM, "s", "--", "moving-average Poisson"),
    "climatology": (C_ORANGE, "^", "-.", "climatology"),
    "fitted_naive_delay": (C_PINK, "v", ":", "Hawkes, fitted, naive state"),
    "fitted_ht_delay": (C_GREEN, "D", "-", "Hawkes, fitted, HT nowcast"),
    "ma_poisson_delay": (C_VERM, "s", ":", "MA Poisson, available counts"),
}


E6_KEYS = ["oracle", "fitted", "fitted_naive_delay", "fitted_ht_delay", "ma_poisson", "ma_poisson_delay", "climatology"]


def _pit_panel(ax, hists, keys, title_note):
    _style(ax, "y")
    top = 1.8
    for m in keys:
        col, mk, ls, lab = M_STYLE[m]
        h = np.array(hists[m], float)
        nb = h.size
        dens = h / max(h.sum(), 1) * nb
        top = max(top, dens.max() * 1.45)
        ax.stairs(dens, np.linspace(0, 1, nb + 1), color=col, lw=1.1, ls=ls, label=lab)
    ax.axhline(1.0, color=INK2, lw=0.6)
    ax.set_xlabel("randomised PIT")
    ax.set_xlim(0, 1)
    ax.set_ylim(0, top)
    ax.text(0.5, 0.97, title_note, transform=ax.transAxes, ha="center", va="top", fontsize=6.8, color="#222222")
    ax.legend(loc="upper center", bbox_to_anchor=(0.5, 0.89), frameon=False, fontsize=5.8, ncol=1)


def fig_alert(res, path):
    s = res["experiments"]["E6"]["summary"]
    meth = s["methods"]
    split = s.get("calibration_by_new_shock")
    ratios = sorted(meth["oracle"]["alerts"].keys(), key=float)
    rx = np.array([float(r) for r in ratios])
    fig, axes = plt.subplots(2, 3, figsize=(W2, 4.4), layout="constrained")
    (ax1, ax2, ax3), (ax4, ax5, ax6) = axes

    def cost_panel(ax, keys):
        _style(ax, "y")
        n = len(keys)
        offs = np.linspace(-0.06, 0.06, n) if n > 1 else [0.0]
        for i, m in enumerate(keys):
            col, mk, ls, lab = M_STYLE[m]
            c = np.array([_f(meth[m]["alerts"][r]["cost_per_window"]["mean"]) for r in ratios])
            e = np.array([1.96 * _f(meth[m]["alerts"][r]["cost_per_window"]["mcse"]) for r in ratios])
            ax.errorbar(rx * (1 + offs[i]), c, yerr=e, fmt=mk, ls=ls, ms=3.6, lw=0.9, color=col, capsize=0, label=lab, zorder=3)
        base = s["surge_rate_test"]
        ax.plot(rx, np.minimum(rx * base, 1 - base), color="#999999", lw=0.8, ls=(0, (1, 1)), zorder=1,
                label="best constant rule")
        ax.set_xscale("log")
        ax.set_xticks(rx)
        ax.set_xticklabels([f"{x:g}" for x in rx])
        ax.minorticks_off()
        ax.set_xlabel(r"cost ratio $c_{\mathrm{miss}}/c_{\mathrm{FA}}$")
        ax.set_ylim(0, 1.05)
        ax.legend(loc="upper left", frameon=False, fontsize=5.8)

    cost_panel(ax1, ["oracle", "fitted", "ma_poisson", "climatology"])
    ax1.set_ylabel("realised cost per window")
    _panel(ax1, "a")
    cost_panel(ax2, ["fitted", "fitted_naive_delay", "fitted_ht_delay", "ma_poisson_delay"])
    _panel(ax2, "b")
    # (c) precision-recall at the three thresholds
    _style(ax3, "both")
    for m in ["oracle", "fitted", "fitted_naive_delay", "fitted_ht_delay", "ma_poisson", "climatology"]:
        col, mk, ls, lab = M_STYLE[m]
        rec = [_f(meth[m]["alerts"][r]["recall"]) for r in ratios]
        pre = [_f(meth[m]["alerts"][r]["precision"]) for r in ratios]
        ax3.plot(rec, pre, marker=mk, ls=ls, ms=3.6, lw=0.8, color=col, label=lab)
    ax3.axhline(s["surge_rate_test"], color="#999999", lw=0.8, ls=(0, (1, 1)))
    ax3.set_xlim(0, 1.02)
    ax3.set_ylim(0, 1.02)
    ax3.set_xlabel("recall (hit rate)")
    ax3.set_ylabel("precision")
    ax3.text(0.97, 0.97, "markers as in (a), (b);\nthree points per method =\nthree cost ratios", transform=ax3.transAxes,
             ha="right", va="top", fontsize=6.0, color="#222222")
    _panel(ax3, "c")
    # (d)-(f) PIT histograms
    hall = {m: meth[m]["pit_hist"] for m in meth}
    _pit_panel(ax4, hall, ["oracle", "fitted", "ma_poisson", "climatology"], "all forecast windows")
    ax4.set_ylabel("density")
    _panel(ax4, "d")
    if split is not None:
        hno = {m: split[m]["no_new_shock"]["pit_hist"] for m in E6_KEYS if m in split}
        _pit_panel(ax5, hno, ["oracle", "fitted", "ma_poisson", "climatology"], "windows without a new event")
        _panel(ax5, "e")
        _pit_panel(ax6, hno, ["fitted", "fitted_naive_delay", "fitted_ht_delay"], "no new event, with delays")
        _panel(ax6, "f")
    else:  # pragma: no cover - older result files
        ax5.axis("off")
        ax6.axis("off")
    fig.savefig(path)
    plt.close(fig)


# ---------------------------------------------------------------------------
# Table
# ---------------------------------------------------------------------------
def _num(x, d=3, sign=False):
    x = _f(x)
    if not np.isfinite(x):
        return "---"
    s = f"{x:+.{d}f}" if sign else f"{x:.{d}f}"
    return s.replace("-", "$-$").replace("+", "$+$") if sign else s.replace("-", "$-$")


def _pct(x):
    x = _f(x)
    return "---" if not np.isfinite(x) else f"{100 * x:.0f}"


def table_main(res, path):
    ex = res["experiments"]
    L = []
    A = L.append
    A("% Generated by code/make_figures.py from results/sim_results.json -- do not edit by hand.")
    A("% Bias and RMSE are relative to the stated target; Cov.: coverage of nominal 95% intervals (%),")
    A("% or, for E4, the rejection rate at the 5% level (%). E2: n_eff = alpha_hat * mean(1 - exp(-beta_hat (T - t_l))),")
    A("% the in-window branching ratio of a fit to Cox data with NO contagion; the target is the second-order pseudo-true")
    A("% value n* = 1 - (1 + kappa)^(-1/2) for the constant-background MLE and the true n = 0 for the remedies (spline")
    A("% background, shock times known). E4: Target = true alpha_off,on, Mean = mean estimate of alpha_off,on, last")
    A("% column = rejection rate (%) at the 5% level. E1 group rows (several entries) report the mean |bias|,")
    A("% the mean RMSE and the range of coverages over the entries.")
    rs = {k: v.get("R") for k, v in ex.items()}
    A(f"% Replications: {json.dumps(rs)}")
    A(r"\begin{tabular}{@{}lllrrrrr@{}}")
    A(r"\toprule")
    A(r"Exp. & Quantity & Setting & Target & Mean & Bias & RMSE & Cov. \\")
    A(r"\midrule")
    if "E1" in ex:
        lab = {"mu[0]": r"$\mu_1$", "alpha[0,0]": r"$\alpha_{11}$", "alpha[0,2]": r"$\alpha_{13}$ (on$\to$off)",
               "alpha[2,0]": r"$\alpha_{31}$ (off$\to$on)", "beta": r"$\beta$", "shock_beta[2]": r"$\beta_3$ (online loading)",
               "eta": r"$\eta$"}
        dlab = {"Mult[0,2]": r"$M_{13}$", "rho(A)": r"$\varrho(\Amat)$"}
        first = True
        for bt in ex["E1"]["summary"]["by_T"]:
            T = f"$T={_f(bt['T']):.0f}$"
            rows = [(lab[n], bt["params"][n]) for n in lab] + [(dlab[n], bt["derived"][n]) for n in dlab]
            for name, v in rows:
                A(f"{'E1' if first else ''} & {name} & {T} & {_num(v['truth'])} & {_num(v['mean'])} & "
                  f"{_num(v['bias'], sign=True)} & {_num(v['rmse'])} & {_pct(v['coverage'])} \\\\")
                first = False
            for grp, nm in (("alpha", r"all $\alpha_{kj}$ (9)"), ("Mult", r"all $M_{kj}$ (9)"),
                            ("shock_beta", r"all $\beta_k$ (3)")):
                g = bt["aggregates"][grp]
                A(f" & {nm} & {T} & --- & --- & {_num(g['mean_abs_bias'])} & {_num(g['mean_rmse'])} & "
                  f"{_pct(g['coverage_min'])}--{_pct(g['coverage_max'])} \\\\")
            A(r"\addlinespace")
    if "E2" in ex:
        confs = ex["E2"]["summary"]["configs"]
        fam_lab = {"rare": "rare shocks", "frequent": "freq.\\ shocks", "slow": "slow regimes"}
        first = True
        for c in confs:
            ks = [x["kappa"] for x in confs if x["family"] == c["family"]]
            klo = min([k for k in ks if k >= 1.0] or ks)
            if c["kappa"] not in (klo, max(ks)):
                continue
            for fk, fl in (("const", "const."), ("spline", "spline"), ("shocks", "shocks known")):
                if fk not in c["fits"]:
                    continue
                v = c["fits"][fk]["n_eff"]
                if fk == "const":  # target: the second-order pseudo-true value n*
                    tgt = _f(c["theory"]["n_star"])
                    g = c["fits"][fk]["gap_neff_minus_nstar"]
                    bias, sd, n = _f(g["mean"]), _f(g["sd"]), g["n"]
                else:  # remedies: target is the true n = 0 (no contagion)
                    tgt = 0.0
                    bias, sd, n = _f(v["mean"]), _f(v["sd"]), v["n"]
                rmse = math.sqrt(bias ** 2 + sd ** 2 * (n - 1) / max(n, 1)) if n else float("nan")
                qn = r"$\hat n_{\mathrm{eff}}$"
                tg = f"$n^*={_num(tgt)}$" if fk == "const" else "$n=0$"
                A(f"{'E2' if first else ''} & {qn}, {fl} & {fam_lab.get(c['family'], c['family'])}, $\\kappa={c['kappa']:g}$ & "
                  f"{tg} & {_num(v['mean'])} & {_num(bias, sign=True)} & {_num(rmse)} & --- \\\\")
                first = False
        A(r"\addlinespace")
    if "E3" in ex:
        first = True
        for h in ex["E3"]["summary"]["homogeneous"]:
            if abs(_f(h["n"]) - 0.5) > 1e-9 and abs(_f(h["n"]) - 0.7) > 1e-9:
                continue
            for r in h["by_p"]:
                if abs(_f(r["p"]) - 0.4) > 1e-9:
                    continue
                st = f"$n={_f(h['n']):g}$, $p={_f(r['p']):g}$"
                for nm, key, tgt in ((r"$\hat n'$ vs $n'(p)$", "naive_vs_napp", r["n_app_theory"]),
                                     (r"$\hat n'$ vs $n$", "naive_vs_n", h["n"]),
                                     (r"$h_p^{-1}(\hat n')$, $p$ known", "corrected_known_p", h["n"]),
                                     (r"$h_{\hat p}^{-1}(\hat n')$, $p$ est.", "corrected_est_p", h["n"])):
                    v = r[key]
                    A(f"{'E3' if first else ''} & {nm} & {st} & {_num(tgt)} & {_num(v['mean'])} & {_num(v['bias'], sign=True)} & "
                      f"{_num(v['rmse'])} & {_pct(v['coverage'])} \\\\")
                    first = False
        for h in ex["E3"]["summary"]["heterogeneous"]:
            if h["case"] != "positive":
                continue
            v = h["n_corrected_vs_nbar"]
            A(f" & $h_{{\\bar p}}^{{-1}}(\\hat n'')$ & heterog., $\\mathrm{{Cov}}(p_X,n_X)>0$ & {_num(v['truth'])} & {_num(v['mean'])} & "
              f"{_num(v['bias'], sign=True)} & {_num(v['rmse'])} & --- \\\\")
        A(r"\addlinespace")
    if "E4" in ex:
        first = True
        for r in ex["E4"]["summary"]["scenarios"]:
            if r["name"] == "common_shock":
                rows = [(r"rejection, calendar omitted", r["without_shocks"]["reject_0.05"], r["alpha_hat"]),
                        (r"rejection, calendar in model", r["with_shocks"]["reject_0.05"], r["alpha_hat_with_shocks"])]
                st = r"common shock"
            else:
                rows = [(r"rejection ($\bar\chi^2$)", r["without_shocks"]["reject_0.05"], r["alpha_hat"])]
                st = "size" if r["name"] == "size" else "power"
            for nm, rr, ah in rows:
                A(f"{'E4' if first else ''} & {nm} & {st}, $\\alpha_{{\\mathrm{{off,on}}}}={_f(r['alpha_true']):g}$ & "
                  f"{_num(r['alpha_true'], 2)} & {_num(ah['mean'])} & --- & --- & {_pct(rr['rate'])} \\\\")
                first = False
        A(r"\addlinespace")
    if "E5" in ex:
        s = ex["E5"]["summary"]
        H = s["H_list"][-1]
        tag = f"H{H:g}"
        est = s["estimated"][-1]
        first = True
        for key, nm in ((f"B[0]@{tag}", r"$B_1$"), (f"D[0]@{tag}", r"$D_1$"), (f"C[0]@{tag}", r"$C_1$"),
                        (f"share[0]@{tag}", r"$C_1/(D_1+C_1)$"), (f"sigma[0]@{tag}", r"$\sigma_1$ (online channel)"),
                        (f"C[2]@{tag}", r"$C_3$ (online)"), ("C[0]@inf", r"$C_1(\infty)$")):
            v = est["quantities"].get(key)
            if v is None:
                continue
            hh = r"$H=\infty$" if key.endswith("inf") else f"$H={H:g}$"
            A(f"{'E5' if first else ''} & {nm} & {hh}, $T={_f(est['T']):.0f}$ & {_num(v['truth'])} & {_num(v['mean'])} & "
              f"{_num(v['bias'], sign=True)} & {_num(v['rmse'])} & {_pct(v['coverage'])} \\\\")
            first = False
    A(r"\bottomrule")
    A(r"\end{tabular}")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--results", default=os.path.join(HERE, "..", "results"))
    ap.add_argument("--figures", default=os.path.join(HERE, "..", "figures"))
    ap.add_argument("--tables", default=os.path.join(HERE, "..", "tables"))
    a = ap.parse_args(argv)
    res = load(a.results)
    os.makedirs(a.figures, exist_ok=True)
    os.makedirs(a.tables, exist_ok=True)
    ex = res["experiments"]
    done = []
    if "E1" in ex:
        fig_recovery(res, os.path.join(a.figures, "fig-sim-recovery.pdf"))
        done.append("fig-sim-recovery.pdf")
    if "E2" in ex:
        fig_spurious(res, os.path.join(a.figures, "fig-sim-spurious.pdf"))
        done.append("fig-sim-spurious.pdf")
    if "E3" in ex:
        fig_thinning(res, os.path.join(a.figures, "fig-sim-thinning.pdf"))
        done.append("fig-sim-thinning.pdf")
    if "E4" in ex:
        fig_lrt(res, load_raw(a.results, "E4"), os.path.join(a.figures, "fig-sim-lrt.pdf"))
        done.append("fig-sim-lrt.pdf")
    if "E5" in ex:
        fig_attribution(res, os.path.join(a.figures, "fig-sim-attribution.pdf"))
        done.append("fig-sim-attribution.pdf")
    if "E6" in ex:
        fig_alert(res, os.path.join(a.figures, "fig-sim-alert.pdf"))
        done.append("fig-sim-alert.pdf")
    table_main(res, os.path.join(a.tables, "tab-sim-main.tex"))
    done.append("tab-sim-main.tex")
    print("wrote", ", ".join(done))


if __name__ == "__main__":
    main()
