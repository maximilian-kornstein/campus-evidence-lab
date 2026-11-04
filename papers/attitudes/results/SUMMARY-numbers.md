# Simulation study: results summary

Paper 3, *Where Does Criticism End?*. Every number below is copied programmatically from `results/sim_results.json`, which `code/run_experiments.py` produced. The figures and tables come from `code/make_figures.py`. **All data are synthetic. No survey was fielded and no real responses were used.**

**Experiment labels.** X1-X5 (and X1b) were labelled E1-E5 (E1b) when they were run; they were renamed to avoid a clash with the estimands (E1)-(E9) of the analysis plan. Seeds, configurations and every number below are unchanged; the code-version prefixes below refer to the files that produced them under the old labels. The new experiments X2b, X6, X7, X8 and X9 are summarised in `results/SUMMARY-new-experiments.md` (written by `code/make_summary.py`).

## Provenance

- Python 3.13.18, numpy 2.5.3, scipy 1.18.1, matplotlib 3.11.2; Linux-6.18.44-fc-v230-x86_64-with-glibc2.39.
- Base seed 20261103; numpy SeedSequence([base_seed, experiment_index, cell keys..., rep]). Each experiment's own `seeds` field gives its keys.
- 2 worker processes, `nice`, OPENBLAS_NUM_THREADS=1. The machine was shared and heavily loaded (load average 11-14 on 4 cores).
- X1: wall 1276 s; run started 2026-11-03T21:49:41Z; run_experiments.py sha256[:16] ca450e64a827b7ce; summary recomputed from raw with run_experiments.py 2729078df210b26b.
- X1b: wall 100 s; run started 2026-11-03T22:15:16Z; run_experiments.py sha256[:16] cd237869adbe67af; summary recomputed from raw with run_experiments.py 2729078df210b26b.
- X2: wall 58 s; run started 2026-11-03T22:15:16Z; run_experiments.py sha256[:16] cd237869adbe67af; summary recomputed from raw with run_experiments.py 2729078df210b26b.
- X3: wall 16 s; run started 2026-11-03T22:15:16Z; run_experiments.py sha256[:16] cd237869adbe67af.
- X4: wall 5 s; run started 2026-11-03T22:15:16Z; run_experiments.py sha256[:16] cd237869adbe67af.
- X5: wall 22 s; run started 2026-11-03T22:15:16Z; run_experiments.py sha256[:16] cd237869adbe67af.

## X1 and X1b: recovery of the boundary estimands

Single group, bifactor normal-ogive DGP, 8 stereotype items and |I| Israel-related items. True I-item ECVs are [0.25, 0.75, 0.4, 0.6, 0.15, 0.85] (the first |I|), tau = 0.5. B = 100 bootstrap replicates and 5 starts per fit. R per design: {'I6': 100, 'I3': 100, 'I2': 50, 'I3p': 40}; X1b (I3np): R = 40.
Designs: I6 and I3 are identified (S block heterogeneous, thm:ident(a)). I3np has a nearly proportional S block (S ECVs 0.65-0.75), so identification is weak. I2 is not identified (thm:ident(c), two I items). I3p is not identified (proportional S block and three I items, thm:ident(b)).

ECV_I bias and RMSE are pooled over the I items. Coverage is of nominal 95% intervals for ECV_j. B is the three-way classification from the per-item bootstrap interval. 'Bonferroni set cov.' is Pr(B_in subset B_tau subset B_out) with Bonferroni logit-Wald intervals (prop:id-boundary-test(b)). 'ECV start range' is the largest spread of ECV_j across starts that reach the optimum (within 1e-6 relative), averaged over replications. 'ident. diag.' is sigma_min/sigma_max of the weighted Jacobian. phi is the correlated-factors S-I correlation, measured against its pseudo-true value.

| Design | n | R | ECV_I bias | ECV_I RMSE | cov. boot | cov. Wald | B: correct / indet. / wrong | Bonferroni set cov. | ECV start range (max, mean) | ident. diag. (median) | phi RMSE | phi cov. |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| I6 | 500 | 100 | +0.005 | 0.082 | 94.8% | 95.0% | 66.2% / 33.7% / 0.2% | 100.0% | 0.000 | 0.1010 | 0.034 | 96.0% |
| I6 | 1000 | 100 | +0.006 | 0.062 | 91.0% | 93.2% | 73.3% / 26.7% / 0.0% | 100.0% | 0.000 | 0.0970 | 0.028 | 94.0% |
| I6 | 3000 | 100 | +0.004 | 0.035 | 92.3% | 95.7% | 91.0% / 9.0% / 0.0% | 100.0% | 0.000 | 0.0966 | 0.016 | 94.0% |
| I3 | 500 | 100 | +0.038 | 0.141 | 94.7% | 94.3% | 39.0% / 61.0% / 0.0% | 98.0% | 0.000 | 0.0609 | 0.042 | 97.0% |
| I3 | 1000 | 100 | +0.002 | 0.074 | 97.0% | 96.3% | 57.0% / 43.0% / 0.0% | 100.0% | 0.000 | 0.0697 | 0.030 | 96.0% |
| I3 | 3000 | 100 | +0.004 | 0.046 | 94.7% | 96.0% | 77.0% / 23.0% / 0.0% | 100.0% | 0.000 | 0.0683 | 0.019 | 95.0% |
| I3np | 500 | 40 | -0.005 | 0.202 | 91.7% | 73.3% | 37.5% / 62.5% / 0.0% | 87.5% | 0.000 | 0.0156 | 0.044 | 90.0% |
| I3np | 1000 | 40 | +0.020 | 0.192 | 92.5% | 56.7% | 48.3% / 51.7% / 0.0% | 72.5% | 0.000 | 0.0158 | 0.034 | 92.5% |
| I3np | 3000 | 40 | +0.023 | 0.168 | 87.5% | 58.3% | 63.3% / 35.0% / 1.7% | 72.5% | 0.000 | 0.0119 | 0.021 | 90.0% |
| I2 | 500 | 50 | +0.032 | 0.177 | 89.0% | 81.0% | 45.0% / 55.0% / 0.0% | 98.0% | 0.216 | 0.0000 | 0.060 | 96.0% |
| I2 | 1000 | 50 | +0.021 | 0.105 | 89.0% | 86.0% | 73.0% / 27.0% / 0.0% | 100.0% | 0.219 | 0.0000 | 0.035 | 94.0% |
| I2 | 3000 | 50 | +0.001 | 0.106 | 65.0% | 62.0% | 88.0% / 12.0% / 0.0% | 98.0% | 0.187 | 0.0000 | 0.028 | 90.0% |
| I3p | 500 | 40 | -0.037 | 0.182 | 90.8% | 70.8% | 44.2% / 55.8% / 0.0% | 90.0% | 0.000 | 0.0275 | 0.044 | 95.0% |
| I3p | 1000 | 40 | -0.050 | 0.180 | 90.8% | 54.2% | 40.0% / 59.2% / 0.8% | 87.5% | 0.000 | 0.0267 | 0.028 | 97.5% |
| I3p | 3000 | 40 | -0.047 | 0.168 | 60.0% | 25.0% | 70.0% / 28.3% / 1.7% | 82.5% | 0.000 | 0.0013 | 0.017 | 95.0% |

Per-item at n = 3000, I6: I1 (ECV 0.25): bias +0.001, SD 0.032, boot cov 94%, correct 100%; I2 (ECV 0.75): bias +0.007, SD 0.035, boot cov 91%, correct 100%; I3 (ECV 0.40): bias +0.003, SD 0.038, boot cov 93%, correct 67%; I4 (ECV 0.60): bias +0.009, SD 0.044, boot cov 89%, correct 79%; I5 (ECV 0.15): bias +0.001, SD 0.027, boot cov 96%, correct 100%; I6 (ECV 0.85): bias +0.003, SD 0.031, boot cov 91%, correct 100%.
Per-item at n = 3000, I3: I1 (ECV 0.25): bias +0.005, SD 0.041, boot cov 92%, correct 99%; I2 (ECV 0.75): bias +0.002, SD 0.046, boot cov 95%, correct 100%; I3 (ECV 0.40): bias +0.004, SD 0.051, boot cov 97%, correct 32%.
I2 (not identified), n = 3000: I1: true ECV 0.250, identified set (0.125, 0.625), estimate SD 0.100, boot cov 62%, mean boot width 0.178; I2: true ECV 0.750, identified set (0.375, 0.875), estimate SD 0.113, boot cov 68%, mean boot width 0.166.
Population identification diagnostic (exact population fit): I6 0.0935, I3 0.0679, I3np 0.00603, I2 8.46e-17, I3p 1.04e-16.
Pseudo-true phi_SI (correlated-factors fit to the population polychorics): I6 0.621, I3 0.589, I3np 0.590, I2 0.591, I3p 0.590.

## X2: DIF, anchors and partial invariance

Two groups with n = 1500 each, the I6 item bank, focal latent means (G, S, I) = [0.3, 0.0, 0.3] and Sigma = I. Uniform DIF on I1 and I2 (thresholds lowered by kappa SDs of the latent response); non-uniform DIF on I3 (G slope x (1 - 1.25 kappa)). kappa in [0.0, 0.2, 0.4, 0.6], R = 100 per kappa; leave-one-anchor-out at kappa = 0.4 (R = 100). Anchor sets: correct = S1-S4, I5, I6; contam1 = S1-S4, I1, I6; contam2 = S1-S4, I1, I2; stereotype-only = S1-S4 (mu_I and sigma_I fixed). 'plim' is the probability limit from a fit to the exact population statistics.

kappa = 0.0:
| Strategy | mu_G bias (MCSE) | mu_G RMSE | mu_G cov. | plim bias mu_G | mu_I bias | mu_I cov. | plim bias mu_I | ECV_I3 bias ref. | ECV_I3 bias focal |
|---|---|---|---|---|---|---|---|---|---|
| naive | -0.003 (0.005) | 0.047 | 95.0% | -0.000 | -0.002 | 97.0% | +0.000 | -0.001 | -0.000 |
| oracle | -0.001 (0.005) | 0.050 | 95.0% | -0.000 | -0.002 | 94.0% | +0.000 | +0.003 | -0.006 |
| correct_fb | -0.002 (0.006) | 0.055 | 98.0% | -0.000 | -0.004 | 94.0% | +0.000 | +0.005 | -0.006 |
| correct_proc | -0.003 (0.005) | 0.047 | 95.0% | - | -0.002 | 97.0% | - | -0.001 | -0.000 |
| contam1_fb | -0.003 (0.006) | 0.061 | 97.0% | +0.000 | -0.002 | 95.0% | -0.000 | +0.004 | -0.006 |
| contam1_proc | -0.003 (0.005) | 0.047 | 95.0% | - | -0.002 | 97.0% | - | -0.001 | -0.000 |
| contam2_fb | -0.007 (0.007) | 0.067 | 94.0% | -0.000 | -0.001 | 94.0% | +0.000 | +0.004 | -0.006 |
| contam2_proc | -0.003 (0.005) | 0.047 | 95.0% | - | -0.002 | 97.0% | - | -0.001 | -0.000 |
| sonly_fb | -0.002 (0.008) | 0.082 | 94.0% | -0.000 | not identified | - | - | +0.004 | -0.008 |

DIF flags (pre-registered rule = BH q = 0.05 AND expected-score difference >= 0.25; BH-only in brackets): correct: power n/a [n/a], false-flag rate 0.0% [0.8%]; contam1: power n/a [n/a], false-flag rate 0.0% [0.6%]; contam2: power n/a [n/a], false-flag rate 0.0% [0.2%].
Per-item flag rates with correct anchors: S5 0% [0%], S6 0% [0%], S7 0% [1%], S8 0% [1%], I1 0% [1%], I2 0% [1%], I3 0% [0%], I4 0% [2%].

kappa = 0.2:
| Strategy | mu_G bias (MCSE) | mu_G RMSE | mu_G cov. | plim bias mu_G | mu_I bias | mu_I cov. | plim bias mu_I | ECV_I3 bias ref. | ECV_I3 bias focal |
|---|---|---|---|---|---|---|---|---|---|
| naive | +0.029 (0.005) | 0.059 | 91.0% | +0.032 | +0.098 | 54.0% | +0.098 | -0.041 | +0.091 |
| oracle | -0.006 (0.005) | 0.049 | 97.0% | -0.000 | +0.003 | 95.0% | +0.000 | +0.007 | +0.006 |
| correct_fb | -0.005 (0.006) | 0.061 | 95.0% | -0.000 | +0.001 | 93.0% | +0.000 | +0.008 | +0.006 |
| correct_proc | +0.007 (0.006) | 0.064 | 91.0% | - | +0.008 | 74.0% | - | -0.046 | +0.082 |
| contam1_fb | -0.093 (0.006) | 0.109 | 65.0% | -0.085 | +0.360 | 0.0% | +0.353 | +0.022 | +0.016 |
| contam1_proc | -0.031 (0.006) | 0.066 | 91.0% | - | +0.230 | 12.0% | - | -0.008 | +0.058 |
| contam2_fb | +0.083 (0.008) | 0.113 | 74.0% | +0.078 | +0.317 | 3.0% | +0.320 | +0.006 | +0.004 |
| contam2_proc | -0.005 (0.006) | 0.062 | 94.0% | - | +0.318 | 1.0% | - | +0.010 | +0.011 |
| sonly_fb | -0.004 (0.008) | 0.076 | 97.0% | +0.000 | not identified | - | - | +0.009 | +0.003 |

DIF flags (pre-registered rule = BH q = 0.05 AND expected-score difference >= 0.25; BH-only in brackets): correct: power 48.7% [77.7%], false-flag rate 0.0% [3.6%]; contam1: power 39.5% [79.0%], false-flag rate 11.8% [22.8%]; contam2: power 96.0% [99.0%], false-flag rate 22.0% [38.7%].
Per-item flag rates with correct anchors: S5 0% [5%], S6 0% [3%], S7 0% [3%], S8 0% [1%], I1 71% [94%], I2 75% [98%], I3 0% [41%], I4 0% [6%].

kappa = 0.4:
| Strategy | mu_G bias (MCSE) | mu_G RMSE | mu_G cov. | plim bias mu_G | mu_I bias | mu_I cov. | plim bias mu_I | ECV_I3 bias ref. | ECV_I3 bias focal |
|---|---|---|---|---|---|---|---|---|---|
| naive | +0.036 (0.006) | 0.074 | 82.0% | +0.040 | +0.243 | 3.0% | +0.230 | -0.072 | +0.199 |
| oracle | -0.006 (0.005) | 0.047 | 98.0% | -0.000 | +0.008 | 95.0% | +0.000 | +0.009 | -0.002 |
| correct_fb | -0.008 (0.005) | 0.049 | 100.0% | -0.000 | +0.010 | 95.0% | +0.000 | +0.010 | -0.002 |
| correct_proc | +0.007 (0.005) | 0.046 | 98.0% | - | -0.032 | 94.0% | - | -0.109 | +0.146 |
| contam1_fb | -0.170 (0.005) | 0.179 | 22.0% | -0.156 | +0.744 | 0.0% | +0.717 | +0.047 | +0.014 |
| contam1_proc | -0.117 (0.005) | 0.129 | 48.0% | - | +0.688 | 0.0% | - | +0.058 | +0.021 |
| contam2_fb | +0.149 (0.012) | 0.191 | 54.0% | +0.135 | +0.669 | 0.0% | +0.663 | +0.003 | -0.005 |
| contam2_proc | +0.054 (0.009) | 0.101 | 82.0% | - | +0.753 | 0.0% | - | -0.008 | -0.010 |
| sonly_fb | -0.011 (0.007) | 0.069 | 97.0% | +0.000 | not identified | - | - | +0.014 | -0.003 |

DIF flags (pre-registered rule = BH q = 0.05 AND expected-score difference >= 0.25; BH-only in brackets): correct: power 66.7% [100.0%], false-flag rate 0.0% [2.8%]; contam1: power 98.5% [99.5%], false-flag rate 29.8% [37.8%]; contam2: power 100.0% [100.0%], false-flag rate 42.9% [47.0%].
Per-item flag rates with correct anchors: S5 0% [2%], S6 0% [1%], S7 0% [6%], S8 0% [5%], I1 100% [100%], I2 100% [100%], I3 0% [100%], I4 0% [0%].
Leave-one-anchor-out spread of mu_G (mean range over the 6 refits): correct 0.043 (MCSE 0.002), contam1 0.133 (MCSE 0.004), contam2 0.099 (MCSE 0.006).

kappa = 0.6:
| Strategy | mu_G bias (MCSE) | mu_G RMSE | mu_G cov. | plim bias mu_G | mu_I bias | mu_I cov. | plim bias mu_I | ECV_I3 bias ref. | ECV_I3 bias focal |
|---|---|---|---|---|---|---|---|---|---|
| naive | -0.001 (0.008) | 0.076 | 83.0% | -0.007 | +0.756 | 1.0% | +0.443 | -0.022 | +0.381 |
| oracle | -0.000 (0.005) | 0.048 | 95.0% | -0.000 | -0.000 | 94.0% | +0.000 | +0.000 | +0.002 |
| correct_fb | -0.001 (0.006) | 0.057 | 96.0% | -0.000 | +0.001 | 92.0% | +0.000 | +0.000 | +0.002 |
| correct_proc | +0.023 (0.005) | 0.053 | 93.0% | - | -0.060 | 80.0% | - | -0.176 | +0.190 |
| contam1_fb | -0.222 (0.006) | 0.230 | 3.0% | -0.215 | +1.077 | 0.0% | +1.084 | +0.055 | +0.013 |
| contam1_proc | -0.139 (0.005) | 0.148 | 31.0% | - | +1.016 | 0.0% | - | +0.068 | +0.016 |
| contam2_fb | +0.227 (0.020) | 0.303 | 44.0% | +0.150 | +0.959 | 0.0% | +1.049 | -0.010 | -0.000 |
| contam2_proc | +0.068 (0.010) | 0.117 | 82.0% | - | +1.102 | 0.0% | - | -0.029 | -0.003 |
| sonly_fb | -0.000 (0.008) | 0.079 | 94.0% | +0.000 | not identified | - | - | -0.002 | +0.002 |

DIF flags (pre-registered rule = BH q = 0.05 AND expected-score difference >= 0.25; BH-only in brackets): correct: power 67.0% [100.0%], false-flag rate 0.0% [1.6%]; contam1: power 100.0% [100.0%], false-flag rate 32.8% [40.8%]; contam2: power 100.0% [100.0%], false-flag rate 45.0% [48.6%].
Per-item flag rates with correct anchors: S5 0% [0%], S6 0% [2%], S7 0% [3%], S8 0% [1%], I1 100% [100%], I2 100% [100%], I3 1% [100%], I4 0% [2%].

Exact population checks: stereotype-only anchors give mu_hat = [0.3, -0.0, 0.0] (true [0.3, 0.0, 0.3]; mu_I fixed), max |ECV^(1) error| = 2.11e-14. thm:dif-bias(d)(i): DIF = -a_j'v on all items gives mu_hat = [0.55, -0.1, 0.45] (expected [0.55, -0.1, 0.45]). prop:anchor(b): 3 anchors with DIF -A_A v give mu_hat = [0.55, -0.1, 0.45] and spurious non-anchor DIF equal to a_k'v (max deviation 2.3e-09).

## X3: list experiments and social-desirability bias

One sensitive item, threshold-shift DGP: pi = 0.3, direct prevalence 0.2 so SDB = 0.10 (minus phi when false endorsement phi > 0). n = 3000, equal costs. Controls have prevalence 1/2, in pairs with binary within-pair correlation rho. R = 2000 (parts A and B), 1000 (part C).

| Cell | Estimator | shares (D, C, T) | SD theory | bias (MCSE) | SD | RMSE | cov. |
|---|---|---|---|---|---|---|---|
| A_indep_equal | split | (0.333, 0.333, 0.333) | 0.0487 | +0.0010 (0.0011) | 0.0484 | 0.0484 | 95.5% |
| A_indep_equal | adj | (0.333, 0.333, 0.333) | - | +0.0008 (0.0011) | 0.0475 | 0.0475 | 95.7% |
| A_indep_neyman | split | (0.160, 0.400, 0.440) | 0.0456 | +0.0008 (0.0010) | 0.0459 | 0.0459 | 94.3% |
| A_indep_neyman | adj | (0.160, 0.400, 0.440) | - | +0.0011 (0.0010) | 0.0450 | 0.0450 | 95.1% |
| A_indep_pilot | split | (0.159, 0.400, 0.441) | 0.0457 | +0.0016 (0.0010) | 0.0462 | 0.0462 | 95.1% |
| A_indep_pilot | adj | (0.159, 0.400, 0.441) | - | +0.0017 (0.0010) | 0.0456 | 0.0456 | 94.9% |
| A_pairs_equal | split | (0.333, 0.333, 0.333) | 0.0342 | -0.0007 (0.0008) | 0.0341 | 0.0341 | 95.2% |
| A_pairs_equal | adj | (0.333, 0.333, 0.333) | - | -0.0006 (0.0007) | 0.0332 | 0.0332 | 95.3% |
| A_pairs_neyman | split | (0.221, 0.349, 0.431) | 0.0331 | +0.0008 (0.0007) | 0.0332 | 0.0332 | 95.2% |
| A_pairs_neyman | adj | (0.221, 0.349, 0.431) | - | +0.0009 (0.0007) | 0.0321 | 0.0321 | 94.8% |
| A_pairs_pilot | split | (0.220, 0.349, 0.431) | 0.0332 | +0.0008 (0.0007) | 0.0324 | 0.0324 | 95.2% |
| A_pairs_pilot | adj | (0.220, 0.349, 0.431) | - | +0.0006 (0.0007) | 0.0316 | 0.0316 | 95.1% |
| B_phi0.0_split_neyman | split | (0.221, 0.349, 0.431) | 0.0331 | +0.0002 (0.0008) | 0.0339 | 0.0339 | 94.4% |
| B_phi0.0_paired_paired_opt | ps | (0.000, 0.470, 0.530) | 0.0243 | -0.0002 (0.0006) | 0.0249 | 0.0249 | 94.5% |
| B_phi0.0_paired_paired_opt | comb_vs_sdb | (0.000, 0.470, 0.530) | 0.0220 | -0.0000 (0.0005) | 0.0226 | 0.0226 | 94.8% |
| B_phi0.0_paired_equal | ps | (0.333, 0.333, 0.333) | 0.0298 | -0.0002 (0.0007) | 0.0296 | 0.0296 | 95.5% |
| B_phi0.0_paired_equal | comb_vs_sdb | (0.333, 0.333, 0.333) | 0.0270 | -0.0001 (0.0006) | 0.0268 | 0.0268 | 95.5% |
| B_phi0.02_split_neyman | split | (0.227, 0.346, 0.427) | 0.0334 | +0.0013 (0.0008) | 0.0337 | 0.0338 | 94.5% |
| B_phi0.02_paired_paired_opt | ps | (0.000, 0.469, 0.531) | 0.0246 | +0.0007 (0.0005) | 0.0242 | 0.0242 | 95.2% |
| B_phi0.02_paired_paired_opt | comb_vs_sdb | (0.000, 0.469, 0.531) | 0.0218 | +0.0206 (0.0005) | 0.0214 | 0.0297 | 85.3% |
| B_phi0.02_paired_equal | ps | (0.333, 0.333, 0.333) | 0.0301 | -0.0002 (0.0007) | 0.0302 | 0.0302 | 95.0% |
| B_phi0.02_paired_equal | comb_vs_sdb | (0.333, 0.333, 0.333) | 0.0267 | +0.0198 (0.0006) | 0.0263 | 0.0329 | 89.8% |

Part C (split, Neyman allocation): bias theory (eq:le-fcbias) vs simulated, SD theory vs simulated, RMSE, coverage.

| J | rho | kc = kf | exposure | bias theory | bias sim. (MCSE) | SD theory | SD sim. | RMSE | cov. |
|---|---|---|---|---|---|---|---|---|---|
| 2 | 0.0 | 0.0 | 0.5000 | -0.0000 | -0.0000 (0.0012) | 0.0356 | 0.0367 | 0.0367 | 94.6% |
| 2 | 0.0 | 0.5 | 0.5000 | -0.0750 | -0.0726 (0.0011) | 0.0356 | 0.0361 | 0.0811 | 44.1% |
| 2 | -0.6 | 0.0 | 0.2000 | -0.0000 | -0.0005 (0.0009) | 0.0272 | 0.0283 | 0.0283 | 94.0% |
| 2 | -0.6 | 0.5 | 0.2000 | -0.0300 | -0.0313 (0.0009) | 0.0272 | 0.0272 | 0.0415 | 78.4% |
| 3 | 0.0 | 0.0 | 0.2500 | -0.0000 | -0.0007 (0.0013) | 0.0410 | 0.0421 | 0.0421 | 94.2% |
| 3 | 0.0 | 0.5 | 0.2500 | -0.0375 | -0.0365 (0.0013) | 0.0410 | 0.0419 | 0.0556 | 85.8% |
| 3 | -0.6 | 0.0 | 0.1000 | -0.0000 | +0.0008 (0.0011) | 0.0344 | 0.0347 | 0.0347 | 95.0% |
| 3 | -0.6 | 0.5 | 0.1000 | -0.0150 | -0.0145 (0.0011) | 0.0344 | 0.0348 | 0.0377 | 92.4% |
| 4 | 0.0 | 0.0 | 0.1250 | -0.0000 | +0.0004 (0.0015) | 0.0456 | 0.0468 | 0.0468 | 94.2% |
| 4 | 0.0 | 0.5 | 0.1250 | -0.0187 | -0.0180 (0.0014) | 0.0456 | 0.0440 | 0.0475 | 95.0% |
| 4 | -0.6 | 0.0 | 0.0200 | -0.0000 | -0.0008 (0.0010) | 0.0331 | 0.0331 | 0.0331 | 96.1% |
| 4 | -0.6 | 0.5 | 0.0200 | -0.0030 | -0.0033 (0.0010) | 0.0331 | 0.0329 | 0.0331 | 94.4% |
| 5 | 0.0 | 0.0 | 0.0625 | -0.0000 | +0.0007 (0.0016) | 0.0498 | 0.0500 | 0.0500 | 95.6% |
| 5 | 0.0 | 0.5 | 0.0625 | -0.0094 | -0.0084 (0.0016) | 0.0498 | 0.0503 | 0.0510 | 94.7% |
| 5 | -0.6 | 0.0 | 0.0100 | -0.0000 | +0.0027 (0.0012) | 0.0390 | 0.0391 | 0.0392 | 95.0% |
| 5 | -0.6 | 0.5 | 0.0100 | -0.0015 | -0.0007 (0.0012) | 0.0390 | 0.0384 | 0.0383 | 95.2% |
| 6 | 0.0 | 0.0 | 0.0312 | -0.0000 | +0.0001 (0.0016) | 0.0535 | 0.0520 | 0.0520 | 95.3% |
| 6 | 0.0 | 0.5 | 0.0312 | -0.0047 | -0.0045 (0.0017) | 0.0535 | 0.0528 | 0.0530 | 95.3% |
| 6 | -0.6 | 0.0 | 0.0020 | -0.0000 | -0.0001 (0.0011) | 0.0379 | 0.0355 | 0.0354 | 96.4% |
| 6 | -0.6 | 0.5 | 0.0020 | -0.0003 | +0.0013 (0.0012) | 0.0379 | 0.0371 | 0.0371 | 95.2% |

MSE-optimal list (thm:design(c)) with fc0.0: theory by n {'300': 'J2_rho-0.6', '1000': 'J2_rho-0.6', '3000': 'J2_rho-0.6', '10000': 'J2_rho-0.6', '30000': 'J2_rho-0.6', '100000': 'J2_rho-0.6', '300000': 'J2_rho-0.6', '1000000': 'J2_rho-0.6'}; empirical at n = 3000: J2_rho-0.6.
MSE-optimal list (thm:design(c)) with fc0.5: theory by n {'300': 'J2_rho-0.6', '1000': 'J2_rho-0.6', '3000': 'J4_rho-0.6', '10000': 'J4_rho-0.6', '30000': 'J4_rho-0.6', '100000': 'J4_rho-0.6', '300000': 'J6_rho-0.6', '1000000': 'J6_rho-0.6'}; empirical at n = 3000: J4_rho-0.6.

Re-computed illustrations from sec:sensitive and sec:design-list: L* = 26.96 (independent controls) and 11.92 (pairs, rho = -0.6); rem:le-mse thresholds {'2000': 0.04557447708341699, '6000': 0.026312436612287233}; thm:design(a) n*Var equal 6.48 vs optimum 5.76, shares [0.1667, 0.4167, 0.4167]; direct-arm cost threshold 1.26e-04; paired/split variance ratio 0.810; sec:design-list m for power 0.8: 1695 (SDB 0.10), 6781 (SDB 0.05).

## X4: MRP small-area estimates of the mean of G

50 areas with 32 demographic cells each; differential non-response; score y = theta_G + N(0, 0.4^2); R = 200 per n. A new population is drawn in each replication. MRP = REML random-intercept model with demographic fixed effects and an area predictor, then poststratification. Direct estimators are evaluated on areas with at least 2 respondents. 'slope' is the regression of estimated on true area deviations from the national mean.

| n | empty areas | MRP RMSE | MRP cov. | MRP slope | EAP-2step RMSE | EAP cov. | EAP slope | rho_EAP | direct RMSE | direct bias | direct-wtd RMSE | MRP better |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1000 | 0.83 | 0.168 | 92.0% | 0.753 | 0.172 | 85.3% | 0.637 | 0.845 | 0.342 | -0.099 | 0.359 | 70.1% |
| 3000 | 0.06 | 0.133 | 93.7% | 0.833 | 0.141 | 86.0% | 0.704 | 0.844 | 0.232 | -0.098 | 0.229 | 69.9% |
| 6000 | 0.01 | 0.105 | 94.7% | 0.901 | 0.115 | 84.0% | 0.762 | 0.846 | 0.177 | -0.094 | 0.164 | 71.7% |

By realised area sample size (n = 3000): [0,5) 294 area-reps: MRP 0.204, direct 0.602, direct-wtd 0.614, MRP cov 92.2%; [5,10) 682 area-reps: MRP 0.194, direct 0.369, direct-wtd 0.391, MRP cov 90.9%; [10,20) 1647 area-reps: MRP 0.164, direct 0.284, direct-wtd 0.291, MRP cov 93.6%; [20,50) 3517 area-reps: MRP 0.133, direct 0.203, direct-wtd 0.196, MRP cov 93.9%; [50,100) 2246 area-reps: MRP 0.102, direct 0.152, direct-wtd 0.131, MRP cov 93.6%; [100,inf) 1614 area-reps: MRP 0.071, direct 0.124, direct-wtd 0.087, MRP cov 95.2%.

## X5: stereotype-count indices

Index = Pr(agree with >= h of the 8 S items), where agree means the top two of five categories. Groups differ by delta in the mean of G only. Random uniform DIF on the S items: b_j^(1) = b_j^(0) + N(0, s^2) sd_j. 1000 random configurations per (s, |delta|), exact population computation by quadrature.

| s | h=2, d=0.05 | h=2, d=0.1 | h=2, d=0.2 | h=2, d=0.3 | h=4, d=0.05 | h=4, d=0.1 | h=4, d=0.2 | h=4, d=0.3 | h=6, d=0.05 | h=6, d=0.1 | h=6, d=0.2 | h=6, d=0.3 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 0.0 | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% |
| 0.1 | 21.1% | 5.6% | 0.0% | 0.0% | 20.1% | 5.1% | 0.0% | 0.0% | 20.1% | 5.2% | 0.0% | 0.0% |
| 0.2 | 33.5% | 21.1% | 6.5% | 0.7% | 32.4% | 18.9% | 5.5% | 0.3% | 33.0% | 21.4% | 5.5% | 0.3% |
| 0.3 | 41.3% | 30.2% | 14.6% | 7.8% | 39.7% | 28.4% | 12.7% | 4.6% | 39.4% | 28.7% | 14.5% | 4.2% |
| 0.4 | 44.4% | 36.7% | 23.5% | 14.8% | 41.6% | 36.8% | 18.3% | 9.4% | 43.0% | 37.6% | 20.8% | 10.2% |
| 0.5 | 47.4% | 41.1% | 32.1% | 24.5% | 46.2% | 38.3% | 25.2% | 17.5% | 46.6% | 39.3% | 25.8% | 18.1% |

Finite sample (n = 1000 per group, h = 4, delta = 0.1): s = 0.0: reversal 11.7% (ties 1.7%), mean diff +0.0226; s = 0.3: reversal 21.7% (ties 0.7%), mean diff +0.0376.
Unequal variances under full invariance (prop:index(b)), delta = 0.2: sigma1 = 0.6: signs by h [1, 1, 1, -1, -1, -1, -1, -1]; sigma1 = 0.8: signs by h [1, 1, 1, 1, 1, 1, -1, -1]; sigma1 = 1.25: signs by h [1, 1, 1, 1, 1, 1, 1, 1]; sigma1 = 1.5: signs by h [1, 1, 1, 1, 1, 1, 1, 1].
Random non-uniform DIF (G slopes x exp(N(0, s_a^2))), delta = 0.1: s_a = 0.2: h-dependent sign 25.9%, reversal by h [0.0, 0.0, 0.0, 0.013, 0.046, 0.082, 0.15, 0.259]; s_a = 0.4: h-dependent sign 48.3%, reversal by h [0.0, 0.0, 0.016, 0.067, 0.136, 0.214, 0.319, 0.483]; s_a = 0.6: h-dependent sign 63.6%, reversal by h [0.001, 0.0, 0.027, 0.094, 0.179, 0.293, 0.445, 0.635].
Example ex:sa-index re-computed: (i) signs [1, 1, -1, -1, -1, -1, -1, -1, -1, -1], P1(5) = 0.100, P2(5) = 0.214; (ii) P1(1) = 0.999, P2(1) = 0.806, P1(10) = 0.002, P2(10) = 0.194, signs [1, 1, 1, 1, 1, -1, -1, -1, -1, -1]; (iii) 0.0049 and 0.0987.

