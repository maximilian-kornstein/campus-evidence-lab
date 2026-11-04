#!/usr/bin/env python
"""Figures and LaTeX tables for the simulation section (sec:simulation).

Reads ../results/sim_results.json (and ../results/raw/X5.json for the index scatter) and writes
  ../figures/fig-sim-recovery.pdf   X1: ECV recovery, interval coverage, boundary-set classification
  ../figures/fig-sim-dif.pdf        X2: latent-mean bias by DIF strategy, DIF flag rates
  ../figures/fig-sim-list.pdf       X3: SDB estimation by allocation; J / control-correlation sweep
  ../figures/fig-sim-mrp.pdf        X4: area-level RMSE, MRP vs direct
  ../figures/fig-sim-index.pdf      X5: index sign reversals under random DIF
  ../tables/tab-sim-main.tex        X1 main recovery table
  ../tables/tab-sim-dif.tex         X2 at the main DIF magnitude
  ../tables/tab-sim-list.tex        X3
  ../tables/tab-sim-mrp.tex         X4
  ../figures/fig-sim-misspec.pdf    X6: cross-loading and acquiescence, standard fit vs remedies
  ../tables/tab-sim-misspec.tex     X6;  tab-sim-tetrad.tex X9;  tab-sim-anchors.tex X2b;
  ../tables/tab-sim-difrev.tex      X7;  tab-sim-delta.tex X8
Experiments X1-X5 were labelled E1-E5 in the first run (renamed; results unchanged).
No titles inside plots; captions belong in LaTeX.  Style follows Paper 1 (../dark-figure/code/make_figures.py).
Usage (from code/): python make_figures.py [--results ../results] [--figures ../figures] [--tables ../tables]
"""
from __future__ import annotations

import argparse
import json
import os

import numpy as np
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
from matplotlib.lines import Line2D  # noqa: E402
from matplotlib.patches import Patch  # noqa: E402

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
# Okabe-Ito (colour-blind safe; checked with the dataviz palette validator); black = truth / oracle.
OI = dict(black="#000000", verm="#D55E00", blue="#0072B2", orange="#E69F00", green="#009E73", pink="#CC79A7",
          sky="#56B4E9")

CFG = ["I6", "I3", "I3np", "I2", "I3p"]
CFG_LABEL = dict(I6=r"$|\mathcal{I}|=6$", I3=r"$|\mathcal{I}|=3$", I3np=r"$|\mathcal{I}|=3$, near-prop. $S$",
                 I2=r"$|\mathcal{I}|=2$ (not ident.)", I3p=r"$|\mathcal{I}|=3$, prop. $S$ (not ident.)")
CFG_SHORT = dict(I6=r"$|\mathcal{I}|{=}6$", I3=r"$|\mathcal{I}|{=}3$", I3np="near-\nprop.", I2=r"$|\mathcal{I}|{=}2$",
                 I3p="prop.")
CFG_COL = dict(I6=OI["blue"], I3=OI["green"], I3np=OI["pink"], I2=OI["verm"], I3p=OI["orange"])
CFG_MARK = dict(I6="o", I3="D", I3np="v", I2="s", I3p="^")
CFG_LS = dict(I6="-", I3="-", I3np="-.", I2="--", I3p=":")


def x1_cells(res):
    """X1 and X1b summaries merged (keys cfg_n<n>)."""
    S = dict(res["experiments"]["X1"]["summary"])
    if "X1b" in res["experiments"]:
        S.update(res["experiments"]["X1b"]["summary"])
    return S


def x1_cfgs(res):
    S = x1_cells(res)
    return [c for c in CFG if any(k.startswith(c + "_n") for k in S)]

STRAT = ["naive", "correct_fb", "correct_proc", "contam1_fb", "contam2_fb", "sonly_fb", "oracle"]
STRAT_LABEL = dict(naive="Ignore DIF (full invariance)", correct_fb="Correct anchors, free baseline",
                   correct_proc="Correct anchors, drafted screen + refit", contam1_fb="1 contaminated anchor",
                   contam2_fb="2 contaminated anchors", oracle="Oracle (true DIF items free)",
                   sonly_fb="Stereotype-only anchors (S1-S4)",
                   contam1_proc="1 contaminated, drafted screen + refit",
                   contam2_proc="2 contaminated, drafted screen + refit",
                   correct_rev="Correct anchors, revised screen + refit (X7)",
                   contam1_rev="1 contaminated, revised screen + refit (X7)",
                   contam2_rev="2 contaminated, revised screen + refit (X7)")
STRAT_COL = dict(naive=OI["verm"], correct_fb=OI["blue"], correct_proc=OI["sky"], contam1_fb=OI["orange"],
                 contam2_fb=OI["pink"], sonly_fb=OI["green"], oracle=OI["black"])
STRAT_MARK = dict(naive="s", correct_fb="o", correct_proc="D", contam1_fb="^", contam2_fb="v", sonly_fb="X", oracle="P")


def load(results_dir):
    with open(os.path.join(results_dir, "sim_results.json")) as f:
        return json.load(f)


def _f(x):
    return float("nan") if x is None else float(x)


def _style(ax, grid_axis="y"):
    ax.grid(True, axis=grid_axis, color=GRID, lw=0.5, zorder=0)
    ax.set_axisbelow(True)
    ax.tick_params(colors="#222222")


def _tag(ax, s):
    ax.set_title(s, loc="left", fontsize=8.5, pad=2)


# ---------------------------------------------------------------------------
# X1
# ---------------------------------------------------------------------------
def fig_recovery(res, path):
    e1 = res["experiments"]["X1"]
    S = x1_cells(res)
    ns = e1["config"]["n"]
    CFG = x1_cfgs(res)
    fig, axes = plt.subplots(1, 3, figsize=(W2, 2.55), layout="constrained",
                             gridspec_kw=dict(width_ratios=[1, 1, 1.5]))
    ax = axes[0]
    _style(ax, "both")
    for c in CFG:
        y = [_f(S[f"{c}_n{n}"]["ecv_I"]["rmse"]["rmse"]) for n in ns]
        e = [2 * _f(S[f"{c}_n{n}"]["ecv_I"]["rmse"]["mcse"]) for n in ns]
        ax.errorbar(ns, y, yerr=e, color=CFG_COL[c], marker=CFG_MARK[c], ls=CFG_LS[c], ms=3.8, mec="white",
                    mew=0.4, elinewidth=0.8, capsize=0, label=CFG_LABEL[c])
    ax.set_xscale("log")
    ax.set_xticks(ns)
    ax.set_xticklabels([str(n) for n in ns])
    ax.minorticks_off()
    ax.set_ylim(bottom=0)
    ax.set_xlabel("Sample size $n$")
    ax.set_ylabel(r"RMSE of $\widehat{\mathrm{ECV}}_j$, $j\in\mathcal{I}$")
    _tag(ax, "(a)")
    ax = axes[1]
    _style(ax, "both")
    ax.axhline(95, color=INK2, lw=0.7, zorder=1)
    for c in CFG:
        y = [100 * _f(S[f"{c}_n{n}"]["ecv_I"]["cover_boot"]["p"]) for n in ns]
        e = [200 * _f(S[f"{c}_n{n}"]["ecv_I"]["cover_boot"]["mcse"]) for n in ns]
        ax.errorbar(ns, y, yerr=e, color=CFG_COL[c], marker=CFG_MARK[c], ls=CFG_LS[c], ms=3.8, mec="white",
                    mew=0.4, elinewidth=0.8, capsize=0)
        yw = [100 * _f(S[f"{c}_n{n}"]["ecv_I"]["cover_wald"]["p"]) for n in ns]
        ax.plot(ns, yw, color=CFG_COL[c], marker=CFG_MARK[c], ls="none", ms=4.6, mfc="white", mew=0.9)
    ax.set_xscale("log")
    ax.set_xticks(ns)
    ax.set_xticklabels([str(n) for n in ns])
    ax.minorticks_off()
    lo = min(40, min(100 * _f(S[f"{c}_n{n}"]["ecv_I"][k]["p"]) for c in CFG for n in ns
                     for k in ("cover_boot", "cover_wald")) - 5)
    ax.set_ylim(max(0, 10 * np.floor(lo / 10)), 101)
    ax.set_xlabel("Sample size $n$")
    ax.set_ylabel("Coverage of 95% interval (%)")
    ax.plot([], [], color=INK2, marker="o", ls="-", ms=3.8, label="bootstrap percentile")
    ax.plot([], [], color=INK2, marker="o", ls="none", ms=4.6, mfc="white", mew=0.9, label="Wald (sandwich)")
    ax.legend(frameon=False, loc="lower left", fontsize=6.6, handlelength=1.6)
    _tag(ax, "(b)")
    ax = axes[2]
    _style(ax, "y")
    width = 0.25
    x0 = 0
    xt, xl = [], []
    # identified designs in colour; the non-identified ones (and the weakly identified near-proportional
    # design) in grey, so that their "correct" shares are not read as information from the data
    GREY = dict(correct="#8c8c8c", indet="#d4d4d4", wrong="#5a5a5a")
    status = dict(I3np="weak", I2="not\nident.", I3p="not\nident.")
    for c in CFG:
        grey = c in status
        for i, n in enumerate(ns):
            b = S[f"{c}_n{n}"]["boundary"]
            pc, pi_, pw = 100 * _f(b["p_correct"]["p"]), 100 * _f(b["p_indet"]["p"]), 100 * _f(b["p_wrong"]["p"])
            x = x0 + (i - 1) * (width + 0.03)
            ax.bar(x, pc, width, color=GREY["correct"] if grey else OI["blue"], edgecolor="white", lw=0.5, zorder=2)
            ax.bar(x, pi_, width, bottom=pc, color=GREY["indet"] if grey else "#c8c8c8", edgecolor="white", lw=0.5,
                   zorder=2)
            ax.bar(x, pw, width, bottom=pc + pi_, color=GREY["wrong"] if grey else OI["verm"], edgecolor="white", lw=0.5,
                   zorder=2)
        xt.append(x0)
        xl.append(CFG_SHORT[c] + (f"\n({status[c]})" if grey else ""))
        x0 += 1
    ax.set_xticks(xt)
    ax.set_xticklabels(xl, fontsize=6.0, linespacing=0.95)
    ax.set_ylim(0, 119)
    ax.set_yticks([0, 20, 40, 60, 80, 100])
    ax.set_ylabel(r"Classification of $j\in\mathcal{I}$ (%)")
    ax.set_xlabel(r"Design; bars $n$ = 500, 1000, 3000", fontsize=7.6)
    ax.legend(handles=[Patch(color=OI["blue"], label="correct"), Patch(color="#c8c8c8", label="undetermined"),
                       Patch(color=OI["verm"], label="wrong")], frameon=False, loc="upper right",
              ncol=3, fontsize=6.0, handlelength=1.0, columnspacing=0.7, borderaxespad=0.1, handletextpad=0.4)
    _tag(ax, "(c)")
    h, l = axes[0].get_legend_handles_labels()
    fig.legend(h, l, loc="outside lower center", ncol=3, frameon=False, handletextpad=0.3, columnspacing=1.2,
               fontsize=7.0)
    fig.savefig(path)
    plt.close(fig)


def _pct(x, nd=0):
    if x is None or not np.isfinite(x):
        return "--"
    return f"{100 * x:.{nd}f}"


def _num(x, nd=3, sign=False):
    if x is None or not np.isfinite(x):
        return "--"
    if abs(x) < 0.5 * 10 ** (-nd):
        x = 0.0                                   # no "-0.000"
    s = f"{x:+.{nd}f}" if sign else f"{x:.{nd}f}"
    return s.replace("-", "$-$") if s.startswith("-") else s


def tab_main(res, path):
    e1 = res["experiments"]["X1"]
    S = x1_cells(res)
    ns = e1["config"]["n"]
    CFG = x1_cfgs(res)
    Rs = dict(e1["config"].get("R", {}))
    if "X1b" in res["experiments"]:
        Rs.update({k: res["experiments"]["X1b"]["config"]["R"] for k in res["experiments"]["X1b"]["config"]["configs"]})
    lines = [r"\begin{tabular}{@{}llrrrrrrrrrr@{}}", r"\toprule",
             r" & & \multicolumn{4}{c}{$\widehat{\mathrm{ECV}}_j$, $j\in\mathcal{I}$} & "
             r"\multicolumn{4}{c}{Boundary set $\mathcal{B}_{0.5}$ (\%)} & \multicolumn{2}{c}{$\hat\rho_{SI}$} \\",
             r"\cmidrule(lr){3-6} \cmidrule(lr){7-10} \cmidrule(lr){11-12}",
             r"Design & $n$ & Bias & RMSE & Cov.\ B & Cov.\ W & Corr. & Undet. & Wrong & Set & RMSE & Cov. \\",
             r"\midrule"]
    for ci, c in enumerate(CFG):
        for i, n in enumerate(ns):
            d = S[f"{c}_n{n}"]
            name = (CFG_LABEL[c].replace(" (not ident.)", r"$^{\dagger}$") if i == 0 else "")
            if c == "I3p" and i == 0:
                name = r"$|\mathcal{I}|=3$, prop.\ $S^{\dagger}$"
            if c == "I3np" and i == 0:
                name = r"$|\mathcal{I}|=3$, near-prop.\ $S$"
            lines.append(" & ".join([
                name, str(n), _num(_f(d["ecv_I"]["bias"]["mean"]), 3, True), _num(_f(d["ecv_I"]["rmse"]["rmse"]), 3),
                _pct(_f(d["ecv_I"]["cover_boot"]["p"])), _pct(_f(d["ecv_I"]["cover_wald"]["p"])),
                _pct(_f(d["boundary"]["p_correct"]["p"])), _pct(_f(d["boundary"]["p_indet"]["p"])),
                _pct(_f(d["boundary"]["p_wrong"]["p"])), _pct(_f(d["boundary_bonferroni"]["p_simultaneous"]["p"])),
                _num(_f(d["phi"]["rmse"]["rmse"]), 3),
                _pct(_f(d["phi"]["cover"]["p"]))]) + r" \\")
        if ci < len(CFG) - 1:
            lines.append(r"\addlinespace")
    lines += [r"\bottomrule", r"\end{tabular}"]
    hdr = ["% Generated by code/make_figures.py from results/sim_results.json -- do not edit by hand.",
           "% X1. Bias/RMSE pooled over the Israel-related items; Cov. B = bootstrap percentile, Cov. W = sandwich",
           "% (logit-scale Wald) coverage of nominal 95% intervals; boundary classification from the bootstrap",
           f"% interval (in / out / undetermined vs the true ECV_j >= 0.5). R per design = {Rs}; B = {e1['config']['B']}.",
           "% Set: Pr(B_in subset B_tau subset B_out) with Bonferroni logit-Wald intervals (prop:id-boundary-test(b)).",
           "% rho_SI: correlated-factors S-I correlation vs its pseudo-true value; Cov. = sandwich interval.",
           "% dagger = not identified (thm:ident)."]
    with open(path, "w") as f:
        f.write("\n".join(hdr + lines) + "\n")


# ---------------------------------------------------------------------------
# X2
# ---------------------------------------------------------------------------
def fig_dif(res, path):
    e2 = res["experiments"]["X2"]
    S, P = e2["summary"], e2["population"]
    ks = e2["config"]["kappa"]
    fig, axes = plt.subplots(1, 3, figsize=(W2, 2.55), layout="constrained",
                             gridspec_kw=dict(width_ratios=[1, 1, 1.15]))
    off = np.linspace(-0.018, 0.018, len(STRAT))
    for a, (fac, lab) in enumerate((("G", r"Median error of $\hat\mu_G^{(1)}-\hat\mu_G^{(0)}$"),
                                    ("I", r"Median error of $\hat\mu_I^{(1)}-\hat\mu_I^{(0)}$"))):
        ax = axes[a]
        _style(ax, "both")
        ax.axhline(0, color=INK2, lw=0.7, zorder=1)
        for si, s in enumerate(STRAT):
            if s not in S[str(ks[0])] or not S[str(ks[0])][s]["mu_" + fac].get("identified", True):
                continue
            xs = np.array(ks) + off[si]
            # medians (robust to the rare fit at a variance bound); +-2 robust MCSE of the median
            y = [_f(S[str(k)][s]["mu_" + fac]["bias"]["median"]) for k in ks]
            e = [2 * _f(S[str(k)][s]["mu_" + fac]["bias"].get("mcse_median")) for k in ks]
            ax.errorbar(xs, y, yerr=e, color=STRAT_COL[s], marker=STRAT_MARK[s], ls="none", ms=3.6, mec="white",
                        mew=0.4, elinewidth=0.8, capsize=0, zorder=3, label=STRAT_LABEL[s])
            if s in P[str(ks[0])]:
                yp = [P[str(k)][s]["mu"]["GSI".index(fac)] - e2["config"]["mu1"]["GSI".index(fac)] for k in ks]
                ax.plot(ks, yp, color=STRAT_COL[s], lw=0.9, ls="-", alpha=0.75, zorder=2)
        ax.set_xticks(ks)
        ax.set_xlabel(r"DIF magnitude $\kappa$")
        ax.set_ylabel(lab)
        _tag(ax, "(a)" if a == 0 else "(b)")
    # (c) detection at the main kappa
    ax = axes[2]
    _style(ax, "y")
    km = str(e2["config"]["main_kappa"])
    det = S[km]["detection"]
    groups = [("I1", "I2"), ("I3",), None]
    glabels = ["uniform\n(I1, I2)", "non-unif.\n(I3)", "DIF-free"]
    sets = ["correct", "contam1", "contam2"]
    scol = dict(correct=OI["blue"], contam1=OI["orange"], contam2=OI["pink"])
    slab = dict(correct="correct anchors", contam1="1 contaminated", contam2="2 contaminated")
    width = 0.26
    for gi, grp in enumerate(groups):
        for si, aset in enumerate(sets):
            items = det[aset]["items"]
            if grp is None:
                vals = [items[k]["flag"]["p"] for k, v in items.items() if not v["dif_true"]]
                vals_bh = [items[k]["sig_bh"]["p"] for k, v in items.items() if not v["dif_true"]]
            else:
                vals = [items[k]["flag"]["p"] for k in grp if k in items]
                vals_bh = [items[k]["sig_bh"]["p"] for k in grp if k in items]
            x = gi + (si - 1) * (width + 0.02)
            if vals:
                ax.bar(x, 100 * np.mean(vals), width, color=scol[aset], edgecolor="white", lw=0.5, zorder=2)
                if 100 * np.mean(vals) < 6:
                    ax.text(x, 100 * np.mean(vals) + 1.5, f"{100 * np.mean(vals):.0f}", ha="center", va="bottom",
                            fontsize=5.8, color=INK2)
                ax.plot(x, 100 * np.mean(vals_bh), marker="_", ms=9, mew=1.4, color="#222222", zorder=3, ls="none")
            else:
                ax.text(x, 2, "anchor", rotation=90, fontsize=5.8, ha="center", va="bottom", color=INK2)
    ax.set_xticks(range(3))
    ax.set_xticklabels(glabels, fontsize=6.8)
    ax.set_ylim(0, 100)
    ax.set_ylabel(r"Flag rate at $\kappa=" + km + "$ (%)")
    hs = [Patch(color=scol[s], label=slab[s]) for s in sets] + \
         [Line2D([], [], marker="_", ms=9, mew=1.4, color="#222222", ls="none", label="BH only (no effect size)")]
    ax.legend(handles=hs, frameon=False, fontsize=6.2, loc="upper right", handlelength=1.0, borderaxespad=0.1)
    _tag(ax, "(c)")
    h, l = axes[0].get_legend_handles_labels()
    fig.legend(h, l, loc="outside lower center", ncol=3, frameon=False, handletextpad=0.3, columnspacing=1.0,
               fontsize=7.0)
    fig.savefig(path)
    plt.close(fig)


def tab_dif(res, path):
    e2 = res["experiments"]["X2"]
    km = str(e2["config"]["main_kappa"])
    S = e2["summary"][km]
    strats = ["naive", "oracle", "correct_fb", "correct_proc", "correct_rev", "contam1_fb", "contam1_proc", "contam1_rev",
              "contam2_fb", "contam2_proc", "contam2_rev", "sonly_fb"]
    S = dict(S)
    if "X7" in res["experiments"]:                      # the revised screen (BH only), same data sets
        S7 = res["experiments"]["X7"]["summary"][km]
        for a in ("correct", "contam1", "contam2"):
            S[a + "_rev"] = S7[a]
    lines = [r"\begin{tabular}{@{}lrrrrrrrr@{}}", r"\toprule",
             r" & \multicolumn{3}{c}{$\mu_G^{(1)}-\mu_G^{(0)}=0.3$} & \multicolumn{3}{c}{$\mu_I^{(1)}-\mu_I^{(0)}=0.3$} & "
             r"\multicolumn{2}{c}{$\mathrm{ECV}_{I3}$ bias} \\",
             r"\cmidrule(lr){2-4} \cmidrule(lr){5-7} \cmidrule(lr){8-9}",
             r"Strategy & Bias & RMSE & Cov. & Bias & RMSE & Cov. & Ref. & Focal \\", r"\midrule"]
    for s in strats:
        if s not in S:
            continue
        d = S[s]
        ident_I = d["mu_I"].get("identified", True)
        lines.append(" & ".join([
            STRAT_LABEL[s], _num(_f(d["mu_G"]["bias"]["mean"]), 3, True), _num(_f(d["mu_G"]["rmse"]["rmse"]), 3),
            _pct(_f(d["mu_G"]["cover"]["p"])),
            _num(_f(d["mu_I"]["bias"]["mean"]), 3, True) if ident_I else r"\multicolumn{3}{c}{not identified}",
            ] + ([_num(_f(d["mu_I"]["rmse"]["rmse"]), 3), _pct(_f(d["mu_I"]["cover"]["p"]))] if ident_I else []) + [
            _num(_f(d["ecv0_I3"]["bias"]["mean"]), 3, True), _num(_f(d["ecv1_I3"]["bias"]["mean"]), 3, True)]) + r" \\")
    lines += [r"\bottomrule", r"\end{tabular}"]
    hdr = ["% Generated by code/make_figures.py from results/sim_results.json -- do not edit by hand.",
           f"% X2 at kappa = {km}; n = {e2['config']['n_per_group']} per group; R = {S['R']}. Cov.: sandwich 95% interval.",
           "% ECV_I3: the non-uniform-DIF item, true ECV 0.40 (reference) and "
           f"{S['naive']['ecv1_I3']['true']:.3f} (focal).",
           "% 'drafted screen': BH q = 0.05 AND expected-score difference >= 0.25 at the focal mean (X2); "
           "'revised screen': BH q = 0.05 alone (X7, the same data sets)."]
    with open(path, "w") as f:
        f.write("\n".join(hdr + lines) + "\n")


# ---------------------------------------------------------------------------
# X3
# ---------------------------------------------------------------------------
def _x3_theory_rmse(c, est="split"):
    th = c[est]["sd_theory"]
    b = c[est].get("bias_theory") or 0.0
    return None if th is None else float(np.sqrt(th ** 2 + b ** 2))


def fig_list(res, path):
    e3 = res["experiments"]["X3"]
    C = e3["summary"]["cells"]
    fig, axes = plt.subplots(1, 3, figsize=(W2, 2.5), layout="constrained",
                             gridspec_kw=dict(width_ratios=[1.0, 1.15, 1.1]))
    # (a) split design: allocation
    ax = axes[0]
    _style(ax, "y")
    allocs = ["equal", "neyman", "pilot"]
    alab = dict(equal="equal", neyman="Neyman", pilot="pilot\nplug-in")
    ctrl = [("indep", "independent controls", OI["verm"], "s"), ("pairs", r"pairs, $\rho=-0.6$", OI["blue"], "o")]
    for i, a in enumerate(allocs):
        for j, (cn, lab, col, mk) in enumerate(ctrl):
            c = C[f"A_{cn}_{a}"]
            x = i + (j - 0.5) * 0.3
            ax.errorbar(x, _f(c["split"]["rmse"]["rmse"]), yerr=2 * _f(c["split"]["rmse"]["mcse"]), color=col,
                        marker=mk, ms=4, mec="white", mew=0.4, elinewidth=0.8, capsize=0, ls="none", zorder=3,
                        label=lab if i == 0 else None)
            ax.plot([x - 0.12, x + 0.12], [c["split"]["sd_theory"]] * 2, color=INK2, lw=0.9, zorder=2)
    ax.set_xticks(range(3))
    ax.set_xticklabels([alab[a] for a in allocs], fontsize=7.0)
    ax.set_xlim(-0.55, 2.55)
    ax.set_ylabel(r"RMSE of $\widehat{\mathrm{SDB}}_{\mathrm{S}}$")
    ax.legend(handles=[Line2D([], [], color=OI["verm"], marker="s", ls="none", ms=4, label="independent controls"),
                       Line2D([], [], color=OI["blue"], marker="o", ls="none", ms=4, label=r"pairs, $\rho=-0.6$"),
                       Line2D([], [], color=INK2, lw=0.9, label="exact SD")],
              frameon=False, fontsize=6.2, loc="center right", handlelength=1.2, borderaxespad=0.1)
    _tag(ax, "(a)")
    # (b) paired vs split, with and without monotonicity
    ax = axes[1]
    _style(ax, "y")
    ax.axhline(0, color=INK2, lw=0.7)
    ests = [("B_phi{}_split_neyman", "split", "split\n$\\widehat{\\mathrm{SDB}}_{\\mathrm{S}}$"),
            ("B_phi{}_paired_paired_opt", "ps", "paired\n$\\widehat{\\mathrm{SDB}}_{\\mathrm{PS}}$"),
            ("B_phi{}_paired_paired_opt", "comb_vs_sdb", "paired\n$\\widehat{\\pi}^{H}$ (comb.)")]
    phis = e3["config"].get("phi_nonmonotone", 0.02)
    for i, (key, est, lab) in enumerate(ests):
        for j, (phi, col, mk) in enumerate(((0.0, OI["blue"], "o"), (phis, OI["verm"], "s"))):
            c = C[key.format(phi)]
            x = i + (j - 0.5) * 0.3
            b, sd = _f(c[est]["bias"]["mean"]), _f(c[est]["sd"])
            ax.errorbar(x, b, yerr=1.959964 * sd, color=col, marker=mk, ms=4, mec="white", mew=0.4, elinewidth=0.9,
                        capsize=0, ls="none", zorder=3,
                        label=(r"monotonicity ($\pi^{F}=0$)" if phi == 0 else rf"false endorsement $\pi^{{F}}={phi}$")
                        if i == 0 else None)
    ax.set_xticks(range(3))
    ax.set_xticklabels([e[2] for e in ests], fontsize=6.8)
    ax.set_xlim(-0.55, 2.55)
    ax.set_ylabel(r"Error in SDB (bias $\pm$ 1.96 SD)")
    ax.legend(frameon=False, fontsize=6.2, loc="lower right", handlelength=1.0, borderaxespad=0.1)
    _tag(ax, "(b)")
    # (c) list choice: RMSE vs J
    ax = axes[2]
    _style(ax, "both")
    Js = (2, 3, 4, 5, 6)
    for rho, col, mk in ((0.0, OI["verm"], "s"), (-0.6, OI["blue"], "o")):
        for fc, ls in ((0.0, "-"), (0.5, "--")):
            ids = [f"C_J{J}_rho{rho}_fc{fc}" for J in Js]
            y = [_f(C[i]["split"]["rmse"]["rmse"]) for i in ids]
            e = [2 * _f(C[i]["split"]["rmse"]["mcse"]) for i in ids]
            th = [_x3_theory_rmse(C[i]) for i in ids]
            ax.plot(Js, th, color=col, lw=0.8, ls=ls, alpha=0.6, zorder=2)
            ax.errorbar(Js, y, yerr=e, color=col, marker=mk, ls="none", ms=3.8, mfc=col if fc == 0 else "white",
                        mec=col, mew=0.9, elinewidth=0.8, capsize=0, zorder=3)
    ax.set_xticks(Js)
    ax.set_xlabel(r"Control items $J$")
    ax.set_ylabel(r"RMSE of $\widehat{\mathrm{SDB}}_{\mathrm{S}}$")
    ax.legend(handles=[Line2D([], [], color=OI["verm"], marker="s", ls="none", ms=4, label=r"$\rho=0$"),
                       Line2D([], [], color=OI["blue"], marker="o", ls="none", ms=4, label=r"$\rho=-0.6$"),
                       Line2D([], [], color=INK2, marker="o", ls="-", ms=4, label="no floor/ceiling"),
                       Line2D([], [], color=INK2, marker="o", mfc="white", ls="--", ms=4,
                              label=r"$\phi_{\mathrm{c}}=\phi_{\mathrm{f}}=0.5$")],
              frameon=False, fontsize=6.2, loc="upper right", handlelength=1.8, borderaxespad=0.1)
    _tag(ax, "(c)")
    fig.savefig(path)
    plt.close(fig)


def tab_list(res, path):
    e3 = res["experiments"]["X3"]
    C = e3["summary"]["cells"]
    lines = [r"\begin{tabular}{@{}llrrrrrrr@{}}", r"\toprule",
             r"Design and allocation & Estimator & $(r_D,r_C,r_T)$ & SD (theory) & Bias & SD & RMSE & Cov. & SE/SD \\",
             r"\midrule"]
    lab_alloc = dict(equal="equal", neyman="Neyman", pilot="pilot plug-in", paired_opt="optimal")

    def row(name, estname, c, est):
        r = c["r_mean"]
        d = c[est]
        sd = _f(d["sd"])
        return " & ".join([name, estname, f"({r[0]:.2f}, {r[1]:.2f}, {r[2]:.2f})", _num(_f(d["sd_theory"]), 4),
                           _num(_f(d["bias"]["mean"]), 4, True), _num(sd, 4), _num(_f(d["rmse"]["rmse"]), 4),
                           _pct(_f(d["cover"]["p"]), 1), _num(_f(d["se_mean"]) / sd, 2)]) + r" \\"

    lines.append(r"\multicolumn{9}{@{}l}{\emph{A. Split design, $J=4$, $\pi^F=0$}} \\")
    for cn, cl in (("indep", r"indep.\ controls"), ("pairs", r"pairs $\rho=-0.6$")):
        for a in ("equal", "neyman", "pilot"):
            lines.append(row(f"{cl}, {lab_alloc[a]}", r"$\widehat{\mathrm{SDB}}_{\mathrm{S}}$", C[f"A_{cn}_{a}"], "split"))
    lines.append(r"\addlinespace")
    lines.append(r"\multicolumn{9}{@{}l}{\emph{B. Paired vs split, $J=4$, pairs $\rho=-0.6$}} \\")
    for phi in (0.0, e3["config"].get("phi_nonmonotone", 0.02)):
        tag = r"$\pi^F=" + f"{phi:g}" + "$"
        lines.append(row(f"split, Neyman, {tag}", r"$\widehat{\mathrm{SDB}}_{\mathrm{S}}$", C[f"B_phi{phi}_split_neyman"], "split"))
        for al in ("paired_opt", "equal"):
            c = C[f"B_phi{phi}_paired_{al}"]
            lines.append(row(f"paired, {lab_alloc[al]}, {tag}", r"$\widehat{\mathrm{SDB}}_{\mathrm{PS}}$", c, "ps"))
            lines.append(row("", r"$\widehat\pi^H$", c, "comb_vs_sdb"))
    lines += [r"\bottomrule", r"\end{tabular}"]
    cf = e3["config"]
    hdr = ["% Generated by code/make_figures.py from results/sim_results.json -- do not edit by hand.",
           f"% X3 parts A, B: n = {cf['n']}, pi = {cf['pi']}, SDB = {cf['sdb']:.2f} (pi^F = 0) or SDB = 0.10 - pi^F; "
           f"R = {cf['R_AB']} per row. Bias/RMSE of each estimator as an estimator of SDB.",
           "% SD (theory): exact (eq:le-split) or asymptotic (eq:le-vps, eq:le-vh) SD at the allocation used;",
           "% Cov.: coverage (%) of the 95% Wald interval with the plug-in SE; SE/SD: mean SE over Monte Carlo SD."]
    with open(path, "w") as f:
        f.write("\n".join(hdr + lines) + "\n")


def tab_listchoice(res, path):
    e3 = res["experiments"]["X3"]
    C = e3["summary"]["cells"]
    LC = e3["summary"]["list_choice"]
    lines = [r"\begin{tabular}{@{}rrrrrrrrrr@{}}", r"\toprule",
             r" & & & & \multicolumn{2}{c}{Bias} & \multicolumn{2}{c}{SD} & & \\",
             r"\cmidrule(lr){5-6} \cmidrule(lr){7-8}",
             r"$J$ & $\rho$ & $\phi_{\mathrm{c}}=\phi_{\mathrm{f}}$ & Exposure & Theory & Sim. & Theory & Sim. & RMSE & Cov. \\", r"\midrule"]
    for fc in (0.0, 0.5):
        for J in (2, 3, 4, 5, 6):
            for rho in (0.0, -0.6):
                c = C[f"C_J{J}_rho{rho}_fc{fc}"]
                d = c["split"]
                lines.append(" & ".join([str(J), _num(rho, 1, True) if rho else "0", f"{fc:g}",
                                         _num(c["truth"]["exposure"], 3), _num(_f(d["bias_theory"]), 4, True),
                                         _num(_f(d["bias"]["mean"]), 4, True), _num(_f(d["sd_theory"]), 4),
                                         _num(_f(d["sd"]), 4), _num(_f(d["rmse"]["rmse"]), 4),
                                         _pct(_f(d["cover"]["p"]), 1)]) + r" \\")
        if fc == 0.0:
            lines.append(r"\addlinespace")
    lines += [r"\bottomrule", r"\end{tabular}"]
    th = {fc: {n: v["best"] for n, v in LC[f"fc{fc}"]["theory_by_n"].items()} for fc in (0.0, 0.5)}
    hdr = ["% Generated by code/make_figures.py from results/sim_results.json -- do not edit by hand.",
           f"% X3 part C: split design, Neyman allocation, n = {e3['config']['n']}, R = {e3['config']['R_C']} per row; "
           "phi_c = phi_f (floor/ceiling probabilities); exposure = Pr(W in {0, J}).",
           f"% MSE-optimal list by n (thm:design(c), theory): phi=0: {th[0.0]}; phi=0.5: {th[0.5]}.",
           f"% Empirical MSE-optimal list at n = {e3['config']['n']}: phi=0: {LC['fc0.0']['empirical_n3000']['best']}; "
           f"phi=0.5: {LC['fc0.5']['empirical_n3000']['best']}."]
    with open(path, "w") as f:
        f.write("\n".join(hdr + lines) + "\n")


# ---------------------------------------------------------------------------
# X4
# ---------------------------------------------------------------------------
def fig_mrp(res, path):
    e4 = res["experiments"]["X4"]
    S = e4["summary"]
    ns = e4["config"]["n"]
    fig, axes = plt.subplots(1, 3, figsize=(W2, 2.4), layout="constrained",
                             gridspec_kw=dict(width_ratios=[1.25, 1, 0.9]))
    est = [("direct_rmse", "direct_ok", "Direct (unweighted)", OI["verm"], "s", "--"),
           ("direct_w_rmse", "direct_w_ok", "Direct (cell-weighted)", OI["orange"], "^", ":"),
           ("mrp_rmse", "mrp_all", "MRP (latent regression)", OI["blue"], "o", "-"),
           (None, "mrp_eap_two_step", "MRP on EAP scores (two-step)", OI["pink"], "D", "-.")]
    ax = axes[0]
    _style(ax, "both")
    nmid = "3000" if "3000" in S else str(ns[len(ns) // 2])
    bins = S[nmid]["by_area_n"]
    xs = np.arange(len(bins))
    for key, _, lab, c, m, ls in est:
        if key is None:
            continue
        y = [_f(b[key]) for b in bins]
        ax.plot(xs, y, color=c, marker=m, ls=ls, ms=3.8, mec="white", mew=0.4)
    ax.set_xticks(xs)
    ax.set_xticklabels([f"{b['lo']}–{b['hi'] - 1}" if b["hi"] < 10 ** 8 else f"{b['lo']}+" for b in bins],
                       fontsize=6.8)
    ax.set_xlabel(f"Respondents in area (total $n$ = {nmid})")
    ax.set_ylabel("RMSE of area mean of $G$")
    ax.set_ylim(bottom=0)
    _tag(ax, "(a)")
    ax = axes[1]
    _style(ax, "both")
    for _, k2, lab, c, m, ls in est:
        y = [_f(S[str(n)][k2]["rmse"]["rmse"]) for n in ns]
        e = [2 * _f(S[str(n)][k2]["rmse"]["mcse"]) for n in ns]
        ax.errorbar(ns, y, yerr=e, color=c, marker=m, ls=ls, ms=3.8, mec="white", mew=0.4, elinewidth=0.8,
                    capsize=0, label=lab)
    ax.set_xscale("log")
    ax.set_xticks(ns)
    ax.set_xticklabels([str(n) for n in ns])
    ax.minorticks_off()
    ax.set_ylim(bottom=0)
    ax.set_xlabel("Total sample size $n$")
    ax.set_ylabel("RMSE over areas")
    _tag(ax, "(b)")
    ax = axes[2]
    _style(ax, "both")
    ax.axhline(1, color=INK2, lw=0.7)
    for k2, lab, c, m, ls in (("mrp", "MRP", OI["blue"], "o", "-"), ("eap", "two-step EAP", OI["pink"], "D", "-.")):
        y = [_f(S[str(n)]["attenuation"][k2]["mean"]) for n in ns]
        e = [2 * _f(S[str(n)]["attenuation"][k2]["mcse"]) for n in ns]
        ax.errorbar(ns, y, yerr=e, color=c, marker=m, ls=ls, ms=3.8, mec="white", mew=0.4, elinewidth=0.8, capsize=0)
    rho = [_f(S[str(n)]["mrp_eap_two_step"]["rho_eap"]["mean"]) * _f(S[str(n)]["attenuation"]["mrp"]["mean"]) for n in ns]
    ax.plot(ns, rho, color="#222222", ls=(0, (1, 1.5)), lw=1.0, zorder=5, label=r"$\hat\varrho\times$ MRP slope")
    ax.set_xscale("log")
    ax.set_xticks(ns)
    ax.set_xticklabels([str(n) for n in ns])
    ax.minorticks_off()
    ax.set_ylim(0, 1.05)
    ax.set_xlabel("Total sample size $n$")
    ax.set_ylabel("Slope on true area deviation")
    ax.legend(frameon=False, fontsize=6.4, loc="lower right", handlelength=1.6)
    _tag(ax, "(c)")
    h, l = axes[1].get_legend_handles_labels()
    fig.legend(h, l, loc="outside lower center", ncol=4, frameon=False, handletextpad=0.3, columnspacing=1.0,
               fontsize=7.0)
    fig.savefig(path)
    plt.close(fig)


def tab_mrp(res, path):
    e4 = res["experiments"]["X4"]
    S = e4["summary"]
    lines = [r"\begin{tabular}{@{}rrrrrrrrrrr@{}}", r"\toprule",
             r" & & \multicolumn{3}{c}{MRP} & \multicolumn{3}{c}{MRP on EAP scores} & "
             r"\multicolumn{2}{c}{Direct, unweighted} & Direct, wtd. \\",
             r"\cmidrule(lr){3-5} \cmidrule(lr){6-8} \cmidrule(lr){9-10} \cmidrule(lr){11-11}",
             r"$n$ & Empty & RMSE & Cov. & Slope & RMSE & Cov. & Slope & RMSE & Bias & RMSE \\", r"\midrule"]
    for n in e4["config"]["n"]:
        d = S[str(n)]
        lines.append(" & ".join([
            str(n), f"{_f(d['empty_areas']['mean']):.1f}", _num(_f(d["mrp_all"]["rmse"]["rmse"]), 3),
            _pct(_f(d["mrp_all"]["cover"]["p"]), 1), _num(_f(d["attenuation"]["mrp"]["mean"]), 2),
            _num(_f(d["mrp_eap_two_step"]["rmse"]["rmse"]), 3), _pct(_f(d["mrp_eap_two_step"]["cover"]["p"]), 1),
            _num(_f(d["attenuation"]["eap"]["mean"]), 2),
            _num(_f(d["direct_ok"]["rmse"]["rmse"]), 3), _num(_f(d["direct_ok"]["bias"]["mean"]), 3, True),
            _num(_f(d["direct_w_ok"]["rmse"]["rmse"]), 3)]) + r" \\")
    lines += [r"\bottomrule", r"\end{tabular}"]
    hdr = ["% Generated by code/make_figures.py from results/sim_results.json -- do not edit by hand.",
           f"% X4: {e4['config']['A']} areas; R = {e4['config']['R']} populations x surveys per n. Direct estimators "
           "evaluated on areas with >= 2 respondents; MRP on all areas.",
           "% Cov.: coverage (%) of 95% intervals (Henderson prediction-error variance, variance components plugged in).",
           "% Slope: regression of estimated on true area deviations from the national mean (1 = no attenuation);",
           "% MRP's slope < 1 is partial pooling; the two-step EAP slope is smaller by the factor rho of prop:eap."]
    with open(path, "w") as f:
        f.write("\n".join(hdr + lines) + "\n")


# ---------------------------------------------------------------------------
# X5
# ---------------------------------------------------------------------------
def fig_index(res, raw5, path):
    e5 = res["experiments"]["X5"]
    S = e5["summary"]["cells"]
    ss = e5["config"]["s_dif"]
    ds = e5["config"]["delta"]
    k = e5["config"]["k_main"]
    fig, axes = plt.subplots(1, 3, figsize=(W2, 2.4), layout="constrained")
    ax = axes[0]
    _style(ax, "both")
    blues = ["#9ecae1", "#6baed6", "#3182bd", "#08519c"]
    marks = ["v", "s", "D", "o"]
    for di, d in enumerate(ds):
        y = [100 * _f(S[f"s{s}_d{d}"][f"reversal_k{k}"]["p"]) for s in ss]
        e = [200 * _f(S[f"s{s}_d{d}"][f"reversal_k{k}"]["mcse"]) for s in ss]
        ax.errorbar(ss, y, yerr=e, color=blues[di], marker=marks[di], ms=3.8, mec="white", mew=0.4, elinewidth=0.8,
                    capsize=0, label=rf"$|\Delta\mu_G|={d}$")
    ax.set_xlabel(r"SD of uniform DIF on $S$ items, $s$")
    ax.set_ylabel(f"Sign reversals, index $q={k}$ (%)")
    ax.set_ylim(bottom=-1)
    ax.legend(frameon=False, loc="upper left", fontsize=6.6, handlelength=1.6)
    _tag(ax, "(a)")
    ax = axes[1]
    _style(ax, "both")
    ax.axhline(0, color=INK2, lw=0.6)
    ax.axvline(0, color=INK2, lw=0.6)
    rng = np.random.default_rng(0)
    s_show = 0.3 if 0.3 in ss else ss[-1]
    for cell in raw5["population"]:
        if cell["s_dif"] == s_show:
            dl = np.array([r["delta"] for r in cell["rows"]])
            dd = np.array([r["diffs"][str(k)] for r in cell["rows"]])
            jit = rng.uniform(-0.012, 0.012, len(dl))
            rev = np.sign(dd) != np.sign(dl)
            ax.scatter(dl[~rev] + jit[~rev], 100 * dd[~rev], s=3, color=OI["blue"], alpha=0.25, lw=0, zorder=2)
            ax.scatter(dl[rev] + jit[rev], 100 * dd[rev], s=3, color=OI["verm"], alpha=0.45, lw=0, zorder=2)
    for cell in raw5["population"]:
        if cell["s_dif"] == 0.0:
            pts = sorted({(r["delta"], r["diffs"][str(k)]) for r in cell["rows"]})
            ax.plot([p[0] for p in pts], [100 * p[1] for p in pts], color=OI["black"], marker="o", ms=3, ls="none",
                    zorder=4)
    ax.set_xlabel(r"Latent difference $\Delta\mu_G$")
    ax.set_ylabel(f"Index difference (pct. points)")
    ax.legend(handles=[Line2D([], [], color=OI["black"], marker="o", ms=3, ls="none", label="invariance ($s=0$)"),
                       Line2D([], [], color=OI["blue"], marker="o", ms=3, ls="none", label=f"DIF $s={s_show}$, same sign"),
                       Line2D([], [], color=OI["verm"], marker="o", ms=3, ls="none", label=f"DIF $s={s_show}$, reversed")],
              frameon=False, loc="upper left", fontsize=6.4, handlelength=1.0, borderaxespad=0.1)
    _tag(ax, "(b)")
    ax = axes[2]
    _style(ax, "both")
    ax.axhline(0, color=INK2, lw=0.6)
    V = e5["variance"]
    sig = e5["config"]["sigma1"]
    cols = [OI["verm"], OI["orange"], OI["sky"], OI["blue"]]
    mks = ["s", "^", "v", "o"]
    for i, s1 in enumerate(sig):
        d = V[f"d0.2_s{s1}"]
        hs = np.arange(1, len(d["diff_by_h"]) + 1)
        ax.plot(hs, 100 * np.array(d["diff_by_h"]), color=cols[i], marker=mks[i], ms=3.4, mec="white", mew=0.4,
                label=rf"$\sigma_G^{{(1)}}={s1}$")
    ax.set_xticks(hs)
    ax.set_xlabel(r"Index threshold $q$ (of 8)")
    ax.set_ylabel("Index difference (pct. points)")
    lo, hi = ax.get_ylim()
    ax.set_ylim(lo - 0.55 * (hi - lo), hi)
    ax.legend(frameon=False, loc="lower left", ncol=2, fontsize=6.2, handlelength=1.4, columnspacing=0.8,
              title=r"full invariance, $\Delta\mu_G=0.2$", title_fontsize=6.2, borderaxespad=0.2)
    _tag(ax, "(c)")
    fig.savefig(path)
    plt.close(fig)


def tab_index(res, path):
    e5 = res["experiments"]["X5"]
    S = e5["summary"]["cells"]
    ss, ds = e5["config"]["s_dif"], e5["config"]["delta"]
    ks = e5["config"]["k"]
    lines = [r"\begin{tabular}{@{}r" + "r" * len(ds) * len(ks) + r"@{}}", r"\toprule",
             " & " + " & ".join(r"\multicolumn{%d}{c}{$q=%d$}" % (len(ds), k) for k in ks) + r" \\",
             " ".join(r"\cmidrule(lr){%d-%d}" % (2 + i * len(ds), 1 + (i + 1) * len(ds)) for i in range(len(ks))),
             r"$s$ & " + " & ".join(" & ".join(rf"${d:g}$" for d in ds) for _ in ks) + r" \\", r"\midrule"]
    for s_ in ss:
        cells = [_pct(_f(S[f"s{s_}_d{d}"][f"reversal_k{k}"]["p"]), 1) for k in ks for d in ds]
        lines.append(f"{s_:g} & " + " & ".join(cells) + r" \\")
    lines += [r"\bottomrule", r"\end{tabular}"]
    NU = e5["nonuniform"]
    nu = "; ".join(f"s_a={v['s_a']}: h-dependent sign {100 * v['p_h_dependent_sign']['p']:.1f}%" for v in NU.values())
    hdr = ["% Generated by code/make_figures.py from results/sim_results.json -- do not edit by hand.",
           f"% X5: percentage of random uniform-DIF configurations ({e5['config']['configs']} per cell) in which the "
           "population index difference P1(q) - P0(q) has the opposite sign to Delta mu_G = mu_G^(1) - mu_G^(0);",
           "% columns: |Delta mu_G| within each q; rows: SD s of the DIF shifts (in SDs of the latent response).",
           f"% Random non-uniform DIF (G slopes x exp(N(0, s_a^2))), Delta mu_G = 0.1: {nu}."]
    with open(path, "w") as f:
        f.write("\n".join(hdr + lines) + "\n")


# ---------------------------------------------------------------------------
# X9: heterogeneity tests for D2(ii)
# ---------------------------------------------------------------------------
X9_LABEL = dict(prop=r"Proportional$^{0}$", one_off=r"All but one proportional$^{0}$",
                two_off=r"Two lines", near=r"Near-proportional", het=r"Heterogeneous")


def tab_tetrad(res, path):
    e9 = res["experiments"]["X9"]
    S = e9["summary"]
    lines = [r"\begin{tabular}{@{}lrrrrrrrrrr@{}}", r"\toprule",
             r" & & \multicolumn{3}{c}{Stereotype domain ($|\mathcal S|=10$)} & "
             r"\multicolumn{3}{c}{Israel domain ($|\mathcal I|=14$)} & \multicolumn{3}{c}{D2(ii): either domain} \\",
             r"\cmidrule(lr){3-5} \cmidrule(lr){6-8} \cmidrule(lr){9-11}",
             r"Configuration & $n$ & Joint & IUT & Earlier & Joint & IUT & Earlier & Joint & IUT & Earlier \\",
             r"\midrule"]
    cfgs = e9["config"]["cfgs"]
    for ci, cfg in enumerate(cfgs):
        for i, n in enumerate(e9["config"]["n"]):
            d = S.get(f"{cfg}_n{n}")
            if d is None:
                continue
            row = [X9_LABEL[cfg] if i == 0 else "", str(n)]
            for dom in ("S", "I"):
                row += [_pct(_f(d[dom][k]["p"]), 1) for k in ("joint", "iut", "bonf")]
            row += [_pct(_f(d["D2ii"][k]["p"]), 1) for k in ("joint", "iut", "bonf")]
            lines.append(" & ".join(row) + r" \\")
        if ci < len(cfgs) - 1:
            lines.append(r"\addlinespace")
    lines += [r"\bottomrule", r"\end{tabular}"]
    R = e9["config"]["R"]
    hdr = ["% Generated by code/make_figures.py from results/sim_results.json -- do not edit by hand.",
           f"% X9: rejection rates (%) of tests of within-domain heterogeneity; R = {R}. Joint: Wald test of a",
           "% non-redundant set of |D|(|D|-3)/2 tetrads at 5%; IUT: intersection-union test (joint test of every D minus",
           f"% one item rejects at 5%); Earlier: any of the {e9['config']['n_tetrads_bonferroni']} within-domain tetrads, "
           "Bonferroni at 5%. D2(ii) columns: joint and IUT at 2.5% per domain; earlier rule as stated.",
           "% superscript 0: configurations in which id-het fails (null); rejection rates there are sizes."]
    with open(path, "w") as f:
        f.write("\n".join(hdr + lines) + "\n")


# ---------------------------------------------------------------------------
# X2b, X7, X8 tables
# ---------------------------------------------------------------------------
def tab_anchor_s(res, path):
    e = res["experiments"]["X2b"]
    S = e["summary"]
    lines = [r"\begin{tabular}{@{}rrrrrrrrrrrr@{}}", r"\toprule",
             r" & & \multicolumn{5}{c}{Default anchors S1--S4, I5, I6} & \multicolumn{5}{c}{Stereotype-only anchors S1--S4} \\",
             r"\cmidrule(lr){3-7} \cmidrule(lr){8-12}",
             r"$\kappa_I$ & $\kappa_S$ & Bias & Cov. & First ord. & Bound & LOO & Bias & Cov. & First ord. & Bound & LOO \\",
             r"\midrule"]
    for i, ki in enumerate(e["config"]["kappa_I"]):
        for ks in e["config"]["kappa_S"]:
            d = S[f"kI{ki}_kS{ks}"]
            row = [f"{ki:g}", f"{ks:g}"]
            for strat, bk in (("default_fb", "default"), ("sonly_fb", "sonly")):
                b = d["bounds"][strat]
                row += [_num(_f(d[strat]["mu_G"]["bias"]["median"]), 3, True), _pct(_f(d[strat]["mu_G"]["cover"]["p"])),
                        _num(_f(b["first_order_actual"][0]), 3, True),
                        _num(_f(b["by_delta_max"][str(ks)]["worst_abs_muG"]), 2),
                        _num(_f(d[bk + "_loo_spread"]["mean"]), 3)]
            lines.append(" & ".join(row) + r" \\")
        if i == 0:
            lines.append(r"\addlinespace")
    lines += [r"\bottomrule", r"\end{tabular}"]
    hdr = ["% Generated by code/make_figures.py from results/sim_results.json -- do not edit by hand.",
           f"% X2b: uniform DIF of kappa_S latent-response SDs on S1 and S2 (two of the four stereotype anchors); R = {e['config']['R']} per row.",
           "% Bias/Cov.: median error over replications and sandwich coverage (%) of mu_G^(1) - mu_G^(0) (true 0.3), free-baseline fits.",
           "% First order: (A'WA)^{-1}A'W d at the actual anchor DIF; Bound: largest first-order |bias of mu_G| over all anchor",
           "% DIF with |d_j| <= kappa_S sd_j on every anchor (eq:id-anchor-bound with the stated maximum); LOO: mean range of",
           "% mu_G over the leave-one-anchor-out refits (0.043 in X2 with correct anchors)."]
    with open(path, "w") as f:
        f.write("\n".join(hdr + lines) + "\n")


def tab_dif_revised(res, path):
    e = res["experiments"]["X7"]
    S = e["summary"]
    lines = [r"\begin{tabular}{@{}rrrrrrrrrrr@{}}", r"\toprule",
             r" & \multicolumn{4}{c}{Flag rate (\%)} & \multicolumn{2}{c}{$\mu_G^{(1)}-\mu_G^{(0)}$} & "
             r"\multicolumn{2}{c}{$\mu_I^{(1)}-\mu_I^{(0)}$} & \multicolumn{2}{c}{$\mathrm{ECV}_{I3}$ bias} \\",
             r"\cmidrule(lr){2-5} \cmidrule(lr){6-7} \cmidrule(lr){8-9} \cmidrule(lr){10-11}",
             r"$\kappa$ & I1, I2 & I3 & DIF-free & Any false & Bias & Cov. & Bias & Cov. & Ref. & Focal \\", r"\midrule"]
    for k in e["config"]["kappa"]:
        d = S[str(k)]["correct"]
        fl = d["flags"]
        u = [fl[x]["flag"]["p"] for x in ("I1", "I2")]
        row = [f"{k:g}", _pct(np.mean(u)) if k > 0 else "--", _pct(fl["I3"]["flag"]["p"]) if k > 0 else "--",
               _pct(_f(d["fpr"]), 1), _pct(_f(d["any_false_flag"]["p"])),
               _num(_f(d["mu_G"]["bias"]["mean"]), 3, True), _pct(_f(d["mu_G"]["cover"]["p"])),
               _num(_f(d["mu_I"]["bias"]["mean"]), 3, True), _pct(_f(d["mu_I"]["cover"]["p"])),
               _num(_f(d["ecv0_I3"]["bias"]["mean"]), 3, True), _num(_f(d["ecv1_I3"]["bias"]["mean"]), 3, True)]
        lines.append(" & ".join(row) + r" \\")
    lines += [r"\bottomrule", r"\end{tabular}"]
    hdr = ["% Generated by code/make_figures.py from results/sim_results.json -- do not edit by hand.",
           f"% X7: the revised screen (BH q = 0.05 only, then refit) with the correct anchors on the X2 data sets; R = {e['config']['R']} per kappa.",
           "% DIF-free: mean flag rate over the tested DIF-free items; Any false: share of replications with >= 1 DIF-free item flagged."]
    with open(path, "w") as f:
        f.write("\n".join(hdr + lines) + "\n")


def tab_delta(res, path):
    e = res["experiments"]["X8"]
    S = e["summary"]
    lab = dict(uniform="Common uniform shift", group_specific="Group-specific shifts", nonuniform=r"Non-uniform ($\upsilon=0.5$)")
    lines = [r"\begin{tabular}{@{}llrrrrrrrr@{}}", r"\toprule",
             r" & & \multicolumn{5}{c}{$\delta_j$ (latent-response SDs)} & \multicolumn{2}{c}{$\mathrm{SDB}_j$} & Common \\",
             r"\cmidrule(lr){3-7} \cmidrule(lr){8-9}",
             r"Scenario & Group & True & Bias & SD & SE & Cov. & True & Bias & shift rej. \\", r"\midrule"]
    for ci, c in enumerate(e["config"]["cells"]):
        d = S[c["id"]]
        for x in (0, 1):
            g = d[f"group{x}"]
            tr = d["truth"][str(x)]
            nonu = c["id"] == "nonuniform"
            row = [lab[c["id"]] if x == 0 else "", f"$x={x}$",
                   "--" if nonu else _num(tr["delta_sd"], 2),
                   "--" if nonu else _num(_f(g["sd_scale"]["bias"]["mean"]), 3, True),
                   _num(_f(g["sd_scale"]["sd"]), 3), _num(_f(g["sd_scale"]["se_mean"]), 3),
                   "--" if nonu else _pct(_f(g["cover"]["p"]), 1),
                   "--" if nonu else _num(tr["sdb"], 3), "--" if nonu else _num(_f(g["sdb_bias"]["mean"]), 4, True),
                   _pct(_f(d["test_common_reject"]["p"]), 1) if x == 0 else ""]
            lines.append(" & ".join(row) + r" \\")
        if ci < len(e["config"]["cells"]) - 1:
            lines.append(r"\addlinespace")
    lines += [r"\bottomrule", r"\end{tabular}"]
    hdr = ["% Generated by code/make_figures.py from results/sim_results.json -- do not edit by hand.",
           f"% X8: delta_j from the list experiment (eq:le-irt-root), in SDs of the item's reference latent response; "
           f"R = {e['config']['R']} per scenario; {e['config']['n_per_group']} per group.",
           "% SE: mean delta-method SE (measurement model + list); Cov.: 95% Wald coverage; Common shift rej.: rejection rate of the",
           "% 5% z-test of delta_1 = delta_0 (a size in the first scenario, power in the others)."]
    with open(path, "w") as f:
        f.write("\n".join(hdr + lines) + "\n")


# ---------------------------------------------------------------------------
# X6: misspecification
# ---------------------------------------------------------------------------
def fig_misspec(res, path):
    e = res["experiments"]["X6"]
    S = e["summary"]
    cells = e["config"]["cells"]
    fig, axes = plt.subplots(1, 3, figsize=(W2, 2.75), layout="constrained",
                             gridspec_kw=dict(width_ratios=[1, 1.1, 1.45]))
    # (a) cross-loading of IT on S: block mean ECV bias, standard bifactor fit vs cross-loading model
    ax = axes[0]
    _style(ax, "both")
    ax.axhline(0, color=INK2, lw=0.7, zorder=1)
    cc = [c for c in cells if c["kind"] == "cross"]
    xs = [c["c"] for c in cc]
    for blk, col, mk, lab in (("S", "#777777", "D", "S items"), ("IT", OI["verm"], "o", "IT items"),
                              ("ID", OI["blue"], "s", "ID items")):
        y = [S[c["id"]]["models"]["bif"]["bias_by_block"][blk] for c in cc]
        yp = [S[c["id"]]["models"]["bif"]["plim_bias_by_block"][blk] for c in cc]
        ax.plot(xs, yp, color=col, lw=0.9, alpha=0.7, zorder=2)
        ax.plot(xs, y, color=col, marker=mk, ls="none", ms=3.8, mec="white", mew=0.4, zorder=3, label=lab)
    y = [S[c["id"]]["models"]["cross"]["bias_by_block"]["IT"] for c in cc]
    ax.plot(xs, y, color=OI["verm"], marker="o", ls="--", lw=0.8, ms=3.8, mfc="white", mew=0.9, zorder=3,
            label="IT, with cross-loadings")
    ax.set_xticks(xs)
    ax.set_xlabel(r"Cross-loading of IT on $S$, $c$")
    ax.set_ylabel(r"Mean bias of $\widehat{\mathrm{ECV}}_j$ in block")
    ax.legend(frameon=False, fontsize=6.0, loc="upper left", handlelength=1.4, borderaxespad=0.1)
    _tag(ax, "(a)")
    # (b) acquiescence: range over the 14 Israel-related items of the ECV bias
    ax = axes[1]
    _style(ax, "y")
    ax.axhline(0, color=INK2, lw=0.7, zorder=1)
    alphas = sorted({c["alpha"] for c in cells if c["kind"] == "acq" and not c.get("hetero")})
    series = [("bif", "registered", OI["orange"], "o", "standard fit, registered keying"),
              ("bif", "balanced", OI["pink"], "s", "standard fit, balanced keying"),
              ("mf", "registered", OI["blue"], "o", "method factor, registered keying"),
              ("mf", "balanced", OI["green"], "s", "method factor, balanced keying")]
    Iitems = [f"ID{j}" for j in range(1, 9)] + [f"IT{j}" for j in range(1, 7)]
    handles = []
    for si, (mod, key, col, mk, lab) in enumerate(series):
        for ai, a in enumerate(alphas):
            d = S[f"acq_{key}_a{a}"]["models"][mod]["bias_by_item"]
            v = np.array([d[i] for i in Iitems])
            x = ai + (si - 1.5) * 0.18
            ax.plot([x, x], [v.min(), v.max()], color=col, lw=1.8, solid_capstyle="butt", zorder=2)
            ax.plot(x, v.mean(), color=col, marker=mk, ms=3.6, mec="white", mew=0.4, zorder=3, ls="none")
        handles.append(Line2D([], [], color=col, marker=mk, lw=1.8, ms=3.6, mec="white", mew=0.4, label=lab))
    ax.set_xticks(range(len(alphas)))
    ax.set_xticklabels([f"{a:.2f}" for a in alphas])
    ax.set_xlim(-0.55, len(alphas) - 0.45)
    ax.set_xlabel(r"Acquiescence slope $\alpha$")
    ax.set_ylabel(r"Bias of $\widehat{\mathrm{ECV}}_j$, $j\in\mathcal{I}$")
    _tag(ax, "(b)")
    # (c) coverage of pointwise 95% Wald intervals for the Israel-related ECVs, standard fit vs remedy
    ax = axes[2]
    _style(ax, "y")
    ax.axhline(95, color=INK2, lw=0.7, zorder=1)
    groups = [(f"cross_c{c}", f"{c:g}".lstrip("0")) for c in (0.1, 0.2, 0.3)] + \
             [(f"acq_registered_a{a}", f"{a:.2f}".lstrip("0")) for a in alphas] + \
             [(f"acq_balanced_a{a}", f"{a:.2f}".lstrip("0")) for a in alphas]
    width = 0.38
    for gi, (cid, lab) in enumerate(groups):
        rem, rcol = ("cross", OI["verm"]) if cid.startswith("cross") else ("mf", OI["blue"])
        for k, (mod, col) in enumerate((("bif", "#9a9a9a"), (rem, rcol))):
            v = 100 * S[cid]["models"][mod]["cover_pointwise_I"]["p"]
            ax.bar(gi + (k - 0.5) * width, v, width, color=col, edgecolor="white", lw=0.4, zorder=2)
    ax.set_xticks(range(len(groups)))
    ax.set_xticklabels([g[1] for g in groups], fontsize=6.4)
    for x0, txt in ((1, r"$c$"), (4, r"reg., $\alpha$"), (7, r"bal., $\alpha$")):
        ax.text(x0, -0.13, txt, transform=ax.get_xaxis_transform(), ha="center", va="top", fontsize=6.6, color="#222222")
    for xb in (2.5, 5.5):
        ax.axvline(xb, color=GRID, lw=0.6, zorder=1)
    ax.set_ylim(0, 100)
    ax.set_ylabel(r"Coverage of 95% intervals, $j\in\mathcal{I}$ (%)")
    _tag(ax, "(c)")
    handles += [Patch(color="#9a9a9a", label="standard bifactor fit"), Patch(color=OI["verm"], label="with IT cross-loadings"),
                Patch(color=OI["blue"], label="with method factor")]
    fig.legend(handles=handles, loc="outside lower center", ncol=4, frameon=False, fontsize=6.4, handlelength=1.4,
               columnspacing=1.0, handletextpad=0.4)
    fig.savefig(path)
    plt.close(fig)


def tab_misspec(res, path):
    e = res["experiments"]["X6"]
    S = e["summary"]
    lines = [r"\begin{tabular}{@{}lrrrrrrrrrrrrr@{}}", r"\toprule",
             r" & & \multicolumn{4}{c}{Standard bifactor} & \multicolumn{2}{c}{Cross-loadings} & \multicolumn{2}{c}{Method factor} & "
             r"\multicolumn{2}{c}{$\mathcal I=\mathrm{ID}$ only} & \multicolumn{2}{c}{IT wrong} \\",
             r"\cmidrule(lr){3-6} \cmidrule(lr){7-8} \cmidrule(lr){9-10} \cmidrule(lr){11-12} \cmidrule(lr){13-14}",
             r"Cell & Flag & IT & ID & Max & Wrong & Max & Wrong & Max & Wrong & Max & Wrong & Std. & 1-item \\", r"\midrule"]

    def lab(c):
        if c["kind"] == "cross":
            return f"cross-loading $c={c['c']:g}$"
        k = "reg." if c["keying"] == "registered" else "bal."
        return f"{k} $\\alpha={c['alpha']:.2f}$" + (r", item-spec." if c.get("hetero") else "")
    for ci, c in enumerate(e["config"]["cells"]):
        d = S.get(c["id"])
        if d is None:
            continue
        M = d["models"]
        pcx = d["plan_check"]
        row = [lab(c), _pct(_f(pcx["p_any_IT_flagged"]["p"])),
               _num(M["bif"]["bias_by_block"]["IT"], 3, True), _num(M["bif"]["bias_by_block"]["ID"], 3, True),
               _num(M["bif"]["maxabs_bias_I"], 3), _pct(_f(M["bif"]["p_wrong"]["p"]), 1)]
        for mod in ("cross", "mf", "ipo"):
            row += [_num(M[mod]["maxabs_bias_I"], 3), _pct(_f(M[mod]["p_wrong"]["p"]), 1)]
        row += [_pct(_f(pcx["IT_primary"]["p_wrong"]["p"]), 1), _pct(_f(pcx["IT_plan"]["p_wrong"]["p"]), 1)]
        lines.append(" & ".join(row) + r" \\")
        if ci in (3, 6, 9):
            lines.append(r"\addlinespace")
    lines += [r"\bottomrule", r"\end{tabular}"]
    hdr = ["% Generated by code/make_figures.py from results/sim_results.json -- do not edit by hand.",
           f"% X6: n = {e['config']['n']}, R = {e['config']['R']} per cell. Flag: % of replications in which the one-item IT x S check (earlier draft) flags at least",
           "% one IT item (BH over the 60 residual correlations, or a one-item cross-loading with a 95% interval excluding 0).",
           "% IT, ID: mean bias of ECV_j in the block; Max: largest |Monte Carlo bias| over the Israel-related items in the model",
           "% (ID only for the ID-only refit); Wrong: % of those items classified on the wrong side of tau = 0.5 (Bonferroni logit-Wald).",
           "% IT wrong: % of IT items on the wrong side under the standard fit (Std.) and under the one-item check (1-item), which classifies a",
           "% flagged IT item only if the standard fit and the one-item cross-loading model agree."]
    with open(path, "w") as f:
        f.write("\n".join(hdr + lines) + "\n")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--results", default=os.path.join(HERE, "..", "results"))
    ap.add_argument("--figures", default=os.path.join(HERE, "..", "figures"))
    ap.add_argument("--tables", default=os.path.join(HERE, "..", "tables"))
    a = ap.parse_args()
    res = load(a.results)
    os.makedirs(a.figures, exist_ok=True)
    os.makedirs(a.tables, exist_ok=True)
    E = res["experiments"]
    if "X1" in E:
        fig_recovery(res, os.path.join(a.figures, "fig-sim-recovery.pdf"))
        tab_main(res, os.path.join(a.tables, "tab-sim-main.tex"))
    if "X2" in E:
        fig_dif(res, os.path.join(a.figures, "fig-sim-dif.pdf"))
        tab_dif(res, os.path.join(a.tables, "tab-sim-dif.tex"))
    if "X3" in E:
        fig_list(res, os.path.join(a.figures, "fig-sim-list.pdf"))
        tab_list(res, os.path.join(a.tables, "tab-sim-list.tex"))
        tab_listchoice(res, os.path.join(a.tables, "tab-sim-listchoice.tex"))
    if "X4" in E:
        fig_mrp(res, os.path.join(a.figures, "fig-sim-mrp.pdf"))
        tab_mrp(res, os.path.join(a.tables, "tab-sim-mrp.tex"))
    if "X5" in E:
        with open(os.path.join(a.results, "raw", "X5.json")) as f:
            raw5 = json.load(f)
        fig_index(res, raw5, os.path.join(a.figures, "fig-sim-index.pdf"))
        tab_index(res, os.path.join(a.tables, "tab-sim-index.tex"))
    if "X9" in E:
        tab_tetrad(res, os.path.join(a.tables, "tab-sim-tetrad.tex"))
    if "X6" in E:
        fig_misspec(res, os.path.join(a.figures, "fig-sim-misspec.pdf"))
        tab_misspec(res, os.path.join(a.tables, "tab-sim-misspec.tex"))
    if "X2b" in E:
        tab_anchor_s(res, os.path.join(a.tables, "tab-sim-anchors.tex"))
    if "X7" in E:
        tab_dif_revised(res, os.path.join(a.tables, "tab-sim-difrev.tex"))
    if "X8" in E:
        tab_delta(res, os.path.join(a.tables, "tab-sim-delta.tex"))
    print("figures/tables written for", sorted(E))


if __name__ == "__main__":
    main()
