"""darkfig: multiple-systems estimation of the dark figure of antisemitic hate crime.

Code for the simulation study of "The Dark Figure" (Kornstein Lab).  This
package's estimator half (SIM-EST) provides:

* :mod:`darkfig.estimators`  -- the public estimator API (SPEC "Estimator API")
* :mod:`darkfig.loglinear`   -- capture-table utilities, Poisson IRLS, model enumeration
* :mod:`darkfig.lcmcr`       -- Gibbs sampler for the DP latent-class model (Manrique-Vallier 2016)
* :mod:`darkfig.linkerror`   -- the canonical linkage-error operator T(delta, eps)

The world / linkage / pipeline modules are maintained separately (SIM-WORLD).
"""

from .estimators import (
    Estimate,
    chao_lower_bound,
    lcmcr,
    lincoln_petersen,
    linkage_corrected,
    loglinear_bma,
    loglinear_closed_form,
    loglinear_model,
)
from .linkerror import detachment_matrix, expected_observed, simulate_observed
from .loglinear import array_to_table, collapse, frequency_counts, histories, table_to_array

__all__ = [
    "Estimate",
    "lincoln_petersen",
    "loglinear_closed_form",
    "loglinear_model",
    "loglinear_bma",
    "chao_lower_bound",
    "lcmcr",
    "linkage_corrected",
    "detachment_matrix",
    "expected_observed",
    "simulate_observed",
    "histories",
    "table_to_array",
    "array_to_table",
    "collapse",
    "frequency_counts",
]
