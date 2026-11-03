#!/usr/bin/env python
"""Figures and LaTeX tables for the simulation section (sec:simulation).

Reads ../results/sim_results.json (and ../results/raw/S5.json for the per-replication
scatter of fig-sim-linkage-error) and writes
  ../figures/fig-sim-bias-coverage.pdf   bias and coverage by estimator x pipeline x scenario (S1-S4)
  ../figures/fig-sim-linkage-error.pdf   dark-figure bias vs realised linkage error (S5)
  ../figures/fig-sim-sensitivity.pdf     closed-form n0(omega) curves with |omega| <= Omega bands (S6)
  ../figures/fig-sim-referral.pdf        Lincoln-Petersen bias with / without provenance correction (S7)
  ../tables/tab-sim-main.tex             main results (S1-S4)
  ../tables/tab-sim-linkage.tex          linkage error and correction by noise level (S5)
  ../tables/tab-sim-referral.tex         referral sweep (S7)
  ../tables/tab-sim-sensitivity.tex      omega-sensitivity bands (S6)
No titles inside plots; captions belong in LaTeX.
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
                  mi="Multiple imputation", corrected_d=r"Corrected, $\varepsilon=0$ (post hoc)",
                  corrected_true=r"Corrected, realised $(\delta,\varepsilon)$",
                  corrected_tv="Corrected + review var.", corrected_lefit="Corrected, best-fit LE")
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
                b, mcse = 100 * _f(s["relbias"]), 100 * _f(s["relbias_mcse"])
                if b > ylim_b[1] or b < ylim_b[0]:     # clipped: open triangle at the panel edge
                    yb = ylim_b[1] - 2.5 if b > 0 else ylim_b[0] + 2.5
                    axb.plot(xb, yb, marker="^" if b > 0 else "v", ms=4.4, color=COL[p], mfc="white", mew=1.0,
                             zorder=4, ls="none")
                else:
                    axb.errorbar(xb, b, yerr=2 * mcse if np.isfinite(mcse) else None, fmt=MARK[p], ms=3.6,
                                 color=COL[p], mec="white", mew=0.4, elinewidth=0.8, capsize=0, zorder=3)
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
    axes[0, 0].set_ylabel(r"Relative bias of $\widehat{N}$ (%)")
    axes[1, 0].set_ylabel("Coverage of 95% interval (%)")
    handles = [Line2D([], [], marker=MARK[p], color=COL[p], ls="none", ms=4.5, mec="white", mew=0.4,
                      label=PIPE_LABEL[p]) for p in pipes]
    fig.legend(handles=handles, loc="outside lower center", ncol=4, frameon=False,
               handletextpad=0.3, columnspacing=1.2)
    fig.savefig(path)
    plt.close(fig)


# ---------------------------------------------------------------------------
# Figure 2: linkage error sweep (S5)
# ---------------------------------------------------------------------------
def fig_linkage_error(res, raw_s5, path, est="bma"):
    """(a) realised and review-estimated LE rates vs noise; (b), (c) n0_hat / n0 vs realised delta, eps.

    The dark-figure error is shown as the ratio n0_hat / n0 = 1 + relative bias on a log
    axis (the LE-corrected estimators can overshoot by an order of magnitude). Small
    points: replications; lines: level means of the ratio (= 1 + mean relative bias).
    """
    sc = res["scenarios"]["S5"]
    levels = sc["results"]
    nu = np.array([lv["level_values"]["noise"] for lv in levels])
    L = [lv["linkage"] for lv in levels]
    g = lambda key: np.array([l[key]["mean"] for l in L])
    fig, axes = plt.subplots(1, 3, figsize=(W2, 2.55), layout="constrained",
                             gridspec_kw=dict(width_ratios=[1, 1.1, 1.1]))
    ax = axes[0]
    _style(ax, "both")
    ax.plot(nu, g("delta_true"), color="#0072B2", ls="-", marker="o", ms=3.5, label=r"$\delta$ realised")
    ax.plot(nu, g("delta_hat"), color="#0072B2", ls="none", marker="o", ms=5.5, mfc="white", mew=0.9,
            label=r"$\hat\delta$ review")
    ax.plot(nu, g("eps_true"), color="#D55E00", ls="--", marker="s", ms=3.5, label=r"$\varepsilon$ realised")
    ax.plot(nu, g("eps_hat"), color="#D55E00", ls="none", marker="s", ms=5.5, mfc="white", mew=0.9,
            label=r"$\hat\varepsilon$ review")
    ax.set_xlabel(r"Record-noise level $\nu$")
    ax.set_ylabel("Linkage error rate")
    ax.legend(frameon=False, loc="upper left", handlelength=1.6, borderaxespad=0.2, fontsize=6.6)
    ax.set_title("(a)", loc="left", fontsize=8.5, pad=2)
    pipes = ["naive", "corrected", "corrected_d", "corrected_true"]
    ymin, ymax = 0.5, 2.0
    for k, (xkey, xlabel, tag) in enumerate([("delta", r"Realised $\delta$", "(b)"),
                                             ("eps", r"Realised $\varepsilon$", "(c)")]):
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
                ys.append(max(((_f(pr["N_hat"]) - _f(pr["n_obs"]))) / n0, 1e-2))
            if p != "oracle":
                ax.scatter(xs, ys, s=2.0, color=COL[p], alpha=0.2, lw=0, zorder=2, rasterized=True)
            mx = g(xkey + "_true")
            my = np.array([1 + _f(_est(res, "S5", p, est, li)["relbias_n0"]) for li in range(len(levels))])
            ymin, ymax = min(ymin, np.nanmin(my)), max(ymax, np.nanmax(my))
            ax.plot(mx, my, color=COL[p], ls=LS[p], marker=MARK[p], ms=3.8 if p != "oracle" else 2.6,
                    lw=1.4 if p != "oracle" else 0.9, mec="white", mew=0.4, zorder=4, label=PIPE_LABEL[p])
        ax.set_yscale("log")
        ax.set_xlabel(xlabel)
        ax.set_title(tag, loc="left", fontsize=8.5, pad=2)
    for ax in axes[1:]:
        ax.set_ylim(ymin / 1.25, ymax * 1.25)
        ax.yaxis.set_major_locator(matplotlib.ticker.FixedLocator([0.5, 0.75, 1, 1.5, 2, 3, 5, 10, 20, 50]))
        ax.yaxis.set_major_formatter(matplotlib.ticker.FuncFormatter(lambda v, _: f"{v:g}"))
        ax.yaxis.set_minor_formatter(matplotlib.ticker.NullFormatter())
    axes[1].set_ylabel(r"$\widehat{n}_{\mathbf{0}}\,/\,n_{\mathbf{0}}$ (" + EST_LABEL[est] + ", log scale)")
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
        y = np.array([100 * _f(_est(res, "S7", pipe, est, li)["relbias"]) for li in range(len(q))])
        e = np.array([200 * _f(_est(res, "S7", pipe, est, li)["relbias_mcse"]) for li in range(len(q))])
        ax.errorbar(q, y, yerr=e, color=col, ls=ls, marker=mk, ms=3.6 if ls == "-" else 3.0,
                    mfc=col if ls == "-" else "white", mec=col, mew=0.8, lw=1.2, elinewidth=0.7, capsize=0, label=lab)
    ax.set_xlabel(r"Referral probability $q$")
    ax.set_ylabel(r"Relative bias of $\widehat{N}$ (%)")
    ax.set_xticks(q)
    ax.legend(frameon=False, loc="lower left", fontsize=6.4, handlelength=2.0, borderaxespad=0.2)
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


def tab_main(res, path):
    scen = ["S1", "S2", "S3", "S4"]
    pipes = [("oracle", "Oracle"), ("naive", "Naive"), ("corrected", "Corrected"), ("mi", "MI")]
    ests = ["lp", "cf", "bma", "chao", "lcmcr"]
    lines = [r"\begin{tabular}{@{}ll" + "rr" * len(ests) + "@{}}", r"\toprule"]
    lines.append(" & & " + " & ".join(rf"\multicolumn{{2}}{{c}}{{{EST_LABEL[e]}}}" for e in ests) + r" \\")
    lines.append(" ".join(rf"\cmidrule(lr){{{3 + 2 * i}-{4 + 2 * i}}}" for i in range(len(ests))))
    lines.append("Scenario & Pipeline & " + " & ".join(["Bias", "Cov."] * len(ests)) + r" \\")
    lines.append(r"\midrule")
    names = dict(S1="S1", S2="S2", S3="S3", S4="S4")
    for k, sid in enumerate(scen):
        for i, (p, plab) in enumerate(pipes):
            row = [names[sid] if i == 0 else "", plab]
            for e in ests:
                s = _est(res, sid, p, e)
                if s is None or s.get("n_ok", 0) == 0:
                    row += ["--", "--"]
                else:
                    row += [_pct(s["relbias"]), f"{100 * _f(s['coverage']):.0f}"]
            lines.append(" & ".join(row) + r" \\")
        if k < len(scen) - 1:
            lines.append(r"\addlinespace")
    lines += [r"\bottomrule", r"\end{tabular}"]
    with open(path, "w") as f:
        f.write("% Generated by code/make_figures.py from results/sim_results.json -- do not edit by hand.\n")
        f.write("% Bias: mean relative bias of N_hat (%); Cov.: coverage of nominal 95% intervals (%).\n")
        f.write("% Means of exploding estimators are outlier-dominated; medians are in results/sim_results.json.\n")
        Rs = {sid: res["scenarios"][sid]["R"] for sid in scen}
        Rl = {sid: res["scenarios"][sid]["R_lcmcr"] for sid in scen}
        f.write(f"% Replications R = {Rs}; LCMCR replications = {Rl}.\n")
        f.write("\n".join(lines) + "\n")


def tab_linkage(res, path, est="bma"):
    sc = res["scenarios"]["S5"]
    lines = [r"\begin{tabular}{@{}r" + "r" * 6 + "r" * 5 + "@{}}", r"\toprule"]
    lines.append(r" & \multicolumn{6}{c}{Linkage} & \multicolumn{5}{c}{Relative bias of $\widehat{n}_{\mathbf{0}}$, "
                 + EST_LABEL[est] + r" (\%)} \\")
    lines.append(r"\cmidrule(lr){2-7}\cmidrule(lr){8-12}")
    lines.append(r"$\nu$ & Prec. & Rec. & $\delta$ & $\hat\delta$ & $\varepsilon$ & $\hat\varepsilon$ & "
                 r"Oracle & Naive & Corr. & Corr.\,$\varepsilon{=}0$ & Corr.\,true \\")
    lines.append(r"\midrule")
    for li, lv in enumerate(sc["results"]):
        L = lv["linkage"]
        row = [f"{lv['level_values']['noise']:.2f}",
               f"{L['precision']['mean']:.3f}", f"{L['recall']['mean']:.3f}",
               f"{L['delta_true']['mean']:.3f}", f"{L['delta_hat']['mean']:.3f}",
               f"{L['eps_true']['mean']:.3f}", f"{L['eps_hat']['mean']:.3f}"]
        for p in ("oracle", "naive", "corrected", "corrected_d", "corrected_true"):
            s = _est(res, "S5", p, est, li)
            row.append(_pct(s["relbias_n0"]) if s and s.get("n_ok") else "--")
        lines.append(" & ".join(row) + r" \\")
    lines += [r"\bottomrule", r"\end{tabular}"]
    with open(path, "w") as f:
        f.write("% Generated by code/make_figures.py from results/sim_results.json -- do not edit by hand.\n")
        f.write(f"% S5: independent capture, record-noise sweep, R = {sc['R']} per level. Precision/recall over all records;\n")
        f.write("% delta, eps: realised LE-model rates of the naive linkage; hats: clerical-review estimates (B = 300 pairs).\n")
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
                row.append(f"{_pct(s['relbias'])} ({100 * _f(s['coverage']):.0f})" if s and s.get("n_ok") else "--")
        lines.append(" & ".join(row) + r" \\")
    lines += [r"\bottomrule", r"\end{tabular}"]
    with open(path, "w") as f:
        f.write("% Generated by code/make_figures.py from results/sim_results.json -- do not edit by hand.\n")
        f.write(f"% S7: relative bias of N_hat in % (coverage of 95% interval in %), oracle linkage, R = {sc['R']} per q.\n")
        f.write("% All = all NGO records; Dropped = referral-only NGO records removed using the provenance flag.\n")
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
        f.write("% Generated by code/make_figures.py from results/sim_results.json -- do not edit by hand.\n")
        f.write("% S6: closed-form estimator on oracle tables. Bias omega=0: median relative bias of n0_hat (%).\n")
        f.write("% Bounds: % of replications with true n0 in [n0_hat(-Omega), n0_hat(Omega)];\n")
        f.write("% CI union: % with true n0 in the union of 95% intervals over |omega| <= Omega; Cov. omega=0: 95% CI coverage of n0.\n")
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
    if "S5" in sc:
        with open(os.path.join(a.results, "raw", "S5.json")) as f:
            raw = json.load(f)
        fig_linkage_error(res, raw, os.path.join(a.figures, "fig-sim-linkage-error.pdf"))
        tab_linkage(res, os.path.join(a.tables, "tab-sim-linkage.tex"))
    if "S7" in sc:
        fig_referral(res, os.path.join(a.figures, "fig-sim-referral.pdf"))
        tab_referral(res, os.path.join(a.tables, "tab-sim-referral.tex"))
    print("figures and tables written")


if __name__ == "__main__":
    main()
