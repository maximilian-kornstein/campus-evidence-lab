"""hawkes: multivariate exponential-kernel Hawkes processes with exogenous
shocks, for Paper 2 ("Shock and Contagion") of the Kornstein Lab.

Modules
-------
model        HawkesSpec, backgrounds, spectral radius, multiplier, stationary mean
simulate     exact simulation (cluster / Ogata), branching labels, shot-noise Cox
likelihood   exact O(n) log-likelihood, intensity, compensator
em           EM via the latent branching structure (const / spline background, shocks)
tests_alpha  boundary LRT for alpha_kj = 0 (chi-bar-square), Davies sup-LR bootstrap
rescaling    time-rescaling KS goodness of fit
inar         INAR(p) / Poisson autoregression on binned counts, Kirchner mapping
attribution  surge decomposition (background / direct / contagion), IRFs, spillover
alert        predictive count distribution, cost-optimal alert threshold
thinning     under-reporting formulas, spurious contagion, second-order helpers

See code/README.md for the API.
"""

from .model import (
    BSplineBasis,
    FourierBasis,
    FunctionBackground,
    HawkesSpec,
    LogLinearBackground,
    PiecewiseConstant,
    merge_events,
    multiplier,
    spectral_radius,
    stationary_mean,
)
from .simulate import cluster_info, simulate, simulate_shot_noise_cox
from .likelihood import compensator, intensity, loglik
from .em import FitResult, decluster, fit_em
from .tests_alpha import chibar_pvalue, lrt_alpha_zero, lrt_alpha_zero_sup
from .rescaling import rescaled_intervals, time_rescale_ks
from .inar import bin_counts, fit_inar, inar_to_hawkes
from .attribution import decompose_surge, expected_counts, impulse_response, spillover
from .alert import (
    alert_rule_intensity,
    exceedance_probability,
    optimal_alert_threshold,
    predictive_count_dist,
)
from .thinning import (
    apparent_beta,
    apparent_branching,
    correct_thinning,
    inverse_apparent_branching,
    spurious_branching,
    thin,
)

__version__ = "1.0.0"

__all__ = [
    "BSplineBasis",
    "FourierBasis",
    "FunctionBackground",
    "HawkesSpec",
    "LogLinearBackground",
    "PiecewiseConstant",
    "merge_events",
    "multiplier",
    "spectral_radius",
    "stationary_mean",
    "cluster_info",
    "simulate",
    "simulate_shot_noise_cox",
    "compensator",
    "intensity",
    "loglik",
    "FitResult",
    "decluster",
    "fit_em",
    "chibar_pvalue",
    "lrt_alpha_zero",
    "lrt_alpha_zero_sup",
    "rescaled_intervals",
    "time_rescale_ks",
    "bin_counts",
    "fit_inar",
    "inar_to_hawkes",
    "decompose_surge",
    "expected_counts",
    "impulse_response",
    "spillover",
    "alert_rule_intensity",
    "exceedance_probability",
    "optimal_alert_threshold",
    "predictive_count_dist",
    "apparent_beta",
    "apparent_branching",
    "correct_thinning",
    "inverse_apparent_branching",
    "spurious_branching",
    "thin",
]
