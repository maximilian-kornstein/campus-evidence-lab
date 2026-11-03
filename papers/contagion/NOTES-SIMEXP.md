# NOTES-SIMEXP: simulation-study notes for SIM-CORE and the section writers

Owner: SIM-EXP. These are observations about `code/hawkes/*` made while running the
simulation study. `code/hawkes/*` was not edited; each item says how
`code/run_experiments.py` works around it. None of them is a correctness bug in the
library; items 1-3 are API or performance gaps, item 4 is a property of the
likelihood that readers of the results need to know.

## 1. No public predictive simulation from a given (nowcast) state

`predictive_count_dist(spec, history_events, t, ...)` computes the excitation state
from an unweighted history. The Horvitz-Thompson nowcast of prop:nowcast(b) needs the
continuation from a *weighted* state `E_kj = sum_i w_i alpha_kj beta_kj exp(-beta_kj (t - s_i))`.

*Workaround.* E6 builds the HT state itself (`run_experiments._ht_state`) and calls the
private `hawkes.alert._future_counts(spec, E, t, Delta, n_sim, rng)`.

*Proposal (minimal).* Expose it:

```python
def predictive_count_dist_from_state(spec, E, t, Delta, n_sim=10000, rng=None,
                                     include_future_shocks=False):
    """Like predictive_count_dist, but from a given (M, M) excitation state E(t)."""
    return _future_counts(spec, np.asarray(E, float), t, Delta, n_sim, as_rng(rng),
                          include_future_shocks)
```

and optionally a `weights=` argument (list of per-event arrays) on `excitation_state`.

## 2. `simulate_shot_noise_cox(return_shots=True)` drops the pre-sample shots

The function simulates shots back to `-40/gamma` but returns only `shots[shots >= 0]`.
Shots before 0 still generate events in [0, T], so a "shocks known" fit (cor:equiv-id)
built from the returned shots is misspecified near t = 0.

*Workaround.* E2 simulates the same law as `HawkesSpec(M=1, mu=nu, alpha=0,
shocks=[(s, 1) for all shots s in [-burn, T]], shock_beta=m, shock_rate=gamma)` with
`simulate`, which handles shocks with tau < 0, and passes the full shot list (including
tau < 0) to `fit_em`.

*Proposal.* Return all simulated shots (or add `return_all_shots=True`).

## 3. EM E-step cost is O(n E) with E known shocks

`_Problem` stores dense (n_k x E) arrays for the shock terms. With a few hundred shocks
and ~2000 events a fit takes 10-20 s on the shared machine (e.g. 16 s for 397 shocks),
against ~0.4 s without shocks.

*Workaround.* E2 fits the shocks-known model only where the expected number of shots
is at most about 130 (all "rare" configurations; "frequent" only for kappa <= 1). The
configurations are listed in `results/sim_results.json` (E2 config, `shocks_max_kappa`).

*Proposal (performance only).* The M-step uses only sums over shocks
(`Nsh.sum(axis=1)`-type totals and the lag-weighted totals for eta), so with a common
eta the shock term can use the same exponential recursion as `DecaySums`, with weights
S_e, at O(n + E).

## 4. The decay rate can run to its lower bound (weak identification of alpha)

When excitation is absent or very weak, the likelihood has a ridge with
beta -> 0 and alpha -> large such that the in-window offspring mass
alpha * mean(1 - exp(-beta (T - t_l))) stays small. `fit_em`'s multistart then sometimes
returns beta at the lower bound 0.01/T and a large alpha, e.g. alpha = 7.6, beta = 1e-5 on
a no-contagion dataset with the shocks known (pilot run). This is a property of the model,
not a code bug, but `alpha` alone is then not a usable estimate of n.

*How the results handle it.* E2 reports, for every fit, both `alpha` (= n_hat) and
`n_eff` = alpha * mean(1 - exp(-beta (T - t_l))), the share of events EM attributes to
self-excitation (equal to n_hat up to edge effects when beta_hat T is large), and the
fraction of fits with beta_hat at the lower bound. The shocks-known results are read
on `n_eff`.

*Proposal.* Report `n_eff` in `FitResult.info`, and consider a default lower bound for
beta tied to the window (e.g. 1/T) for applied use, documented as a modelling choice.
