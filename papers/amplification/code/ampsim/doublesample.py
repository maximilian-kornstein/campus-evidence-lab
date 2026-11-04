"""Double-sampled exposure of a puppet (sec:prot-validation, thm:misclass(d)) and its closed-form variance
(sec:prot-power), for the registered primary analysis (E5b).

A puppet's record is summarised by impression counts by (true type, score band), cnt (..., 20), and the
counts of the positions it opened, opn (..., 20) (index type * 5 + band; bands 3, 4 are flagged). Its
recorded positions are split into the strata of sec:prot-validation:
    F   flagged positions (bands 3, 4): m codes, uniformly without replacement (all if fewer);
    O   positions of items the puppet opened (all unflagged under the avoid-on-flag rule): m_open codes;
    h   the other unflagged positions, by score band h = 0, 1, 2: m_unf codes in all, allocated over the bands
        in proportion to n_h * s_h (Neyman 1934, s_h a design input), at least one per non-empty band.
Within a stratum the coded positions are a simple random sample, so the number of true positives among them
is hypergeometric. The double-sampled exposure is
    E~_u = (n_F p_F + n_O p_O + sum_h n_h p_h) / N,
with p the share of coded positions with L = 1 in each stratum. Given the record it is unbiased for the
puppet's true exposure E_u = (positions with L = 1) / N, and it lies in [0, 1].
"""
from __future__ import annotations

import numpy as np

from .world import N_BANDS, N_TYPES

N_UNF_BANDS = 3          # unflagged score bands 0, 1, 2


def strata(cnt, opn):
    """Per-puppet stratum sizes and true-positive counts. cnt, opn: (..., 20) integer arrays."""
    c = np.asarray(cnt, np.int64).reshape(np.shape(cnt)[:-1] + (N_TYPES, N_BANDS))
    o = np.asarray(opn, np.int64).reshape(np.shape(opn)[:-1] + (N_TYPES, N_BANDS))
    pos, tot = c[..., 2:, :].sum(-2), c.sum(-2)          # (..., 5): L = 1, all
    opos, otot = o[..., 2:, :].sum(-2), o.sum(-2)
    return dict(N=tot.sum(-1), E=pos.sum(-1) / np.maximum(tot.sum(-1), 1),
                nF=tot[..., 3:].sum(-1), aF=pos[..., 3:].sum(-1),
                nO=otot[..., :3].sum(-1), aO=opos[..., :3].sum(-1), nO_flagged=otot[..., 3:].sum(-1),
                nB=tot[..., :3] - otot[..., :3], aB=pos[..., :3] - opos[..., :3])


def neyman_alloc(n, s, total, floor=1):
    """Allocate `total` codes over strata of sizes n (M, H) in proportion to n_h s_h (D'Hondt rounding),
    with at least `floor` per non-empty stratum and at most n_h; all positions if total >= sum n_h."""
    n = np.asarray(n, np.int64)
    M, H = n.shape
    tot = np.minimum(int(total), n.sum(1))
    a = np.minimum(np.where(n > 0, floor, 0), n)
    a = np.where((a.sum(1) > tot)[:, None], 0, a)          # floor not affordable: start from zero
    score = n * (np.asarray(s, float)[None, :] + 1e-9)
    for _ in range(int(total)):
        left = tot - a.sum(1)
        if not (left > 0).any():
            break
        pr = np.where(a < n, score / (a + 1.0), -1.0)
        j = pr.argmax(1)
        add = (left > 0) & (pr[np.arange(M), j] >= 0)
        a[np.arange(M)[add], j[add]] += 1
    return a


def _hyper(rng, good, size, k):
    """Hypergeometric draws (number of L = 1 among k of `size` positions, `good` of them L = 1); 0 if k = 0."""
    good, size, k = np.broadcast_arrays(np.asarray(good, np.int64), np.asarray(size, np.int64), np.asarray(k, np.int64))
    out = np.zeros(good.shape, np.int64)
    m = k > 0
    if m.any():
        out[m] = rng.hypergeometric(good[m], size[m] - good[m], k[m])
    return out


def _ratio(n, x, k):
    return np.where(k > 0, n * x / np.maximum(k, 1), 0.0)


def ds_exposure(st, rng, s_band, m=10, m_open=5, m_unf=20):
    """Double-sampled exposure E~_u for every puppet in st (from strata()). Returns (E~, codes used)."""
    mF = np.minimum(m, st["nF"])
    mO = np.minimum(m_open, st["nO"])
    nB = st["nB"].reshape(-1, N_UNF_BANDS)
    mB = neyman_alloc(nB, s_band, m_unf).reshape(st["nB"].shape)
    xF = _hyper(rng, st["aF"], st["nF"], mF)
    xO = _hyper(rng, st["aO"], st["nO"], mO)
    xB = _hyper(rng, st["aB"], st["nB"], mB)
    num = _ratio(st["nF"], xF, mF) + _ratio(st["nO"], xO, mO) + _ratio(st["nB"], xB, mB).sum(-1)
    return num / np.maximum(st["N"], 1), mF + mO + mB.sum(-1)


def pilot_codes(st, rng, s_band, m_open=10, m_unf=40, m_unf_reg=20):
    """Pilot coding (sec:prot-power): all flagged positions, and m_open + m_unf unflagged positions per puppet
    (openings, then score bands by the same allocation rule). Returns the coded counts, the pilot's
    double-sampled exposure E^_u, and the registered band allocation (capped by the pilot's codes)."""
    shp = st["nB"].shape
    cO = np.minimum(m_open, st["nO"])
    cB = neyman_alloc(st["nB"].reshape(-1, N_UNF_BANDS), s_band, m_unf).reshape(shp)
    xO = _hyper(rng, st["aO"], st["nO"], cO)
    xB = _hyper(rng, st["aB"], st["nB"], cB)
    Ehat = (st["aF"] + _ratio(st["nO"], xO, cO) + _ratio(st["nB"], xB, cB).sum(-1)) / np.maximum(st["N"], 1)
    mB_reg = np.minimum(neyman_alloc(st["nB"].reshape(-1, N_UNF_BANDS), s_band, m_unf_reg).reshape(shp), cB)
    return dict(N=st["N"], nF=st["nF"], aF=st["aF"], nO=st["nO"], cO=cO, xO=xO, nB=st["nB"], cB=cB, xB=xB, Ehat=Ehat,
                mB_reg=mB_reg)


def ds_from_pilot(pc, j, rng, m=10, m_open=5):
    """Registered statistic re-drawn from the pilot's codes of pilot puppets j (any shape): m flagged codes from
    the puppet's (fully coded) flagged positions, and the registered unflagged codes subsampled from the pilot's
    coded unflagged positions of each stratum. E(result | pilot) = E^_j."""
    nF, aF, nO, cO, xO = (pc[k][j] for k in ("nF", "aF", "nO", "cO", "xO"))
    nB, cB, xB, mB = pc["nB"][j], pc["cB"][j], pc["xB"][j], pc["mB_reg"][j]
    mF = np.minimum(m, nF)
    mO = np.minimum(m_open, cO)
    yF = _hyper(rng, aF, nF, mF)
    yO = _hyper(rng, xO, cO, mO)
    yB = _hyper(rng, xB, cB, mB)
    num = _ratio(nF, yF, mF) + _ratio(nO, yO, mO) + _ratio(nB, yB, mB).sum(-1)
    return num / np.maximum(pc["N"][j], 1)


def cell_rates(cnt):
    """Exposure-weighted q, mu, Se, Sp, PPV, FOR of a cell from counts (..., 20) summed over puppets."""
    c = np.asarray(cnt, np.int64).reshape(-1, N_TYPES, N_BANDS).sum(0)
    pos, neg = c[2:].sum(0), c[:2].sum(0)
    N = c.sum()
    fl = slice(3, None)
    tp, fp = pos[fl].sum(), neg[fl].sum()
    fn, tn = pos[:3].sum(), neg[:3].sum()
    return dict(q=(tp + fp) / N, mu=(tp + fn) / N, Se=tp / (tp + fn), Sp=tn / (tn + fp), PPV=tp / (tp + fp),
                FOR=fn / (fn + tn))


def var_closed_form(mu, sigma2E, q, PPV, FOR, Se, Sp, kTS, m, m0):
    """Per-arm term of A + n B_ds (sec:prot-power, prop:power(a) for double sampling and eq. pw-B with
    m_1 = n m, m_0 = n m0), divided by mu^2: the variance per puppet of E~_u / mu."""
    vs2 = mu * Se * (1 - Se) + (1 - mu) * Sp * (1 - Sp)
    A = sigma2E + vs2 / kTS * (PPV - FOR) ** 2
    B = q ** 2 * PPV * (1 - PPV) / m + (1 - q) ** 2 * FOR * (1 - FOR) / m0
    return dict(A=A / mu ** 2, nB=B / mu ** 2, total=(A + B) / mu ** 2)
