# Simulation study — summary of run 1 (SIM-WORLD)

> **Superseded.** A code audit (2026-11-03) found pipeline issues: no linkage variance in corrected intervals, non-posterior MI draws, Rubin's rules on the wrong scale, mean-based summaries dominated by blow-ups, and short LCMCR chains. A corrected run (run 2) replaces these numbers. Kept for the record.

Source: `results/sim_results.json` (run 1), started 2026-11-03T20:27:34Z. 1,640 worlds, 1,271 s wall, base seed 20261103. Python 3.13.18, numpy 2.5.3, scipy 1.18.1. All data synthetic.

## Design
- N = 2000 incidents, 30 counties, K = 4 lists (police, NGO, CSO, portal).
- Capture models: independent; 3 latent classes (0.15/0.35/0.50); latent classes with covariates.
- Referral: the NGO ingests police captures with probability q.
- Record noise ν: dates, county, type, venue typos, hour, duplicates with probability 0.04ν.
- Linkage: blocking ±14 days and county adjacency; FS-EM with 3 classes; within-list dedup; greedy clustering at posterior 0.5 with one record per list.
- Review: B = 300 pairs, Neyman allocation. MI: 20 Bernoulli(π) draws.

## Headline results (mean relative bias of N̂; coverage of 95% intervals)
- **S1** (independence, clean): oracle within ±0.6%, coverage 0.95–0.98. The closed form is heavy-tailed: mean +8.6%, median −0.1%.
- **S2** (heterogeneity): LP −39.0%, Chao −19.9%, BMA −12.0% (coverage 0.26), LCMCR −10.1% (coverage 0.78).
- **S3** (referral q = 0.5): LP −38.9%; dropping referrals by provenance gives −0.9% (coverage 0.93); BMA −0.1%; LCMCR −0.3%.
- **S4** (heterogeneity + noise): naive BMA +39.2%; the LE-corrected BMA is worse at +72.2%; the ε = 0 post-hoc variant gives −3.1%. The review δ̂, ε̂ match the realised rates.
- **S5** (noise sweep): the LE correction fails at ν ≥ 0.5 because errors are swap-dominated (best-fit ε* = 0).
- **S6**: the ω-bands [n̂₀(−1), n̂₀(1)] contain n₀ in 87–98% of replicates.
- **S7** (referral sweep): provenance-drop LP is unbiased for every q; BMA fails at q = 1 (structural zero).
