"""Item banks used by the simulation study (all parameters synthetic).

S block (8 classic-stereotype items): item-level ECVs 0.45-0.90 and communalities
0.50-0.60, so that the S block's specific loadings are NOT proportional to its G loadings
(the loading condition of the identification analysis; see `x1_bank(prop_S=True)` for the
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


def x1_bank(n_I: int, prop_S: bool = False) -> gen.Bank:
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


# ---- X2: two groups, DIF on Israel-related items -------------------------------------
X2_MU1 = np.array([0.30, 0.00, 0.30])     # focal-group latent means (G, S, I); reference = 0
X2_UNIFORM = (8, 9)                       # I1, I2: uniform DIF (thresholds lowered in focal group)
X2_NONUNIFORM = (10,)                     # I3: non-uniform DIF (G slope multiplied by 1 - 1.25 kappa)
X2_TRUE_DIF = X2_UNIFORM + X2_NONUNIFORM
X2_ANCHORS = {
    "correct": (0, 1, 2, 3, 12, 13),      # S1-S4, I5, I6 (all DIF-free)
    "contam1": (0, 1, 2, 3, 8, 13),       # I5 replaced by I1 (uniform DIF)
    "contam2": (0, 1, 2, 3, 8, 9),        # both I anchors have uniform DIF
}


def x2_banks(kappa: float):
    """(reference bank, focal bank) for DIF magnitude kappa.

    Uniform DIF: b_jc^(1) = b_jc^(0) - kappa * sd_j with sd_j = sqrt(1 + a_jG^2 + a_js^2), i.e. a
    shift of kappa SDs of the reference group's latent response.  Non-uniform DIF:
    a_jG^(1) = (1 - 1.25 kappa) a_jG^(0)."""
    bank = x1_bank(6)
    sd = np.sqrt(1 + bank.aG ** 2 + bank.aS ** 2)
    b1 = gen.with_dif(bank, uniform={j: -kappa * sd[j] for j in X2_UNIFORM},
                      nonuniform={j: (1 - 1.25 * kappa, 1.0) for j in X2_NONUNIFORM})
    return bank, b1


# ---- registered-size item bank (sec:design-items: 10 S items, 8 ID + 6 IT items) -----------
# ID = Israel-related items in the disputed categories (called IP, "policy criticism", in the first draft).
# Synthetic parameters chosen to test the methods; not calibrated to any survey.
REG_ECV_S = np.array([0.85, 0.45, 0.75, 0.55, 0.90, 0.50, 0.80, 0.60, 0.70, 0.65])
REG_H2_S = np.array([0.55, 0.50, 0.60, 0.50, 0.55, 0.60, 0.50, 0.55, 0.55, 0.50])
REG_ECV_ID = np.array([0.10, 0.15, 0.20, 0.25, 0.30, 0.40, 0.60, 0.70])
REG_ECV_IT = np.array([0.35, 0.40, 0.45, 0.60, 0.75, 0.85])
REG_H2_I = 0.50
REG_N_S, REG_N_ID, REG_N_IT = 10, 8, 6
REG_IDX_S = np.arange(0, 10)
REG_IDX_ID = np.arange(10, 18)
REG_IDX_IT = np.arange(18, 24)
REG_REVERSED = (1, 6, 11, 15)          # registered keying: 4 reverse-keyed items, 2 in S (S2, S7) and 2 in ID (ID2, ID6)
REG_BALANCED = (1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23)   # balanced keying: half of every block (S 5/10, ID 4/8, IT 3/6)


def reg_names():
    return ([f"S{j + 1}" for j in range(REG_N_S)] + [f"ID{j + 1}" for j in range(REG_N_ID)]
            + [f"IT{j + 1}" for j in range(REG_N_IT)])


def reg_standardised(ecv_S=None, h2_S=None, ecv_I=None, h2_I=REG_H2_I):
    """Standardised (lam_G, lam_s), spec and names of the registered-size bank."""
    ecv_S = REG_ECV_S if ecv_S is None else np.asarray(ecv_S, float)
    h2_S = REG_H2_S if h2_S is None else h2_S
    ecv_I = np.r_[REG_ECV_ID, REG_ECV_IT] if ecv_I is None else np.asarray(ecv_I, float)
    lgS, lsS = gen.loadings_from_ecv(ecv_S, h2_S)
    lgI, lsI = gen.loadings_from_ecv(ecv_I, h2_I)
    spec = np.r_[np.ones(len(ecv_S), int), 2 * np.ones(len(ecv_I), int)]
    return np.r_[lgS, lgI], np.r_[lsS, lsI], spec


def reg_thresholds(J):
    return gen.base_thresholds(J, np.linspace(-0.3, 0.3, J))


def reg_bank(**kw) -> gen.Bank:
    lg, ls, spec = reg_standardised(**kw)
    J = len(spec)
    names = reg_names() if J == 24 else [f"S{j + 1}" for j in range(int(np.sum(spec == 1)))] + \
        [f"I{j + 1}" for j in range(int(np.sum(spec == 2)))]
    return gen.bank_from_standardised(lg, ls, spec, reg_thresholds(J), names)


def x6_crossload(c):
    """X6(a): the trope-based items IT1-IT6 also load on S with standardised loading c (their G and
    I loadings unchanged, so their own-domain ECV_j = lam_G^2 / (lam_G^2 + lam_I^2) is unchanged).
    Returns (A (24, 3) slopes on (G, S, I), b (24, 4), spec, true own-domain ECVs)."""
    lg, ls, spec = reg_standardised()
    L = np.zeros((24, 3))
    L[:, 0] = lg
    L[np.arange(24), spec] = ls
    L[REG_IDX_IT, 1] = c
    A = gen.slopes_from_standardised(L)
    sd = np.sqrt(1 + np.sum(A ** 2, axis=1))
    b = reg_thresholds(24) * sd[:, None]          # standardised thresholds as in the base bank
    return A, b, spec, lg ** 2 / (lg ** 2 + ls ** 2)


X6_HETERO_PATTERN = np.resize(np.array([0.5, 1.5, 1.0, 0.75, 1.25]), 24)   # item multipliers of alpha (mean 1)


def x6_acquiescence(alpha, keying, hetero=False):
    """X6(b): an acquiescence factor M (orthogonal, unit variance) added to the registered bank, with slope
    +alpha on every positively worded item and -alpha on every reverse-keyed item, after reverse-scoring
    (so content loadings are positive for every item).  This is the random-intercept method factor of
    Maydeu-Olivares and Coffman (2006) on the slope scale.  hetero=True multiplies alpha by item-specific
    factors 0.5-1.5 (X6_HETERO_PATTERN), which the one-parameter method factor does not represent.  The content slopes, and hence every
    ECV_j = a_jG^2 / (a_jG^2 + a_js^2), are those of the base bank.  keying in {"registered", "balanced"}.
    Returns (A (24, 4) on (G, S, I, M), b, spec, true ECVs, keying signs k_j)."""
    lg, ls, spec = reg_standardised()
    rev = REG_REVERSED if keying == "registered" else REG_BALANCED
    k = np.ones(24)
    k[list(rev)] = -1.0
    L = np.zeros((24, 3))
    L[:, 0] = lg
    L[np.arange(24), spec] = ls
    mult = X6_HETERO_PATTERN if hetero else np.ones(24)
    A = np.c_[gen.slopes_from_standardised(L), alpha * mult * k]
    sd = np.sqrt(1 + np.sum(A ** 2, axis=1))
    b = reg_thresholds(24) * sd[:, None]
    return A, b, spec, lg ** 2 / (lg ** 2 + ls ** 2), k


def std_method_loading(A):
    """Standardised loadings on the last column of a slope matrix (orthogonal unit-variance factors)."""
    return A[:, -1] / np.sqrt(1 + np.sum(A ** 2, axis=1))


# ---- X9: banks for the intersection-union tetrad test of D2(ii) ------------------------------
X9_CONFIGS = {
    # name: (ECV_S (10), ECV_I (14)); communalities as in the registered bank
    "prop": (np.full(10, 0.70), np.full(14, 0.45)),
    "one_off": (np.r_[np.full(9, 0.70), 0.20], np.r_[np.full(13, 0.45), 0.90]),
    "two_off": (np.r_[np.full(8, 0.70), 0.30, 0.30], np.r_[np.full(12, 0.45), 0.85, 0.85]),
    "near": (np.array([0.74, 0.66, 0.72, 0.68, 0.75, 0.65, 0.73, 0.67, 0.71, 0.69]),
             np.array([0.38, 0.52, 0.40, 0.50, 0.42, 0.48, 0.44, 0.46, 0.39, 0.51, 0.41, 0.49, 0.43, 0.47])),
    "het": (REG_ECV_S, np.r_[REG_ECV_ID, REG_ECV_IT]),
}


def x9_bank(cfg):
    eS, eI = X9_CONFIGS[cfg]
    return reg_bank(ecv_S=eS, ecv_I=eI)


# ---- X2b: ideology-type DIF on the stereotype anchors ------------------------------------------
X2B_S_DIF_ITEMS = (0, 1)                # S1, S2: thresholds lowered by kappa_S SDs in the focal group


def x2b_banks(kappa_I: float, kappa_S: float):
    """(reference, focal) banks: the X2/X2 Israel-item DIF at kappa_I plus uniform DIF of kappa_S latent-
    response SDs on two of the four stereotype anchors (S1, S2), in the same direction."""
    b0, b1 = x2_banks(kappa_I)
    sd = np.sqrt(1 + b0.aG ** 2 + b0.aS ** 2)
    b1 = gen.with_dif(b1, uniform={j: -kappa_S * sd[j] for j in X2B_S_DIF_ITEMS})
    return b0, b1
