#!/usr/bin/env python
"""Write results/SUMMARY-new-experiments.md (X2b, X6, X7, X8, X9) from results/sim_results.json.

Every number is formatted from the JSON; nothing is typed by hand.  The summary of X1-X5
(formerly E1-E5) is results/SUMMARY-numbers.md.
Usage (from code/): python make_summary.py [--results ../results]
"""
from __future__ import annotations

import argparse
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))


def f(x, nd=3, sign=False):
    if x is None:
        return "-"
    return (f"{x:+.{nd}f}" if sign else f"{x:.{nd}f}")


def pc(x, nd=1):
    return "-" if x is None else f"{100 * x:.{nd}f}%"


def disp(name):
    """Item labels: the block of disputed Israel-related categories is ID (labelled IP in early code)."""
    return name.replace("IP", "ID")


def x2b(e):
    L = ["## X2b: DIF on the stereotype anchors", "",
         f"Two groups of {e['config']['n_per_group']}, focal means (0.3, 0, 0.3); uniform DIF of kappa_S latent-response SDs "
         "on S1 and S2 (two of the four stereotype anchors, same direction), with the X2 Israel-item DIF at kappa_I. "
         f"R = {e['config']['R']} per cell. Wall {e['wall_seconds']:.0f} s, CPU {e['cpu_seconds']:.0f} s.", "",
         "| kappa_I | kappa_S | strategy | mu_G bias (MCSE) | median | RMSE | cov. | plim bias | first-order bias | mu_S bias | conv. |",
         "|---|---|---|---|---|---|---|---|---|---|---|"]
    S = e["summary"]
    for key, d in S.items():
        for s in ("oracle", "default_fb", "default_proc", "sonly_fb"):
            m = d[s]["mu_G"]
            fo = d["bounds"].get(s, {}).get("first_order_actual") if s in d["bounds"] else None
            ms = d[s]["mu_S"].get("bias", {}).get("mean") if "bias" in d[s]["mu_S"] else None
            L.append(f"| {d['kappa_I']:g} | {d['kappa_S']:g} | {s} | {f(m['bias']['mean'], 3, True)} ({f(m['bias']['mcse'])}) | "
                     f"{f(m['bias']['median'], 3, True)} | {f(m['rmse']['rmse'])} | {pc(m['cover']['p'], 0)} | "
                     f"{f(m['plim_bias'], 3, True) if m['plim_bias'] is not None else '-'} | "
                     f"{f(fo[0], 3, True) if fo else '-'} | {f(ms, 3, True)} | {pc(d[s]['converged']['p'], 0)} |")
    L.append("")
    for key, d in S.items():
        fl = ", ".join(f"{k} {pc(v['p'], 0)}" for k, v in d["default_flags"].items())
        L.append(f"- kappa_I = {d['kappa_I']:g}, kappa_S = {d['kappa_S']:g}: revised-screen flag rates with the default anchors: {fl}. "
                 f"Leave-one-anchor-out range of mu_G: default {f(d['default_loo_spread']['mean'])} (median "
                 f"{f(d['default_loo_spread']['median'])}), stereotype-only {f(d['sonly_loo_spread']['mean'])} (median "
                 f"{f(d['sonly_loo_spread']['median'])}).")
    L += ["", "Bound eq:id-anchor-bound (first order, DWLS efficient information) at a stated maximum anchor DIF delta_max "
          "(|d_j| <= delta_max sd_j for every anchor); values at kappa_I = 0.4, kappa_S = 0.1 (they do not depend on the cell "
          "to the printed precision):", "",
          "| anchors | delta_max | worst abs bias mu_G | same-direction bias mu_G | worst norm | bound (middle) | bound (outer) | sigma_min(M) |",
          "|---|---|---|---|---|---|---|---|"]
    d = S["kI0.4_kS0.1"]
    for s in ("default_fb", "sonly_fb"):
        b = d["bounds"][s]
        for dm, v in b["by_delta_max"].items():
            L.append(f"| {s} | {dm} | {f(v['worst_abs_muG'])} | {f(v['same_direction_muG'], 3, True)} | {f(v['worst_norm'])} | "
                     f"{f(v['bound_middle'])} | {f(v['bound_outer'])} | {f(b['sigma_min_M'], 1)} |")
    L.append("")
    return L


def x6(e):
    S = e["summary"]
    L = ["## X6: directional misspecifications and remedies", "",
         f"Registered sizes: 10 S, 8 ID, 6 IT items; n = {e['config']['n']}; R = {e['config']['R']} per cell; "
         f"wall {e['wall_seconds']:.0f} s, CPU {e['cpu_seconds']:.0f} s. Bias = Monte Carlo mean of ECV-hat minus the true "
         "own-domain ECV; plim = fit to the exact population polychorics. Wrong = % of the Israel-related items in the model "
         "classified on the wrong side of tau = 0.5 by Bonferroni logit-Wald intervals; false in = % of truly-out items classified in.",
         "", "| cell | model | bias S | bias ID | bias IT | plim bias IT | max abs bias (I) | plim max abs (I) | wrong | false in | undet. | ident. (median) |",
         "|---|---|---|---|---|---|---|---|---|---|---|---|"]
    for cid, d in S.items():
        for nm, md in d["models"].items():
            bb = md["bias_by_block"]
            pb = md["plim_bias_by_block"] or {}
            L.append(f"| {cid} | {nm} | {f(bb['S'], 3, True)} | {f(bb['ID'], 3, True)} | {f(bb.get('IT'), 3, True)} | "
                     f"{f(pb.get('IT'), 3, True)} | {f(md['maxabs_bias_I'])} | {f(md['plim_maxabs_bias_I'])} | "
                     f"{pc(md['p_wrong']['p'])} | {pc(md['p_false_in']['p'])} | {pc(md['p_indet']['p'])} | "
                     f"{f(md['ident']['median'], 4) if 'ident' in md else '-'} |")
    L.append("")
    for cid, d in S.items():
        line = (f"- {cid}: IT x S mean-residual test rejects in {pc(d['resid_test_reject']['p'])}; mean residual "
                f"{f(d['resid_mean_ITxS']['mean'], 4, True)} (plim {f(d['plim_resid_mean_ITxS'], 4, True)}).")
        if "m" in d["models"]["mf"]:
            line += f" Method-factor slope m-hat mean {f(d['models']['mf']['m']['mean'])} (plim {f(d['models']['mf']['plim_m'])})."
        if "plan_check" in d:
            pcx = d["plan_check"]
            line += (f" Plan's IT x S check: at least one IT item flagged in {pc(pcx['p_any_IT_flagged']['p'])}; flag rate by item "
                     + ", ".join(f"{k} {pc(v['p'], 0)}" for k, v in pcx["flag_by_item"].items())
                     + f"; IT items wrong: standard {pc(pcx['IT_primary']['p_wrong']['p'])}, plan's rule {pc(pcx['IT_plan']['p_wrong']['p'])}"
                     + f" (undetermined {pc(pcx['IT_plan']['p_indet']['p'])}); false in: standard {pc(pcx['IT_primary']['p_false_in']['p'])}, "
                     f"plan's rule {pc(pcx['IT_plan']['p_false_in']['p'])}.")
        if "ident_content" in d["models"]["mf"]:
            line += f" Method-factor model, identification diagnostic over content parameters (median) {f(d['models']['mf']['ident_content']['median'], 4)}."
        fi = {disp(k): v for k, v in d["models"]["bif"]["false_in_by_item"].items() if v and v > 0}
        if fi:
            line += " Standard fit, items classified in although out: " + ", ".join(f"{k} {pc(v, 0)}" for k, v in fi.items()) + "."
        L.append(line)
    L.append("")
    return L


def x7(e):
    S = e["summary"]
    L = ["## X7: the revised DIF screen (BH only) end to end", "",
         f"The X2 data sets (same seeds), R = {e['config']['R']} per kappa; wall {e['wall_seconds']:.0f} s, CPU {e['cpu_seconds']:.0f} s.", "",
         "| kappa | anchors | flag I1 | flag I2 | flag I3 | DIF-free flag rate | any false flag | mu_G bias (cov.) | mu_I bias (cov.) | ECV_I3 bias ref. | ECV_I3 bias focal | BH flags = X2 |",
         "|---|---|---|---|---|---|---|---|---|---|---|---|"]
    for k, cell in S.items():
        for a in ("correct", "contam1", "contam2"):
            d = cell[a]
            fl = d["flags"]
            g = lambda x: pc(fl[x]["flag"]["p"], 0) if x in fl else "anchor"
            L.append(f"| {k} | {a} | {g('I1')} | {g('I2')} | {g('I3')} | {pc(d['fpr'])} | {pc(d['any_false_flag']['p'], 0)} | "
                     f"{f(d['mu_G']['bias']['mean'], 3, True)} ({pc(d['mu_G']['cover']['p'], 0)}) | "
                     f"{f(d['mu_I']['bias']['mean'], 3, True)} ({pc(d['mu_I']['cover']['p'], 0)}) | "
                     f"{f(d['ecv0_I3']['bias']['mean'], 3, True)} | {f(d['ecv1_I3']['bias']['mean'], 3, True)} | "
                     f"{pc(d['bh_flags_identical_to_X2'], 0)} |")
    L.append("")
    for k, cell in S.items():
        d = cell["correct"]
        if d["ecv1_I3_bias_if_not_flagged"]:
            L.append(f"- kappa = {k}, correct anchors: focal ECV_I3 bias when I3 is not flagged {f(d['ecv1_I3_bias_if_not_flagged']['mean'], 3, True)} "
                     f"(n = {d['ecv1_I3_bias_if_not_flagged']['n']}), when flagged "
                     f"{f(d['ecv1_I3_bias_if_flagged']['mean'], 3, True) if d['ecv1_I3_bias_if_flagged'] else '-'}. "
                     "Share of flagged items described as small DIF (latent-averaged expected-score difference < 0.25): "
                     + ", ".join(f"{x} {pc(v['small_if_flagged']['p'], 0)}" for x, v in d["flags"].items() if v["small_if_flagged"]) + ".")
    L.append("")
    return L


def x8(e):
    S = e["summary"]
    L = ["## X8: identification of the threshold shift delta_j by the list experiment", "",
         f"Item I4 of the X1 bank; two groups of {e['config']['n_per_group']}; arms D/C/T in equal thirds; R = {e['config']['R']} per "
         f"scenario; wall {e['wall_seconds']:.0f} s. delta in SDs of the item's reference latent response.", "",
         "| scenario | group | true delta | bias (MCSE) | SD | mean SE | cov. | meas. share of var. | true SDB | SDB bias | SDB SD | test of common shift |",
         "|---|---|---|---|---|---|---|---|---|---|---|---|"]
    for cid, d in S.items():
        for x in (0, 1):
            g = d[f"group{x}"]
            t = d["truth"][str(x)]
            L.append(f"| {cid} | {x} | {f(t['delta_sd'], 2)} | {f(g['sd_scale']['bias']['mean'], 3, True)} ({f(g['sd_scale']['bias']['mcse'])}) | "
                     f"{f(g['sd_scale']['sd'])} | {f(g['sd_scale']['se_mean'])} | {pc(g['cover']['p'])} | {pc(g['se_meas_share'], 0)} | "
                     f"{f(t['sdb'])} | {f(g['sdb_bias']['mean'], 4, True)} | {f(g['sdb_sd'], 4)} | "
                     f"{pc(d['test_common_reject']['p']) if x == 0 else ''} |")
        if "pooled" in d:
            p = d["pooled"]
            L.append(f"| {cid} | pooled | | {f(p['bias_sd']['mean'], 3, True)} | {f(p['sd_sd'])} | | {pc(p['cover']['p'])} | | | | | |")
    L.append("")
    return L


def x9(e):
    S = e["summary"]
    L = ["## X9: tests of within-domain heterogeneity (rule D2(ii))", "",
         f"Registered sizes (10 S, 14 I items). R = {e['config']['R']}; wall {e['wall_seconds']:.0f} s. Rejection rates at 5% per domain "
         "(joint tetrad Wald test; residual-based one-factor test; intersection-union test; earlier Bonferroni rule over "
         f"{e['config']['n_tetrads_bonferroni']} tetrads). D2(ii) = either domain, joint and IUT at 2.5% per domain.", "",
         "| config | n | S joint | S resid | S IUT | S earlier | I joint | I resid | I IUT | I earlier | D2 joint | D2 IUT | D2 earlier |",
         "|---|---|---|---|---|---|---|---|---|---|---|---|---|"]
    for k, d in S.items():
        L.append(f"| {d['cfg']}{' (null)' if d['null'] else ''} | {d['n']} | " +
                 " | ".join(pc(d[dom][t]["p"]) for dom in ("S", "I") for t in ("joint", "resid", "iut", "bonf")) + " | " +
                 " | ".join(pc(d["D2ii"][t]["p"]) for t in ("joint", "iut", "bonf")) + " |")
    L.append("")
    return L


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--results", default=os.path.join(HERE, "..", "results"))
    a = ap.parse_args()
    with open(os.path.join(a.results, "sim_results.json")) as fh:
        res = json.load(fh)
    E = res["experiments"]
    L = ["# Simulation study: new experiments (X2b, X6-X9)", "",
         "Paper 3, *Where Does Criticism End?*. Written by `code/make_summary.py` from `results/sim_results.json`; every number "
         "is formatted from the JSON. **All data are synthetic.** X1-X5 (formerly E1-E5) are summarised in "
         "`results/SUMMARY-numbers.md`. ID = Israel-related items in the disputed categories; IT = trope-based items.", ""]
    for k, fn in (("X2b", x2b), ("X6", x6), ("X7", x7), ("X8", x8), ("X9", x9)):
        if k in E:
            L += fn(E[k])
    with open(os.path.join(a.results, "SUMMARY-new-experiments.md"), "w") as fh:
        fh.write("\n".join(L) + "\n")
    print("wrote SUMMARY-new-experiments.md")


if __name__ == "__main__":
    main()
