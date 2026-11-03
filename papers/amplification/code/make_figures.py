#!/usr/bin/env python
"""Figures and LaTeX tables for the simulation section (sec:simulation) of "Supply or Demand?".

Reads ../results/sim_results.json and writes
  ../figures/fig-sim-ar.pdf            E1: AR estimates by classifier regime; CI coverage vs puppets per cell
  ../figures/fig-sim-interference.pdf  E2: bias of AA vs load; arm shifts; remedies and saturation extrapolation
  ../figures/fig-sim-decomp.pdf        E3: supply / demand decomposition vs formation length; persona contrasts
  ../figures/fig-sim-markov.pdf        E4: Markov predictions vs simulation; perturbation (tilt, replacement nudge)
  ../figures/fig-sim-sequential.pdf    E5: alg:sequential coverage, width and power; comparators
  ../tables/tab-sim-main.tex           E1 main table (relative bias and coverage of AR by regime and method)
  ../tables/tab-sim-designs.tex        E2-E5 summary (interference, decomposition, Markov, sequential)
  ../tables/tab-sim-checks.tex         E1b + E2 bounds: checks of thm:identify, thm:misclass, prop:interference
No titles inside plots; captions belong in LaTeX. Style follows Paper 1 (../dark-figure/code/make_figures.py).
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
    "legend.fontsize": 7.5,
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

W2, W1 = 6.0, 2.9
GRID = "#d9d9d9"
INK2 = "#555555"
# Okabe-Ito (validated with the dataviz palette checker; low-contrast hues always carry markers / line styles)
COL = dict(true="#000000", naive="#D55E00", rg_pooled="#E69F00", rg_strat="#0072B2")
MARK = dict(true="o", naive="s", rg_pooled="^", rg_strat="D")
LS = dict(true="-", naive="--", rg_pooled=":", rg_strat="-")
METH_LABEL = dict(true="True labels (oracle)", naive="Naive classifier", rg_pooled="Rogan–Gladen, pooled Se/Sp",
                  rg_strat="Rogan–Gladen, arm-stratified")
METH_SHORT = dict(true="True", naive="Naive", rg_pooled="RG pooled", rg_strat="RG stratified")
PERS = ["general", "jewish", "mideast", "conspiracy"]
PERS_LABEL = dict(general="General", jewish="Jewish interest", mideast="Middle East", conspiracy="Conspiracy-adj.")
PCOL = dict(general="#0072B2", jewish="#009E73", mideast="#E69F00", conspiracy="#CC79A7")
PMARK = dict(general="o", jewish="s", mideast="^", conspiracy="D")
REG_LABEL = dict(ND="Non-differential", DU="Differential: borderline FP", DD="Differential: coded FN",
                 NDI="Non-diff. by type, item-level")
REG_SHORT = dict(ND="ND: non-differential", DU="DU: borderline FP", DD="DD: coded FN", NDI="NDI: item-level")
PERS_TICK = dict(general="General", jewish="Jewish", mideast="Mid. East", conspiracy="Consp.")


def load(results_dir):
    with open(os.path.join(results_dir, "sim_results.json")) as f:
        return json.load(f)


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


def _tag(ax, s):
    ax.set_title(s, loc="left", fontsize=8.5, pad=2)


# ---------------------------------------------------------------------------
# E1
# ---------------------------------------------------------------------------
def fig_ar(res, path, ref="chron", U_show="20"):
    e1 = res["E1"]
    regs = [g for g in ("ND", "DU", "DD", "NDI") if g in e1["regimes"]]
    meths = ["true", "naive", "rg_pooled", "rg_strat"]
    U_grid = e1["config"]["U_grid"]
    fig, axes = plt.subplots(2, len(regs), figsize=(W2, 4.1), layout="constrained", sharey="row")
    off = np.linspace(-0.27, 0.27, len(meths))
    for j, g in enumerate(regs):
        C = e1["regimes"][g]["contrasts"][ref]
        ax = axes[0, j]
        _style(ax)
        ax.axhline(1.0, color=INK2, lw=0.7, zorder=1)
        for x in range(len(PERS)):
            if x % 2 == 1:
                ax.axvspan(x - 0.5, x + 0.5, color="#f3f3f3", zorder=0, lw=0)
        for mi, m in enumerate(meths):
            for x, p in enumerate(PERS):
                s = C[p]["by_U"][U_show][m]
                AR0 = C[p]["AR"]
                med = _f(s["ar_median"]) / AR0
                lo = max(med - _f(s["ar_sd"]) / AR0, 1e-3)
                hi = med + _f(s["ar_sd"]) / AR0
                yv = min(max(med, 0.32), 3.1)
                if yv != med:
                    ax.plot(x + off[mi], yv, marker="^" if med > 1 else "v", ms=4.2, color=COL[m], mfc="white",
                            mew=1.0, ls="none", zorder=4)
                else:
                    ax.errorbar(x + off[mi], med, yerr=[[med - lo], [min(hi, 3.1) - med]], fmt=MARK[m], ms=3.5,
                                color=COL[m], mec="white", mew=0.4, elinewidth=0.8, capsize=0, zorder=3)
        ax.set_yscale("log")
        ax.set_ylim(0.3, 3.3)
        ax.yaxis.set_major_locator(matplotlib.ticker.FixedLocator([0.5, 0.75, 1, 1.5, 2, 3]))
        ax.yaxis.set_major_formatter(matplotlib.ticker.FuncFormatter(lambda v, _: f"{v:g}"))
        ax.yaxis.set_minor_formatter(matplotlib.ticker.NullFormatter())
        ax.yaxis.set_minor_locator(matplotlib.ticker.NullLocator())
        ax.set_xlim(-0.5, len(PERS) - 0.5)
        ax.set_xticks(range(len(PERS)))
        ax.set_xticklabels([PERS_TICK[p] for p in PERS], rotation=35, ha="right", rotation_mode="anchor")
        ax.set_title(REG_SHORT[g], fontsize=7.6, pad=3)
        ax2 = axes[1, j]
        _style(ax2, "both")
        ax2.axhline(95, color=INK2, lw=0.7, zorder=1)
        for m in meths:
            cov = [100 * np.mean([_f(C[p]["by_U"][str(U)][m]["ar_cov"]) for p in PERS]) for U in U_grid]
            ax2.plot(U_grid, cov, color=COL[m], ls=LS[m], marker=MARK[m], ms=3.4, mec="white", mew=0.4, lw=1.2)
        ax2.set_xscale("log")
        ax2.set_xticks(U_grid)
        ax2.set_xticklabels([str(u) for u in U_grid])
        ax2.minorticks_off()
        ax2.set_ylim(-3, 103)
        ax2.set_xlabel("Puppets per cell")
    axes[0, 0].set_ylabel(r"$\widehat{\mathrm{AR}}/\mathrm{AR}$ (median $\pm$ s.d.)")
    axes[1, 0].set_ylabel("Coverage of 95% CI (%)")
    handles = [Line2D([], [], marker=MARK[m], color=COL[m], ls=LS[m], ms=4.5, mec="white", mew=0.4, lw=1.2,
                      label=METH_LABEL[m]) for m in meths]
    fig.legend(handles=handles, loc="outside lower center", ncol=4, frameon=False, handletextpad=0.3,
               columnspacing=1.0, fontsize=7.0)
    fig.savefig(path)
    plt.close(fig)


# ---------------------------------------------------------------------------
# E2
# ---------------------------------------------------------------------------
def fig_interference(res, path, ref="chron"):
    e2 = res["E2"]
    D = e2["designs"]
    sim = D["simultaneous"]["by_rho"]
    rhos = sorted(float(r) for r in sim)
    fig, axes = plt.subplots(1, 3, figsize=(W2, 2.45), layout="constrained", gridspec_kw=dict(width_ratios=[1, 1, 1.15]))
    ax = axes[0]
    _style(ax, "both")
    ax.axhline(0, color=INK2, lw=0.7)
    for p in PERS:
        x = [_f(sim[str(r)]["load"]["mean"]) for r in rhos]
        y = [1000 * _f(sim[str(r)]["personas"][p][ref]["bias_AA"]["mean"]) for r in rhos]
        e = [2000 * _f(sim[str(r)]["personas"][p][ref]["bias_AA"]["se"] or 0) for r in rhos]
        ax.errorbar(x, y, yerr=e, color=PCOL[p], marker=PMARK[p], ms=3.4, mec="white", mew=0.4, lw=1.1,
                    elinewidth=0.7, capsize=0, label=PERS_LABEL[p])
    ax.set_xlabel(r"Load $\bar\ell$")
    ax.set_ylabel(r"Bias of $\widehat{\mathrm{AA}}_{\mathrm{chron}}$ ($\times10^{-3}$)")
    _tag(ax, "(a)")
    ax = axes[1]
    _style(ax, "both")
    ax.axhline(0, color=INK2, lw=0.7)
    for p in PERS:
        x = [_f(sim[str(r)]["load"]["mean"]) for r in rhos]
        for arm, ls, mfc in (("alg", "-", None), ("popular", ":", "white")):
            y = [1000 * _f(sim[str(r)]["personas"][p]["shift"][arm]["mean"]) for r in rhos]
            ax.plot(x, y, color=PCOL[p], ls=ls, marker=PMARK[p], ms=3.2, mfc=mfc or PCOL[p], mec=PCOL[p], mew=0.7, lw=1.0)
    ax.set_xlabel(r"Load $\bar\ell$")
    ax.set_ylabel(r"Arm mean shift ($\times10^{-3}$)")
    ax.legend(handles=[Line2D([], [], color=INK2, ls="-", label="alg"),
                       Line2D([], [], color=INK2, ls=":", label="popularity-only")],
              frameon=False, loc="lower left", fontsize=6.6, handlelength=1.8)
    _tag(ax, "(b)")
    ax = axes[2]
    _style(ax)
    ax.axhline(0, color=INK2, lw=0.7)
    r_show = max(r for r in rhos if str(r) in D.get("staggered", {}).get("by_rho", {}))
    items = [("simultaneous", "Simult."), ("low_coview", "Low co-view"), ("staggered", "Staggered")]
    sat = e2.get("saturation", {})
    sat_key = next((k for k in sat if k.endswith("/" + str(r_show))), None)
    xs = []
    for i, p in enumerate(PERS):
        for k, (dn, lab) in enumerate(items):
            row = D[dn]["by_rho"].get(str(r_show))
            if row is None:
                continue
            b = 1000 * _f(row["personas"][p][ref]["bias_AA"]["mean"])
            e = 2000 * _f(row["personas"][p][ref]["bias_AA"]["se"] or 0)
            x = i + (k - 1.5) * 0.19
            ax.errorbar(x, b, yerr=e, fmt=["o", "s", "^"][k], color=PCOL[p], ms=3.6, mfc=[PCOL[p], "white", PCOL[p]][k],
                        mec=PCOL[p], mew=0.8, elinewidth=0.7, capsize=0)
        if sat_key:
            s = sat[sat_key][p][ref]["bias_extrapolated"]
            ax.errorbar(i + 1.5 * 0.19, 1000 * _f(s["mean"]), yerr=2000 * _f(s["se"] or 0), fmt="D", color=INK2, ms=3.4,
                        mfc="white", mew=0.8, elinewidth=0.7, capsize=0)
        xs.append(i)
    ax.set_xticks(xs)
    ax.set_xticklabels([PERS_TICK[p] for p in PERS], rotation=30, ha="right", rotation_mode="anchor")
    ax.set_ylabel(r"Bias of $\widehat{\mathrm{AA}}_{\mathrm{chron}}$ ($\times10^{-3}$)")
    hl = [Line2D([], [], marker="o", color=INK2, ls="none", ms=3.6, label="simultaneous"),
          Line2D([], [], marker="s", color=INK2, mfc="white", ls="none", ms=3.6, label="low co-viewing"),
          Line2D([], [], marker="^", color=INK2, ls="none", ms=3.6, label="staggered waves")]
    if sat_key:
        hl.append(Line2D([], [], marker="D", color=INK2, mfc="white", ls="none", ms=3.4, label="saturation extrap."))
    _tag(ax, f"(c) traffic share {r_show:g}")
    h, l = axes[0].get_legend_handles_labels()
    fig.legend(h + hl, l + [x.get_label() for x in hl], loc="outside lower center", ncol=4, frameon=False,
               fontsize=6.8, columnspacing=1.0, handletextpad=0.3)
    fig.savefig(path)
    plt.close(fig)


# ---------------------------------------------------------------------------
# E3
# ---------------------------------------------------------------------------
def fig_decomp(res, path):
    e3 = res["E3"]
    cps = sorted(e3["checkpoints"], key=lambda k: int(k))
    H = [int(k) for k in cps]
    fig, axes = plt.subplots(1, 2, figsize=(W2, 2.6), layout="constrained", gridspec_kw=dict(width_ratios=[1.0, 0.85]))
    ax = axes[0]
    _style(ax, "both")
    ax.axhline(0, color=INK2, lw=0.7)
    comps = [("tau", r"total $\tau$", "#000000", "o", "-"), ("tau_sup", r"supply $\tau_{\mathrm{sup}}$", "#0072B2", "s", "-"),
             ("tau_dem", r"demand shaping $\tau_{\mathrm{dem}}$", "#D55E00", "^", "--"),
             ("iota", r"interaction $\iota$", "#009E73", "D", ":")]
    for k, lab, c, m, ls in comps:
        y = np.array([100 * e3["checkpoints"][h]["decomposition"][k]["value"] for h in cps])
        e = np.array([200 * e3["checkpoints"][h]["decomposition"][k]["se"] for h in cps])
        ax.errorbar(H, y, yerr=e, color=c, marker=m, ls=ls, ms=3.6, mec="white", mew=0.4, lw=1.2, elinewidth=0.7,
                    capsize=0, label=lab)
    a0 = 100 * e3["AA_ref_F0"]["value"]
    ax.axhline(a0, color="#56B4E9", lw=1.0, ls=(0, (4, 2)), zorder=1, label=r"fixed-demand audit at $F_0$")
    aq = 100 * e3["protocol_audit_Q"]["AA"]
    ax.axhline(aq, color="#CC79A7", lw=1.0, ls=(0, (1, 1.5)), zorder=1, label="protocol puppets, persona mix")
    ax.set_xlabel(r"Formation period $H$ (sessions)")
    ax.set_ylabel("Difference (percentage points)")
    ax.legend(frameon=False, fontsize=6.2, loc="upper left", bbox_to_anchor=(1.0, 1.0), handlelength=1.8,
              borderaxespad=0.0)
    _tag(ax, "(a)")
    ax = axes[1]
    _style(ax)
    ax.axhline(0, color=INK2, lw=0.7)
    pc = e3["persona_contrast"]
    names = list(pc)
    parts = [("supply_contrast", "supply contrast $\\mathrm{AA}(d_0)$", "#0072B2"),
             ("demand_contrast", "demand contrast", "#D55E00"), ("interaction", "interaction", "#009E73")]
    w = 0.24
    for j, (k, lab, c) in enumerate(parts):
        ax.bar(np.arange(len(names)) + (j - 1) * w, [100 * pc[n][k] for n in names], width=w - 0.03, color=c,
               label=lab, zorder=2, hatch=[None, "//", ".."][j], edgecolor="white", lw=0.3)
    ax.scatter(np.arange(len(names)), [100 * pc[n]["total"] for n in names], marker="_", s=120, color="#000000",
               zorder=3, label="total")
    ax.set_xticks(np.arange(len(names)))
    ax.set_xticklabels([PERS_TICK[n] for n in names], rotation=20, ha="right", rotation_mode="anchor", fontsize=7)
    ax.set_ylabel("Persona contrast (pp)")
    ax.legend(frameon=False, fontsize=6.3, loc="upper left")
    _tag(ax, "(b)")
    fig.savefig(path)
    plt.close(fig)


# ---------------------------------------------------------------------------
# E4
# ---------------------------------------------------------------------------
def fig_markov(res, path):
    e4 = res["E4"]
    fig, axes = plt.subplots(1, 3, figsize=(W2, 2.45), layout="constrained")
    ax = axes[0]
    _style(ax, "both")
    lim = [0, 0]
    T = e4["config"]["T"]
    TL = e4["config"]["T_long"]
    for p in PERS:
        for pol, mfc in (("alg", None), ("chron", "white")):
            f = e4["fit"][p][pol]
            pairs = [(f["pred"][f"e_{T}"], f["sim"]["e_T"], "o"), (f["pred"][f"e_{TL}"], f["sim"]["e_T_long"], "s"),
                     (f["pred"]["pi_A"], f["sim"]["tail"], "^")]
            for pr, si, mk_ in pairs:
                ax.plot(100 * pr, 100 * si, marker=mk_, color=PCOL[p], mfc=mfc or PCOL[p], mec=PCOL[p], mew=0.7,
                        ms=3.8, ls="none")
                lim[1] = max(lim[1], 100 * pr, 100 * si)
    ax.plot([0, lim[1] * 1.05], [0, lim[1] * 1.05], color=INK2, lw=0.7, zorder=1)
    ax.set_xlabel("Markov prediction (%)")
    ax.set_ylabel("Simulated exposure (%)")
    ax.legend(handles=[Line2D([], [], marker="o", color=INK2, ls="none", ms=3.6, label=rf"$e_{{{T}}}$"),
                       Line2D([], [], marker="s", color=INK2, ls="none", ms=3.6, label=rf"$e_{{{TL}}}$ (long session)"),
                       Line2D([], [], marker="^", color=INK2, ls="none", ms=3.6, label=r"$\varpi(A)$ vs tail"),
                       Line2D([], [], marker="o", color=INK2, mfc="white", ls="none", ms=3.6, label="open: chron")],
              frameon=False, fontsize=6.2, loc="upper left", handletextpad=0.2)
    _tag(ax, "(a)")
    ax = axes[1]
    _style(ax, "both")
    tl = e4["perturbation"]["tilt"]
    for p in PERS:
        rows = tl[p]["rows"]
        eps = [r["eps"] for r in rows]
        ax.plot(eps, [100 * r["sim_delta_tail"] for r in rows], color=PCOL[p], marker=PMARK[p], ms=3.4, mec="white",
                mew=0.4, lw=1.2)
        ax.plot(eps, [100 * r["model"]["delta_A"] for r in rows], color=PCOL[p], ls="--", lw=0.9)
        ax.plot(eps, [100 * r["model"]["first_order_A"] for r in rows], color=PCOL[p], ls=":", lw=0.9)
    ax.set_xlabel(r"Score tilt $\varepsilon$ toward $L_c=1$")
    ax.set_ylabel(r"$\Delta$ long-run exposure (pp)")
    ax.legend(handles=[Line2D([], [], color=INK2, marker="o", ms=3, label="simulated (tail)"),
                       Line2D([], [], color=INK2, ls="--", label=r"chain, exact $\Delta\varpi_A$"),
                       Line2D([], [], color=INK2, ls=":", label="first order")],
              frameon=False, fontsize=6.2, loc="upper left")
    _tag(ax, "(b)")
    ax = axes[2]
    _style(ax, "both")
    rp = e4["perturbation"]["replace"]
    for p in PERS:
        rows = [r for r in rp[p]["rows"] if r["eps"] > 0]
        eps = [r["eps"] for r in rows]
        ax.plot(eps, [100 * r["sim_tail"] for r in rows], color=PCOL[p], marker=PMARK[p], ms=3.4, mec="white",
                mew=0.4, lw=1.2)
        ax.plot(eps, [100 * r["pred_c_exact_piA"] for r in rows], color=PCOL[p], ls="--", lw=0.9)
        ax.plot(eps, [100 * r["pred_c_first_order_piA"] for r in rows], color=PCOL[p], ls=":", lw=0.9)
    ax.set_xlabel(r"Replacement probability $\varepsilon$")
    ax.set_ylabel(r"Long-run exposure (%)")
    ax.legend(handles=[Line2D([], [], color=INK2, marker="o", ms=3, label="simulated (tail)"),
                       Line2D([], [], color=INK2, ls="--", label="thm:perturb(c), base chain"),
                       Line2D([], [], color=INK2, ls=":", label="first order")],
              frameon=False, fontsize=6.2, loc="upper left")
    _tag(ax, "(c)")
    handles = [Line2D([], [], color=PCOL[p], marker=PMARK[p], ls="-", ms=3.6, label=PERS_LABEL[p]) for p in PERS]
    fig.legend(handles=handles, loc="outside lower center", ncol=4, frameon=False, fontsize=7.0)
    fig.savefig(path)
    plt.close(fig)


# ---------------------------------------------------------------------------
# E5
# ---------------------------------------------------------------------------
def fig_sequential(res, path):
    e5 = res["E5"]
    P = e5["personas"]
    fig, axes = plt.subplots(1, 3, figsize=(W2, 2.5), layout="constrained", gridspec_kw=dict(width_ratios=[1.15, 1, 1]))
    ax = axes[0]
    _style(ax)
    ax.axhline(95, color=INK2, lw=0.7)
    meths = [("fieller", "primary", "alg:seq.", "#0072B2", "o"), ("fieller", "protocol", "alg:seq., $\\alpha$=.0125", "#56B4E9", "v"),
             ("betting_exact", None, "exact betting", "#009E73", "D"), ("aa_cs", None, "AA plug-in CS", "#E69F00", "^"),
             ("repeated_wald", None, "repeated Wald", "#D55E00", "s")]
    for k, (a, b, lab, c, m) in enumerate(meths):
        ys = []
        for p in PERS:
            v = P[p][a][b] if b else P[p][a]
            key = {"fieller": "coverage_from_wave1", "betting_exact": "coverage_all_t", "aa_cs": "coverage_from_wave1",
                   "repeated_wald": "coverage_all_looks"}[a]
            ys.append(100 * _f(v[key]))
        ax.plot(np.arange(4) + (k - 2) * 0.13, ys, marker=m, color=c, ls="none", ms=4, mec="white", mew=0.4, label=lab)
    ax.set_xticks(range(4))
    ax.set_xticklabels([PERS_TICK[p] for p in PERS], rotation=30, ha="right", rotation_mode="anchor")
    ax.set_ylim(0, 103)
    ax.set_ylabel("Time-uniform coverage (%)")
    ax.legend(frameon=False, fontsize=6.0, loc="lower left", handletextpad=0.2, borderaxespad=0.1)
    _tag(ax, "(a)")
    ax = axes[1]
    _style(ax, "both")
    for p in PERS:
        v = P[p]["fieller"]["primary"]["median_log_width_by_wave"]
        ws = sorted(int(w) for w in v)
        ax.plot([5 * w for w in ws], [_f(v[str(w)]) for w in ws], color=PCOL[p], marker=PMARK[p], ms=3.2, mec="white",
                mew=0.4, lw=1.2)
        b = P[p]["betting_exact"]["median_log_width"]
        ts = sorted(int(t) for t in b)
        ax.plot(ts, [_f(b[str(t)]) for t in ts], color=PCOL[p], ls=":", lw=0.9, marker=PMARK[p], mfc="white", ms=3)
    ax.set_xscale("log")
    ax.set_xlabel("Pairs of puppets")
    ax.set_ylabel(r"Median width of CS for $\log\mathrm{AR}$")
    ax.legend(handles=[Line2D([], [], color=INK2, marker="o", ms=3, label="alg:sequential"),
                       Line2D([], [], color=INK2, ls=":", marker="o", mfc="white", ms=3, label="exact betting")],
              frameon=False, fontsize=6.2, loc="upper right")
    _tag(ax, "(b)")
    ax = axes[2]
    _style(ax, "both")
    for p in PERS:
        v = P[p]["fieller"]["primary"]["excludes_1_by_wave"]
        ws = sorted(int(w) for w in v)
        ax.plot([5 * w for w in ws], [100 * _f(v[str(w)]) for w in ws], color=PCOL[p], marker=PMARK[p], ms=3.2,
                mec="white", mew=0.4, lw=1.2, label=PERS_LABEL[p])
        pw = P[p]["power"]
        if pw.get("n_seq") is not None and _f(pw["n_seq"]) <= 400:
            ax.axvline(_f(pw["n_seq"]), color=PCOL[p], lw=0.6, ls=(0, (2, 2)))
    ax.axhline(80, color=INK2, lw=0.6, ls=":")
    ax.set_xscale("log")
    ax.set_xlabel("Pairs of puppets")
    ax.set_ylabel(r"P(CS excludes $\mathrm{AR}=1$) (%)")
    _tag(ax, "(c)")
    h, l = axes[2].get_legend_handles_labels()
    fig.legend(h, l, loc="outside lower center", ncol=4, frameon=False, fontsize=7.0)
    fig.savefig(path)
    plt.close(fig)


# ---------------------------------------------------------------------------
# Tables
# ---------------------------------------------------------------------------
def _pct(x, nd=1, sign=True):
    x = _f(x)
    if not np.isfinite(x):
        return "--"
    v = 100 * x
    if abs(v) >= 1000:
        return r"$>{+}10^3$" if v > 0 else r"$<{-}10^3$"
    s = f"{v:+.{nd}f}" if sign else f"{v:.{nd}f}"
    return s.replace("+", "$+$").replace("-", "$-$")


def tab_main(res, path, ref="chron", U="20"):
    e1 = res["E1"]
    regs = [g for g in ("ND", "DU", "DD", "NDI") if g in e1["regimes"]]
    meths = ["true", "naive", "rg_pooled", "rg_strat"]
    lines = [r"\begin{tabular}{@{}ll" + "rrr" * len(PERS) + "@{}}", r"\toprule"]
    lines.append(" & & " + " & ".join(rf"\multicolumn{{3}}{{c}}{{{PERS_LABEL[p]}}}" for p in PERS) + r" \\")
    lines.append(" ".join(rf"\cmidrule(lr){{{3 + 3 * i}-{5 + 3 * i}}}" for i in range(len(PERS))))
    lines.append("Classifier error & Estimator & " + " & ".join(["AR", "Bias", "Cov."] * len(PERS)) + r" \\")
    lines.append(r"\midrule")
    for k, g in enumerate(regs):
        C = e1["regimes"][g]["contrasts"][ref]
        lines.append(REG_LABEL[g] + " & Truth & " + " & ".join(
            rf"\multicolumn{{3}}{{c}}{{{C[p]['AR']:.2f}}}" for p in PERS) + r" \\")
        for i, m in enumerate(meths):
            row = ["", METH_SHORT[m]]
            for p in PERS:
                s_ = C[p]["by_U"][U][m]
                row += [f"{_f(s_['ar_median']):.2f}", _pct(s_["ar_relbias_median"]), f"{100 * _f(s_['ar_cov']):.0f}"]
            lines.append(" & ".join(row) + r" \\")
        if k < len(regs) - 1:
            lines.append(r"\addlinespace")
    lines += [r"\bottomrule", r"\end{tabular}"]
    with open(path, "w") as f:
        f.write("% Generated by code/make_figures.py from results/sim_results.json -- do not edit by hand.\n")
        f.write(f"% E1, reference = {ref}, {U} puppets per persona-arm cell, validation n = {e1['config']['n_val']} "
                f"impressions per cell (5 score bands), R = {e1['config']['R']} audits per configuration.\n")
        f.write("% Truth: pool AR of the regime (regimes differ slightly because the avoid-on-flag choice rule uses the\n"
                "% classifier). AR: median estimate; Bias: median relative bias (%); Cov.: coverage of the nominal 95%\n"
                "% interval for AR (%).\n")
        f.write("\n".join(lines) + "\n")


def tab_designs(res, path):
    """Compact summary of E2-E5 for the text (one row per quantity, one column per persona)."""
    lines = [r"\begin{tabular}{@{}l" + "r" * len(PERS) + "@{}}", r"\toprule"]
    lines.append("Quantity & " + " & ".join(PERS_LABEL[p] for p in PERS) + r" \\")
    lines.append(r"\midrule")
    def row(lab, vals):
        vals = [v.replace("-", "$-$") if v != "--" else v for v in vals]
        lines.append(lab + " & " + " & ".join(vals) + r" \\")
    if "E2" in res:
        e2 = res["E2"]
        sim = e2["designs"]["simultaneous"]["by_rho"]
        rmax = max(sim, key=float)
        lines.append(rf"\multicolumn{{{1 + len(PERS)}}}{{@{{}}l}}{{\emph{{E2: interference (reference chron, traffic share {float(rmax):g}, load {sim[rmax]['load']['mean']:.2f})}}}} \\")
        row(r"$\mathrm{AA}^0$ ($\times10^{-3}$)", [f"{1000 * sim['0.0']['personas'][p]['chron']['AA_truth']:.1f}" for p in PERS])
        row(r"Bias of $\widehat{\mathrm{AA}}$ ($\times10^{-3}$)", [f"{1000 * sim[rmax]['personas'][p]['chron']['bias_AA']['mean']:.1f}" for p in PERS])
        for dn, lab in (("low_coview", "low co-viewing"), ("staggered", "staggered waves")):
            d = e2["designs"].get(dn, {}).get("by_rho", {})
            if rmax in d:
                row(rf"\quad with {lab}", [f"{1000 * d[rmax]['personas'][p]['chron']['bias_AA']['mean']:.1f}" for p in PERS])
        lines.append(r"\addlinespace")
    if "E3" in res:
        e3 = res["E3"]
        hmax = max(e3["checkpoints"], key=int)
        dec = e3["checkpoints"][hmax]["decomposition"]
        lines.append(rf"\multicolumn{{{1 + len(PERS)}}}{{@{{}}l}}{{\emph{{E3: real users, formation $H={hmax}$ sessions (pp): "
                     rf"$\tau={100 * dec['tau']['value']:.2f}$, $\tau_{{\mathrm{{sup}}}}={100 * dec['tau_sup']['value']:.2f}$, "
                     rf"$\tau_{{\mathrm{{dem}}}}={100 * dec['tau_dem']['value']:.2f}$, $\iota={100 * dec['iota']['value']:.2f}$; "
                     rf"audit at $F_0$: {100 * e3['AA_ref_F0']['value']:.2f}}}}} \\")
        lines.append(r"\addlinespace")
    if "E4" in res:
        e4 = res["E4"]
        T, TL = e4["config"]["T"], e4["config"]["T_long"]
        lines.append(rf"\multicolumn{{{1 + len(PERS)}}}{{@{{}}l}}{{\emph{{E4: Markov model, algorithmic policy (consumed items, \%)}}}} \\")
        row(rf"$e_{{{T}}}$ predicted / simulated", [f"{100 * e4['fit'][p]['alg']['pred'][f'e_{T}']:.2f} / {100 * e4['fit'][p]['alg']['sim']['e_T']:.2f}" for p in PERS])
        row(rf"$e_{{{TL}}}$ predicted / simulated", [f"{100 * e4['fit'][p]['alg']['pred'][f'e_{TL}']:.2f} / {100 * e4['fit'][p]['alg']['sim']['e_T_long']:.2f}" for p in PERS])
        row(r"$\kappa_{\mathcal A}$; Kemeny $K$", [f"{e4['fit'][p]['alg']['pred']['kappa_A']:.2f}; {e4['fit'][p]['alg']['pred']['kemeny']:.2f}" for p in PERS])
        lines.append(r"\addlinespace")
    if "E5" in res:
        e5 = res["E5"]["personas"]
        lines.append(rf"\multicolumn{{{1 + len(PERS)}}}{{@{{}}l}}{{\emph{{E5: sequential audit (reference chron)}}}} \\")
        row("True AR", [f"{e5[p]['AR']:.2f}" for p in PERS])
        row(r"Time-uniform coverage, \cref{alg:sequential} (\%)", [f"{100 * e5[p]['fieller']['primary']['coverage_from_wave1']:.1f}" for p in PERS])
        row(r"\quad repeated Wald (\%)", [f"{100 * e5[p]['repeated_wald']['coverage_all_looks']:.1f}" for p in PERS])
        row(r"$n_{\mathrm{fix}}$; $n_{\mathrm{seq}}$ (pairs)", [f"{e5[p]['power']['n_fix']:.0f}; {e5[p]['power']['n_seq']:.0f}" for p in PERS])
        row(r"Power at $n_{\mathrm{fix}}$, fixed sample", [f"{e5[p]['power'].get('fixed_power_at_n_fix', float('nan')):.2f}" if e5[p]['power'].get('fixed_power_at_n_fix') is not None else "--" for p in PERS])
        row(r"Power by $n_{\mathrm{seq}}$, sequential", [f"{e5[p]['power']['seq_power_by_horizon']:.2f}" if e5[p]['power'].get('seq_power_by_horizon') is not None else "--" for p in PERS])
    lines += [r"\bottomrule", r"\end{tabular}"]
    with open(path, "w") as f:
        f.write("% Generated by code/make_figures.py from results/sim_results.json -- do not edit by hand.\n")
        f.write("\n".join(lines) + "\n")


def tab_checks(res, path, U="20"):
    """E1b (DESIGN's estimators with session-level data) and E2 bounds of prop:interference."""
    e = res["E1b"]["regimes"]
    L = [r"\begin{tabular}{@{}l" + "r" * len(PERS) + "@{}}", r"\toprule"]
    L.append("Quantity & " + " & ".join(PERS_LABEL[p] for p in PERS) + r" \\")
    L.append(r"\midrule")

    def row(lab, vals):
        vals = [v.replace("-", "$-$") if v not in ("--",) else v for v in vals]
        L.append(lab + " & " + " & ".join(vals) + r" \\")

    def head(t):
        L.append(rf"\multicolumn{{{1 + len(PERS)}}}{{@{{}}l}}{{\emph{{{t}}}}} \\")
    for nm, lab in (("ND", "Non-differential error, profiles as simulated"),
                    ("ND_buckets", "Non-differential error, accounts in experiment buckets")):
        if nm not in e:
            continue
        P_ = e[nm]["personas"]
        head(lab + f" ({U} puppets per cell)")
        row("Design effect, alg; ref", [f"{P_[p]['deff'][0]:.2f}; {P_[p]['deff'][1]:.2f}" for p in PERS])
        k = "known_pooled"
        row(r"Coverage AA: cluster-robust; sessions iid (\%)",
            [f"{100 * P_[p]['by_U'][U][k]['cluster']['AA']['coverage']:.1f}; {100 * P_[p]['by_U'][U][k]['session']['AA']['coverage']:.1f}" for p in PERS])
        row(r"Coverage $\log\mathrm{AR}$: cluster-robust; sessions iid (\%)",
            [f"{100 * P_[p]['by_U'][U][k]['cluster']['logAR']['coverage']:.1f}; {100 * P_[p]['by_U'][U][k]['session']['logAR']['coverage']:.1f}" for p in PERS])
        if nm == "ND":
            row(r"Naive AR; $\omega+(1-\omega)\mathrm{AR}$; true AR",
                [f"{P_[p]['naive_AR_pop']:.3f}; {P_[p]['naive_AR_attenuation_formula']:.3f}; {P_[p]['AR']:.3f}" for p in PERS])
            x = "external_pooled"
            row(r"External validation: s.d.\ of $\log\widehat{\mathrm{AR}}$, MC; delta",
                [f"{P_[p]['by_U'][U][x]['logAR_sd_mc']:.3f}; {P_[p]['by_U'][U][x]['logAR_sd_delta']:.3f}" for p in PERS])
            row(r"\quad coverage $\log\mathrm{AR}$; AA (\%)",
                [f"{100 * P_[p]['by_U'][U][x]['logAR']['coverage']:.1f}; {100 * P_[p]['by_U'][U][x]['AA']['coverage']:.1f}" for p in PERS])
        L.append(r"\addlinespace")
    if "DD" in e:
        P_ = e["DD"]["personas"]
        head(f"Differential error (coded false negatives), external validation, {U} puppets per cell")
        row(r"True AR; naive $\mathrm{AR}^{\mathrm{nv}}$; $\mathrm{AR}^{\mathrm{pool}}$ (eq.~\ref{eq:mc-diff})",
            [f"{P_[p]['AR']:.3f}; {P_[p]['naive_AR_pop']:.3f}; {P_[p]['AR_pool_formula']:.3f}" for p in PERS])
        for x, lab in (("external_pooled", "pooled"), ("external_strat", "stratified by arm")):
            row(rf"Corrected, {lab}: median AR; coverage (\%)",
                [f"{P_[p]['by_U'][U][x]['AR_median']:.3f}; {100 * P_[p]['by_U'][U][x]['logAR']['coverage']:.1f}" for p in PERS])
        L.append(r"\addlinespace")
    if "E2" in res and "bounds" in res["E2"]:
        b = res["E2"]["bounds"]
        head(r"Interference (reference chron): \cref{prop:interference}(a) and (c)")
        sim = res["E2"]["designs"]["simultaneous"]["by_rho"]
        r = max(sim, key=float)
        row(rf"$|$bias AA$|$; $\xi_\Delta\bar\ell$ at share {float(r):g} ($\times10^{{-3}}$)",
            [f"{1000 * b[p]['chron']['part_a'][r]['abs_bias_AA']:.2f}; {1000 * b[p]['chron']['part_a'][r]['bound_AA']:.2f}" for p in PERS])
        row(rf"$|$bias $\log\mathrm{{AR}}|$; ratio bound at share {float(r):g}",
            [f"{b[p]['chron']['part_a'][r]['abs_bias_logAR']:.3f}; {b[p]['chron']['part_a'][r]['bound']:.3f}" for p in PERS])
        for key in b[PERS[0]]["chron"]["saturation"]:
            row(rf"Extrapolation {key}: $|$bias$|$; $\zeta\ell_1\ell_2/2$ ($\times10^{{-3}}$)",
                [f"{1000 * b[p]['chron']['saturation'][key]['abs_bias_extrapolated']:.2f}; {1000 * b[p]['chron']['saturation'][key]['bound_dd']:.2f}" for p in PERS])
    L += [r"\bottomrule", r"\end{tabular}"]
    with open(path, "w") as f:
        f.write("% Generated by code/make_figures.py from results/sim_results.json -- do not edit by hand.\n")
        f.write(f"% E1b: R = {res['E1b']['config']['R']} audits per configuration; known error rates (thm:identify) unless\n"
                f"% stated; external validation n1 = {res['E1b']['config']['n1']} coded positives, n0 = {res['E1b']['config']['n0']} coded negatives.\n")
        f.write("\n".join(L) + "\n")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--results", default=os.path.join(HERE, "..", "results"))
    ap.add_argument("--figures", default=os.path.join(HERE, "..", "figures"))
    ap.add_argument("--tables", default=os.path.join(HERE, "..", "tables"))
    a = ap.parse_args()
    res = load(a.results)
    os.makedirs(a.figures, exist_ok=True)
    os.makedirs(a.tables, exist_ok=True)
    if "E1" in res:
        fig_ar(res, os.path.join(a.figures, "fig-sim-ar.pdf"))
        tab_main(res, os.path.join(a.tables, "tab-sim-main.tex"))
    if "E2" in res:
        fig_interference(res, os.path.join(a.figures, "fig-sim-interference.pdf"))
    if "E3" in res:
        fig_decomp(res, os.path.join(a.figures, "fig-sim-decomp.pdf"))
    if "E4" in res:
        fig_markov(res, os.path.join(a.figures, "fig-sim-markov.pdf"))
    if "E5" in res:
        fig_sequential(res, os.path.join(a.figures, "fig-sim-sequential.pdf"))
    tab_designs(res, os.path.join(a.tables, "tab-sim-designs.tex"))
    if "E1b" in res:
        tab_checks(res, os.path.join(a.tables, "tab-sim-checks.tex"))
    print("figures and tables written")


if __name__ == "__main__":
    main()
