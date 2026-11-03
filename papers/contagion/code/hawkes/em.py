"""EM estimation via the latent branching structure (Veen & Schoenberg 2008;
Marsan & Lengline 2008; Mohler et al. 2011), for multivariate exponential
Hawkes processes with a constant or log-linear spline background and known
exogenous shocks.

E-step (exact, O(n M^2), no truncation window)
----------------------------------------------
Event i in stream k has branching probabilities
``mu_k(t_i)/lambda_i`` (background), ``shock_beta_k S_e psi_k(t_i - tau_e)/lambda_i``
(shock e), and ``alpha_kj beta_kj exp(-beta_kj (t_i - t_l))/lambda_i`` (child of
event l of stream j). The M-step needs only these sums over events, and the
lag-weighted sums over parents:

    N_kj = sum_i sum_l p_il,    W_kj = sum_i sum_l p_il (t_i - t_l).

For exponential kernels both are exact decay sums. They are computed with the
vectorised O(n) recursion of :class:`hawkes.likelihood.DecaySums`, so no
pairwise matrix and no truncation window are needed. Event-level parent
probabilities are never formed. :func:`decluster` gives the stream-level
probabilities.

M-step (exact up to a 1-D root solve)
-------------------------------------
* constant background: ``mu_k = sum_i P(bg)_i / T``;
* spline background ``mu_k(t) = exp(B(t)' theta_k)``: a few Newton steps
  (with step halving) on the concave expected complete-data log-likelihood
  ``sum_i P(bg)_i B(t_i)' theta_k - int_0^T exp(B' theta_k)``;
* (alpha, beta) jointly. alpha is profiled out,
  ``alpha_kj = N_kj / G_j(beta_kj)`` with ``G_j(b) = sum_l (1 - e^{-b(T - t_l)})``.
  beta maximises ``N log b - b W - N log G(b)`` (summed over pairs for a common beta).
  The stationarity condition ``b = N / (W + N G'(b)/G(b))`` is solved by a
  monotone fixed-point iteration, with a bounded Brent search as fallback.
  Ignoring the boundary terms gives the familiar closed form ``b = N/W``.
* shock loadings and response rate are handled in the same way, with
  ``shock_beta_k = sum_e N_ke / sum_e S_e Psi_e(eta_k)``.

Every M-step maximises the expected complete-data log-likelihood, so the
observed log-likelihood is non-decreasing (``FitResult.loglik_trace``).
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
from scipy.optimize import minimize_scalar

from .likelihood import DecaySums, check_events, shock_kernel_matrix
from .model import BSplineBasis, HawkesSpec, LogLinearBackground, gauss_legendre_cells

__all__ = ["FitResult", "fit_em", "decluster", "numerical_hessian"]


@dataclass
class FitResult:
    """Result of :func:`fit_em`.

    spec : fitted HawkesSpec.
    loglik : log-likelihood at the fitted parameters.
    n_iter : number of EM iterations.
    converged : whether the relative log-likelihood change fell below ``tol``.
    loglik_trace : log-likelihood at each iterate (non-decreasing).
    se : dict of standard errors (same shapes as the parameters; NaN where
        not computed), or None. Computed from the observed information, i.e.
        the numerical Hessian of the exact log-likelihood.
    se_flag : "not computed", "ok", or a description of the problem. Entries
        on the boundary (alpha ~ 0) are excluded and flagged, because the usual
        asymptotics fail there.
    n_params : number of free parameters (for AIC/BIC).
    """

    spec: HawkesSpec
    loglik: float
    n_iter: int
    converged: bool
    loglik_trace: np.ndarray
    se: dict | None = None
    se_flag: str = "not computed"
    n_params: int = 0
    background: str = "const"
    info: dict = field(default_factory=dict)

    @property
    def aic(self) -> float:
        return -2.0 * self.loglik + 2.0 * self.n_params

    def bic(self, n_events: int) -> float:
        return -2.0 * self.loglik + np.log(n_events) * self.n_params

    @property
    def mu(self):
        return self.spec.mu

    @property
    def alpha(self):
        return self.spec.alpha

    @property
    def beta(self):
        return self.spec.beta


class _Problem:
    """Cached data structures for the E-step."""

    def __init__(self, events, T, M, background, shocks, basis, n_basis):
        self.ev = check_events(events, M, T)
        self.T = float(T)
        self.M = M
        self.n = np.array([e.size for e in self.ev])
        self.idx = [[np.searchsorted(self.ev[j], self.ev[k], side="left") for j in range(M)] for k in range(M)]
        self.rem = [self.T - e for e in self.ev]  # T - t_l
        self.shocks = [(float(a), float(b)) for a, b in (shocks or [])]
        self.E = len(self.shocks)
        self.tau = np.array([s[0] for s in self.shocks], float)
        self.S = np.array([s[1] for s in self.shocks], float)
        if self.E:
            self.dsh = []
            self.psh = []
            for k in range(M):
                d = self.ev[k][:, None] - self.tau[None, :]
                self.dsh.append(np.where(d > 0, d, 0.0))
                self.psh.append(d > 0)
            self.c1 = np.maximum(self.T - self.tau, 0.0)
            self.c0 = np.maximum(-self.tau, 0.0)
        self.background = background
        if background == "spline":
            self.basis = basis if basis is not None else BSplineBasis(T, n_basis)
            self.Bev = [self.basis(e) for e in self.ev]
            qn, self.qw = gauss_legendre_cells(self.basis.cells())
            self.Bq = self.basis(qn)
        elif background != "const":
            raise ValueError("background must be 'const' or 'spline'")

    # kernel window functions -------------------------------------------
    def G(self, j, b):
        return float(np.sum(-np.expm1(-b * self.rem[j])))

    def dG(self, j, b):
        r = self.rem[j]
        return float(np.sum(r * np.exp(-b * r)))

    def Gsh(self, eta):
        if self.E == 0:
            return 0.0
        return float(np.sum(self.S * (np.exp(-eta * self.c0) - np.exp(-eta * self.c1))))

    def dGsh(self, eta):
        if self.E == 0:
            return 0.0
        return float(np.sum(self.S * (self.c1 * np.exp(-eta * self.c1) - self.c0 * np.exp(-eta * self.c0))))

    # E-step -------------------------------------------------------------
    def estep(self, p, stats=True):
        M = self.M
        A, Bm, sb, eta = p["A"], p["Bm"], p["sb"], p["eta"]
        cache = {}
        ll = 0.0
        Nbg = np.zeros(M)
        wbg = [None] * M
        N = np.zeros((M, M))
        W = np.zeros((M, M))
        Nsh = np.zeros((M, self.E))
        Wsh = np.zeros((M, self.E))
        for k in range(M):
            nk = self.n[k]
            if nk == 0:
                continue
            if self.background == "const":
                lam_bg = np.full(nk, p["mu"][k])
            else:
                lam_bg = np.exp(self.Bev[k] @ p["theta"][k])
            lam = lam_bg.copy()
            hs = None
            if self.E and sb[k] > 0:
                hs = sb[k] * np.where(
                    self.psh[k], self.S[None, :] * eta[k] * np.exp(-eta[k] * self.dsh[k]), 0.0
                )
                lam += hs.sum(axis=1)
            contrib = {}
            for j in range(M):
                if A[k, j] > 0 and self.n[j] > 0:
                    b = Bm[k, j]
                    key = (j, b)
                    if key not in cache:
                        cache[key] = DecaySums(self.ev[j], b, lag=stats)
                    out = cache[key](self.ev[k], self.idx[k][j])
                    c = A[k, j] * b
                    if stats:
                        contrib[j] = (c * out[0], c * out[1])
                        lam += contrib[j][0]
                    else:
                        lam += c * out
            if np.any(lam <= 0):
                return {"ll": -np.inf}
            ll += float(np.sum(np.log(lam)))
            if not stats:
                continue
            w = 1.0 / lam
            wb = lam_bg * w
            Nbg[k] = wb.sum()
            wbg[k] = wb
            for j, (cs, cd) in contrib.items():
                N[k, j] = cs @ w
                W[k, j] = cd @ w
            if hs is not None:
                hw = hs * w[:, None]
                Nsh[k] = hw.sum(axis=0)
                Wsh[k] = (hw * self.dsh[k]).sum(axis=0)
        # compensator
        if self.background == "const":
            comp = float(np.sum(p["mu"]) * self.T)
        else:
            comp = float(np.sum(self.qw[:, None] * np.exp(self.Bq @ p["theta"].T)))
        for k in range(M):
            for j in range(M):
                if A[k, j] > 0:
                    comp += A[k, j] * self.G(j, Bm[k, j])
            if self.E and sb[k] > 0:
                comp += sb[k] * self.Gsh(eta[k])
        ll -= comp
        if not stats:
            return {"ll": ll}
        return {"ll": ll, "Nbg": Nbg, "wbg": wbg, "N": N, "W": W, "Nsh": Nsh, "Wsh": Wsh}


def _solve_rate(N, W, Gfun, dGfun, b0, lo, hi):
    """Maximise f(b) = N log b - b W - sum_m N_m log G_m(b) over b in [lo, hi].
    N and W are totals; Gfun(b) returns sum_m N_m log G_m(b) and dGfun(b)
    returns sum_m N_m G'_m(b)/G_m(b)."""

    def f(b):
        return N * np.log(b) - b * W - Gfun(b)

    b = min(max(b0, lo), hi)
    for _ in range(100):
        denom = W + dGfun(b)
        b_new = N / denom if denom > 0 else hi
        b_new = min(max(b_new, lo), hi)
        if abs(b_new - b) <= 1e-12 * b:
            b = b_new
            break
        b = b_new
    if not np.isfinite(f(b)) or f(b) < f(min(max(b0, lo), hi)) - 1e-9 * (1 + abs(f(b0))):
        res = minimize_scalar(
            lambda u: -f(np.exp(u)), bounds=(np.log(lo), np.log(hi)), method="bounded", options={"xatol": 1e-10}
        )
        bb = float(np.exp(res.x))
        b = bb if f(bb) > f(b0) else min(max(b0, lo), hi)
    return b


def _newton_loglinear(theta, wb, Bev, Bq, qw, n_steps, ridge):
    """A few Newton steps on q(th) = wb'B th - qw' exp(Bq th) - ridge/2 |th - mean|^2."""

    def q(th):
        val = wb @ (Bev @ th) - qw @ np.exp(Bq @ th)
        if ridge:
            d = th - th.mean()
            val -= 0.5 * ridge * d @ d
        return val

    th = theta.copy()
    q0 = q(th)
    nb = th.size
    for _ in range(n_steps):
        e = qw * np.exp(Bq @ th)
        g = Bev.T @ wb - Bq.T @ e
        H = (Bq.T * e) @ Bq
        if ridge:
            P = ridge * (np.eye(nb) - np.ones((nb, nb)) / nb)
            g -= P @ th
            H += P
        try:
            step = np.linalg.solve(H + 1e-12 * np.eye(nb), g)
        except np.linalg.LinAlgError:
            break
        s = 1.0
        while s > 1e-8:
            cand = th + s * step
            qc = q(cand)
            if np.isfinite(qc) and qc >= q0:
                th, q0 = cand, qc
                break
            s *= 0.5
        else:
            break
        if np.max(np.abs(s * step)) < 1e-10:
            break
    return th


def _as_matrix_or_nan(x, M):
    if x is None:
        return np.full((M, M), np.nan)
    a = np.asarray(x, dtype=float)
    if a.ndim == 0:
        return np.full((M, M), float(a))
    if a.shape != (M, M):
        raise ValueError("beta_fixed must be a scalar or (M, M) (NaN = free)")
    return a.copy()


def fit_em(
    events,
    T: float,
    M: int | None = None,
    background: str = "const",
    shocks=None,
    n_basis: int = 8,
    beta_fixed=None,
    max_iter: int = 500,
    tol: float = 1e-6,
    *,
    beta_structure: str = "scalar",
    alpha_mask=None,
    shock_rate_structure: str = "scalar",
    shock_rate_fixed=None,
    basis=None,
    init: HawkesSpec | None = None,
    beta_init: float | None = None,
    beta_bounds: tuple | None = None,
    n_newton: int = 3,
    ridge: float = 0.0,
    compute_se: bool = False,
    accelerate: bool = True,
    min_iter: int = 3,
    n_grid: int = 8,
    grid_iter: int = 40,
    n_starts: int = 3,
) -> FitResult:
    """Fit a multivariate exponential Hawkes model by EM.

    Parameters
    ----------
    events : list of M sorted arrays on [0, T].
    background : "const" (mu_k constant) or "spline" (mu_k(t) = exp(B(t)'theta_k)
        with a cubic B-spline basis of ``n_basis`` functions; or pass ``basis``,
        e.g. :class:`hawkes.model.FourierBasis`).
    shocks : list of (tau_e, S_e) with known times and sizes. The loadings
        shock_beta (M,) and the response rate eta are estimated.
    beta_fixed : None (estimate), a scalar, or an (M, M) array whose NaN
        entries are free.
    beta_structure : "scalar" (all free beta entries share one rate, the
        default) or "matrix" (one rate per free entry).
    alpha_mask : (M, M) bool, True = free, False = fixed at 0.
    shock_rate_structure : "scalar" (common eta) or "vector" (eta_k).
    shock_rate_fixed : None or a scalar / (M,) fixed eta.
    init : HawkesSpec used as the starting value (no beta grid search).
    beta_init : starting beta. If None and no init, the profile log-likelihood
        (EM with beta fixed, ``grid_iter`` iterations) is evaluated on an
        ``n_grid``-point log grid over [min(0.05 n/T, 20/T), 200 n/T]. The free
        EM then starts from each local maximum of this grid profile (best
        first, at most ``n_starts``) and the best optimum is kept, because the
        likelihood can be multimodal in beta.
    beta_bounds : (lo, hi) for beta and eta. Default (0.01/T, 1e4 * n/T).
    tol : stop when the log-likelihood gain is <= tol * (1 + |loglik|).
    compute_se : compute standard errors from the numerical Hessian.
    accelerate : SQUAREM extrapolation (Varadhan & Roland 2008) between EM
        steps, accepted only when it increases the log-likelihood (the trace stays
        monotone; the fixed point is the same as plain EM). ``n_iter`` counts
        EM-map evaluations.
    """
    M = len(events) if M is None else int(M)
    prob = _Problem(events, T, M, background, shocks, basis, n_basis)
    T = prob.T
    n_tot = max(int(prob.n.sum()), 1)
    lo, hi = beta_bounds if beta_bounds is not None else (0.01 / T, 1e4 * n_tot / T)
    amask = np.ones((M, M), bool) if alpha_mask is None else np.asarray(alpha_mask, bool).copy()
    bfix = _as_matrix_or_nan(beta_fixed, M)
    bfree = np.isnan(bfix)
    if beta_structure not in ("scalar", "matrix"):
        raise ValueError("beta_structure must be 'scalar' or 'matrix'")
    if shock_rate_structure not in ("scalar", "vector"):
        raise ValueError("shock_rate_structure must be 'scalar' or 'vector'")
    eta_fixed = None if shock_rate_fixed is None else np.broadcast_to(np.asarray(shock_rate_fixed, float), (M,)).copy()
    E = prob.E

    # ---- initial values -------------------------------------------------
    p = {}
    rate = prob.n / T
    if init is not None:
        A0 = init.alpha.copy() * amask
        # a free entry fitted exactly to 0 could never move: nudge it
        A0[(A0 <= 0) & amask] = 1e-3
        Bm0 = init.beta_matrix
        sb0 = init.shock_beta.copy() if init.shocks else np.zeros(M)
        eta0 = init.shock_rate_vec
        if background == "const":
            mu0 = init.mu_bar(T)
        else:
            if isinstance(init.mu, LogLinearBackground) and init.mu.theta.shape[1] == prob.Bq.shape[1]:
                theta0 = init.mu.theta.copy()
            else:
                theta0 = np.log(np.maximum(init.mu_bar(T), 1e-10))[:, None] * np.ones((1, prob.Bq.shape[1]))
    else:
        A0 = 0.5 * np.outer(prob.n / n_tot, np.ones(M)) * amask
        A0[(A0 <= 0) & amask] = 1e-3
        mu0 = np.maximum(0.5 * rate, 1e-10)
        theta0 = np.log(mu0)[:, None] * np.ones((1, prob.Bq.shape[1])) if background == "spline" else None
        b_start = beta_init if beta_init is not None else 1.0
        Bm0 = np.full((M, M), b_start)
        sb0 = np.where(prob.n > 0, 0.1 * prob.n / max(prob.S.sum(), 1e-12), 0.0) if E else np.zeros(M)
        eta0 = np.full(M, b_start)
    Bm0 = np.where(bfree, Bm0, bfix)
    if E:
        # a loading started at exactly 0 would stay at 0 under the EM update
        default_sb = np.where(prob.n > 0, 0.1 * prob.n / max(prob.S.sum(), 1e-12), 0.0)
        sb0 = np.where((np.asarray(sb0) > 0) | (prob.n == 0), sb0, default_sb)
    if eta_fixed is not None:
        eta0 = eta_fixed.copy()
    if background == "const":
        p["mu"] = np.asarray(mu0, float)
    else:
        p["theta"] = np.asarray(theta0, float)
    p.update(A=A0, Bm=Bm0, sb=sb0 if E else np.zeros(M), eta=np.asarray(eta0, float))

    def mstep(st, p, update_beta=True):
        q = {k: (v.copy() if isinstance(v, np.ndarray) else v) for k, v in p.items()}
        # background
        if background == "const":
            q["mu"] = np.maximum(st["Nbg"] / T, 1e-300)
        else:
            th = q["theta"].copy()
            for k in range(M):
                if prob.n[k] == 0:
                    th[k] = np.log(1e-12)
                    continue
                th[k] = _newton_loglinear(th[k], st["wbg"][k], prob.Bev[k], prob.Bq, prob.qw, n_newton, ridge)
            q["theta"] = th
        N, W = st["N"], st["W"]
        Bm = q["Bm"].copy()
        act = amask & (N > 1e-12)
        if update_beta and np.any(bfree & act):
            if beta_structure == "scalar":
                pairs = [(k, j) for k in range(M) for j in range(M) if bfree[k, j] and act[k, j]]
                Nt = sum(N[k, j] for k, j in pairs)
                Wt = sum(W[k, j] for k, j in pairs)
                Ncol = {}
                for k, j in pairs:
                    Ncol[j] = Ncol.get(j, 0.0) + N[k, j]
                b0 = float(Bm[pairs[0]])
                b = _solve_rate(
                    Nt,
                    Wt,
                    lambda b: sum(n * np.log(prob.G(j, b)) for j, n in Ncol.items()),
                    lambda b: sum(n * prob.dG(j, b) / prob.G(j, b) for j, n in Ncol.items()),
                    b0,
                    lo,
                    hi,
                )
                Bm[bfree] = b
            else:
                for k in range(M):
                    for j in range(M):
                        if bfree[k, j] and act[k, j]:
                            n_, j_ = N[k, j], j
                            Bm[k, j] = _solve_rate(
                                n_,
                                W[k, j],
                                lambda b, n_=n_, j_=j_: n_ * np.log(prob.G(j_, b)),
                                lambda b, n_=n_, j_=j_: n_ * prob.dG(j_, b) / prob.G(j_, b),
                                Bm[k, j],
                                lo,
                                hi,
                            )
        q["Bm"] = Bm
        A = np.zeros((M, M))
        for k in range(M):
            for j in range(M):
                if amask[k, j] and prob.n[j] > 0:
                    A[k, j] = N[k, j] / prob.G(j, Bm[k, j])
        q["A"] = A
        if E:
            Nsh, Wsh = st["Nsh"], st["Wsh"]
            Nk = Nsh.sum(axis=1)
            Wk = Wsh.sum(axis=1)
            eta = q["eta"].copy()
            if eta_fixed is None:
                if shock_rate_structure == "scalar":
                    if Nk.sum() > 1e-12:
                        e = _solve_rate(
                            Nk.sum(),
                            Wk.sum(),
                            lambda x: Nk.sum() * np.log(prob.Gsh(x)),
                            lambda x: Nk.sum() * prob.dGsh(x) / prob.Gsh(x),
                            float(eta[0]),
                            lo,
                            hi,
                        )
                        eta[:] = e
                else:
                    for k in range(M):
                        if Nk[k] > 1e-12:
                            eta[k] = _solve_rate(
                                Nk[k],
                                Wk[k],
                                lambda x, n_=Nk[k]: n_ * np.log(prob.Gsh(x)),
                                lambda x, n_=Nk[k]: n_ * prob.dGsh(x) / prob.Gsh(x),
                                float(eta[k]),
                                lo,
                                hi,
                            )
            q["eta"] = eta
            q["sb"] = np.array([Nk[k] / prob.Gsh(eta[k]) if Nk[k] > 0 else 0.0 for k in range(M)])
        return q

    # ---- EM iterations (optionally SQUAREM-accelerated) ------------------
    def pack(ps, masks):
        mA, msb = masks
        parts = [np.log(ps["mu"])] if background == "const" else [ps["theta"].ravel()]
        parts.append(np.log(ps["A"][mA]))
        parts.append(np.log(ps["Bm"][bfree]))
        if E:
            parts.append(np.log(ps["sb"][msb]))
            if eta_fixed is None:
                parts.append(np.log(ps["eta"]))
        return np.concatenate(parts)

    def unpack(x, masks, template):
        mA, msb = masks
        q = {k: (v.copy() if isinstance(v, np.ndarray) else v) for k, v in template.items()}
        i = 0
        if background == "const":
            q["mu"] = np.exp(x[i : i + M])
            i += M
        else:
            nb = q["theta"].size
            q["theta"] = x[i : i + nb].reshape(q["theta"].shape)
            i += nb
        nA = int(mA.sum())
        q["A"][mA] = np.exp(x[i : i + nA])
        i += nA
        nB = int(bfree.sum())
        q["Bm"][bfree] = np.clip(np.exp(x[i : i + nB]), lo, hi)
        i += nB
        if E:
            ns = int(msb.sum())
            q["sb"][msb] = np.exp(x[i : i + ns])
            i += ns
            if eta_fixed is None:
                q["eta"] = np.clip(np.exp(x[i : i + M]), lo, hi)
        return q

    def run(p, n_max, tol_, update_beta=True):
        """Iterate the EM map from p. Returns (p, st, trace, n_evals, converged)."""
        trace = []
        converged = False
        it = 0
        st = prob.estep(p)
        trace.append(st["ll"])
        if not np.isfinite(st["ll"]):
            return p, st, trace, it, False
        amax = 1.0
        while it < n_max:
            p0, st0 = p, st
            # plain EM step
            p1 = mstep(st0, p0, update_beta)
            st1 = prob.estep(p1)
            it += 1
            if not st1["ll"] >= st0["ll"] - 1e-8 * (1 + abs(st0["ll"])):
                break  # numerical safeguard (should not happen): keep the old iterate
            trace.append(st1["ll"])
            p, st = p1, st1
            if accelerate and it < n_max:
                # second EM step, then a SQUAREM extrapolation (Varadhan &
                # Roland 2008, scheme S3) on the log-parameters, followed by a
                # stabilising EM step. The extrapolation is kept only if it
                # beats the plain EM iterate, so the trace stays monotone.
                p2 = mstep(st1, p1, update_beta)
                st2 = prob.estep(p2)
                it += 1
                if not st2["ll"] >= st1["ll"] - 1e-8 * (1 + abs(st1["ll"])):
                    break
                trace.append(st2["ll"])
                p, st = p2, st2
                mA = amask & (p0["A"] > 0) & (p1["A"] > 0) & (p2["A"] > 0)
                msb = (p0["sb"] > 0) & (p1["sb"] > 0) & (p2["sb"] > 0)
                masks = (mA, msb)
                x0, x1, x2 = pack(p0, masks), pack(p1, masks), pack(p2, masks)
                r = x1 - x0
                v = x2 - 2.0 * x1 + x0
                nv = float(np.sqrt(v @ v))
                a = min(max(float(np.sqrt(r @ r)) / nv if nv > 0 else 1.0, 1.0), amax)
                if a >= amax:  # step length capped: allow longer steps next time
                    amax *= 4.0
                if a > 1.0 and it < n_max and np.all(np.isfinite(x0)):
                    ok = False
                    ps = unpack(x0 + 2.0 * a * r + a * a * v, masks, p2)
                    sts = prob.estep(ps)
                    if np.isfinite(sts["ll"]):
                        p3 = mstep(sts, ps, update_beta)
                        st3 = prob.estep(p3)
                        it += 1
                        if np.isfinite(st3["ll"]) and st3["ll"] >= st2["ll"]:
                            p, st = p3, st3
                            trace.append(st3["ll"])
                            ok = True
                    if not ok:
                        amax = max(1.0, amax / 4.0)
            if it >= min_iter and (st["ll"] - st0["ll"]) <= tol_ * (1 + abs(st["ll"])):
                converged = True
                break
        return p, st, trace, it, converged

    # ---- starting values for beta: profile likelihood on a grid -----------
    # The likelihood can be multimodal in beta (e.g. a spurious "tiny alpha,
    # huge beta" mode when excitation is weak), so we evaluate the profile
    # log-likelihood (EM with beta fixed) on a log grid and start the free EM
    # from every local maximum of the grid profile (at most ``n_starts``).
    starts = [p]
    need_grid = init is None and beta_init is None and np.any(bfree & amask)
    if need_grid:
        r_ = n_tot / T
        g_lo = max(lo, min(0.05 * r_, 20.0 / T))
        g_hi = min(hi, 200.0 * r_)
        grid = np.geomspace(g_lo, max(g_hi, g_lo * 1.0001), n_grid)
        prof = []
        for b in grid:
            pg = {k: (v.copy() if isinstance(v, np.ndarray) else v) for k, v in p.items()}
            pg["Bm"] = np.where(bfree, b, bfix)
            if eta_fixed is None:
                pg["eta"] = np.full(M, b)
            pg, stg, _, _, _ = run(pg, grid_iter, 1e-7, update_beta=False)
            prof.append((stg["ll"] if np.isfinite(stg["ll"]) else -np.inf, pg))
        lls = np.array([z[0] for z in prof])
        # local maxima of the grid profile (one start per basin), best first
        is_max = np.ones(lls.size, bool)
        is_max[1:] &= lls[1:] >= lls[:-1]
        is_max[:-1] &= lls[:-1] >= lls[1:]
        cand = sorted(np.flatnonzero(is_max), key=lambda i: -lls[i])
        starts = [prof[i][1] for i in cand[: max(1, n_starts)]]

    best = None
    for p_start in starts:
        out = run(p_start, max_iter, tol)
        if best is None or out[1]["ll"] > best[1]["ll"]:
            best = out
    p, st, trace, it, converged = best

    spec = _to_spec(p, M, prob, background, shock_rate_structure, beta_structure, bfree)
    n_par = _count_params(prob, background, amask, bfree, beta_structure, E, shock_rate_structure, eta_fixed)
    res = FitResult(
        spec=spec,
        loglik=float(st["ll"]),
        n_iter=it,
        converged=converged,
        loglik_trace=np.asarray(trace),
        n_params=n_par,
        background=background,
        info={"beta_bounds": (lo, hi), "alpha_mask": amask, "beta_free": bfree},
    )
    if compute_se:
        _attach_se(res, prob, p, background, amask, bfree, beta_structure, eta_fixed, shock_rate_structure)
    return res


def _count_params(prob, background, amask, bfree, beta_structure, E, shock_rate_structure, eta_fixed):
    M = prob.M
    n = (M if background == "const" else prob.Bq.shape[1] * M) + int(amask.sum())
    act = bfree & amask
    if np.any(act):
        n += 1 if beta_structure == "scalar" else int(act.sum())
    if E:
        n += M
        if eta_fixed is None:
            n += 1 if shock_rate_structure == "scalar" else M
    return n


def _to_spec(p, M, prob, background, shock_rate_structure, beta_structure, bfree):
    Bm = p["Bm"]
    beta = float(Bm[0, 0]) if np.allclose(Bm, Bm[0, 0], rtol=0, atol=0) else Bm.copy()
    if background == "const":
        mu = p["mu"].copy()
    else:
        mu = LogLinearBackground(p["theta"].copy(), prob.basis)
    eta = p["eta"]
    if prob.E == 0:
        sr = 1.0  # no shocks: the response rate is not used
    else:
        sr = float(eta[0]) if np.all(eta == eta[0]) else eta.copy()
    return HawkesSpec(
        M=M,
        mu=mu,
        alpha=p["A"].copy(),
        beta=beta,
        shocks=list(prob.shocks),
        shock_beta=p["sb"].copy(),
        shock_rate=sr,
    )


def numerical_hessian(f, x, rel_step=1e-4, abs_step=1e-6):
    """Central-difference Hessian of a scalar function f at x."""
    x = np.asarray(x, float)
    n = x.size
    h = rel_step * np.maximum(np.abs(x), abs_step / rel_step)
    H = np.zeros((n, n))
    f0 = f(x)
    fp = np.zeros(n)
    fm = np.zeros(n)
    for i in range(n):
        e = np.zeros(n)
        e[i] = h[i]
        fp[i] = f(x + e)
        fm[i] = f(x - e)
        H[i, i] = (fp[i] - 2 * f0 + fm[i]) / h[i] ** 2
    for i in range(n):
        for j in range(i + 1, n):
            ei = np.zeros(n)
            ej = np.zeros(n)
            ei[i] = h[i]
            ej[j] = h[j]
            v = (f(x + ei + ej) - f(x + ei - ej) - f(x - ei + ej) + f(x - ei - ej)) / (4 * h[i] * h[j])
            H[i, j] = H[j, i] = v
    return H


def _attach_se(res, prob, p, background, amask, bfree, beta_structure, eta_fixed, shock_rate_structure, bound_tol=1e-6):
    """Standard errors from the observed information (numerical Hessian of the
    exact log-likelihood) over the free parameters that are off the boundary."""
    M = prob.M
    E = prob.E
    names = []  # (key, index)
    x0 = []
    if background == "const":
        for k in range(M):
            names.append(("mu", (k,)))
            x0.append(p["mu"][k])
    else:
        for k in range(M):
            for b in range(p["theta"].shape[1]):
                names.append(("theta", (k, b)))
                x0.append(p["theta"][k, b])
    boundary = []
    for k in range(M):
        for j in range(M):
            if amask[k, j]:
                if p["A"][k, j] > bound_tol:
                    names.append(("A", (k, j)))
                    x0.append(p["A"][k, j])
                else:
                    boundary.append(f"alpha[{k},{j}]")
    act = bfree & amask & (p["A"] > bound_tol)
    if np.any(act):
        if beta_structure == "scalar":
            names.append(("Bm_all", None))
            x0.append(p["Bm"][act][0])
        else:
            for k, j in zip(*np.nonzero(act)):
                names.append(("Bm", (k, j)))
                x0.append(p["Bm"][k, j])
    if E:
        for k in range(M):
            if p["sb"][k] > bound_tol:
                names.append(("sb", (k,)))
                x0.append(p["sb"][k])
            else:
                boundary.append(f"shock_beta[{k}]")
        if eta_fixed is None:
            if shock_rate_structure == "scalar":
                names.append(("eta_all", None))
                x0.append(p["eta"][0])
            else:
                for k in range(M):
                    names.append(("eta", (k,)))
                    x0.append(p["eta"][k])
    x0 = np.asarray(x0, float)

    def unpack(x):
        q = {k: (v.copy() if isinstance(v, np.ndarray) else v) for k, v in p.items()}
        for (key, ix), v in zip(names, x):
            if key == "Bm_all":
                q["Bm"] = np.where(bfree, v, p["Bm"])
            elif key == "eta_all":
                q["eta"] = np.full(M, v)
            else:
                q[key][ix] = v
        return q

    positive = np.array([key != "theta" for key, _ in names], bool)

    def f(x):
        if np.any(x[positive] <= 0):
            return -np.inf
        return prob.estep(unpack(x), stats=False)["ll"]

    se = {
        "mu" if background == "const" else "theta": np.full(p["mu"].shape if background == "const" else p["theta"].shape, np.nan),
        "alpha": np.full((M, M), np.nan),
        "beta": np.full((M, M), np.nan),
    }
    if E:
        se["shock_beta"] = np.full(M, np.nan)
        se["shock_rate"] = np.full(M, np.nan)
    flag = "ok"
    try:
        H = numerical_hessian(f, x0)
        info = -H
        if not np.all(np.isfinite(info)):
            raise np.linalg.LinAlgError("non-finite Hessian")
        ev = np.linalg.eigvalsh(0.5 * (info + info.T))
        if ev.min() <= 0:
            flag = "observed information not positive definite"
            cov = np.full_like(info, np.nan)
        else:
            cov = np.linalg.inv(info)
    except np.linalg.LinAlgError as exc:  # pragma: no cover
        flag = f"hessian failed: {exc}"
        cov = np.full((x0.size, x0.size), np.nan)
    sd = np.sqrt(np.maximum(np.diag(cov), 0.0)) if np.all(np.isfinite(cov)) else np.full(x0.size, np.nan)
    for (key, ix), s in zip(names, sd):
        if key == "mu":
            se["mu"][ix] = s
        elif key == "theta":
            se["theta"][ix] = s
        elif key == "A":
            se["alpha"][ix] = s
        elif key == "Bm_all":
            se["beta"][bfree] = s
        elif key == "Bm":
            se["beta"][ix] = s
        elif key == "sb":
            se["shock_beta"][ix] = s
        elif key == "eta_all":
            se["shock_rate"][:] = s
        elif key == "eta":
            se["shock_rate"][ix] = s
    if boundary:
        flag = (flag + "; " if flag != "ok" else "") + "on boundary (no SE): " + ", ".join(boundary)
    res.se = se
    res.se_flag = flag
    res.info["cov"] = cov
    res.info["se_names"] = names


def decluster(spec: HawkesSpec, events, T: float | None = None) -> list[np.ndarray]:
    """Stream-level branching probabilities of every event.

    Returns a list over streams k of (n_k, 1 + E + M) arrays with columns
    [background, shock_0..shock_{E-1}, parent in stream 0..M-1]. Rows sum to 1.
    """
    ev = check_events(events, spec.M, T)
    M = spec.M
    Bm = spec.beta_matrix
    tau, S = spec.shock_times, spec.shock_sizes
    eta = spec.shock_rate_vec
    E = len(spec.shocks)
    out = []
    cache = {}
    for k in range(M):
        tk = ev[k]
        cols = np.zeros((tk.size, 1 + E + M))
        cols[:, 0] = spec.mu_at(tk)[:, k]
        if E and spec.shock_beta[k] > 0:
            cols[:, 1 : 1 + E] = spec.shock_beta[k] * shock_kernel_matrix(tk, tau, S, eta[k])
        for j in range(M):
            if spec.alpha[k, j] > 0 and ev[j].size:
                key = (j, Bm[k, j])
                if key not in cache:
                    cache[key] = DecaySums(ev[j], Bm[k, j])
                cols[:, 1 + E + j] = spec.alpha[k, j] * Bm[k, j] * cache[key](tk)
        out.append(cols / cols.sum(axis=1, keepdims=True))
    return out
