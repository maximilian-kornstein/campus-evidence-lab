"""Item banks used by the simulation study (all parameters synthetic).

S block (8 classic-stereotype items): item-level ECVs 0.45-0.90 and communalities
0.50-0.60, so that the S block's specific loadings are NOT proportional to its G loadings
(the loading condition of the identification analysis; see `e1_bank(prop_S=True)` for the
proportional counter-example).
I block (Israel-related items), in order: ECV = 0.25, 0.75, 0.40, 0.60, 0.15, 0.85 with
communality 0.5; the 2- and 3-item designs use the first 2 and 3 of these, so the true
boundary set at tau = 0.5 is {2nd} (n_I = 2, 3) or {2nd, 4th, 6th} (n_I = 6).
Thresholds: marginal proportions (0.30, 0.30, 0.20, 0.12, 0.08) on a five-point scale,
shifted by -0.3..0.3 SD across items.
"""
from __future__ import annotations

import numpy as np

from . import generate as gen

ECV_S = np.array([0.85, 0.45, 0.75, 0.55, 0.90, 0.50, 0.80, 0.60])
H2_S = np.array([0.55, 0.50, 0.60, 0.50, 0.55, 0.60, 0.50, 0.55])
ECV_I = np.array([0.25, 0.75, 0.40, 0.60, 0.15, 0.85])
H2_I = 0.5
ECV_S_PROP = 0.70        # proportional S block: every S item has ECV 0.70 (lam_S / lam_G constant)
H2_S_PROP = 0.55


def e1_bank(n_I: int, prop_S: bool = False) -> gen.Bank:
    if prop_S:
        lgS, lsS = gen.loadings_from_ecv(np.full(8, ECV_S_PROP), H2_S_PROP)
    else:
        lgS, lsS = gen.loadings_from_ecv(ECV_S, H2_S)
    lgI, lsI = gen.loadings_from_ecv(ECV_I[:n_I], H2_I)
    spec = np.r_[np.ones(8, int), 2 * np.ones(n_I, int)]
    J = len(spec)
    names = [f"S{j + 1}" for j in range(8)] + [f"I{j + 1}" for j in range(n_I)]
    return gen.bank_from_standardised(np.r_[lgS, lgI], np.r_[lsS, lsI], spec,
                                      gen.base_thresholds(J, np.linspace(-0.3, 0.3, J)), names)


# ---- E2: two groups, DIF on Israel-related items -------------------------------------
E2_MU1 = np.array([0.30, 0.00, 0.30])     # focal-group latent means (G, S, I); reference = 0
E2_UNIFORM = (8, 9)                       # I1, I2: uniform DIF (thresholds lowered in focal group)
E2_NONUNIFORM = (10,)                     # I3: non-uniform DIF (G slope multiplied by 1 - 1.25 kappa)
E2_TRUE_DIF = E2_UNIFORM + E2_NONUNIFORM
E2_ANCHORS = {
    "correct": (0, 1, 2, 3, 12, 13),      # S1-S4, I5, I6 (all DIF-free)
    "contam1": (0, 1, 2, 3, 8, 13),       # I5 replaced by I1 (uniform DIF)
    "contam2": (0, 1, 2, 3, 8, 9),        # both I anchors have uniform DIF
}


def e2_banks(kappa: float):
    """(reference bank, focal bank) for DIF magnitude kappa.

    Uniform DIF: b_jc^(1) = b_jc^(0) - kappa * sd_j with sd_j = sqrt(1 + a_jG^2 + a_js^2), i.e. a
    shift of kappa SDs of the reference group's latent response.  Non-uniform DIF:
    a_jG^(1) = (1 - 1.25 kappa) a_jG^(0)."""
    bank = e1_bank(6)
    sd = np.sqrt(1 + bank.aG ** 2 + bank.aS ** 2)
    b1 = gen.with_dif(bank, uniform={j: -kappa * sd[j] for j in E2_UNIFORM},
                      nonuniform={j: (1 - 1.25 * kappa, 1.0) for j in E2_NONUNIFORM})
    return bank, b1
