#!/usr/bin/env python
"""Figures and LaTeX tables for the simulation section (sec:simulation) and its appendix.

Reads ../results/sim_results.json (and ../results/raw/E4.json for the null
p-values) written by run_experiments.py, and writes
  ../figures/fig-sim-recovery.pdf     E1: relative bias / RMSE by parameter; CI coverage by quantity (appendix)
  ../figures/fig-sim-spurious.pdf     E2: fitted n vs kappa with n* = 1 - (1+kappa)^{-1/2}; long window; remedies
  ../figures/fig-sim-thinning.pdf     E3: fitted n vs p; corrected estimates; variance floor; heterogeneous recording
  ../figures/fig-sim-lrt.pdf          E4: size / power, null p-value P-P plot, common-shock false positives
  ../figures/fig-sim-attribution.pdf  E5: B / D / C and shares, exact vs Monte Carlo vs estimated (appendix)
  ../figures/fig-sim-alert.pdf        E6: realised cost, precision / recall, PIT (no-future-event vs integrating)
  ../tables/tab-sim-e1.tex ... tab-sim-e6.tex   one booktabs tabular per experiment (one metric per column)
No titles inside plots; captions belong in LaTeX. Legends sit outside the data region.
Style matches Paper 1 (../dark-figure/code/make_figures.py): serif, stix mathtext,
Okabe-Ito colours, every series also with its own marker / line style.
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
        return rf"$\upsilon_{{{int(nm[11]) + 1}}}$"
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
              ("$\\upsilon_k$", lambda n, d: n.startswith("shock_beta[") and not d),
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
    confs_all = res["experiments"]["E2"]["summary"]["configs"]
    confs = [c for c in confs_all if not c.get("long_T")]
    longs = [c for c in confs_all if c.get("long_T")]
    fams = []
    for c in confs:
        if c["family"] not in fams:
            fams.append(c["family"])
    kap_all = np.array([c["kappa"] for c in confs])
    kk = np.geomspace(kap_all.min() / 1.3, kap_all.max() * 1.3, 200)
    nstar = 1 - (1 + kk) ** -0.5
    fig, axes = plt.subplots(1, 2, figsize=(W2, 2.8), layout="constrained", sharey=True)
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
    if longs:
        for c in longs:
            col, mk, lab = _family_label(c)
            kx = c["kappa"] * 1.13
            ax1.errorbar(kx, _f(c["fits"]["const"]["n_eff"]["mean"]), yerr=1.96 * _f(c["fits"]["const"]["n_eff"]["mcse"]),
                         fmt="*", ms=7.5, color=col, mec="#222222", mew=0.5, capsize=0, zorder=4)
        T_long = _f(longs[0]["T"])
        handles.append(Line2D([], [], color=FAM_STYLE["rare"][0], marker="*", mec="#222222", mew=0.5, ls="none", ms=7.5,
                              label=rf"rare, constant background, $T={T_long:.0f}$"))
    ax1.set_ylabel(r"fitted branching ratio $\hat n_{\mathrm{eff}}$")
    _panel(ax1, "a")
    # (b) remedies
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
    handles += [Line2D([], [], color=INK2, marker="o", mfc="white", ls="--", ms=4, lw=0.9, label="(b) spline background"),
                Line2D([], [], color=INK2, marker="o", ls=":", ms=4, lw=0.9, label="(b) shock times known")]
    _panel(ax2, "b")
    ymax = max(0.8, max(_f(c["fits"]["const"]["n_eff"]["mean"]) for c in confs) + 0.12)
    ax1.set_ylim(-0.05, ymax)
    fig.legend(handles=handles, loc="outside upper center", ncol=3, frameon=False, fontsize=6.8,
               handlelength=2.2, columnspacing=1.6)
    fig.savefig(path)
    plt.close(fig)


# ---------------------------------------------------------------------------
# E3  Thinning
# ---------------------------------------------------------------------------
N_STYLE = [(C_BLUE, "o"), (C_VERM, "s"), (C_GREEN, "D"), (C_PINK, "^")]
R_RAMP = ["#000000", "#3d3d3d", "#696969", "#949494"]  # one-hue grey ramp (lightest >= 3:1 on white): p known, r = 0.1, 0.3, 0.5
R_MARK = ["o", "s", "D", "^"]


def _h(n, p):
    q = (1 - n) ** 2
    return 1 - (1 - n) / np.sqrt(q + p * (1 - q))


def fig_thinning(res, path, n_floor=0.5):
    s = res["experiments"]["E3"]["summary"]
    hom = s["homogeneous"]
    fig, axes = plt.subplots(2, 2, figsize=(W2, 4.25), layout="constrained")
    (ax1, ax2), (ax3, ax4) = axes
    pp = np.linspace(0.05, 1, 200)
    for ax in (ax1, ax2, ax3):
        _style(ax, "both")
        ax.set_xlabel(r"recording probability $p$")
        ax.set_xlim(0.1, 1.05)
    handles = []
    for i, h in enumerate(hom):
        col, mk = N_STYLE[i % len(N_STYLE)]
        n = _f(h["n"])
        p = np.array([_f(r["p"]) for r in h["by_p"]])
        m = np.array([_f(r["naive_vs_n"]["mean"]) for r in h["by_p"]])
        e = np.array([1.96 * _f(r["naive_vs_n"]["sd"]) / math.sqrt(max(r["naive_vs_n"]["n"], 1)) for r in h["by_p"]])
        ax1.plot(pp, _h(n, pp), color=col, lw=1.0, zorder=2)
        ax1.plot(pp, n * pp, color=col, lw=0.6, ls=":", zorder=2)
        ax1.errorbar(p, m, yerr=e, fmt=mk, ms=4, color=col, capsize=0, zorder=3)
        handles.append(Line2D([], [], color=col, marker=mk, ms=4, lw=1.0, label=f"$n={n:g}$"))
        mk_ = np.array([_f(r["corrected_known_p"]["mean"]) for r in h["by_p"]])
        ek = np.array([1.96 * _f(r["corrected_known_p"]["sd"]) / math.sqrt(max(r["corrected_known_p"]["n"], 1)) for r in h["by_p"]])
        me = np.array([_f(r["corrected_est_p"]["mean"]) for r in h["by_p"]])
        ee = np.array([1.96 * _f(r["corrected_est_p"]["sd"]) / math.sqrt(max(r["corrected_est_p"]["n"], 1)) for r in h["by_p"]])
        ax2.axhline(n, color=col, lw=0.8, zorder=1)
        ax2.errorbar(p - 0.012, mk_, yerr=ek, fmt=mk, ms=4, color=col, capsize=0, zorder=3)
        ax2.errorbar(p + 0.012, me, yerr=ee, fmt=mk, ms=4, mfc="white", color=col, capsize=0, zorder=3)
    handles += [Line2D([], [], color=INK2, lw=1.0, label=r"(a) $n'=h_p(n)$"),
                Line2D([], [], color=INK2, lw=0.6, ls=":", label=r"(a) $pn$"),
                Line2D([], [], color=INK2, marker="o", ls="none", ms=4, label=r"(b) $h_p^{-1}(\hat n')$, $p$ known"),
                Line2D([], [], color=INK2, marker="o", mfc="white", ls="none", ms=4,
                       label=r"(b) $h_{\hat p}^{-1}(\hat n')$, $\hat p$ with 10% error")]
    ax1.set_ylabel(r"fitted $\hat n'$ (recorded incidents)")
    ax1.set_ylim(0, 0.8)
    ax2.set_ylabel(r"corrected $\hat n$")
    ax2.set_ylim(0, 0.9)
    _panel(ax1, "a")
    _panel(ax2, "b")
    # (c) variance floor: RMSE of the corrected estimate against p, by the relative error of p_hat
    hh = [h for h in hom if abs(_f(h["n"]) - n_floor) < 1e-9]
    if hh and hh[0]["by_p"][0].get("corrected_est_p_by_r"):
        h = hh[0]
        p = np.array([_f(r["p"]) for r in h["by_p"]])
        rk = np.array([_f(r["corrected_known_p"]["rmse"]) for r in h["by_p"]])
        ax3.plot(p, rk, marker=R_MARK[0], ms=4, lw=0.9, color=R_RAMP[0], zorder=3)
        hc = [Line2D([], [], color=R_RAMP[0], marker=R_MARK[0], ms=4, lw=0.9, label="$p$ known")]
        rlist = [x["r"] for x in h["by_p"][0]["corrected_est_p_by_r"]]
        for i, r_ in enumerate(rlist):
            rm = np.array([_f(r["corrected_est_p_by_r"][i]["rmse"]) for r in h["by_p"]])
            fl = _f(h["by_p"][0]["corrected_est_p_by_r"][i]["floor_sd"])
            col = R_RAMP[min(i + 1, len(R_RAMP) - 1)]
            ax3.plot(p, rm, marker=R_MARK[min(i + 1, 3)], ms=4, lw=0.9, color=col, zorder=3)
            ax3.axhline(fl, color=col, lw=0.8, ls=(0, (3, 2)), zorder=2)
            hc.append(Line2D([], [], color=col, marker=R_MARK[min(i + 1, 3)], ms=4, lw=0.9, label=f"error {100 * r_:.0f}%"))
        hc.append(Line2D([], [], color=INK2, lw=0.8, ls=(0, (3, 2)), label="floor (dashed)"))
        ax3.set_ylabel(r"RMSE of corrected $\hat n$")  # n = n_floor is stated in the caption
        top = max(0.16, 1.55 * np.nanmax([_f(x["rmse"]) for r in h["by_p"] for x in r["corrected_est_p_by_r"]]))
        ax3.set_ylim(0, top)
        ax3.legend(handles=hc, loc="upper center", ncol=3, frameon=False, fontsize=6.3, columnspacing=1.0,
                   handlelength=1.8)
    _panel(ax3, "c")
    # (d) heterogeneous recording
    het = s["heterogeneous"]
    _style(ax4, "y")
    x = np.arange(len(het))
    for i, h in enumerate(het):
        th = h["theory"]
        ax4.plot([i - 0.32, i - 0.04], [th["n_app_theory"]] * 2, color=TRUTH, lw=1.1, zorder=2)
        ax4.plot([i + 0.04, i + 0.32], [th["n_naive_theory"]] * 2, color=TRUTH, lw=1.1, zorder=2)
        a = h["n_app_vs_theory"]
        b = h["n_corrected_vs_naive_theory"]
        ax4.errorbar(i - 0.18, _f(a["mean"]), yerr=1.96 * _f(a["sd"]) / math.sqrt(max(a["n"], 1)), fmt="o", ms=4,
                     color=C_BLUE, capsize=0, zorder=3)
        ax4.errorbar(i + 0.18, _f(b["mean"]), yerr=1.96 * _f(b["sd"]) / math.sqrt(max(b["n"], 1)), fmt="s", ms=4,
                     color=C_VERM, capsize=0, zorder=3)
    nbar = het[0]["theory"]["n_bar"]
    ax4.axhline(nbar, color=INK2, lw=0.7, ls="--", zorder=1)
    ax4.set_xticks(x)
    short = {"positive": r"Cov$>$0", "homogeneous": "equal", "negative": r"Cov$<$0", "complete": "complete"}
    labs = []
    for h in het:
        px = h["theory"]["p_x"]
        labs.append(f"({px[0]:g}, {px[1]:g})\n{short.get(h['case'], h['case'])}")
    ax4.set_xticklabels(labs, fontsize=7)
    nx = het[0]["theory"]["n_x"]
    ax4.set_xlabel(rf"recording $(p_1,p_2)$; $(n_1,n_2)=({nx[0]:g},{nx[1]:g})$")
    ax4.set_ylabel("branching ratio")
    ax4.set_ylim(0.25, 0.8)
    ax4.set_xlim(-0.5, len(het) - 0.5)
    ax4.legend(handles=[Line2D([], [], color=C_BLUE, marker="o", ls="none", ms=4, label=r"fitted $\hat n''$"),
                        Line2D([], [], color=C_VERM, marker="s", ls="none", ms=4, label=r"$h_{\bar p}^{-1}(\hat n'')$"),
                        Line2D([], [], color=TRUTH, lw=1.1, label="theory"),
                        Line2D([], [], color=INK2, lw=0.7, ls="--", label=r"true $\bar n$")],
               loc="upper center", frameon=False, fontsize=6.5, ncol=4, columnspacing=1.0, handlelength=1.6)
    _panel(ax4, "d")
    fig.legend(handles=handles, loc="outside upper center", ncol=4, frameon=False, fontsize=6.8, columnspacing=1.4)
    fig.savefig(path, bbox_inches="tight")  # keeps the panel (c) y-label inside the page
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
    ax1.legend(loc="lower right", bbox_to_anchor=(1.0, 0.09), frameon=False, fontsize=6.6)
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
        ax2.text(0.48, 0.02, rf"$\Pr(\mathrm{{LR}}=0)={p0:.2f}$", fontsize=6.8, va="bottom", ha="right")
    ax2.set_xlim(0, 0.5)
    ax2.set_ylim(0, 0.5)
    ax2.set_xlabel(r"nominal level $u$")
    ax2.set_ylabel(r"$\Pr(p\text{-value}\leq u)$ under $H_0$")
    ax2.legend(loc="upper left", frameon=False, fontsize=6.6)
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
    short = ["A", "B", "online"]
    for k in range(M):
        items.append((f"share[{k}]@{tag}", short[k] if k < len(short) else str(k + 1), "share", k))
    for sh in val["shares"]:
        if "sigma_exact" in sh:
            k = sh["stream"]
            items.append((f"sigma[{k}]@{tag}", short[k] if k < len(short) else str(k + 1), "sigma", k))
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
    ax2.set_xticklabels([it[1] for it in items], fontsize=7)
    n_sh = sum(it[2] == "share" for it in items)
    ax2.axvline(n_sh - 0.5, color=GRID, lw=0.6)
    ax2.text((n_sh - 1) / 2, 1.0, r"$C_k/(D_k+C_k)$", transform=ax2.get_xaxis_transform(), ha="center", va="bottom", fontsize=7)
    ax2.text(n_sh + (len(items) - n_sh - 1) / 2, 1.0, r"$\sigma_k$", transform=ax2.get_xaxis_transform(), ha="center",
             va="bottom", fontsize=7)
    ax2.set_ylim(0, 1)
    ax2.set_ylabel(rf"share, $H={H:g}$")
    _panel(ax2, "b")
    fig.savefig(path)
    plt.close(fig)


# ---------------------------------------------------------------------------
# E6  Alerting
# ---------------------------------------------------------------------------
# (colour, marker, line style, hollow marker?, label). Solid lines / filled markers: forecasters that
# integrate over future events (the conditional law given the past); dashed / hollow: no future events.
M_STYLE = {
    "oracle": (TRUTH, "o", "--", True, "true par., no future events"),
    "oracle_int": (TRUTH, "o", "-", False, "true par., integrating"),
    "fitted": (C_BLUE, "s", "--", True, "fitted, no future events"),
    "fitted_int": (C_BLUE, "s", "-", False, "fitted, integrating"),
    "fitted_naive_delay": (C_PINK, "v", "--", True, "fitted, naive state, no future events"),
    "fitted_ht_delay": (C_GREEN, "D", "--", True, "fitted, HT nowcast, no future events"),
    "fitted_naive_delay_int": (C_PINK, "v", "-", False, "delays: naive state"),
    "fitted_ht_delay_int": (C_GREEN, "D", "-", False, "delays: HT nowcast"),
    "ma_poisson": (C_VERM, "^", "-.", False, "moving-average (MA) Poisson"),
    "ma_poisson_delay": (C_VERM, "^", ":", True, "delays: MA Poisson, available"),
    "climatology": (C_ORANGE, "X", "-.", False, "climatology"),
}
E6_KEYS = list(M_STYLE)


def _mhandle(m):
    col, mk, ls, hollow, lab = M_STYLE[m]
    return Line2D([], [], color=col, marker=mk, ls=ls, ms=3.8, lw=0.9, mfc="white" if hollow else col, label=lab)


def _pit_density(h):
    h = np.array(h, float)
    return h / max(h.sum(), 1) * h.size


def _pit_panel(ax, hists, keys, note):
    _style(ax, "y")
    top = 1.6
    for m in keys:
        if m not in hists:
            continue
        col, mk, ls, hollow, lab = M_STYLE[m]
        dens = _pit_density(hists[m])
        top = max(top, dens.max() * 1.18)
        ax.stairs(dens, np.linspace(0, 1, dens.size + 1), color=col, lw=1.1, ls=ls)
    ax.axhline(1.0, color=INK2, lw=0.6)
    ax.set_xlabel("randomised PIT")
    ax.set_xlim(0, 1)
    ax.set_ylim(0, top + 0.35)
    ax.text(0.5, 0.98, note, transform=ax.transAxes, ha="center", va="top", fontsize=6.8, color="#222222")


def fig_alert(res, path):
    s = res["experiments"]["E6"]["summary"]
    meth = s["methods"]
    split = s.get("calibration_by_new_shock")
    has_int = "oracle_int" in meth
    ratios = sorted(meth["oracle"]["alerts"].keys(), key=float)
    rx = np.array([float(r) for r in ratios])
    fig, axes = plt.subplots(2, 3, figsize=(W2, 4.5), layout="constrained")
    (ax1, ax2, ax3), (ax4, ax5, ax6) = axes
    base = s["surge_rate_test"]

    def cost_panel(ax, keys):
        _style(ax, "y")
        keys = [m for m in keys if m in meth]
        n = len(keys)
        offs = np.linspace(-0.07, 0.07, n) if n > 1 else [0.0]
        for i, m in enumerate(keys):
            col, mk, ls, hollow, lab = M_STYLE[m]
            c = np.array([_f(meth[m]["alerts"][r]["cost_per_window"]["mean"]) for r in ratios])
            e = np.array([1.96 * _f(meth[m]["alerts"][r]["cost_per_window"]["mcse"]) for r in ratios])
            ax.errorbar(rx * (1 + offs[i]), c, yerr=e, fmt=mk, ls=ls, ms=3.6, lw=0.9, color=col,
                        mfc="white" if hollow else col, capsize=0, zorder=3)
        ax.plot(rx, np.minimum(rx * base, 1 - base), color="#999999", lw=0.8, ls=(0, (1, 1)), zorder=1)
        ax.set_xscale("log")
        ax.set_xticks(rx)
        ax.set_xticklabels([f"{x:g}" for x in rx])
        ax.minorticks_off()
        ax.set_xlabel(r"cost ratio $c_{\mathrm{miss}}/c_{\mathrm{FA}}$")
        ax.set_ylim(0, 1.0)

    k_a = ["oracle", "oracle_int", "fitted", "fitted_int", "ma_poisson", "climatology"]
    cost_panel(ax1, k_a)
    ax1.set_ylabel("realised cost per window")
    ax1.text(0.03, 0.97, "complete data", transform=ax1.transAxes, ha="left", va="top", fontsize=6.8)
    _panel(ax1, "a")
    k_b = (["fitted_int", "fitted_naive_delay_int", "fitted_ht_delay_int", "ma_poisson_delay"] if has_int
           else ["fitted", "fitted_naive_delay", "fitted_ht_delay", "ma_poisson_delay"])
    cost_panel(ax2, k_b)
    ax2.text(0.03, 0.97, "reporting delays", transform=ax2.transAxes, ha="left", va="top", fontsize=6.8)
    _panel(ax2, "b")
    # (c) precision-recall at the three thresholds
    _style(ax3, "both")
    k_c = ["oracle", "oracle_int", "fitted", "fitted_int", "fitted_naive_delay_int", "fitted_ht_delay_int", "ma_poisson",
           "climatology"]
    for m in [m for m in k_c if m in meth]:
        col, mk, ls, hollow, lab = M_STYLE[m]
        rec = [_f(meth[m]["alerts"][r]["recall"]) for r in ratios]
        pre = [_f(meth[m]["alerts"][r]["precision"]) for r in ratios]
        ax3.plot(rec, pre, marker=mk, ls=ls, ms=3.6, lw=0.8, color=col, mfc="white" if hollow else col)
    ax3.axhline(base, color="#999999", lw=0.8, ls=(0, (1, 1)))
    ax3.set_xlim(0, 1.0)
    ax3.set_ylim(0, 1.0)
    ax3.set_xlabel("recall (hit rate)")
    ax3.set_ylabel("precision")
    ax3.text(0.97, 0.97, "one point per cost ratio", transform=ax3.transAxes, ha="right", va="top", fontsize=6.4)
    _panel(ax3, "c")
    # (d)-(f) PIT histograms
    hall = {m: meth[m]["pit_hist"] for m in meth}
    _pit_panel(ax4, hall, ["oracle", "oracle_int", "fitted", "fitted_int"], "all 1800 windows")
    ax4.set_ylabel("density")
    _panel(ax4, "d")
    if split is not None and has_int:
        m = "oracle_int"
        col = M_STYLE[m][0]
        d_no = _pit_density(split[m]["no_new_shock"]["pit_hist"])
        d_new = _pit_density(split[m]["new_shock"]["pit_hist"])
        _style(ax5, "y")
        edges = np.linspace(0, 1, d_no.size + 1)
        ax5.stairs(d_new, edges, color=col, lw=1.1, ls="-", zorder=3)
        ax5.stairs(d_no, edges, color=INK2, lw=1.1, ls=(0, (2, 1.2)), zorder=3)
        ax5.axhline(1.0, color=INK2, lw=0.6)
        top = max(d_new.max(), d_no.max())
        ax5.set_ylim(0, top * 1.22)
        ax5.set_xlim(0, 1)
        ax5.set_xlabel("randomised PIT")
        n_new, n_no = split[m]["new_shock"]["n"], split[m]["no_new_shock"]["n"]
        ax5.text(0.5, 0.98, "true par., integrating, by window", transform=ax5.transAxes, ha="center", va="top",
                 fontsize=6.8, color="#222222")
        ax5.annotate(f"event arrives\n({n_new} windows)", xy=(0.85, d_new[-2]), xytext=(0.52, top * 0.80), fontsize=6.4,
                     ha="center", va="center", arrowprops=dict(arrowstyle="-", color=INK2, lw=0.5))
        ax5.annotate(f"no event\n({n_no} windows)", xy=(0.15, d_no[1]), xytext=(0.3, top * 0.45), fontsize=6.4,
                     ha="center", va="center", arrowprops=dict(arrowstyle="-", color=INK2, lw=0.5))
        _panel(ax5, "e")
        _pit_panel(ax6, hall, ["fitted_int", "fitted_naive_delay_int", "fitted_ht_delay_int"], "delays, all windows")
        _panel(ax6, "f")
    elif split is not None:  # pragma: no cover - older result files
        hno = {m: split[m]["no_new_shock"]["pit_hist"] for m in E6_KEYS if m in split}
        _pit_panel(ax5, hno, ["oracle", "fitted"], "windows without a new event")
        _panel(ax5, "e")
        _pit_panel(ax6, hno, ["fitted", "fitted_naive_delay", "fitted_ht_delay"], "no new event, with delays")
        _panel(ax6, "f")
    else:  # pragma: no cover
        ax5.axis("off")
        ax6.axis("off")
    order = ["oracle_int", "oracle", "fitted_int", "fitted", "ma_poisson", "climatology", "fitted_naive_delay_int",
             "fitted_ht_delay_int", "ma_poisson_delay"]
    hd = [_mhandle(m) for m in order if m in meth]
    hd.append(Line2D([], [], color="#999999", lw=0.8, ls=(0, (1, 1)), label="best constant rule; (c) surge rate"))
    fig.legend(handles=hd, loc="outside upper center", ncol=3, frameon=False, fontsize=6.6, columnspacing=1.8,
               handlelength=2.3)
    fig.savefig(path)
    plt.close(fig)


# ---------------------------------------------------------------------------
# Tables: one booktabs tabular per experiment, one metric per column. The table
# environments (captions, panels) are in sections/08-simulation.tex and appendix C.
# ---------------------------------------------------------------------------
TABLES = ["tab-sim-e1.tex", "tab-sim-e2.tex", "tab-sim-e3.tex", "tab-sim-e4.tex", "tab-sim-e5.tex", "tab-sim-e6.tex"]


def _num(x, d=3, sign=False):
    x = _f(x)
    if not np.isfinite(x):
        return "---"
    s = f"{x:+.{d}f}" if sign else f"{x:.{d}f}"
    return s.replace("-", "$-$").replace("+", "$+$") if sign else s.replace("-", "$-$")


def _pct(x, d=1):
    """Percentage with d decimals, rounded half up (so 0.025 -> 2.5 and 0.0625 -> 6.3)."""
    from decimal import Decimal, ROUND_HALF_UP
    x = _f(x)
    if not np.isfinite(x):
        return "---"
    q = Decimal(1).scaleb(-d)
    return str(Decimal(repr(100 * x)).quantize(q, rounding=ROUND_HALF_UP))


def _header(L, note):
    L.append("% Generated by code/make_figures.py from results/sim_results.json -- do not edit by hand.")
    for line in note:
        L.append("% " + line)


def _write(path, L):
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")


def table_e1(res, path):
    ex = res["experiments"]
    L = []
    _header(L, ["E1 recovery. Cov.: coverage (%) of nominal 95% intervals. Group rows: mean |bias|, mean RMSE and",
                "range of coverage over the entries."])
    L += [r"\begin{tabular}{@{}llrrrrr@{}}", r"\toprule",
          r"Quantity & Setting & Target & Mean & Bias & RMSE & Cov.\ (\%) \\", r"\midrule"]
    lab = {"mu[0]": r"$\mu_1$", "alpha[0,0]": r"$\alpha_{11}$", "alpha[0,2]": r"$\alpha_{13}$ (on$\to$off)",
           "alpha[2,0]": r"$\alpha_{31}$ (off$\to$on)", "beta": r"$\beta$", "shock_beta[2]": r"$\upsilon_3$ (online loading)",
           "eta": r"$\eta$"}
    dlab = {"Mult[0,2]": r"$M_{13}$", "rho(A)": r"$\varrho(\Amat)$"}
    bts = ex["E1"]["summary"]["by_T"]
    for i, bt in enumerate(bts):
        T = f"$T={_f(bt['T']):.0f}$"
        rows = [(lab[n], bt["params"][n]) for n in lab] + [(dlab[n], bt["derived"][n]) for n in dlab]
        for name, v in rows:
            L.append(f"{name} & {T} & {_num(v['truth'])} & {_num(v['mean'])} & {_num(v['bias'], sign=True)} & "
                     f"{_num(v['rmse'])} & {_pct(v['coverage'], 0)} \\\\")
        for grp, nm in (("alpha", r"all $\alpha_{kj}$ (9)"), ("Mult", r"all $M_{kj}$ (9)"), ("shock_beta", r"all $\upsilon_k$ (3)")):
            g = bt["aggregates"][grp]
            L.append(f"{nm} & {T} & --- & --- & {_num(g['mean_abs_bias'])} & {_num(g['mean_rmse'])} & "
                     f"{_pct(g['coverage_min'], 0)}--{_pct(g['coverage_max'], 0)} \\\\")
        if i < len(bts) - 1:
            L.append(r"\addlinespace")
    L += [r"\bottomrule", r"\end{tabular}"]
    _write(path, L)


def _mm(d, dd=3):
    """mean (median) of an mstat dict."""
    return f"{_num(d['mean'], dd)} ({_num(d['median'], dd)})"


def table_e2(res, path):
    s = res["experiments"]["E2"]["summary"]
    L = []
    _header(L, ["E2 (no contagion). n_eff = alpha_hat * mean(1 - exp(-beta_hat (T - t_l))): mean (median) over replicates.",
                "Shocks: shocks per path, median [min, max] (incl. the 40-day lead-in). Ridge: fits with beta_hat * T < 1,",
                "for the constant / spline / shocks-known fits ('-' = fit not run)."])
    L += [r"\begin{tabular}{@{}lrrcrcccc@{}}", r"\toprule",
          r" & & & & & \multicolumn{3}{c}{$\hat n_{\mathrm{eff}}$, mean (median)} & \\",
          r"\cmidrule(lr){6-8}",
          r"Family & $\kappa$ & $T$ & Shocks per path & $n^*$ & Constant & Spline & Shocks known & Ridge \\",
          r"\midrule"]
    fam_lab = {"rare": r"Rare ($m=16$)", "frequent": r"Frequent ($m=4$)", "slow": r"Slow switching"}
    prev = None
    for c in s["configs"]:
        key = (c["family"], c.get("long_T", False))
        if prev is not None and key != prev:
            L.append(r"\addlinespace")
        fam = fam_lab.get(c["family"], c["family"]) if key != prev else ""
        if c.get("long_T") and key != prev:
            fam = fam_lab.get(c["family"], c["family"]) + ", long"
        prev = key
        ns = c.get("n_shots")
        shots = f"{_f(ns['median']):g} [{_f(ns['min']):.0f}, {_f(ns['max']):.0f}]" if ns else "---"
        cells, ridge = [], []
        for fk in ("const", "spline", "shocks"):
            if fk in c["fits"]:
                cells.append(_mm(c["fits"][fk]["n_eff"]))
                ridge.append(str(c["fits"][fk]["ridge"]["n"]))
            else:
                cells.append("---")
                ridge.append("-")
        L.append(f"{fam} & {c['kappa']:g} & {_f(c['T']):.0f} & {shots} & {_num(c['theory']['n_star'])} & "
                 f"{cells[0]} & {cells[1]} & {cells[2]} & {'/'.join(ridge)} \\\\")
    L += [r"\bottomrule", r"\end{tabular}"]
    _write(path, L)


def table_e3(res, path, p_row=0.4):
    s = res["experiments"]["E3"]["summary"]
    L = []
    _header(L, [f"E3 at p = {p_row:g}. Floor: r n (1 - n)(2 - n) / 2, the p-term of eq:th-delta for relative error r of p_hat.",
                "Cov.: coverage (%) of nominal 95% intervals (R = 40)."])
    L += [r"\begin{tabular}{@{}llrrrrrr@{}}", r"\toprule",
          r"Setting & Estimator & Target & Mean & Bias & RMSE & Floor & Cov.\ (\%) \\", r"\midrule"]
    first = True
    for h in s["homogeneous"]:
        n = _f(h["n"])
        if abs(n - 0.3) < 1e-9:
            continue
        for r in h["by_p"]:
            if abs(_f(r["p"]) - p_row) > 1e-9:
                continue
            if not first:
                L.append(r"\addlinespace")
            first = False
            st = f"$n={n:g}$, $p={_f(r['p']):g}$"
            rows = [(r"$\hat n'$ (naive)", r["naive_vs_n"], n, None),
                    (r"$h_p^{-1}(\hat n')$, $p$ known", r["corrected_known_p"], n, None)]
            for x in r.get("corrected_est_p_by_r", []):
                rows.append((rf"$h_{{\hat p}}^{{-1}}(\hat n')$, ${100 * x['r']:.0f}\%$ error", x, n, x["floor_sd"]))
            for i, (nm, v, tgt, fl) in enumerate(rows):
                L.append(f"{st if i == 0 else ''} & {nm} & {_num(tgt)} & {_num(v['mean'])} & {_num(_f(v['mean']) - _f(tgt), sign=True)} & "
                         f"{_num(v['rmse'])} & {_num(fl) if fl is not None else '---'} & {_pct(v['coverage'])} \\\\")
    for h in s["heterogeneous"]:
        if h["case"] != "positive":
            continue
        v = h["n_corrected_vs_nbar"]
        L.append(r"\addlinespace")
        L.append(f"heterog., $\\mathrm{{Cov}}(p_X,n_X)>0$ & $h_{{\\bar p}}^{{-1}}(\\hat n'')$ & {_num(v['truth'])} & {_num(v['mean'])} & "
                 f"{_num(v['bias'], sign=True)} & {_num(v['rmse'])} & --- & --- \\\\")
    L += [r"\bottomrule", r"\end{tabular}"]
    _write(path, L)


def table_e4(res, path):
    sc = res["experiments"]["E4"]["summary"]["scenarios"]
    L = []
    _header(L, ["E4. Rejection rates (%) at the 5% level with the chi-bar-square and the naive chi2_1 reference;",
                "P(LR = 0): share of statistics equal to 0 (%)."])
    L += [r"\begin{tabular}{@{}lrrrrrr@{}}", r"\toprule",
          r"Scenario & $R$ & True $\alpha_{\mathrm{off,on}}$ & Mean $\hat\alpha_{\mathrm{off,on}}$ & "
          r"Reject., $\bar\chi^2$ (\%) & Reject., $\chi^2_1$ (\%) & $\Pr(\mathrm{LR}=0)$ (\%) \\", r"\midrule"]
    for r in sc:
        if r["name"] == "common_shock":
            rows = [("common shocks, calendar omitted", r["without_shocks"], r["alpha_hat"]),
                    ("common shocks, calendar in model", r["with_shocks"], r["alpha_hat_with_shocks"])]
        else:
            rows = [("size" if r["name"] == "size" else "power", r["without_shocks"], r["alpha_hat"])]
        for nm, w, ah in rows:
            L.append(f"{nm} & {r['R']} & {_f(r['alpha_true']):g} & {_num(ah['mean'])} & {_pct(w['reject_0.05']['rate'])} & "
                     f"{_pct(w['reject_naive_chi2_1_0.05']['rate'])} & {_pct(w['P_stat_zero']['rate'])} \\\\")
    L += [r"\bottomrule", r"\end{tabular}"]
    _write(path, L)


def table_e5(res, path):
    s = res["experiments"]["E5"]["summary"]
    H = s["H_list"][-1]
    tag = f"H{H:g}"
    est = s["estimated"][-1]
    L = []
    _header(L, [f"E5 plug-in estimates from the E1 fits at T = {_f(est['T']):.0f}, H = {H:g} (and infinity). Cov.: coverage (%)",
                "of nominal 95% delta-method intervals (logit scale for shares)."])
    L += [r"\begin{tabular}{@{}lrrrrr@{}}", r"\toprule",
          r"Quantity & Truth & Mean & Bias & RMSE & Cov.\ (\%) \\", r"\midrule"]
    for key, nm in ((f"B[0]@{tag}", r"$B_1$"), (f"D[0]@{tag}", r"$D_1$"), (f"C[0]@{tag}", r"$C_1$"),
                    (f"share[0]@{tag}", r"$C_1/(D_1+C_1)$"), (f"sigma[0]@{tag}", r"$\sigma_1$ (online channel)"),
                    (f"D[2]@{tag}", r"$D_3$ (online)"), (f"C[2]@{tag}", r"$C_3$ (online)"), ("C[0]@inf", r"$C_1(\infty)$")):
        v = est["quantities"].get(key)
        if v is None:
            continue
        L.append(f"{nm} & {_num(v['truth'])} & {_num(v['mean'])} & {_num(v['bias'], sign=True)} & {_num(v['rmse'])} & "
                 f"{_pct(v['coverage'], 0)} \\\\")
    L += [r"\bottomrule", r"\end{tabular}"]
    _write(path, L)


E6_ROWS = [("Complete data", [("oracle", r"Hawkes, true par., no future events"), ("oracle_int", r"Hawkes, true par., integrating"),
                              ("fitted", r"Hawkes, fitted, no future events"), ("fitted_int", r"Hawkes, fitted, integrating"),
                              ("ma_poisson", "Moving-average Poisson"), ("climatology", "Climatology")]),
           ("Reporting delays", [("fitted_naive_delay", r"Fitted, naive state, no future events"),
                                 ("fitted_ht_delay", r"Fitted, HT nowcast, no future events"),
                                 ("fitted_naive_delay_int", r"Fitted, naive state, integrating"),
                                 ("fitted_ht_delay_int", r"Fitted, HT nowcast, integrating"),
                                 ("ma_poisson_delay", "Moving-average Poisson, available counts")])]


def table_e6(res, path, pr_ratio="5"):
    s = res["experiments"]["E6"]["summary"]
    meth = s["methods"]
    ratios = sorted(meth["oracle"]["alerts"].keys(), key=float)
    L = []
    _header(L, ["E6. Cost per window at c_miss/c_FA = " + ", ".join(ratios) + f"; precision and recall at c_miss/c_FA = {pr_ratio};",
                "Brier score of the surge probability; pooled PIT chi2 (9 df, 1800 windows); mean forecast minus outcome."])
    L += [r"\begin{tabular}{@{}lrrrrrrrr@{}}", r"\toprule",
          r" & \multicolumn{3}{c}{Cost per window} & & & & & \\", r"\cmidrule(lr){2-4}",
          r"Forecaster & " + " & ".join(f"{_f(r):g}" for r in ratios) + r" & Prec. & Recall & Brier & PIT $\chi^2_9$ & Bias \\",
          r"\midrule"]
    for gi, (grp, rows) in enumerate(E6_ROWS):
        if gi:
            L.append(r"\addlinespace")
        L.append(rf"\multicolumn{{9}}{{@{{}}l}}{{\emph{{{grp}}}}} \\")
        for m, nm in rows:
            if m not in meth:
                continue
            v = meth[m]
            a = v["alerts"]
            L.append(f"\\quad {nm} & " + " & ".join(_num(a[r]["cost_per_window"]["mean"]) for r in ratios) +
                     f" & {_num(a[pr_ratio]['precision'])} & {_num(a[pr_ratio]['recall'])} & {_num(v['brier']['mean'], 4)} & "
                     f"{_f(v['pit_chi2']):.1f} & {_num(v['mean_bias']['mean'], 2, sign=True)} \\\\")
    L += [r"\bottomrule", r"\end{tabular}"]
    _write(path, L)


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
    jobs = [("E1", "fig-sim-recovery.pdf", lambda p: fig_recovery(res, p)),
            ("E2", "fig-sim-spurious.pdf", lambda p: fig_spurious(res, p)),
            ("E3", "fig-sim-thinning.pdf", lambda p: fig_thinning(res, p)),
            ("E4", "fig-sim-lrt.pdf", lambda p: fig_lrt(res, load_raw(a.results, "E4"), p)),
            ("E5", "fig-sim-attribution.pdf", lambda p: fig_attribution(res, p)),
            ("E6", "fig-sim-alert.pdf", lambda p: fig_alert(res, p))]
    for name, fn, f in jobs:
        if name in ex:
            f(os.path.join(a.figures, fn))
            done.append(fn)
    tabs = [("E1", table_e1), ("E2", table_e2), ("E3", table_e3), ("E4", table_e4), ("E5", table_e5), ("E6", table_e6)]
    for (name, f), fn in zip(tabs, TABLES):
        if name in ex:
            f(res, os.path.join(a.tables, fn))
            done.append(fn)
    print("wrote", ", ".join(done))


if __name__ == "__main__":
    main()
