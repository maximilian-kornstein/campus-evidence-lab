# Simulation study: new experiments (X2b, X6-X9)

Paper 3, *Where Does Criticism End?*. Written by `code/make_summary.py` from `results/sim_results.json`; every number is formatted from the JSON. **All data are synthetic.** X1-X5 (formerly E1-E5) are summarised in `results/SUMMARY-numbers.md`. ID = Israel-related items in the disputed categories; IT = trope-based items.

## X2b: DIF on the stereotype anchors

Two groups of 1500, focal means (0.3, 0, 0.3); uniform DIF of kappa_S latent-response SDs on S1 and S2 (two of the four stereotype anchors, same direction), with the X2 Israel-item DIF at kappa_I. R = 100 per cell. Wall 242 s, CPU 436 s.

| kappa_I | kappa_S | strategy | mu_G bias (MCSE) | median | RMSE | cov. | plim bias | first-order bias | mu_S bias | conv. |
|---|---|---|---|---|---|---|---|---|---|---|
| 0 | 0.1 | oracle | -0.003 (0.006) | -0.001 | 0.055 | 93% | -0.000 | - | +0.006 | 100% |
| 0 | 0.1 | default_fb | +0.025 (0.005) | +0.023 | 0.057 | 96% | +0.030 | +0.026 | +0.082 | 100% |
| 0 | 0.1 | default_proc | +0.006 (0.005) | +0.007 | 0.051 | 93% | - | - | +0.056 | 100% |
| 0 | 0.1 | sonly_fb | +0.073 (0.010) | +0.066 | 0.124 | 84% | +0.072 | +0.058 | +0.017 | 100% |
| 0 | 0.2 | oracle | -0.007 (0.005) | -0.013 | 0.048 | 96% | -0.000 | - | +0.003 | 100% |
| 0 | 0.2 | default_fb | +0.047 (0.008) | +0.045 | 0.097 | 82% | +0.057 | +0.052 | +0.156 | 100% |
| 0 | 0.2 | default_proc | +0.006 (0.008) | +0.010 | 0.078 | 80% | - | - | +0.156 | 100% |
| 0 | 0.2 | sonly_fb | +0.259 (0.118) | +0.233 | 1.198 | 32% | +0.254 | +0.114 | -0.114 | 99% |
| 0 | 0.3 | oracle | +0.007 (0.005) | +0.003 | 0.055 | 94% | -0.000 | - | -0.019 | 100% |
| 0 | 0.3 | default_fb | +0.040 (0.026) | +0.024 | 0.260 | 28% | +0.030 | +0.076 | +0.411 | 78% |
| 0 | 0.3 | default_proc | +0.032 (0.021) | -0.017 | 0.216 | 38% | - | - | +0.552 | 89% |
| 0 | 0.3 | sonly_fb | -5.720 (1.497) | +1.118 | 15.958 | 22% | +2.521 | +0.170 | +10.075 | 93% |
| 0.4 | 0.1 | oracle | -0.003 (0.005) | -0.006 | 0.053 | 97% | -0.000 | - | +0.000 | 100% |
| 0.4 | 0.1 | default_fb | +0.031 (0.007) | +0.033 | 0.072 | 89% | +0.030 | +0.026 | +0.059 | 100% |
| 0.4 | 0.1 | default_proc | +0.013 (0.006) | +0.017 | 0.057 | 91% | - | - | +0.038 | 100% |
| 0.4 | 0.1 | sonly_fb | +0.080 (0.011) | +0.078 | 0.133 | 75% | +0.073 | +0.058 | -0.007 | 100% |
| 0.4 | 0.2 | oracle | +0.008 (0.006) | +0.006 | 0.059 | 95% | -0.000 | - | -0.007 | 100% |
| 0.4 | 0.2 | default_fb | +0.069 (0.008) | +0.063 | 0.108 | 72% | +0.058 | +0.052 | +0.123 | 100% |
| 0.4 | 0.2 | default_proc | +0.041 (0.010) | +0.054 | 0.104 | 70% | - | - | +0.117 | 100% |
| 0.4 | 0.2 | sonly_fb | +0.410 (0.140) | +0.236 | 1.453 | 36% | +0.266 | +0.115 | -0.335 | 95% |
| 0.4 | 0.3 | oracle | -0.007 (0.006) | -0.001 | 0.063 | 88% | -0.000 | - | +0.019 | 100% |
| 0.4 | 0.3 | default_fb | +0.031 (0.024) | +0.008 | 0.239 | 42% | +0.028 | +0.076 | +0.440 | 79% |
| 0.4 | 0.3 | default_proc | +0.016 (0.024) | -0.027 | 0.235 | 36% | - | - | +0.460 | 92% |
| 0.4 | 0.3 | sonly_fb | -4.805 (1.722) | +1.250 | 17.796 | 20% | +2.634 | +0.170 | +7.079 | 92% |

- kappa_I = 0, kappa_S = 0.1: revised-screen flag rates with the default anchors: S5 2%, S6 11%, S7 2%, S8 3%, I1 0%, I2 2%, I3 0%, I4 2%. Leave-one-anchor-out range of mu_G: default 0.165 (median 0.155), stereotype-only 0.464 (median 0.432).
- kappa_I = 0, kappa_S = 0.2: revised-screen flag rates with the default anchors: S5 21%, S6 55%, S7 21%, S8 45%, I1 1%, I2 2%, I3 2%, I4 1%. Leave-one-anchor-out range of mu_G: default 0.766 (median 0.393), stereotype-only 1.410 (median 1.093).
- kappa_I = 0, kappa_S = 0.3: revised-screen flag rates with the default anchors: S5 43%, S6 67%, S7 49%, S8 69%, I1 3%, I2 16%, I3 2%, I4 5%. Leave-one-anchor-out range of mu_G: default 12.034 (median 2.732), stereotype-only 5.857 (median 2.354).
- kappa_I = 0.4, kappa_S = 0.1: revised-screen flag rates with the default anchors: S5 4%, S6 7%, S7 2%, S8 9%, I1 100%, I2 100%, I3 98%, I4 3%. Leave-one-anchor-out range of mu_G: default 0.166 (median 0.151), stereotype-only 0.469 (median 0.423).
- kappa_I = 0.4, kappa_S = 0.2: revised-screen flag rates with the default anchors: S5 31%, S6 57%, S7 33%, S8 56%, I1 100%, I2 100%, I3 98%, I4 4%. Leave-one-anchor-out range of mu_G: default 0.525 (median 0.397), stereotype-only 1.946 (median 1.059).
- kappa_I = 0.4, kappa_S = 0.3: revised-screen flag rates with the default anchors: S5 54%, S6 78%, S7 65%, S8 84%, I1 100%, I2 100%, I3 100%, I4 7%. Leave-one-anchor-out range of mu_G: default 11.872 (median 2.938), stereotype-only 5.387 (median 2.355).

Bound eq:id-anchor-bound (first order, DWLS efficient information) at a stated maximum anchor DIF delta_max (|d_j| <= delta_max sd_j for every anchor); values at kappa_I = 0.4, kappa_S = 0.1 (they do not depend on the cell to the printed precision):

| anchors | delta_max | worst abs bias mu_G | same-direction bias mu_G | worst norm | bound (middle) | bound (outer) | sigma_min(M) |
|---|---|---|---|---|---|---|---|
| default_fb | 0.1 | 0.345 | +0.104 | 0.683 | 0.707 | 0.738 | 80.6 |
| default_fb | 0.2 | 0.690 | +0.208 | 1.365 | 1.413 | 1.476 | 80.6 |
| default_fb | 0.3 | 1.035 | +0.312 | 2.048 | 2.120 | 2.214 | 80.6 |
| default_fb | 0.4 | 1.380 | +0.416 | 2.730 | 2.826 | 2.952 | 80.6 |
| sonly_fb | 0.1 | 0.442 | +0.099 | 0.761 | 0.763 | 0.807 | 61.5 |
| sonly_fb | 0.2 | 0.885 | +0.199 | 1.522 | 1.525 | 1.613 | 61.5 |
| sonly_fb | 0.3 | 1.327 | +0.298 | 2.283 | 2.288 | 2.420 | 61.5 |
| sonly_fb | 0.4 | 1.769 | +0.398 | 3.045 | 3.051 | 3.226 | 61.5 |

## X6: directional misspecifications and remedies

Registered sizes: 10 S, 8 ID, 6 IT items; n = 6000; R = 100 per cell; wall 574 s, CPU 1098 s. Bias = Monte Carlo mean of ECV-hat minus the true own-domain ECV; plim = fit to the exact population polychorics. Wrong = % of the Israel-related items in the model classified on the wrong side of tau = 0.5 by Bonferroni logit-Wald intervals; false in = % of truly-out items classified in.

| cell | model | bias S | bias ID | bias IT | plim bias IT | max abs bias (I) | plim max abs (I) | wrong | false in | undet. | ident. (median) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| cross_c0.0 | bif | -0.002 | +0.001 | +0.003 | +0.000 | 0.005 | 0.000 | 0.0% | 0.0% | 10.5% | 0.0897 |
| cross_c0.0 | cross | -0.005 | +0.002 | +0.003 | -0.000 | 0.006 | 0.000 | 0.0% | 0.0% | 11.9% | 0.0653 |
| cross_c0.0 | mf | -0.002 | +0.001 | +0.003 | +0.000 | 0.005 | 0.000 | 0.0% | 0.0% | 10.7% | 0.0000 |
| cross_c0.0 | ipo | -0.004 | +0.002 | - | - | 0.004 | 0.000 | 0.0% | 0.0% | 4.8% | 0.0720 |
| cross_c0.0 | twostage | -0.003 | +0.002 | +0.002 | - | 0.005 | - | 0.0% | 0.0% | 10.6% | - |
| cross_c0.1 | bif | +0.112 | -0.041 | +0.018 | +0.018 | 0.071 | 0.071 | 0.0% | 0.0% | 17.1% | 0.0853 |
| cross_c0.1 | cross | -0.005 | +0.001 | +0.002 | +0.000 | 0.005 | 0.000 | 0.0% | 0.0% | 11.4% | 0.0639 |
| cross_c0.1 | mf | +0.111 | -0.041 | +0.018 | +0.018 | 0.071 | 0.071 | 0.0% | 0.0% | 17.0% | 0.0000 |
| cross_c0.1 | ipo | -0.005 | +0.001 | - | - | 0.003 | 0.000 | 0.0% | 0.0% | 5.1% | 0.0724 |
| cross_c0.1 | twostage | -0.005 | +0.001 | +0.002 | - | 0.005 | - | 0.0% | 0.0% | 11.4% | - |
| cross_c0.2 | bif | +0.201 | -0.066 | +0.051 | +0.048 | 0.117 | 0.117 | 0.1% | 0.2% | 25.4% | 0.0840 |
| cross_c0.2 | cross | -0.006 | +0.004 | +0.003 | +0.000 | 0.007 | 0.000 | 0.0% | 0.0% | 10.9% | 0.0665 |
| cross_c0.2 | mf | +0.201 | -0.066 | +0.051 | +0.049 | 0.117 | 0.117 | 0.1% | 0.2% | 25.3% | 0.0000 |
| cross_c0.2 | ipo | -0.005 | +0.003 | - | - | 0.006 | 0.000 | 0.0% | 0.0% | 4.9% | 0.0719 |
| cross_c0.2 | twostage | -0.006 | +0.004 | +0.003 | - | 0.007 | - | 0.0% | 0.0% | 10.9% | - |
| cross_c0.3 | bif | +0.254 | -0.080 | +0.089 | +0.090 | 0.141 | 0.142 | 7.1% | 9.4% | 25.6% | 0.0837 |
| cross_c0.3 | cross | -0.002 | +0.001 | -0.000 | -0.000 | 0.006 | 0.000 | 0.0% | 0.0% | 8.7% | 0.0742 |
| cross_c0.3 | mf | +0.254 | -0.080 | +0.089 | +0.090 | 0.141 | 0.142 | 7.1% | 9.6% | 25.5% | 0.0000 |
| cross_c0.3 | ipo | -0.001 | +0.001 | - | - | 0.006 | 0.000 | 0.0% | 0.0% | 5.1% | 0.0719 |
| cross_c0.3 | twostage | +0.035 | -0.010 | +0.013 | - | 0.021 | - | 0.9% | 1.1% | 11.3% | - |
| acq_registered_a0.25 | bif | -0.010 | +0.014 | +0.023 | +0.022 | 0.030 | 0.029 | 0.0% | 0.0% | 11.6% | 0.0872 |
| acq_registered_a0.25 | cross | -0.005 | +0.012 | +0.027 | +0.026 | 0.039 | 0.038 | 0.0% | 0.0% | 13.6% | 0.0631 |
| acq_registered_a0.25 | mf | -0.004 | +0.001 | +0.001 | +0.000 | 0.003 | 0.000 | 0.0% | 0.0% | 9.7% | 0.0402 |
| acq_registered_a0.25 | ipo | -0.007 | +0.013 | - | - | 0.030 | 0.032 | 0.0% | 0.0% | 0.6% | 0.0675 |
| acq_registered_a0.25 | twostage | -0.010 | +0.014 | +0.023 | - | 0.030 | - | 0.0% | 0.0% | 11.6% | - |
| acq_registered_a0.4 | bif | +0.025 | -0.000 | +0.015 | +0.013 | 0.132 | 0.134 | 0.0% | 0.0% | 11.9% | 0.0840 |
| acq_registered_a0.4 | cross | +0.050 | -0.009 | +0.023 | +0.021 | 0.139 | 0.141 | 0.0% | 0.0% | 15.9% | 0.0688 |
| acq_registered_a0.4 | mf | -0.002 | +0.001 | +0.001 | +0.000 | 0.003 | 0.000 | 0.0% | 0.0% | 11.2% | 0.0277 |
| acq_registered_a0.4 | ipo | +0.113 | -0.033 | - | - | 0.164 | 0.166 | 0.0% | 0.0% | 6.6% | 0.0379 |
| acq_registered_a0.4 | twostage | +0.025 | -0.000 | +0.015 | - | 0.132 | - | 0.0% | 0.0% | 11.9% | - |
| acq_registered_a0.55 | bif | +0.015 | +0.010 | +0.050 | +0.047 | 0.312 | 0.314 | 0.6% | 0.9% | 20.3% | 0.0577 |
| acq_registered_a0.55 | cross | -0.008 | +0.022 | +0.062 | +0.056 | 0.317 | 0.319 | 2.7% | 4.2% | 23.3% | 0.0644 |
| acq_registered_a0.55 | mf | -0.002 | +0.002 | +0.002 | +0.000 | 0.004 | 0.000 | 0.0% | 0.0% | 12.9% | 0.0229 |
| acq_registered_a0.55 | ipo | +0.008 | +0.022 | - | - | 0.322 | 0.323 | 0.0% | 0.0% | 7.0% | 0.0488 |
| acq_registered_a0.55 | twostage | +0.014 | +0.011 | +0.050 | - | 0.313 | - | 0.7% | 1.1% | 20.1% | - |
| acq_balanced_a0.25 | bif | +0.139 | -0.064 | -0.099 | -0.099 | 0.121 | 0.122 | 0.1% | 0.0% | 15.9% | 0.1200 |
| acq_balanced_a0.25 | cross | +0.163 | -0.072 | -0.110 | -0.111 | 0.195 | 0.196 | 6.6% | 0.0% | 13.9% | 0.0914 |
| acq_balanced_a0.25 | mf | -0.002 | +0.001 | +0.001 | -0.000 | 0.005 | 0.000 | 0.0% | 0.0% | 12.1% | 0.0328 |
| acq_balanced_a0.25 | ipo | +0.153 | -0.066 | - | - | 0.128 | 0.129 | 0.1% | 0.0% | 16.4% | 0.1053 |
| acq_balanced_a0.25 | twostage | +0.139 | -0.064 | -0.099 | - | 0.121 | - | 0.1% | 0.0% | 15.9% | - |
| acq_balanced_a0.4 | bif | +0.152 | -0.082 | -0.128 | -0.129 | 0.170 | 0.168 | 3.9% | 0.0% | 17.1% | 0.1678 |
| acq_balanced_a0.4 | cross | +0.158 | -0.085 | -0.146 | -0.147 | 0.255 | 0.253 | 8.1% | 0.0% | 15.3% | 0.1194 |
| acq_balanced_a0.4 | mf | +0.001 | +0.000 | +0.001 | +0.000 | 0.006 | 0.000 | 0.0% | 0.0% | 13.0% | 0.0217 |
| acq_balanced_a0.4 | ipo | +0.154 | -0.079 | - | - | 0.168 | 0.165 | 1.4% | 0.0% | 22.5% | 0.1362 |
| acq_balanced_a0.4 | twostage | +0.152 | -0.082 | -0.128 | - | 0.170 | - | 3.9% | 0.0% | 17.1% | - |
| acq_balanced_a0.55 | bif | -0.197 | +0.256 | +0.103 | +0.200 | 0.433 | 0.642 | 45.0% | 68.0% | 5.9% | 0.2086 |
| acq_balanced_a0.55 | cross | -0.167 | +0.097 | -0.107 | -0.104 | 0.672 | 0.751 | 54.4% | 52.4% | 1.0% | 0.2070 |
| acq_balanced_a0.55 | mf | -0.001 | +0.001 | +0.001 | -0.000 | 0.003 | 0.000 | 0.0% | 0.0% | 14.6% | 0.0172 |
| acq_balanced_a0.55 | ipo | +0.091 | -0.074 | - | - | 0.173 | 0.179 | 1.1% | 0.0% | 21.1% | 0.1643 |
| acq_balanced_a0.55 | twostage | -0.092 | +0.048 | -0.111 | - | 0.524 | - | 39.8% | 37.2% | 5.2% | - |
| acq_registered_a0.4_het | bif | +0.028 | -0.020 | -0.019 | -0.019 | 0.112 | 0.109 | 0.0% | 0.0% | 4.6% | 0.0665 |
| acq_registered_a0.4_het | cross | +0.029 | -0.020 | -0.014 | -0.014 | 0.117 | 0.114 | 0.0% | 0.0% | 7.5% | 0.0722 |
| acq_registered_a0.4_het | mf | -0.066 | +0.015 | +0.016 | +0.018 | 0.043 | 0.047 | 0.0% | 0.0% | 15.9% | 0.0319 |
| acq_registered_a0.4_het | ipo | +0.056 | -0.026 | - | - | 0.123 | 0.120 | 0.0% | 0.0% | 1.1% | 0.0477 |
| acq_registered_a0.4_het | twostage | +0.028 | -0.020 | -0.019 | - | 0.112 | - | 0.0% | 0.0% | 4.6% | - |

- cross_c0.0: IT x S mean-residual test rejects in 5.0%; mean residual +0.0000 (plim -0.0000). Method-factor slope m-hat mean 0.018 (plim 0.000). Plan's IT x S check: at least one IT item flagged in 26.0%; flag rate by item IT1 7%, IT2 1%, IT3 5%, IT4 6%, IT5 7%, IT6 4%; IT items wrong: standard 0.0%, plan's rule 0.0% (undetermined 19.8%); false in: standard 0.0%, plan's rule 0.0%. Method-factor model, identification diagnostic over content parameters (median) 0.0897.
- cross_c0.1: IT x S mean-residual test rejects in 100.0%; mean residual +0.0025 (plim +0.0026). Method-factor slope m-hat mean 0.012 (plim 0.000). Plan's IT x S check: at least one IT item flagged in 100.0%; flag rate by item IT1 84%, IT2 81%, IT3 74%, IT4 63%, IT5 40%, IT6 28%; IT items wrong: standard 0.0%, plan's rule 0.0% (undetermined 26.3%); false in: standard 0.0%, plan's rule 0.0%. Method-factor model, identification diagnostic over content parameters (median) 0.0854.
- cross_c0.2: IT x S mean-residual test rejects in 100.0%; mean residual +0.0029 (plim +0.0029). Method-factor slope m-hat mean 0.010 (plim 0.000). Plan's IT x S check: at least one IT item flagged in 100.0%; flag rate by item IT1 100%, IT2 99%, IT3 97%, IT4 92%, IT5 89%, IT6 75%; IT items wrong: standard 0.3%, plan's rule 0.0% (undetermined 40.2%); false in: standard 0.7%, plan's rule 0.0%. Method-factor model, identification diagnostic over content parameters (median) 0.0842. Standard fit, items classified in although out: IT3 2%.
- cross_c0.3: IT x S mean-residual test rejects in 85.0%; mean residual +0.0012 (plim +0.0013). Method-factor slope m-hat mean 0.012 (plim 0.000). Plan's IT x S check: at least one IT item flagged in 100.0%; flag rate by item IT1 100%, IT2 100%, IT3 100%, IT4 99%, IT5 95%, IT6 82%; IT items wrong: standard 14.2%, plan's rule 1.5% (undetermined 48.5%); false in: standard 28.3%, plan's rule 3.0%. Method-factor model, identification diagnostic over content parameters (median) 0.0840. Standard fit, items classified in although out: IT2 7%, IT3 78%.
- acq_registered_a0.25: IT x S mean-residual test rejects in 0.0%; mean residual -0.0005 (plim -0.0004). Method-factor slope m-hat mean 0.249 (plim 0.250). Plan's IT x S check: at least one IT item flagged in 42.0%; flag rate by item IT1 10%, IT2 13%, IT3 13%, IT4 7%, IT5 7%, IT6 4%; IT items wrong: standard 0.0%, plan's rule 0.0% (undetermined 27.8%); false in: standard 0.0%, plan's rule 0.0%. Method-factor model, identification diagnostic over content parameters (median) 0.0897.
- acq_registered_a0.4: IT x S mean-residual test rejects in 0.0%; mean residual -0.0017 (plim -0.0017). Method-factor slope m-hat mean 0.400 (plim 0.400). Plan's IT x S check: at least one IT item flagged in 98.0%; flag rate by item IT1 66%, IT2 56%, IT3 41%, IT4 27%, IT5 67%, IT6 86%; IT items wrong: standard 0.0%, plan's rule 0.0% (undetermined 33.2%); false in: standard 0.0%, plan's rule 0.0%. Method-factor model, identification diagnostic over content parameters (median) 0.0910.
- acq_registered_a0.55: IT x S mean-residual test rejects in 3.0%; mean residual -0.0009 (plim -0.0009). Method-factor slope m-hat mean 0.549 (plim 0.550). Plan's IT x S check: at least one IT item flagged in 100.0%; flag rate by item IT1 92%, IT2 73%, IT3 73%, IT4 95%, IT5 100%, IT6 100%; IT items wrong: standard 1.3%, plan's rule 1.2% (undetermined 47.2%); false in: standard 2.7%, plan's rule 2.3%. Method-factor model, identification diagnostic over content parameters (median) 0.0928. Standard fit, items classified in although out: IT3 8%.
- acq_balanced_a0.25: IT x S mean-residual test rejects in 0.0%; mean residual -0.0023 (plim -0.0022). Method-factor slope m-hat mean 0.250 (plim 0.250). Plan's IT x S check: at least one IT item flagged in 100.0%; flag rate by item IT1 100%, IT2 100%, IT3 100%, IT4 100%, IT5 100%, IT6 100%; IT items wrong: standard 0.2%, plan's rule 0.2% (undetermined 17.7%); false in: standard 0.0%, plan's rule 0.0%. Method-factor model, identification diagnostic over content parameters (median) 0.0874.
- acq_balanced_a0.4: IT x S mean-residual test rejects in 0.0%; mean residual -0.0069 (plim -0.0066). Method-factor slope m-hat mean 0.400 (plim 0.400). Plan's IT x S check: at least one IT item flagged in 100.0%; flag rate by item IT1 100%, IT2 100%, IT3 100%, IT4 100%, IT5 100%, IT6 100%; IT items wrong: standard 5.0%, plan's rule 5.0% (undetermined 44.8%); false in: standard 0.0%, plan's rule 0.0%. Method-factor model, identification diagnostic over content parameters (median) 0.0840.
- acq_balanced_a0.55: IT x S mean-residual test rejects in 70.0%; mean residual +0.0012 (plim +0.0093). Method-factor slope m-hat mean 0.550 (plim 0.550). Plan's IT x S check: at least one IT item flagged in 100.0%; flag rate by item IT1 100%, IT2 100%, IT3 100%, IT4 100%, IT5 100%, IT6 100%; IT items wrong: standard 36.0%, plan's rule 32.7% (undetermined 41.8%); false in: standard 69.0%, plan's rule 62.3%. Method-factor model, identification diagnostic over content parameters (median) 0.0816. Standard fit, items classified in although out: ID1 69%, ID2 63%, ID3 70%, ID4 65%, ID5 70%, ID6 68%, IT1 70%, IT2 67%, IT3 70%.
- acq_registered_a0.4_het: IT x S mean-residual test rejects in 0.0%; mean residual -0.0019 (plim -0.0018). Method-factor slope m-hat mean 0.410 (plim 0.410). Plan's IT x S check: at least one IT item flagged in 100.0%; flag rate by item IT1 60%, IT2 100%, IT3 100%, IT4 100%, IT5 99%, IT6 100%; IT items wrong: standard 0.0%, plan's rule 0.0% (undetermined 21.0%); false in: standard 0.0%, plan's rule 0.0%. Method-factor model, identification diagnostic over content parameters (median) 0.1047.

## X7: the revised DIF screen (BH only) end to end

The X2 data sets (same seeds), R = 100 per kappa; wall 28 s, CPU 56 s.

| kappa | anchors | flag I1 | flag I2 | flag I3 | DIF-free flag rate | any false flag | mu_G bias (cov.) | mu_I bias (cov.) | ECV_I3 bias ref. | ECV_I3 bias focal | BH flags = X2 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 0.0 | correct | 1% | 1% | 0% | 0.8% | 5% | -0.003 (95%) | -0.003 (97%) | -0.001 | +0.000 | 100% |
| 0.0 | contam1 | anchor | 1% | 2% | 0.6% | 4% | -0.003 (95%) | -0.002 (97%) | -0.001 | +0.000 | 100% |
| 0.0 | contam2 | anchor | anchor | 1% | 0.2% | 2% | -0.003 (95%) | -0.002 (97%) | -0.000 | -0.000 | 100% |
| 0.2 | correct | 94% | 98% | 41% | 3.6% | 17% | -0.004 (96%) | -0.002 (87%) | -0.020 | +0.042 | 100% |
| 0.2 | contam1 | anchor | 59% | 99% | 22.8% | 86% | -0.056 (81%) | +0.302 (3%) | +0.023 | +0.014 | 100% |
| 0.2 | contam2 | anchor | anchor | 99% | 38.7% | 99% | +0.027 (90%) | +0.348 (1%) | +0.007 | +0.003 | 100% |
| 0.4 | correct | 100% | 100% | 100% | 2.8% | 13% | -0.006 (98%) | +0.008 (95%) | +0.009 | -0.002 | 100% |
| 0.4 | contam1 | anchor | 99% | 100% | 37.8% | 100% | -0.123 (42%) | +0.703 (0%) | +0.054 | +0.018 | 100% |
| 0.4 | contam2 | anchor | anchor | 100% | 47.0% | 100% | +0.070 (77%) | +0.739 (0%) | -0.007 | -0.009 | 100% |
| 0.6 | correct | 100% | 100% | 100% | 1.6% | 8% | +0.000 (95%) | -0.000 (94%) | +0.000 | +0.002 | 100% |
| 0.6 | contam1 | anchor | 100% | 100% | 40.8% | 100% | -0.158 (25%) | +1.032 (0%) | +0.065 | +0.015 | 100% |
| 0.6 | contam2 | anchor | anchor | 100% | 48.6% | 100% | +0.084 (74%) | +1.088 (0%) | -0.027 | -0.003 | 100% |

- kappa = 0.0, correct anchors: focal ECV_I3 bias when I3 is not flagged +0.000 (n = 100), when flagged -. Share of flagged items described as small DIF (latent-averaged expected-score difference < 0.25): S7 100%, S8 100%, I1 100%, I2 100%, I4 100%.
- kappa = 0.2, correct anchors: focal ECV_I3 bias when I3 is not flagged +0.077 (n = 59), when flagged -0.009. Share of flagged items described as small DIF (latent-averaged expected-score difference < 0.25): S5 100%, S6 100%, S7 100%, S8 100%, I1 45%, I2 50%, I3 100%, I4 100%.

## X8: identification of the threshold shift delta_j by the list experiment

Item I4 of the X1 bank; two groups of 3000; arms D/C/T in equal thirds; R = 300 per scenario; wall 20 s. delta in SDs of the item's reference latent response.

| scenario | group | true delta | bias (MCSE) | SD | mean SE | cov. | meas. share of var. | true SDB | SDB bias | SDB SD | test of common shift |
|---|---|---|---|---|---|---|---|---|---|---|---|
| uniform | 0 | 0.40 | +0.000 (0.009) | 0.153 | 0.149 | 94.3% | 16% | 0.073 | +0.0010 | 0.0326 | 3.0% |
| uniform | 1 | 0.40 | -0.003 (0.006) | 0.109 | 0.109 | 95.7% | 19% | 0.112 | -0.0003 | 0.0341 |  |
| uniform | pooled | | +0.007 | 0.090 | | 93.3% | | | | | |
| group_specific | 0 | 0.40 | +0.001 (0.009) | 0.150 | 0.148 | 95.7% | 16% | 0.073 | +0.0020 | 0.0324 | 58.0% |
| group_specific | 1 | 0.80 | -0.003 (0.006) | 0.108 | 0.115 | 96.7% | 27% | 0.186 | -0.0018 | 0.0316 |  |
| nonuniform | 0 | 0.40 | +0.006 (0.009) | 0.153 | 0.148 | 95.3% | 16% | 0.073 | +0.0028 | 0.0328 | 14.0% |
| nonuniform | 1 | 0.40 | -0.149 (0.007) | 0.116 | 0.119 | 78.7% | 17% | 0.112 | -0.0453 | 0.0328 |  |

## X9: tests of within-domain heterogeneity (rule D2(ii))

Registered sizes (10 S, 14 I items). R = {'6000': 400, '1500': 200}; wall 146 s. Rejection rates at 5% per domain (joint tetrad Wald test; residual-based one-factor test; intersection-union test; earlier Bonferroni rule over 3633 tetrads). D2(ii) = either domain, joint and IUT at 2.5% per domain.

| config | n | S joint | S resid | S IUT | S earlier | I joint | I resid | I IUT | I earlier | D2 joint | D2 IUT | D2 earlier |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| prop (null) | 1500 | 9.0% | 6.5% | 0.5% | 0.5% | 11.0% | 10.0% | 1.0% | 4.0% | 13.0% | 0.0% | 4.5% |
| prop (null) | 6000 | 5.0% | 5.0% | 0.0% | 0.8% | 6.0% | 5.8% | 0.2% | 4.2% | 5.8% | 0.2% | 5.0% |
| one_off (null) | 1500 | 8.0% | 5.5% | 0.0% | 0.0% | 14.5% | 12.0% | 2.5% | 2.0% | 12.5% | 1.5% | 2.0% |
| one_off (null) | 6000 | 5.5% | 5.2% | 0.0% | 0.5% | 6.5% | 6.0% | 1.0% | 4.8% | 5.2% | 0.5% | 5.0% |
| two_off | 1500 | 69.5% | 66.0% | 4.5% | 68.5% | 54.0% | 57.0% | 2.5% | 70.0% | 75.0% | 4.0% | 92.5% |
| two_off | 6000 | 100.0% | 100.0% | 3.0% | 100.0% | 100.0% | 100.0% | 3.5% | 100.0% | 100.0% | 3.2% | 100.0% |
| near | 1500 | 12.0% | 8.0% | 0.0% | 2.0% | 14.0% | 11.5% | 1.5% | 5.0% | 13.0% | 0.5% | 7.0% |
| near | 6000 | 8.0% | 7.0% | 0.2% | 1.0% | 6.2% | 6.2% | 0.5% | 4.0% | 7.0% | 0.0% | 5.0% |
| het | 1500 | 82.5% | 79.0% | 30.0% | 52.0% | 100.0% | 100.0% | 99.5% | 100.0% | 100.0% | 100.0% | 100.0% |
| het | 6000 | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% |

