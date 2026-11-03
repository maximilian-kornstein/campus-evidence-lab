#!/usr/bin/env python
"""Figures and LaTeX tables for the simulation section (sec:simulation). Run 2.

Reads ../results/sim_results.json (and ../results/raw/S5.json for the per-replication
scatter of fig-sim-linkage-error) and writes
  ../figures/fig-sim-bias-coverage.pdf   median (filled) and mean (open) relative bias, coverage (S1-S4)
  ../figures/fig-sim-linkage-error.pdf   dark-figure error vs realised linkage error (S5)
  ../figures/fig-sim-sensitivity.pdf     closed-form n0(omega) curves with |omega| <= Omega bands (S6)
  ../figures/fig-sim-referral.pdf        Lincoln-Petersen / BMA median bias with / without provenance correction (S7)
  ../figures/fig-sim-le-validation.pdf   S8: LE-generated tables; bias and coverage with / without v_link
  ../tables/tab-sim-main.tex             main results (S1-S4): median (MAD), mean [blow-ups], coverage
  ../tables/tab-sim-linkage.tex          S5 linkage quality and audit (frame vs capture-level rates)
  ../tables/tab-sim-linkage-bias.tex     S5 dark-figure bias and coverage by pipeline (BMA)
  ../tables/tab-sim-referral.tex         referral sweep (S7)
  ../tables/tab-sim-sensitivity.tex      omega-sensitivity bands (S6)
  ../tables/tab-sim-le.tex               S8 validation of Cor cor:linkcorrect under the LE model
  ../tables/tab-sim-lcmcr.tex            LCMCR convergence diagnostics (4 chains per fit)
  ../tables/tab-sim-mi.tex               MI (Gibbs linkage draws) vs the point linkage
Bias is the MEDIAN relative bias over replicates (primary); means are secondary and are
dominated by blow-ups (N_hat > 5N), which are counted. No titles inside plots; captions
belong in LaTeX.
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

W2, W1 = 6.0, 2.9      # figure widths (inches)
GRID = "#d9d9d9"
INK2 = "#555555"
# Okabe-Ito (colour-blind safe; validated with the dataviz palette checker), black = oracle / truth
COL = dict(oracle="#000000", naive="#D55E00", corrected="#0072B2", mi="#E69F00",
           corrected_d="#009E73", corrected_true="#CC79A7", corrected_tv="#56B4E9", corrected_lefit="#7f7f7f")
MARK = dict(oracle="o", naive="s", corrected="D", mi="^", corrected_d="v", corrected_true="P",
            corrected_tv="d", corrected_lefit="X")
LS = dict(oracle="-", naive="--", corrected="-", mi=":", corrected_d="-.", corrected_true=(0, (1, 1)),
          corrected_tv="-", corrected_lefit=(0, (3, 1, 1, 1)))
PIPE_LABEL = dict(oracle="Oracle linkage", naive="Naive (best linkage)", corrected="Linkage-corrected",
                  mi="Multiple imputation (Gibbs)", corrected_d=r"Corrected, $\varepsilon=0$ (post hoc)",
                  corrected_true=r"Corrected, realised $(\delta,\varepsilon)$",
                  corrected_tv="Corrected + audit var.", corrected_lefit="Corrected, best-fit LE")
EST_LABEL = dict(lp="LP", cf="CF", bma="BMA", chao="Chao", lcmcr="LCMCR")
EST_LONG = dict(lp="Lincoln--Petersen", cf="Closed form ($\\omega=0$)", bma="Log-linear BMA",
                chao="Chao lower bound", lcmcr="LCMCR")
SC_SHORT = dict(S1="S1: independence", S2="S2: heterogeneity", S3="S3: referral",
                S4="S4: heterog. + noise")


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


def _est(res, sid, pipe, est, li=0):
    try:
        return res["scenarios"][sid]["results"][li]["estimates"][pipe][est]
    except (KeyError, IndexError):
        return None


def _style(ax, grid_axis="y"):
    ax.grid(True, axis=grid_axis, color=GRID, lw=0.5, zorder=0)
    ax.set_axisbelow(True)
    ax.tick_params(colors="#222222")


# ---------------------------------------------------------------------------
# Figure 1: bias and coverage (S1-S4)
# ---------------------------------------------------------------------------
def _clip_mark(ax, x, v, lim, col, filled=True):
    """Plot an out-of-range value as a triangle at the panel edge."""
    y = lim[1] - 2.5 if v > 0 else lim[0] + 2.5
    ax.plot(x, y, marker="^" if v > 0 else "v", ms=4.4, color=col, mfc=col if filled else "white", mew=1.0,
            zorder=4, ls="none")


def fig_bias_coverage(res, path):
    scen = ["S1", "S2", "S3", "S4"]
    pipes = ["oracle", "naive", "corrected", "mi"]
    ests = ["lp", "cf", "bma", "chao", "lcmcr"]
    ylim_b = (-50, 80)
    fig, axes = plt.subplots(2, 4, figsize=(W2, 3.9), sharey="row", layout="constrained")
    off = np.linspace(-0.27, 0.27, len(pipes))
    for j, sid in enumerate(scen):
        axb, axc = axes[0, j], axes[1, j]
        for ax in (axb, axc):
            _style(ax)
            for x in range(len(ests)):
                if x % 2 == 1:
                    ax.axvspan(x - 0.5, x + 0.5, color="#f3f3f3", zorder=0, lw=0)
        axb.axhline(0, color=INK2, lw=0.7, zorder=1)
        axc.axhline(95, color=INK2, lw=0.7, zorder=1)
        for p_i, p in enumerate(pipes):
            for x, e in enumerate(ests):
                s = _est(res, sid, p, e)
                if s is None or s.get("n_ok", 0) == 0:
                    continue
                xb = x + off[p_i]
                b, mcse = 100 * _f(s["relbias_median"]), 100 * _f(s["relbias_median_mcse"])
                bm = 100 * _f(s["relbias_mean"])
                if b > ylim_b[1] or b < ylim_b[0]:
                    _clip_mark(axb, xb, b, ylim_b, COL[p], filled=True)
                else:
                    axb.errorbar(xb, b, yerr=2 * mcse if np.isfinite(mcse) else None, fmt=MARK[p], ms=3.6,
                                 color=COL[p], mec="white", mew=0.4, elinewidth=0.8, capsize=0, zorder=3)
                if np.isfinite(bm):      # secondary: mean (open, small)
                    if bm > ylim_b[1] or bm < ylim_b[0]:
                        _clip_mark(axb, xb, bm, ylim_b, COL[p], filled=False)
                    else:
                        axb.plot(xb, bm, marker="o", ms=2.6, mfc="white", mec=COL[p], mew=0.7, ls="none", zorder=2)
                c = 100 * _f(s["coverage"])
                cse = 100 * _f(s["coverage_mcse"])
                axc.errorbar(xb, c, yerr=2 * cse, fmt=MARK[p], ms=3.6, color=COL[p], mec="white", mew=0.4,
                             elinewidth=0.8, capsize=0, zorder=3)
        axb.set_ylim(*ylim_b)
        axc.set_ylim(-3, 103)
        for ax in (axb, axc):
            ax.set_xlim(-0.5, len(ests) - 0.5)
            ax.set_xticks(range(len(ests)))
        axb.set_xticklabels([])
        axc.set_xticklabels([EST_LABEL[e] for e in ests], rotation=45, ha="right", rotation_mode="anchor")
        axb.set_title(SC_SHORT[sid], fontsize=7.8, pad=3)
    axes[0, 0].set_ylabel(r"Rel. bias of $\widehat{N}$ (%)")
    axes[1, 0].set_ylabel("Coverage of 95% CI (%)")
    handles = [Line2D([], [], marker=MARK[p], color=COL[p], ls="none", ms=4.5, mec="white", mew=0.4,
                      label=PIPE_LABEL[p]) for p in pipes]
    handles += [Line2D([], [], marker="o", ls="none", ms=3.0, mfc="white", mec=INK2, mew=0.7,
                       label="open: mean (filled: median)")]
    fig.legend(handles=handles, loc="outside lower center", ncol=3, frameon=False,
               handletextpad=0.3, columnspacing=1.0, fontsize=6.8)
    fig.savefig(path)
    plt.close(fig)


# ---------------------------------------------------------------------------
# Figure 2: linkage error sweep (S5)
# ---------------------------------------------------------------------------
def fig_linkage_error(res, raw_s5, path, est="bma"):
    """(a) realised (capture-level and audit-frame) and audit-estimated LE rates vs noise;
    (b), (c) dark-figure ratio vs realised delta, eps.

    The dark-figure error is shown as (N_hat - n_obs_true) / n0 = 1 + (N_hat - N)/n0 (common oracle
    observed count) on a log axis. Small points: replications; lines: level MEDIANS.
    """
    sc = res["scenarios"]["S5"]
    levels = sc["results"]
    nu = np.array([lv["level_values"]["noise"] for lv in levels])
    L = [lv["linkage"] for lv in levels]
    g = lambda key, stat="mean": np.array([l[key][stat] for l in L])
    fig, axes = plt.subplots(1, 3, figsize=(W2, 2.55), layout="constrained",
                             gridspec_kw=dict(width_ratios=[1, 1.1, 1.1]))
    ax = axes[0]
    _style(ax, "both")
    ax.plot(nu, g("delta_true"), color="#0072B2", ls="-", marker="o", ms=3.5, label=r"$\delta$ capture-level")
    ax.plot(nu, g("delta_frame"), color="#0072B2", ls=":", lw=1.0, label=r"$\delta$ audit frame")
    ax.plot(nu, g("delta_hat"), color="#0072B2", ls="none", marker="o", ms=5.5, mfc="white", mew=0.9,
            label=r"$\hat\delta$ audit")
    ax.plot(nu, g("eps_true"), color="#D55E00", ls="--", marker="s", ms=3.5, label=r"$\varepsilon$ capture-level")
    ax.plot(nu, g("eps_frame"), color="#D55E00", ls=":", lw=1.0, label=r"$\varepsilon$ audit frame")
    ax.plot(nu, g("eps_hat"), color="#D55E00", ls="none", marker="s", ms=5.5, mfc="white", mew=0.9,
            label=r"$\hat\varepsilon$ audit")
    ax.set_xlabel(r"Record-noise level $\nu$")
    ax.set_ylabel("Linkage error rate (mean)")
    ax.legend(frameon=False, loc="upper left", handlelength=1.6, borderaxespad=0.2, fontsize=5.8)
    ax.set_title("(a)", loc="left", fontsize=8.5, pad=2)
    pipes = ["naive", "corrected", "corrected_d", "corrected_true", "mi"]
    ymin, ymax = 0.5, 2.0
    for k, (xkey, xlabel, tag) in enumerate([("delta", r"Realised $\delta$ (capture-level)", "(b)"),
                                             ("eps", r"Realised $\varepsilon$ (capture-level)", "(c)")]):
        ax = axes[k + 1]
        _style(ax, "both")
        ax.axhline(1.0, color=INK2, lw=0.7, zorder=1)
        for p in pipes + ["oracle"]:
            xs, ys = [], []
            for r in raw_s5:
                pr = r["pipelines"].get(p, {}).get(est)
                if pr is None or not pr.get("ok"):
                    continue
                n0 = r["truth"]["n0"]
                xs.append(r["linkage"]["error"][xkey])
                ys.append(max((_f(pr["N_hat"]) - r["truth"]["n_obs"]) / n0, 1e-2))
            if p != "oracle":
                ax.scatter(xs, ys, s=2.0, color=COL[p], alpha=0.2, lw=0, zorder=2, rasterized=True)
            mx = g(xkey + "_true", "median")
            my = np.array([1 + _f(_est(res, "S5", p, est, li)["relbias_n0_median"]) for li in range(len(levels))])
            ymin, ymax = min(ymin, np.nanmin(my)), max(ymax, np.nanmax(my))
            ax.plot(mx, my, color=COL[p], ls=LS[p], marker=MARK[p], ms=3.8 if p != "oracle" else 2.6,
                    lw=1.4 if p != "oracle" else 0.9, mec="white", mew=0.4, zorder=4, label=PIPE_LABEL[p])
        ax.set_yscale("log")
        ax.set_xlabel(xlabel)
        ax.set_title(tag, loc="left", fontsize=8.5, pad=2)
    for ax in axes[1:]:
        ax.set_ylim(max(ymin / 1.25, 0.08), min(ymax * 1.25, 60))
        ax.yaxis.set_major_locator(matplotlib.ticker.FixedLocator([0.1, 0.2, 0.5, 0.75, 1, 1.5, 2, 3, 5, 10, 20, 50]))
        ax.yaxis.set_major_formatter(matplotlib.ticker.FuncFormatter(lambda v, _: f"{v:g}"))
        ax.yaxis.set_minor_formatter(matplotlib.ticker.NullFormatter())
    axes[1].set_ylabel(r"$(\widehat{N}-n)/n_{\mathbf{0}}$ (" + EST_LABEL[est] + ", log scale)")
    h, lab = axes[1].get_legend_handles_labels()
    fig.legend(h, lab, loc="outside lower center", ncol=3, frameon=False,
               handletextpad=0.3, columnspacing=1.2, fontsize=6.8)
    fig.savefig(path, dpi=300)
    plt.close(fig)


# ---------------------------------------------------------------------------
# Figure 3: omega sensitivity (S6 on the S1 / S2 / S4 oracle tables)
# ---------------------------------------------------------------------------
def fig_sensitivity(res, path, scen=("S1", "S2", "S4")):
    fig, axes = plt.subplots(1, len(scen), figsize=(W2, 2.45), sharey=False, layout="constrained")
    for ax, sid in zip(axes, scen):
        om = res["scenarios"][sid]["results"][0]["omega"]
        g = np.array(om["grid"])
        _style(ax, "both")
        for Om, a in ((1.0, 0.10), (0.5, 0.16)):
            ax.axvspan(-Om, Om, color="#0072B2", alpha=a, lw=0, zorder=0)
        ax.fill_between(g, om["n0_q05"], om["n0_q95"], color="#0072B2", alpha=0.18, lw=0, zorder=1,
                        label="5–95% over replications")
        ax.plot(g, om["n0_median"], color="#0072B2", lw=1.5, zorder=3, label=r"median $\widehat{n}_{\mathbf{0}}(\omega)$")
        ax.axhspan(om["n0_true_q05"], om["n0_true_q95"], color="#000000", alpha=0.08, lw=0, zorder=1)
        ax.axhline(om["n0_true_mean"], color="#000000", lw=1.0, ls="--", zorder=2, label=r"true $n_{\mathbf{0}}$")
        wp = om["omega_pop_mean"]
        if np.isfinite(_f(wp)):
            ax.axvline(wp, color="#D55E00", lw=1.0, ls=":", zorder=2, label=r"population $\omega$")
        ax.set_yscale("log")
        ax.set_xlim(g.min(), g.max())
        ax.set_xlabel(r"Sensitivity parameter $\omega$")
        lab = dict(S1="S1 independence", S2="S2 heterogeneity", S3="S3 referral", S4="S4 heterogeneity + cov.")[sid]
        ax.text(0.03, 0.97, lab, transform=ax.transAxes, ha="left", va="top", fontsize=7.2)
        ax.yaxis.set_major_locator(matplotlib.ticker.LogLocator(base=10, subs=(1.0, 2.0, 5.0)))
        ax.yaxis.set_major_formatter(matplotlib.ticker.FuncFormatter(lambda v, _: f"{v:,.0f}"))
        ax.yaxis.set_minor_formatter(matplotlib.ticker.NullFormatter())
    axes[0].set_ylabel(r"Closed-form $\widehat{n}_{\mathbf{0}}(\omega)$ (log scale)")
    h, lab = axes[0].get_legend_handles_labels()
    h += [plt.Rectangle((0, 0), 1, 1, color="#0072B2", alpha=0.26, lw=0),
          plt.Rectangle((0, 0), 1, 1, color="#0072B2", alpha=0.10, lw=0)]
    lab += [r"$|\omega|\leq 0.5$", r"$|\omega|\leq 1$"]
    fig.legend(h, lab, loc="outside lower center", ncol=3, frameon=False,
               handletextpad=0.4, columnspacing=1.2, fontsize=6.8)
    fig.savefig(path)
    plt.close(fig)


# ---------------------------------------------------------------------------
# Figure 4: referral (S7)
# ---------------------------------------------------------------------------
def fig_referral(res, path):
    sc = res["scenarios"]["S7"]
    q = np.array([lv["level_values"]["referral_q"] for lv in sc["results"]])
    fig, ax = plt.subplots(figsize=(W1, 2.3), layout="constrained")
    _style(ax, "both")
    ax.axhline(0, color=INK2, lw=0.7)
    series = [("oracle", "lp", "#D55E00", "s", "-", "LP, all NGO records"),
              ("oracle_dropref", "lp", "#0072B2", "o", "-", "LP, referral-only dropped"),
              ("oracle", "bma", "#D55E00", "s", ":", "BMA, all NGO records"),
              ("oracle_dropref", "bma", "#0072B2", "o", ":", "BMA, referral-only dropped")]
    for pipe, est, col, mk, ls, lab in series:
        y = np.array([100 * _f(_est(res, "S7", pipe, est, li)["relbias_median"]) for li in range(len(q))])
        e = np.array([200 * _f(_est(res, "S7", pipe, est, li)["relbias_median_mcse"]) for li in range(len(q))])
        ax.errorbar(q, y, yerr=e, color=col, ls=ls, marker=mk, ms=3.6 if ls == "-" else 3.0,
                    mfc=col if ls == "-" else "white", mec=col, mew=0.8, lw=1.2, elinewidth=0.7, capsize=0, label=lab)
    ax.set_xlabel(r"Referral probability $q$")
    ax.set_ylabel(r"Median relative bias of $\widehat{N}$ (%)")
    ax.set_xticks(q)
    ax.legend(frameon=False, loc="lower left", fontsize=6.4, handlelength=2.0, borderaxespad=0.2)
    fig.savefig(path)
    plt.close(fig)


# ---------------------------------------------------------------------------
# Figure 5: S8 -- the LE model generates the observed table
# ---------------------------------------------------------------------------
LE_COL = dict(oracle="#000000", naive="#D55E00", corrected_known="#0072B2", corrected_review="#009E73",
              corrected_review_tv="#56B4E9", known_cap="#CC79A7")
LE_LAB = dict(oracle="Oracle", naive="Naive (LE table)", corrected_known=r"Corrected, known $(\delta,\varepsilon)$",
              corrected_review="Corrected, audit rates", corrected_review_tv="Corrected, audit rates + audit var.",
              known_cap=r"Corrected, known, without $v_{\mathrm{link}}$")
LE_MARK = dict(oracle="o", naive="s", corrected_known="D", corrected_review="^", corrected_review_tv="v", known_cap="X")


def fig_le_validation(res, path):
    sc = res["scenarios"]["S8"]
    lv = sc["results"]
    ests = ["lp", "cf", "bma", "chao"]
    x = np.arange(len(lv))
    fig, axes = plt.subplots(2, 4, figsize=(W2, 3.9), sharey="row", layout="constrained")
    bias_p = ["oracle", "naive", "corrected_known", "corrected_review"]
    cov_p = ["oracle", "known_cap", "corrected_known", "corrected_review", "corrected_review_tv"]
    off_b = np.linspace(-0.27, 0.27, len(bias_p))
    off_c = np.linspace(-0.3, 0.3, len(cov_p))
    ylim_b = (-30, 60)
    for j, e in enumerate(ests):
        axb, axc = axes[0, j], axes[1, j]
        for ax in (axb, axc):
            _style(ax)
            for i in (3, 4, 5):
                ax.axvspan(i - 0.5, i + 0.5, color="#f3f3f3", zorder=0, lw=0)
        axb.axhline(0, color=INK2, lw=0.7, zorder=1)
        axc.axhline(95, color=INK2, lw=0.7, zorder=1)
        for k, p in enumerate(bias_p):
            for i, l in enumerate(lv):
                s = l["estimates"].get(p, {}).get(e)
                if not s or not s.get("n_ok"):
                    continue
                b, m = 100 * _f(s["relbias_median"]), 100 * _f(s["relbias_median_mcse"])
                if b > ylim_b[1] or b < ylim_b[0]:
                    _clip_mark(axb, i + off_b[k], b, ylim_b, LE_COL[p])
                else:
                    axb.errorbar(i + off_b[k], b, yerr=2 * m if np.isfinite(m) else None, fmt=LE_MARK[p], ms=3.2,
                                 color=LE_COL[p], mec="white", mew=0.4, elinewidth=0.7, capsize=0, zorder=3)
        for k, p in enumerate(cov_p):
            for i, l in enumerate(lv):
                pp = "corrected_known" if p == "known_cap" else p
                s = l["estimates"].get(pp, {}).get(e)
                if not s or not s.get("n_ok"):
                    continue
                c = 100 * _f(s["coverage_cap"] if p == "known_cap" else s["coverage"])
                cs = 100 * _f(s["coverage_cap_mcse"] if p == "known_cap" else s["coverage_mcse"])
                axc.errorbar(i + off_c[k], c, yerr=2 * cs, fmt=LE_MARK[p], ms=3.2, color=LE_COL[p], mec="white",
                             mew=0.4, elinewidth=0.7, capsize=0, zorder=3)
        axb.set_ylim(*ylim_b)
        axc.set_ylim(40, 101)
        for ax in (axb, axc):
            ax.set_xlim(-0.5, len(lv) - 0.5)
            ax.set_xticks(x)
        axb.set_xticklabels([])
        axc.set_xticklabels([f"{v['level_values']['eps']:g}".replace("0.", ".") for v in lv], fontsize=5.6)
        for gi, d in enumerate(sorted({v["level_values"]["delta"] for v in lv})):
            axc.text(3 * gi + 1, -0.17, rf"$\delta={d:g}$", transform=axc.get_xaxis_transform(), ha="center",
                     va="top", fontsize=6.0)
        axb.set_title(EST_LONG[e], fontsize=7.8, pad=3)
    axes[0, 0].set_ylabel(r"Median bias of $\widehat{N}$ (%)")
    axes[1, 0].set_ylabel("Coverage of 95% CI (%)")
    axes[1, 0].text(-0.06, -0.035, r"$\varepsilon$:", transform=axes[1, 0].transAxes, fontsize=5.6, ha="right",
                    va="top")
    keys = ["oracle", "naive", "corrected_known", "known_cap", "corrected_review", "corrected_review_tv"]
    handles = [Line2D([], [], marker=LE_MARK[p], color=LE_COL[p], ls="none", ms=4.2, mec="white", mew=0.4,
                      label=LE_LAB[p]) for p in keys]
    fig.legend(handles=handles, loc="outside lower center", ncol=3, frameon=False, handletextpad=0.3,
               columnspacing=1.0, fontsize=6.6)
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
    if abs(v) >= 1e4:            # exploding estimators (e.g. closed form on a corrected table with ~0 cells)
        return r"$>{+}10^4$" if v > 0 else r"$<{-}10^4$"
    if abs(v) >= 1000:
        return (f"{v:+.0f}" if sign else f"{v:.0f}").replace("+", "$+$").replace("-", "$-$")
    s = f"{v:+.{nd}f}" if sign else f"{v:.{nd}f}"
    return s.replace("+", "$+$").replace("-", "$-$")


def _cov(s, key="coverage"):
    v = _f(s.get(key)) if s else float("nan")
    return f"{100 * v:.0f}" if np.isfinite(v) else "--"


def _hdr(f, extra=""):
    f.write("% Generated by code/make_figures.py from results/sim_results.json (run 2) -- do not edit by hand.\n")
    if extra:
        f.write(extra)


def tab_main(res, path):
    scen = ["S1", "S2", "S3", "S4"]
    pipes = [("oracle", "Oracle"), ("naive", "Naive"), ("corrected", "Corrected"), ("mi", "MI")]
    ests = ["lp", "cf", "bma", "chao", "lcmcr"]
    lines = [r"\begin{tabular}{@{}ll" + "rrr" * len(ests) + "@{}}", r"\toprule"]
    lines.append(" & & " + " & ".join(rf"\multicolumn{{3}}{{c}}{{{EST_LABEL[e]}}}" for e in ests) + r" \\")
    lines.append(" ".join(rf"\cmidrule(lr){{{3 + 3 * i}-{5 + 3 * i}}}" for i in range(len(ests))))
    lines.append("Scen. & Pipeline & " + " & ".join(["Median (MAD)", "Mean", "Cov."] * len(ests)) + r" \\")
    lines.append(r"\midrule")
    for k, sid in enumerate(scen):
        for i, (p, plab) in enumerate(pipes):
            row = [sid if i == 0 else "", plab]
            for e in ests:
                s = _est(res, sid, p, e)
                if s is None or s.get("n_ok", 0) == 0:
                    row += ["--", "--", "--"]
                else:
                    mad = 100 * _f(s["relbias_mad_sd"])
                    row.append(f"{_pct(s['relbias_median'])} ({mad:.0f})" if np.isfinite(mad) else _pct(s["relbias_median"]))
                    nb = int(s.get("n_blowup", 0))
                    row.append(_pct(s["relbias_mean"]) + (rf"\textsuperscript{{[{nb}]}}" if nb else ""))
                    row.append(_cov(s))
            lines.append(" & ".join(row) + r" \\")
        if k < len(scen) - 1:
            lines.append(r"\addlinespace")
    lines += [r"\bottomrule", r"\end{tabular}"]
    Rs = {sid: res["scenarios"][sid]["R"] for sid in scen}
    Rl = {sid: res["scenarios"][sid]["R_lcmcr"] for sid in scen}
    with open(path, "w") as f:
        _hdr(f, "% Median (MAD): median relative bias of N_hat in % (1.4826 x MAD of the relative bias, in % points);\n"
                "% Mean: mean relative bias (%), superscript [k] = number of replicates with N_hat > 5N;\n"
                "% Cov.: coverage of nominal 95% intervals (%). Corrected intervals include v_link.\n"
                f"% Replications R = {Rs}; LCMCR replications = {Rl} (4 chains per fit).\n")
        f.write("\n".join(lines) + "\n")


def tab_linkage(res, path):
    sc = res["scenarios"]["S5"]
    lines = [r"\begin{tabular}{@{}r" + "r" * 3 + "r" * 4 + "r" * 4 + "@{}}", r"\toprule"]
    lines.append(r" & \multicolumn{3}{c}{Linkage} & \multicolumn{4}{c}{False non-match rate} & "
                 r"\multicolumn{4}{c}{False-match rate} \\")
    lines.append(r"\cmidrule(lr){2-4}\cmidrule(lr){5-8}\cmidrule(lr){9-12}")
    lines.append(r"$\nu$ & Prec. & Rec. & Block. & $\delta$ & $\delta_{\mathrm{frame}}$ & $\hat\delta$ & Cov. & "
                 r"$\varepsilon$ & $\varepsilon_{\mathrm{frame}}$ & $\hat\varepsilon$ & Cov. \\")
    lines.append(r"\midrule")
    for lv in sc["results"]:
        L = lv["linkage"]
        row = [f"{lv['level_values']['noise']:.2f}",
               f"{L['precision']['mean']:.3f}", f"{L['recall']['mean']:.3f}", f"{L['blocking_recall']['mean']:.3f}",
               f"{L['delta_true']['mean']:.3f}", f"{L['delta_frame']['mean']:.3f}", f"{L['delta_hat']['mean']:.3f}",
               f"{100 * L['delta_ci_coverage_frame']:.0f}",
               f"{L['eps_true']['mean']:.3f}", f"{L['eps_frame']['mean']:.3f}", f"{L['eps_hat']['mean']:.3f}",
               f"{100 * L['eps_ci_coverage_frame']:.0f}"]
        lines.append(" & ".join(row) + r" \\")
    lines += [r"\bottomrule", r"\end{tabular}"]
    with open(path, "w") as f:
        _hdr(f, f"% S5: independent capture, record-noise sweep, R = {sc['R']} per level (means over replicates).\n"
                "% Prec./Rec.: pairwise precision / recall over all records; Block.: blocking recall (true cross-list\n"
                "% record pairs that are candidate pairs). delta, eps: realised capture-level LE rates of the naive\n"
                "% linkage over ALL true pairs; delta_frame, eps_frame: the same rates on the audit frame (candidate\n"
                "% pairs among de-duplicated records), i.e. the estimand of the random audit; hats: audit estimates\n"
                "% (B = 300 pairs); Cov.: % of replicates whose 95% audit CI covers the frame rate.\n")
        f.write("\n".join(lines) + "\n")


def tab_linkage_bias(res, path, est="bma"):
    sc = res["scenarios"]["S5"]
    pipes = [("oracle", "Oracle"), ("naive", "Naive"), ("corrected", "Corr."), ("corrected_d", r"Corr.\,$\varepsilon{=}0$"),
             ("corrected_true", "Corr.\\,true"), ("mi", "MI")]
    lines = [r"\begin{tabular}{@{}r" + "r" * len(pipes) + "r" * len(pipes) + "@{}}", r"\toprule"]
    lines.append(rf" & \multicolumn{{{len(pipes)}}}{{c}}{{Median relative bias of $\widehat{{n}}_{{\mathbf{{0}}}}$ (\%)}} & "
                 rf"\multicolumn{{{len(pipes)}}}{{c}}{{Coverage (\%)}} \\")
    lines.append(rf"\cmidrule(lr){{2-{1 + len(pipes)}}}\cmidrule(lr){{{2 + len(pipes)}-{1 + 2 * len(pipes)}}}")
    lines.append(r"$\nu$ & " + " & ".join(l for _, l in pipes) + " & " + " & ".join(l for _, l in pipes) + r" \\")
    lines.append(r"\midrule")
    for li, lv in enumerate(sc["results"]):
        row = [f"{lv['level_values']['noise']:.2f}"]
        ss = [_est(res, "S5", p, est, li) for p, _ in pipes]
        for s in ss:
            nb = int(s.get("n_blowup", 0)) if s else 0
            row.append((_pct(s["relbias_n0_median"]) + (rf"\textsuperscript{{[{nb}]}}" if nb else "")) if s and s.get("n_ok") else "--")
        for s in ss:
            row.append(_cov(s) if s and s.get("n_ok") else "--")
        lines.append(" & ".join(row) + r" \\")
    lines += [r"\bottomrule", r"\end{tabular}"]
    with open(path, "w") as f:
        _hdr(f, f"% S5: {EST_LABEL[est]}; R = {sc['R']} per level. Bias: median over replicates of (N_hat - N)/n0_true, i.e. the\n"
                "% dark-figure error with the common (oracle) observed count; superscript [k]: replicates with N_hat > 5N.\n"
                "% Coverage of 95% intervals for N; corrected intervals include v_link; MI = Gibbs linkage draws + Rubin.\n")
        f.write("\n".join(lines) + "\n")


def tab_referral(res, path):
    sc = res["scenarios"]["S7"]
    ests = ["lp", "bma", "cf", "chao"]
    lines = [r"\begin{tabular}{@{}r" + "rr" * len(ests) + "@{}}", r"\toprule"]
    lines.append(" & " + " & ".join(rf"\multicolumn{{2}}{{c}}{{{EST_LABEL[e]}}}" for e in ests) + r" \\")
    lines.append(" ".join(rf"\cmidrule(lr){{{2 + 2 * i}-{3 + 2 * i}}}" for i in range(len(ests))))
    lines.append("$q$ & " + " & ".join(["All", "Dropped"] * len(ests)) + r" \\")
    lines.append(r"\midrule")
    for li, lv in enumerate(sc["results"]):
        row = [f"{lv['level_values']['referral_q']:.2f}"]
        for e in ests:
            for p in ("oracle", "oracle_dropref"):
                s = _est(res, "S7", p, e, li)
                row.append(f"{_pct(s['relbias_median'])} ({_cov(s)})" if s and s.get("n_ok") else "--")
        lines.append(" & ".join(row) + r" \\")
    lines += [r"\bottomrule", r"\end{tabular}"]
    with open(path, "w") as f:
        _hdr(f, f"% S7: median relative bias of N_hat in % (coverage of 95% interval in %), oracle linkage, R = {sc['R']} per q.\n"
                "% All = all NGO records; Dropped = referral-only NGO records removed using the provenance flag.\n")
        f.write("\n".join(lines) + "\n")


def tab_sensitivity(res, path, scen=("S1", "S2", "S3", "S4")):
    lines = [r"\begin{tabular}{@{}lrrrrrrr@{}}", r"\toprule"]
    lines.append(r" & & & \multicolumn{2}{c}{$|\omega|\le 0.5$} & \multicolumn{2}{c}{$|\omega|\le 1$} & \\")
    lines.append(r"\cmidrule(lr){4-5}\cmidrule(lr){6-7}")
    lines.append(r"Scenario & $\omega_{\mathrm{pop}}$ & Bias $\omega{=}0$ & Bounds & CI union & Bounds & CI union "
                 r"& Cov. $\omega{=}0$ \\")
    lines.append(r"\midrule")
    for sid in scen:
        om = res["scenarios"][sid]["results"][0]["omega"]
        b = om["bands"]
        wp = _f(om["omega_pop_mean"])
        wp = 0.0 if abs(wp) < 5e-4 else wp
        row = [sid, ("0.000" if wp == 0.0 else f"{wp:+.3f}".replace("-", "$-$").replace("+", "$+$")),
               _pct(om["omega0_relbias_n0_median"]),
               f"{100 * b['0.5']['point_bounds_cover']:.0f}", f"{100 * b['0.5']['ci_union_cover']:.0f}",
               f"{100 * b['1.0']['point_bounds_cover']:.0f}", f"{100 * b['1.0']['ci_union_cover']:.0f}",
               f"{100 * om['omega0_ci_cover']:.0f}"]
        lines.append(" & ".join(row) + r" \\")
    lines += [r"\bottomrule", r"\end{tabular}"]
    with open(path, "w") as f:
        _hdr(f, "% S6: closed-form estimator on oracle tables. Bias omega=0: median relative bias of n0_hat (%).\n"
                "% Bounds: % of replications with true n0 in [n0_hat(-Omega), n0_hat(Omega)];\n"
                "% CI union: % with true n0 in the union of 95% intervals over |omega| <= Omega; Cov. omega=0: 95% CI coverage of n0.\n")
        f.write("\n".join(lines) + "\n")


def tab_le(res, path):
    sc = res["scenarios"]["S8"]
    lines = [r"\begin{tabular}{@{}rr" + "rrr" + "rrrrr" + "rrr" + "@{}}", r"\toprule"]
    lines.append(r" & & \multicolumn{3}{c}{BMA: median bias (\%)} & \multicolumn{5}{c}{BMA: coverage (\%)} & "
                 r"\multicolumn{3}{c}{Known rates: cov. with / without $v_{\mathrm{link}}$} \\")
    lines.append(r"\cmidrule(lr){3-5}\cmidrule(lr){6-10}\cmidrule(lr){11-13}")
    lines.append(r"$\delta$ & $\varepsilon$ & Naive & Known & Audit & Oracle & Known$^-$ & Known & Audit & "
                 r"Audit$^+$ & LP & CF & Chao \\")
    lines.append(r"\midrule")
    for li, lv in enumerate(sc["results"]):
        E = lv["estimates"]
        g = lambda p, e="bma": E.get(p, {}).get(e)
        row = [f"{lv['level_values']['delta']:g}", f"{lv['level_values']['eps']:g}",
               _pct(g("naive")["relbias_median"]), _pct(g("corrected_known")["relbias_median"]),
               _pct(g("corrected_review")["relbias_median"]),
               _cov(g("oracle")), _cov(g("corrected_known"), "coverage_cap"), _cov(g("corrected_known")),
               _cov(g("corrected_review")), _cov(g("corrected_review_tv"))]
        for e in ("lp", "cf", "chao"):
            s = g("corrected_known", e)
            row.append(f"{_cov(s)}/{_cov(s, 'coverage_cap')}")
        lines.append(" & ".join(row) + r" \\")
        if li in (2, 5):
            lines.append(r"\addlinespace")
    lines += [r"\bottomrule", r"\end{tabular}"]
    with open(path, "w") as f:
        _hdr(f, f"% S8: observed table = simulate_observed(t_true, delta, eps) (the LE model itself); independent capture,\n"
                f"% N = 2000, R = {sc['R']} per cell. Known: linkage_corrected with the true (delta, eps); Audit: rates from a\n"
                "% random audit simulated from the LE ground truth (200 records + 100 linked edges). Known^-: interval without\n"
                "% v_link (inner estimator only, as in run 1); Known/Audit: with v_link; Audit^+: + audit variance.\n")
        f.write("\n".join(lines) + "\n")


def tab_lcmcr(res, path):
    rows = []
    for sid in ("S1", "S2", "S3", "S4"):
        for p, plab in (("oracle", "Oracle"), ("naive", "Naive")):
            s = _est(res, sid, p, "lcmcr")
            if not s or "diag" not in s:
                continue
            d = s["diag"]
            rows.append([sid, plab, f"{d['n_fits']}", f"{d['rhat_median']:.3f}", f"{d['rhat_max']:.3f}",
                         f"{100 * d['frac_rhat_lt_1_01']:.0f}", f"{d['ess_bulk_median']:.0f}", f"{d['ess_bulk_min']:.0f}",
                         f"{d['ess_tail_median']:.0f}", f"{100 * d['frac_meets_protocol']:.0f}",
                         _pct(s["relbias_median"]) + rf" ({100 * _f(s['relbias_median_mcse']):.1f})",
                         f"{_cov(s)} ({100 * _f(s['coverage_mcse']):.0f})"])
    lines = [r"\begin{tabular}{@{}llrrrrrrrrrr@{}}", r"\toprule",
             r"Scen. & Table & Fits & $\widehat R$ med. & $\widehat R$ max & \% $\widehat R{<}1.01$ & ESS$_b$ med. & "
             r"ESS$_b$ min & ESS$_t$ med. & \% protocol & Median bias (MCSE) & Cov. (MCSE) \\", r"\midrule"]
    lines += [" & ".join(r) + r" \\" for r in rows]
    lines += [r"\bottomrule", r"\end{tabular}"]
    with open(path, "w") as f:
        _hdr(f, "% LCMCR fits with 4 chains x 7500 iterations (2500 burn-in, thin 5; 4000 pooled draws), overdispersed n0 starts.\n"
                "% Rank-normalised split-Rhat and bulk / tail ESS of N (Vehtari et al. 2021). % protocol: fits meeting App. app:comp-diag\n"
                "% (Rhat < 1.01 and bulk and tail ESS >= 400). Bias and coverage in %, Monte Carlo SE in parentheses.\n")
        f.write("\n".join(lines) + "\n")


def tab_mi(res, path, est="bma"):
    rows = []
    items = [("S4", 0, "S4")] + [("S5", li, f"S5, $\\nu={lv['level_values']['noise']:g}$")
                                 for li, lv in enumerate(res["scenarios"]["S5"]["results"])]
    for sid, li, lab in items:
        L = res["scenarios"][sid]["results"][li]["linkage"]
        if not L or "mi" not in L:
            continue
        M = L["mi"]
        sn, sm = _est(res, sid, "naive", est, li), _est(res, sid, "mi", est, li)
        rows.append([lab, f"{M['n_false_merges_point']['mean']:.0f}", f"{M['n_false_merges_draw']['mean']:.0f}",
                     f"{M['recall_point']['mean']:.3f}", f"{M['recall_draw']['mean']:.3f}",
                     f"{M['n_obs_point_minus_true']['mean']:+.0f}".replace("-", "$-$").replace("+", "$+$"),
                     f"{M['n_obs_draw_minus_true']['mean']:+.0f}".replace("-", "$-$").replace("+", "$+$"),
                     _pct(sn["relbias_median"]), _pct(sm["relbias_median"]), _cov(sn), _cov(sm)])
    lines = [r"\begin{tabular}{@{}lrrrrrrrrrr@{}}", r"\toprule",
             r" & \multicolumn{2}{c}{False merges} & \multicolumn{2}{c}{Recall} & \multicolumn{2}{c}{$n-n^\star$} & "
             rf"\multicolumn{{2}}{{c}}{{{EST_LABEL[est]} median bias (\%)}} & \multicolumn{{2}}{{c}}{{Cov. (\%)}} \\",
             r"\cmidrule(lr){2-3}\cmidrule(lr){4-5}\cmidrule(lr){6-7}\cmidrule(lr){8-9}\cmidrule(lr){10-11}",
             r"Scenario & Point & Draw & Point & Draw & Point & Draw & Naive & MI & Naive & MI \\", r"\midrule"]
    lines += [" & ".join(r) + r" \\" for r in rows]
    lines += [r"\bottomrule", r"\end{tabular}"]
    with open(path, "w") as f:
        _hdr(f, "% MI with Gibbs linkage draws (approximate posterior under the plug-in FS pairwise model) vs the point\n"
                "% linkage. False merges, recall (pairwise, all records) and n - n* (observed clusters minus true observed\n"
                "% incidents): means over replicates (draw columns: mean over the first 5 draws per replicate).\n")
        f.write("\n".join(lines) + "\n")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--results", default=os.path.join(HERE, "..", "results"))
    ap.add_argument("--figures", default=os.path.join(HERE, "..", "figures"))
    ap.add_argument("--tables", default=os.path.join(HERE, "..", "tables"))
    a = ap.parse_args()
    res = load(a.results)
    os.makedirs(a.figures, exist_ok=True)
    os.makedirs(a.tables, exist_ok=True)
    sc = res["scenarios"]
    if all(s in sc for s in ("S1", "S2", "S3", "S4")):
        fig_bias_coverage(res, os.path.join(a.figures, "fig-sim-bias-coverage.pdf"))
        tab_main(res, os.path.join(a.tables, "tab-sim-main.tex"))
        fig_sensitivity(res, os.path.join(a.figures, "fig-sim-sensitivity.pdf"))
        tab_sensitivity(res, os.path.join(a.tables, "tab-sim-sensitivity.tex"))
        tab_lcmcr(res, os.path.join(a.tables, "tab-sim-lcmcr.tex"))
    if "S5" in sc:
        with open(os.path.join(a.results, "raw", "S5.json")) as f:
            raw = json.load(f)
        fig_linkage_error(res, raw, os.path.join(a.figures, "fig-sim-linkage-error.pdf"))
        tab_linkage(res, os.path.join(a.tables, "tab-sim-linkage.tex"))
        tab_linkage_bias(res, os.path.join(a.tables, "tab-sim-linkage-bias.tex"))
        if "S4" in sc:
            tab_mi(res, os.path.join(a.tables, "tab-sim-mi.tex"))
    if "S7" in sc:
        fig_referral(res, os.path.join(a.figures, "fig-sim-referral.pdf"))
        tab_referral(res, os.path.join(a.tables, "tab-sim-referral.tex"))
    if "S8" in sc:
        fig_le_validation(res, os.path.join(a.figures, "fig-sim-le-validation.pdf"))
        tab_le(res, os.path.join(a.tables, "tab-sim-le.tex"))
    print("figures and tables written")


if __name__ == "__main__":
    main()
