"""Record linkage for the dark-figure simulation study.

Pipeline (cf. Alg. alg:fsem and the random audit of Prop. prop:link-audit in Sec. sec:linkage):
  1. normalise record attributes (venue text, type crosswalk);
  2. blocking: candidate pairs share a county neighbourhood (same or adjacent
     county, or either county unknown) and have |date difference| <= window;
  3. comparison vectors gamma with discrete levels for date difference,
     hour-of-day difference, location, harmonised type and venue
     Jaro-Winkler similarity (hour and venue have an explicit "missing on
     either side" level; location has an "unknown county" level);
  4. Fellegi-Sunter EM (unsupervised m/u) giving posterior match
     probabilities pi_{rr'}. Default: a 3-class latent model (match, related
     non-match, unrelated non-match; conditional independence within class,
     date / hour distributions tied across the two non-match classes); the
     classical 2-class CI model is available with n_classes=2. The full
     specification is in FS_EM_SPEC (recorded in the results JSON);
  5. within-list de-duplication (union-find on within-list pairs whose
     posterior >= 0.5, using the class-conditional distributions fitted on
     the cross-list pairs with class proportions re-estimated on the
     within-list pairs);
  6. constrained clustering into incidents: greedy merging by descending
     posterior above a threshold with at most one record per list per cluster
     (the single best / "naive" linkage);
  7. linkage draws for multiple imputation (gibbs_linkage): a single-record
     Gibbs sampler over partitions of the de-duplicated records that targets
     the plug-in Fellegi-Sunter pairwise posterior
        p(Lambda | gamma) propto prod_{pairs r~r' in one cluster} pi/(1-pi)
     restricted to partitions with <= 1 record per list per cluster in which
     every within-cluster pair is a candidate pair with pi >= tau. These are
     approximate posterior draws (empirical Bayes: m, u, p fixed at the FS-EM
     values; pairwise composite likelihood; edges with pi < tau truncated).
     The run-1 sampler (independent Bernoulli(pi) link proposals resolved
     greedily under the constraint, sample_linkage_bernoulli) is kept for
     reference only: it is NOT a posterior sampler;
  8. clerical-review simulator (clerical_review): the RANDOM stratified audit
     of Prop. prop:link-audit -- a stratified simple random sample of B
     candidate pairs with Neyman allocation over (link status x posterior)
     strata, truth revealed, giving design-based estimates of the LE-model
     rates (delta, eps) on the candidate-pair frame. It is not the targeted
     review of Alg. alg:review, and reviewed links are NOT fixed in the
     linkage afterwards. Its estimand is computed from the truth on the same
     frame by audit_frame_truth; true matches outside every block are
     invisible to it (blocking recall is reported separately).

Empirical linkage-error rates are expressed in the parametrisation of the
canonical LE model of SPEC.md:
  * delta (per-record detachment): under LE a true cross-list pair stays
    together iff neither record detaches, so pairwise recall = (1 - delta)^2,
    hence delta = 1 - sqrt(recall).
  * eps (per-singleton merge probability): eps = M / (S + M), with M the number
    of false merge events (sum over clusters of #distinct true incidents - 1)
    and S the number of singleton clusters after merging (first-order
    approximation of the pre-merge singleton count by S + M).
"""
from __future__ import annotations

from dataclasses import dataclass, field
import re
import numpy as np

from .world import CROSSWALK, Records

# ---------------------------------------------------------------------------
# string similarity
# ---------------------------------------------------------------------------

def jaro(s1: str, s2: str) -> float:
    """Jaro similarity. Each character of s1 is matched to the first unmatched equal
    character of s2 within the match window (str.find does the scan in C; the result
    is identical to the textbook double loop, see tests)."""
    if s1 == s2:
        return 1.0 if s1 else 0.0
    l1, l2 = len(s1), len(s2)
    if l1 == 0 or l2 == 0:
        return 0.0
    match_dist = max(max(l1, l2) // 2 - 1, 0)
    flags = bytearray(l2)
    s1_matched = []
    find = s2.find
    for i, c in enumerate(s1):
        lo = i - match_dist if i > match_dist else 0
        hi = i + match_dist + 1
        if hi > l2:
            hi = l2
        j = find(c, lo, hi)
        while j != -1 and flags[j]:
            j = find(c, j + 1, hi)
        if j != -1:
            flags[j] = 1
            s1_matched.append(c)
    m = len(s1_matched)
    if m == 0:
        return 0.0
    t = 0
    k = 0
    for j in range(l2):
        if flags[j]:
            if s2[j] != s1_matched[k]:
                t += 1
            k += 1
    t = t / 2.0
    return (m / l1 + m / l2 + (m - t) / m) / 3.0


def _jaro_reference(s1: str, s2: str) -> float:
    """Textbook double-loop Jaro similarity (run-1 implementation; used in tests only)."""
    if s1 == s2:
        return 1.0 if s1 else 0.0
    l1, l2 = len(s1), len(s2)
    if l1 == 0 or l2 == 0:
        return 0.0
    match_dist = max(max(l1, l2) // 2 - 1, 0)
    s2_flags = [False] * l2
    s1_matched = []
    for i, c in enumerate(s1):
        lo = i - match_dist if i > match_dist else 0
        hi = min(i + match_dist + 1, l2)
        for j in range(lo, hi):
            if not s2_flags[j] and s2[j] == c:
                s2_flags[j] = True
                s1_matched.append(c)
                break
    m = len(s1_matched)
    if m == 0:
        return 0.0
    s2_matched = [s2[j] for j in range(l2) if s2_flags[j]]
    t = sum(a != b for a, b in zip(s1_matched, s2_matched)) / 2.0
    return (m / l1 + m / l2 + (m - t) / m) / 3.0


def jaro_winkler(s1: str, s2: str, p: float = 0.1, max_prefix: int = 4) -> float:
    """Jaro-Winkler similarity (Winkler 1990), own implementation."""
    j = jaro(s1, s2)
    if j <= 0.0:
        return j
    ell = 0
    for a, b in zip(s1[:max_prefix], s2[:max_prefix]):
        if a != b:
            break
        ell += 1
    return j + ell * p * (1.0 - j)


_NORM_MAP = {"street": "st", "avenue": "ave", "boulevard": "blvd", "road": "rd", "lane": "ln",
             "drive": "dr", "congregation": "cong", "synagogue": "syn", "cemetery": "cem",
             "second": "2nd", "third": "3rd", "building": "bldg", "university": "univ",
             "community": "comm", "center": "ctr", "&": "and"}
_STOP = {"near", "outside", "at", "the", "of"}
_PUNCT = re.compile(r"[^a-z0-9 ]+")


def normalize_venue(s: str) -> str:
    s = _PUNCT.sub(" ", s.lower())
    toks = [_NORM_MAP.get(t, t) for t in s.split() if t not in _STOP]
    return " ".join(toks)


# ---------------------------------------------------------------------------
# blocking and comparison
# ---------------------------------------------------------------------------
DATE_BREAKS = (1, 3, 8)          # |dd| = 0 | 1-2 | 3-7 | >=8 (up to the window)
HOUR_BREAKS = (2, 4)             # circular |dh| <= 1 | 2-3 | >= 4 ; level 3 = missing
VENUE_BREAKS = (0.96, 0.90, 0.80)
FIELDS = ("date", "hour", "location", "type", "venue")
N_LEVELS = (4, 4, 3, 3, 5)       # last level of hour / venue = missing on either side
MISSING_LEVEL = {1: 3, 4: 4}     # field -> level meaning "missing" (location 2 = unknown county)


@dataclass
class Prepared:
    records: Records
    venue_norm: np.ndarray
    type_mask: np.ndarray


def prepare(records: Records) -> Prepared:
    vn = np.array([normalize_venue(v) for v in records.venue], dtype=object)
    tm = np.array([CROSSWALK[(int(k), lab)] for k, lab in zip(records.list_id, records.type_label)],
                  dtype=np.int64)
    return Prepared(records, vn, tm)


def candidate_pairs(records: Records, adjacency: np.ndarray, window: int = 14) -> np.ndarray:
    """All pairs (i < j) with |date_i - date_j| <= window and compatible counties.

    Counties are compatible if equal or adjacent, or if either is unknown (-1).
    Returns an (P, 2) int array with i < j (record indices).
    """
    n = len(records)
    order = np.argsort(records.date, kind="stable")
    d = records.date[order]
    hi = np.searchsorted(d, d + window, side="right")
    counts = hi - np.arange(n) - 1
    a = np.repeat(np.arange(n), counts)
    offs = np.arange(counts.sum()) - np.repeat(np.cumsum(counts) - counts, counts)
    b = a + 1 + offs
    i, j = order[a], order[b]
    C = adjacency.shape[0]
    adj = np.ones((C + 1, C + 1), dtype=bool)   # index C = unknown county
    adj[:C, :C] = adjacency
    ci = np.where(records.county[i] < 0, C, records.county[i])
    cj = np.where(records.county[j] < 0, C, records.county[j])
    keep = adj[ci, cj]
    i, j = i[keep], j[keep]
    lo, hi_ = np.minimum(i, j), np.maximum(i, j)
    P = np.stack([lo, hi_], axis=1)
    if len(P):
        P = P[np.lexsort((P[:, 1], P[:, 0]))]
    return P.astype(np.int64)


def compare(prep: Prepared, pairs: np.ndarray, cache: dict | None = None) -> np.ndarray:
    """Comparison vectors gamma (P, 5) with levels as documented in N_LEVELS."""
    rec = prep.records
    i, j = pairs[:, 0], pairs[:, 1]
    P = len(pairs)
    g = np.zeros((P, len(FIELDS)), dtype=np.int64)
    dd = np.abs(rec.date[i] - rec.date[j])
    g[:, 0] = np.digitize(dd, DATE_BREAKS)
    hi_, hj = rec.hour[i], rec.hour[j]
    dh = np.abs(hi_ - hj)
    dh = np.minimum(dh, 24 - dh)
    g[:, 1] = np.where((hi_ < 0) | (hj < 0), 3, np.digitize(dh, HOUR_BREAKS))
    ci, cj = rec.county[i], rec.county[j]
    unknown = (ci < 0) | (cj < 0)
    same = (ci == cj) & ~unknown
    g[:, 2] = np.where(same, 0, np.where(unknown, 2, 1))
    mi, mj = prep.type_mask[i], prep.type_mask[j]
    inter = mi & mj
    single = lambda m: (m & (m - 1)) == 0
    g[:, 3] = np.where(inter == 0, 2, np.where(single(mi) & single(mj), 0, 1))
    cache = {} if cache is None else cache
    vn = prep.venue_norm
    lev = np.empty(P, dtype=np.int64)
    b0, b1, b2 = VENUE_BREAKS
    for p in range(P):
        s1, s2 = vn[i[p]], vn[j[p]]
        if not s1 or not s2:
            lev[p] = 4
            continue
        key = (s1, s2) if s1 <= s2 else (s2, s1)
        sim = cache.get(key)
        if sim is None:
            sim = jaro_winkler(key[0], key[1])
            cache[key] = sim
        lev[p] = 0 if sim >= b0 else (1 if sim >= b1 else (2 if sim >= b2 else 3))
    g[:, 4] = lev
    return g


# ---------------------------------------------------------------------------
# Fellegi-Sunter EM: latent-class mixture, conditional independence within class
# ---------------------------------------------------------------------------
@dataclass
class FSModel:
    """C-class mixture over comparison vectors; class 0 = match (m), classes 1.. = non-match (u).

    With C = 2 this is the classical Fellegi-Sunter model under conditional
    independence. With C = 3 the extra non-match class absorbs 'related'
    non-matches (distinct incidents that share venue / county / type, e.g.
    repeat attacks on the same institution), which otherwise violate the CI
    assumption and are pulled into the match class (cf. Winkler 1993;
    Larsen and Rubin 2001).
    """
    weights: np.ndarray        # (C,) class proportions; weights[0] = p (match)
    theta: list                # theta[c][f] = level probabilities of field f in class c
    n_iter: int
    converged: bool
    loglik: float

    @property
    def p(self):
        return float(self.weights[0])

    @property
    def m(self):
        return self.theta[0]

    @property
    def u(self):
        """Non-match level probabilities (marginal over the non-match classes, per field)."""
        w = self.weights[1:] / self.weights[1:].sum()
        return [sum(w[c] * self.theta[c + 1][f] for c in range(len(w))) for f in range(len(self.theta[0]))]

    def class_loglik(self, gamma):
        C = len(self.weights)
        out = np.zeros((len(gamma), C))
        for c in range(C):
            for f in range(gamma.shape[1]):
                out[:, c] += np.log(self.theta[c][f][gamma[:, f]])
        return out

    def log_weights(self, gamma):
        """FS weight log m(gamma)/u(gamma), u = mixture of the non-match classes."""
        L = self.class_loglik(gamma)
        wn = self.weights[1:] / self.weights[1:].sum()
        lu = _logsumexp(L[:, 1:] + np.log(wn), axis=1)
        return L[:, 0] - lu

    def posterior(self, gamma, weights=None):
        w = self.weights if weights is None else np.asarray(weights)
        L = self.class_loglik(gamma) + np.log(w)
        return np.exp(L[:, 0] - _logsumexp(L, axis=1))

    def to_dict(self):
        return dict(weights=self.weights.tolist(),
                    theta=[[x.tolist() for x in th] for th in self.theta],
                    n_iter=int(self.n_iter), converged=bool(self.converged))


def _logsumexp(a, axis):
    mx = np.max(a, axis=axis, keepdims=True)
    return (mx + np.log(np.sum(np.exp(a - mx), axis=axis, keepdims=True))).squeeze(axis)


def _agree_init(L, freq, f):
    mm = 0.25 ** np.arange(L)
    if f in MISSING_LEVEL:
        ml = MISSING_LEVEL[f]
        mm[ml] = 0.0
        mm = mm / mm.sum() * (1 - freq[ml])
        mm[ml] = freq[ml]
    elif f == 2:     # unknown county level
        mm[2] = freq[2]
    return mm / mm.sum()


TIED_FIELDS = (0, 1)   # date, hour: identical distribution in both non-match classes


def fs_em(gamma: np.ndarray, n_levels=N_LEVELS, n_classes: int = 3, max_iter: int = 5000,
          tol: float = 1e-9, alpha: float = 1e-3, tie_nonmatch: bool = True,
          init: "FSModel | None" = None) -> FSModel:
    """Unsupervised EM for the latent-class comparison model (alg:fsem).

    Runs on the unique comparison patterns with multiplicities. ``alpha`` is a
    small pseudo-count keeping every level probability strictly positive.
    Initialisation: class 0 (match) favours agreement on every field; class 1
    (C = 3, related non-match) favours agreement on location / type / venue but
    has the overall date / hour distribution; the last class is the overall
    distribution (or a warm start from ``init``). With ``tie_nonmatch`` (default) the two non-match classes
    share their date and hour distributions: for two *distinct* incidents the
    date / hour differences do not depend on whether they share a venue, so
    the related class can only explain venue / location / type agreement.
    After convergence the match class is the one with the largest probability
    of exact date agreement.
    """
    pats, counts = np.unique(gamma, axis=0, return_counts=True)
    counts = counts.astype(float)
    F = gamma.shape[1]
    freq = [np.bincount(pats[:, f], weights=counts, minlength=n_levels[f]) + alpha for f in range(F)]
    freq = [x / x.sum() for x in freq]
    theta = [[_agree_init(n_levels[f], freq[f], f) for f in range(F)]]
    if n_classes == 3:
        theta.append([freq[f].copy() if f in (0, 1) else _agree_init(n_levels[f], freq[f], f) for f in range(F)])
        w = np.array([0.04, 0.04, 0.92])
    elif n_classes == 2:
        w = np.array([0.05, 0.95])
    else:
        raise ValueError("n_classes must be 2 or 3")
    theta.append([freq[f].copy() for f in range(F)])
    if init is not None and len(init.weights) == len(w):     # warm start
        theta = [[x.copy() for x in th] for th in init.theta]
        w = init.weights.copy()
    C = len(theta)
    # one-hot design over (field, level): L = X @ log(theta)^T, level counts = X^T @ R
    offs = np.concatenate([[0], np.cumsum(n_levels)])
    X = np.zeros((len(pats), offs[-1]))
    for f in range(F):
        X[np.arange(len(pats)), offs[f] + pats[:, f]] = 1.0
    T = np.array([np.concatenate(th) for th in theta])          # (C, total levels)
    tied = [np.arange(offs[f], offs[f + 1]) for f in TIED_FIELDS] if (tie_nonmatch and C == 3) else []
    prev = -np.inf
    converged = False
    it = 0
    ll = -np.inf
    for it in range(1, max_iter + 1):
        L = X @ np.log(T).T + np.log(w)
        mx = L.max(axis=1, keepdims=True)
        lse = (mx + np.log(np.exp(L - mx).sum(axis=1, keepdims=True)))[:, 0]
        ll = float(counts @ lse)
        R = np.exp(L - lse[:, None]) * counts[:, None]
        w = np.clip(R.sum(axis=0) / counts.sum(), 1e-12, None)
        w /= w.sum()
        S = (X.T @ R).T + alpha                                    # (C, total levels)
        for idx in tied:
            S[1, idx] = S[2, idx] = S[1, idx] + S[2, idx] - alpha
        for f in range(F):
            seg = slice(offs[f], offs[f + 1])
            S[:, seg] /= S[:, seg].sum(axis=1, keepdims=True)
        T = S
        if abs(ll - prev) < tol * max(1.0, abs(ll)):
            converged = True
            break
        prev = ll
    theta = [[T[c, offs[f]:offs[f + 1]].copy() for f in range(F)] for c in range(C)]
    # identify the match class: largest P(exact date agreement)
    mc = int(np.argmax([theta[c][0][0] for c in range(C)]))
    if mc != 0:
        order = [mc] + [c for c in range(C) if c != mc]
        theta = [theta[c] for c in order]
        w = w[order]
    return FSModel(weights=w, theta=theta, n_iter=it, converged=converged, loglik=ll)


def fit_weights(model: FSModel, gamma: np.ndarray, max_iter: int = 1000, tol: float = 1e-10) -> np.ndarray:
    """EM for the class proportions only, class-conditional distributions held fixed."""
    w = model.weights.copy()
    if len(gamma) == 0:
        return w
    pats, counts = np.unique(gamma, axis=0, return_counts=True)
    L0 = model.class_loglik(pats)
    for _ in range(max_iter):
        L = L0 + np.log(w)
        R = np.exp(L - _logsumexp(L, axis=1)[:, None]) * counts[:, None]
        w_new = np.clip(R.sum(axis=0) / counts.sum(), 1e-12, None)
        w_new /= w_new.sum()
        if np.max(np.abs(w_new - w)) < tol:
            w = w_new
            break
        w = w_new
    return w


# ---------------------------------------------------------------------------
# clustering
# ---------------------------------------------------------------------------
class _UF:
    __slots__ = ("parent", "mask")

    def __init__(self, n, masks):
        self.parent = list(range(n))
        self.mask = list(masks)

    def find(self, x):
        par = self.parent
        root = x
        while par[root] != root:
            root = par[root]
        while par[x] != root:
            par[x], x = root, par[x]
        return root

    def try_union(self, a, b, constrained=True):
        ra, rb = self.find(a), self.find(b)
        if ra == rb:
            return False
        if constrained and (self.mask[ra] & self.mask[rb]):
            return False
        if ra > rb:
            ra, rb = rb, ra
        self.parent[rb] = ra
        self.mask[ra] |= self.mask[rb]
        return True

    def labels(self):
        return np.array([self.find(x) for x in range(len(self.parent))], dtype=np.int64)


def cluster_constrained(n: int, list_id: np.ndarray, pairs: np.ndarray, order: np.ndarray):
    """Merge pairs in the given order subject to <= 1 record per list per cluster.

    Returns (labels, accepted) where accepted is a boolean array over ``order``
    positions mapped back to pair indices (the spanning-forest edges).
    """
    uf = _UF(n, (1 << np.asarray(list_id, dtype=np.int64)).tolist())
    accepted = np.zeros(len(pairs), dtype=bool)
    pa, pb = pairs[:, 0].tolist(), pairs[:, 1].tolist()
    for idx in np.asarray(order).tolist():
        if uf.try_union(pa[idx], pb[idx]):
            accepted[idx] = True
    return uf.labels(), accepted


def greedy_link(n, list_id, pairs, post, threshold=0.5):
    """Single best linkage: greedy by descending posterior above ``threshold``."""
    cand = np.flatnonzero(post >= threshold)
    order = cand[np.argsort(-post[cand], kind="stable")]
    return cluster_constrained(n, list_id, pairs, order)


def sample_linkage_bernoulli(n, list_id, pairs, post, rng):
    """Run-1 imputation (kept for reference; NOT a posterior sampler).

    Independent Bernoulli(pi) link proposals applied in random order under the
    one-record-per-list constraint. Transitive closure of the accepted proposals
    joins records whose own pair has a low posterior, so with miscalibrated FS
    posteriors it produces far more false merges than the point linkage.
    """
    on = np.flatnonzero(rng.random(len(post)) < post)
    order = on[rng.permutation(len(on))]
    labels, _ = cluster_constrained(n, list_id, pairs, order)
    return labels


sample_linkage = sample_linkage_bernoulli   # backwards-compatible name


def _connected(nodes, nbr):
    """Whether ``nodes`` (a small set of records) is connected in the retained-edge graph."""
    if len(nodes) <= 1:
        return True
    it = iter(nodes)
    seen = {next(it)}
    stack = list(seen)
    while stack:
        x = stack.pop()
        nx = nbr[x]
        for y in nodes:
            if y not in seen and y in nx:
                seen.add(y)
                stack.append(y)
    return len(seen) == len(nodes)


def gibbs_linkage(n, list_id, pairs, post, rng, n_draws=20, burn=10, thin=2, init_labels=None,
                  tau=1e-3, return_trace=False):
    """Approximate posterior linkage draws by single-record Gibbs sampling over partitions.

    Target (plug-in empirical-Bayes Fellegi-Sunter posterior with a pairwise
    composite likelihood)::

        p(Lambda | gamma) propto prod_{r < r' in one cluster of Lambda} omega_rr'

    with ``omega = pi / (1 - pi)`` for candidate pairs with ``pi >= tau``
    ("retained edges") and the floor ``omega_0 = tau / (1 - tau)`` for every
    other within-cluster pair (non-candidate pairs and candidate pairs with
    ``pi < tau``), on the partitions in which every cluster holds at most one
    record per list and is connected in the retained-edge graph (the support of
    the greedy point linkage, which only follows edges with pi >= 0.5). For an
    isolated candidate pair the target reproduces the FS posterior pi exactly.
    For a record that could join a multi-record cluster C, the joining odds are
    the product of its pairwise odds with *every* member of C, so -- unlike the
    run-1 Bernoulli/greedy imputation -- weak links are not chained transitively.

    One sweep visits every record that has at least one retained edge, in random
    order, and resamples its cluster from its full conditional: {own singleton}
    and the clusters that contain a retained neighbour and no record of its list,
    subject to the cluster it leaves staying connected (if it would not, the
    record stays). The chain starts from ``init_labels`` (default: all
    singletons; clusters of ``init_labels`` that are not admissible are split
    into singletons). Draws are taken every ``thin`` sweeps after ``burn`` sweeps.

    Returns a list of ``n_draws`` label arrays (and, with ``return_trace``, a dict
    with the number of links Sum_c (|c| - 1) after every sweep, the number of
    records that changed cluster per sweep and sizes of the sampler).
    """
    n = int(n)
    list_id = np.asarray(list_id)
    keep = post >= tau
    pk = np.clip(post[keep], tau, 1.0 - 1e-12)
    lw = (np.log(pk) - np.log1p(-pk)).tolist()
    w0 = float(np.log(tau) - np.log1p(-tau))
    nbr = [dict() for _ in range(n)]
    for i, j, w in zip(pairs[keep, 0].tolist(), pairs[keep, 1].tolist(), lw):
        nbr[i][j] = w
        nbr[j][i] = w
    bit = (1 << list_id.astype(np.int64)).tolist()
    # ---- initial state
    lab = list(range(n))
    if init_labels is not None:
        groups = {}
        for r, c in enumerate(np.asarray(init_labels).tolist()):
            groups.setdefault(c, []).append(r)
        for mem in groups.values():
            mask = 0
            ok = True
            for r in mem:
                if mask & bit[r]:
                    ok = False
                mask |= bit[r]
            if ok and _connected(set(mem), nbr):
                for r in mem:
                    lab[r] = mem[0]
    members = {}
    for r, c in enumerate(lab):
        members.setdefault(c, set()).add(r)
    lmask = {c: 0 for c in members}
    for r, c in enumerate(lab):
        lmask[c] |= bit[r]
    free = [c for c in range(n) if c not in members]
    active = np.array([r for r in range(n) if nbr[r]], dtype=np.int64)
    draws, trace_links, trace_moves = [], [], []
    n_sweeps = burn + n_draws * thin
    exp = np.exp
    for sweep in range(n_sweeps):
        moves = 0
        order = active[rng.permutation(len(active))].tolist()
        us = rng.random(len(order)).tolist()
        for r, u in zip(order, us):
            c = lab[r]
            mem = members[c]
            nr = nbr[r]
            if len(mem) > 2:
                rest = mem - {r}
                if not _connected(rest, nbr):
                    continue        # leaving would disconnect the cluster: r stays (forced)
            mem.discard(r)
            if mem:
                lmask[c] ^= bit[r]
            else:
                del members[c]
                del lmask[c]
                free.append(c)
            br = bit[r]
            opts = [-1]
            vals = [0.0]
            seen = set()
            for q in nr:
                cq = lab[q]
                if cq in seen or cq == -1:
                    continue
                seen.add(cq)
                if lmask[cq] & br:
                    continue
                sc = 0.0
                for y in members[cq]:
                    sc += nr.get(y, w0)
                opts.append(cq)
                vals.append(sc)
            if len(opts) == 1:
                choice = -1
            else:
                v = np.asarray(vals)
                pr = exp(v - v.max())
                cs = np.cumsum(pr)
                choice = opts[int(np.searchsorted(cs, u * cs[-1], side="right"))]
            if choice == -1:
                cn = free.pop()
                members[cn] = {r}
                lmask[cn] = br
            else:
                cn = choice
                members[cn].add(r)
                lmask[cn] |= br
            if cn != c:
                moves += 1
            lab[r] = cn
        if return_trace:
            trace_links.append(n - len(members))
            trace_moves.append(moves)
        if sweep >= burn and (sweep - burn + 1) % thin == 0:
            draws.append(np.array(lab, dtype=np.int64))
    if return_trace:
        return draws, dict(n_links=trace_links, n_moves=trace_moves, n_active=int(len(active)),
                           n_edges=int(keep.sum()), tau=tau, burn=burn, thin=thin)
    return draws


def table_from_labels(labels: np.ndarray, list_id: np.ndarray, K: int = 4, keep=None):
    """Capture table {h: n_h} from cluster labels (one history per cluster)."""
    labels = np.asarray(labels)
    lid = np.asarray(list_id)
    if keep is not None:
        labels, lid = labels[keep], lid[keep]
    _, inv = np.unique(labels, return_inverse=True)
    masks = np.zeros(inv.max() + 1 if len(inv) else 0, dtype=np.int64)
    np.bitwise_or.at(masks, inv, 1 << lid)
    counts = np.bincount(masks, minlength=2 ** K)
    return {tuple((c >> k) & 1 for k in range(K)): int(counts[c]) for c in range(1, 2 ** K)}


# ---------------------------------------------------------------------------
# empirical linkage error (ground truth)
# ---------------------------------------------------------------------------
def linkage_error(labels: np.ndarray, true_id: np.ndarray, list_id: np.ndarray):
    """Linkage quality of a partition of ALL records against the truth.

    The unit is a capture (true incident i, list k). A true cross-list capture
    pair {(i,k), (i,k')} is *kept* if some estimated cluster contains records of
    both captures. Precision is computed over the list-pairs of the estimated
    clusters (a list-pair {k,k'} of cluster c is correct if one true incident has
    records of both lists in c). LE-model rates:
      delta = 1 - sqrt(recall)          (pairwise recall = (1 - delta)^2 under LE)
      eps   = M / (S + M)               (M false merges, S singleton clusters)
    Also counts 'split captures' (a capture whose records sit in >1 cluster,
    e.g. a missed within-list duplicate), which LE does not model.
    """
    labels = np.asarray(labels)
    true_id = np.asarray(true_id)
    list_id = np.asarray(list_id)
    # cluster -> {incident -> list-bitmask}
    by_c = {}
    for c, t, k in zip(labels.tolist(), true_id.tolist(), list_id.tolist()):
        d = by_c.setdefault(c, {})
        d[t] = d.get(t, 0) | (1 << k)
    pc = [bin(x).count("1") for x in range(1 << 8)]
    # true capture sets per incident
    inc_mask = {}
    for t, k in zip(true_id.tolist(), list_id.tolist()):
        inc_mask[t] = inc_mask.get(t, 0) | (1 << k)
    n_true_pairs = sum(pc[m] * (pc[m] - 1) // 2 for m in inc_mask.values())
    kept_pairs = {}
    n_linked = 0
    n_correct = 0
    merges = 0
    singles = 0
    cap_clusters = {}
    for c, d in by_c.items():
        cm = 0
        for t, m in d.items():
            cm |= m
            for k in range(8):
                if m >> k & 1:
                    cap_clusters[(t, k)] = cap_clusters.get((t, k), 0) + 1
            if pc[m] >= 2:
                s_ = kept_pairs.setdefault(t, set())
                ks = [k for k in range(8) if m >> k & 1]
                for a in range(len(ks)):
                    for b in range(a + 1, len(ks)):
                        s_.add((ks[a], ks[b]))
        merges += len(d) - 1
        if pc[cm] == 1:
            singles += 1
        ks = [k for k in range(8) if cm >> k & 1]
        for a in range(len(ks)):
            for b in range(a + 1, len(ks)):
                n_linked += 1
                both = (1 << ks[a]) | (1 << ks[b])
                if any((m & both) == both for m in d.values()):
                    n_correct += 1
    kept = sum(len(v) for v in kept_pairs.values())
    recall = kept / n_true_pairs if n_true_pairs else 1.0
    precision = n_correct / n_linked if n_linked else 1.0
    split = sum(1 for v in cap_clusters.values() if v > 1)
    delta = 1.0 - np.sqrt(recall)
    eps = merges / (singles + merges) if (singles + merges) else 0.0
    return dict(precision=float(precision), recall=float(recall), n_true_pairs=int(n_true_pairs),
                n_linked_pairs=int(n_linked), n_false_merges=int(merges), n_singletons=int(singles),
                n_split_captures=int(split), n_clusters=int(len(by_c)),
                delta=float(delta), eps=float(eps))


# ---------------------------------------------------------------------------
# clerical review simulator: the random stratified audit of Prop. prop:link-audit
# (NOT the targeted review of Alg. alg:review; reviewed links are not fixed)
# ---------------------------------------------------------------------------
def audit_frame_truth(pairs: np.ndarray, labels: np.ndarray, accepted: np.ndarray, true_id: np.ndarray):
    """The audit's estimand computed from the truth on the SAME frame (all candidate pairs).

    TP = true-match candidate pairs in one cluster, FN = true-match candidate pairs
    split, FE = false accepted edges (false spanning-forest edges = false merges
    along accepted links), S = singleton clusters. delta_frame = 1 - sqrt(TP/(TP+FN)),
    eps_frame = FE/(S + FE): what clerical_review estimates without design error.
    """
    same = labels[pairs[:, 0]] == labels[pairs[:, 1]]
    truth = true_id[pairs[:, 0]] == true_id[pairs[:, 1]]
    TP = int((same & truth).sum())
    FN = int((~same & truth).sum())
    FE = int((accepted & ~truth).sum())
    S = int((np.unique(labels, return_counts=True)[1] == 1).sum())
    rec = TP / (TP + FN) if TP + FN else 1.0
    return dict(TP=TP, FN=FN, FE=FE, singletons=S, recall_frame=float(rec),
                delta_frame=float(1.0 - np.sqrt(rec)), eps_frame=float(FE / (S + FE)) if S + FE else 0.0)


REVIEW_BREAKS = (1e-4, 1e-3, 0.01, 0.05, 0.2, 0.5, 0.8, 0.95, 0.99)


def clerical_review(pairs: np.ndarray, post: np.ndarray, labels: np.ndarray, accepted: np.ndarray,
                    true_id: np.ndarray, B: int, rng, s_floor: float = 0.01,
                    min_per_stratum: int = 2):
    """Random stratified audit of B candidate pairs with Neyman allocation (Prop. prop:link-audit).

    This is the design-based audit of the error rates, not the targeted review of
    Alg. alg:review: pairs are a probability sample, and the reviewed outcomes are
    used only to estimate (delta, eps); the reviewed links are not fixed in the
    linkage. The estimand is defined on the candidate-pair frame (see
    audit_frame_truth); true matches outside every block are not in the frame.

    Strata = link status (A: accepted edge, L: same cluster but not an edge,
    U: different clusters) x posterior bins REVIEW_BREAKS. The allocation is
    n_s proportional to N_s * S_s with S_s = max(s_floor, sqrt(pibar_s (1-pibar_s))),
    pibar_s the mean model posterior in stratum s (the model-based pilot),
    capped at N_s with the remainder re-allocated. Reviewing a pair reveals
    whether the two records belong to the same true incident.

    Estimates (Horvitz-Thompson within strata):
      TP  = sum_{s in A u L} N_s thetahat_s   (true matches kept together)
      FN  = sum_{s in U}     N_s thetahat_s   (true matches split)
      FE  = sum_{s in A}     N_s (1 - thetahat_s) (false accepted edges = merges)
      delta_hat = 1 - sqrt(TP / (TP + FN)),  eps_hat = FE / (S + FE)
    where S is the (observed) number of singleton clusters. Standard errors use
    the stratified variance with finite-population correction (within-stratum
    variance floored at the model-based pibar_s (1 - pibar_s)) and the delta method.
    """
    P = len(pairs)
    same = labels[pairs[:, 0]] == labels[pairs[:, 1]]
    status = np.where(accepted, 0, np.where(same, 1, 2))
    pbin = np.digitize(post, REVIEW_BREAKS)
    nb = len(REVIEW_BREAKS) + 1
    stratum = status * nb + pbin
    S_ids = np.unique(stratum)
    Ns = np.array([(stratum == s).sum() for s in S_ids])
    pibar = np.array([post[stratum == s].mean() for s in S_ids])
    Ss = np.maximum(s_floor, np.sqrt(pibar * (1 - pibar)))
    # Neyman allocation with caps
    B = int(min(B, P))
    alloc = np.minimum(Ns, min_per_stratum)
    remaining = B - alloc.sum()
    free = alloc < Ns
    while remaining > 0 and free.any():
        w = Ns * Ss * free
        share = remaining * w / w.sum()
        add = np.minimum(np.floor(share).astype(int), Ns - alloc)
        if add.sum() == 0:   # hand out the last few units by largest remainder
            idx = np.argsort(-(share - np.floor(share)) * free)[:remaining]
            for t in idx:
                if alloc[t] < Ns[t]:
                    alloc[t] += 1
            break
        alloc += add
        remaining = B - alloc.sum()
        free = alloc < Ns
    alloc = np.minimum(alloc, Ns)
    est = dict(TP=0.0, FN=0.0, FE=0.0)
    var = dict(TP=0.0, FN=0.0, FE=0.0)
    n_reviewed = 0
    for s, N_s, n_s, pibar_s in zip(S_ids, Ns, alloc, pibar):
        if n_s == 0:
            continue
        members = np.flatnonzero(stratum == s)
        pick = rng.choice(members, size=int(n_s), replace=False)
        truth = (true_id[pairs[pick, 0]] == true_id[pairs[pick, 1]]).astype(float)
        n_reviewed += int(n_s)
        th = truth.mean()
        # model-assisted variance: the within-stratum variance is floored at the
        # model-based value pibar_s (1 - pibar_s), so strata with zero (or only)
        # hits in the sample do not report zero variance
        s2_hat = truth.var(ddof=1) if n_s > 1 else 0.0
        s2 = max(s2_hat, pibar_s * (1 - pibar_s))
        v = N_s ** 2 * (1 - n_s / N_s) * s2 / n_s
        st = s // nb
        if st in (0, 1):
            est["TP"] += N_s * th
            var["TP"] += v
        else:
            est["FN"] += N_s * th
            var["FN"] += v
        if st == 0:
            est["FE"] += N_s * (1 - th)
            var["FE"] += v
    sizes = np.unique(labels, return_counts=True)[1]
    singles = int((sizes == 1).sum())
    TP, FN, FE = est["TP"], est["FN"], est["FE"]
    recall = TP / (TP + FN) if TP + FN > 0 else 1.0
    delta = 1.0 - np.sqrt(recall)
    eps = FE / (singles + FE) if singles + FE > 0 else 0.0
    # delta method (TP and FN estimated from disjoint strata -> independent)
    tot = TP + FN
    if tot > 0 and recall > 0:
        d_rec_dTP = FN / tot ** 2
        d_rec_dFN = -TP / tot ** 2
        var_rec = d_rec_dTP ** 2 * var["TP"] + d_rec_dFN ** 2 * var["FN"]
        se_delta = float(np.sqrt(var_rec) / (2 * np.sqrt(recall)))
    else:
        se_delta = float("nan")
    se_eps = float(np.sqrt(var["FE"]) * singles / (singles + FE) ** 2) if singles + FE > 0 else float("nan")
    return dict(delta_hat=float(delta), eps_hat=float(eps), se_delta=se_delta, se_eps=se_eps,
                recall_hat=float(recall), TP_hat=float(TP), FN_hat=float(FN), FE_hat=float(FE),
                n_reviewed=n_reviewed, n_strata=int(len(S_ids)), n_candidates=int(P))


# ---------------------------------------------------------------------------
# full linkage run
# ---------------------------------------------------------------------------
def _n_true_cross_pairs(true_id, list_id):
    """Number of record pairs from different lists that belong to the same true incident."""
    true_id = np.asarray(true_id, dtype=np.int64)
    list_id = np.asarray(list_id, dtype=np.int64)
    if len(true_id) == 0:
        return 0
    _, inv = np.unique(true_id, return_inverse=True)
    C = np.zeros((inv.max() + 1, int(list_id.max()) + 1), dtype=np.int64)
    np.add.at(C, (inv, list_id), 1)
    tot = C.sum(axis=1)
    return int(((tot ** 2 - (C ** 2).sum(axis=1)) // 2).sum())


# Full specification of the Fellegi-Sunter EM used in run_linkage (recorded in the results JSON
# so that the paper can describe it).
FS_EM_SPEC = dict(
    fields=dict(
        date=dict(levels=4, definition="|date difference| in days: 0 | 1-2 | 3-7 | >=8 (up to the blocking window)"),
        hour=dict(levels=4, definition="circular |hour difference|: <=1 | 2-3 | >=4 | missing on either side",
                  missing_level=3),
        location=dict(levels=3, definition="same county | different (adjacent) county | county unknown on either side",
                      missing_level=2),
        type=dict(levels=3, definition="harmonised type sets: both single and equal | overlapping | disjoint"),
        venue=dict(levels=5, definition="Jaro-Winkler similarity of normalised venue strings: >=0.96 | >=0.90 | "
                                        ">=0.80 | <0.80 | missing on either side", missing_level=4)),
    missing_handling="'missing' is an explicit comparison level with its own m and u probabilities "
                     "(no missing-at-random marginalisation)",
    n_classes=3,
    classes=["match (m)", "related non-match (shares venue/location/type, e.g. repeat targets)",
             "unrelated non-match"],
    tied_fields=["date", "hour"],
    tie_rule="the two non-match classes share one date and one hour distribution (M-step pools their "
             "expected counts); the related class can only explain venue/location/type agreement",
    conditional_independence="fields independent given the class (within each of the 3 classes)",
    pseudo_count=1e-3, max_iter=5000, tol="relative log-likelihood change < 1e-9",
    init="match class: geometric agreement profile 0.25^level (missing levels at their overall frequency); "
         "related class: agreement profile on location/type/venue, overall date/hour; unrelated class: "
         "overall frequencies; weights (0.04, 0.04, 0.92)",
    match_class_identification="class with the largest P(exact date agreement)",
    fit_sequence="(1) EM on all cross-list candidate pairs; (2) within-list de-duplication with the class-"
                 "conditional distributions held fixed and class proportions re-estimated by EM on the within-"
                 "list pairs, union-find on posterior >= 0.5; (3) EM refit, warm-started at (1), on cross-list "
                 "pairs among the de-duplicated representatives",
    posterior="pi = P(match class | gamma) with the fitted class proportions",
    blocking="same or adjacent county (or either unknown) and |date difference| <= 14 days",
    point_linkage="greedy merging by descending pi over pairs with pi >= 0.5, at most one record per list per cluster",
)


@dataclass
class LinkageConfig:
    window: int = 14
    threshold: float = 0.5
    dedup_threshold: float = 0.5
    n_classes: int = 3
    review_B: int = 300
    n_imputations: int = 20


@dataclass
class LinkageResult:
    rep_idx: np.ndarray          # indices (into the full record set) of de-duplicated representatives
    rep_of: np.ndarray           # for every record, the local index of its representative
    pairs: np.ndarray            # cross-list candidate pairs among representatives (local indices)
    post: np.ndarray             # posterior match probabilities of those pairs
    labels: np.ndarray           # single-best cluster labels of representatives
    accepted: np.ndarray         # accepted-edge flags over pairs
    list_id: np.ndarray          # list ids of representatives
    true_id: np.ndarray          # true incident ids of representatives (ground truth)
    model: FSModel
    info: dict = field(default_factory=dict)

    def labels_all(self, rep_labels=None):
        """Cluster labels for every record (records inherit their representative's label)."""
        lab = self.labels if rep_labels is None else rep_labels
        return np.asarray(lab)[self.rep_of]


def run_linkage(records: Records, adjacency: np.ndarray, cfg: LinkageConfig = LinkageConfig()) -> LinkageResult:
    prep = prepare(records)
    n = len(records)
    pairs_all = candidate_pairs(records, adjacency, cfg.window)
    gamma_all = compare(prep, pairs_all, cache={})
    lid = records.list_id
    cross = lid[pairs_all[:, 0]] != lid[pairs_all[:, 1]]

    # 1) comparison model on cross-list pairs
    model0 = fs_em(gamma_all[cross], n_classes=cfg.n_classes)

    # 2) within-list de-duplication: same class-conditional distributions,
    #    class proportions re-estimated on the within-list pairs
    within = ~cross
    g_w = gamma_all[within]
    if within.any():
        w_w = fit_weights(model0, g_w)
        post_w = model0.posterior(g_w, weights=w_w)
    else:
        w_w, post_w = model0.weights, np.zeros(0)
    pw_pairs = pairs_all[within]
    uf = _UF(n, [0] * n)
    for idx in np.flatnonzero(post_w >= cfg.dedup_threshold):
        uf.try_union(int(pw_pairs[idx, 0]), int(pw_pairs[idx, 1]), constrained=False)
    dlab = uf.labels()
    rep_idx = np.flatnonzero(dlab == np.arange(n))       # union-find roots = smallest index of each group
    is_rep = np.zeros(n, dtype=bool)
    is_rep[rep_idx] = True
    loc = -np.ones(n, dtype=np.int64)
    loc[rep_idx] = np.arange(len(rep_idx))
    rep_of = loc[dlab]

    # 3) refit on cross-list pairs among representatives, then link
    keep = cross & is_rep[pairs_all[:, 0]] & is_rep[pairs_all[:, 1]]
    g_c = gamma_all[keep]
    model = fs_em(g_c, n_classes=cfg.n_classes, init=model0)
    post = model.posterior(g_c)
    pairs = loc[pairs_all[keep]]
    rl = lid[rep_idx]
    labels, accepted = greedy_link(len(rep_idx), rl, pairs, post, cfg.threshold)

    tid = records.true_id
    n_false_dedup = int((tid != tid[dlab]).sum())
    key = tid[rep_idx] * 8 + rl
    n_missed_dup = int(len(key) - len(np.unique(key)))
    # blocking recall: true cross-list record pairs that are candidate pairs
    pa, pb = pairs_all[:, 0], pairs_all[:, 1]
    n_true_cand = int((cross & (tid[pa] == tid[pb])).sum())
    n_true_cross_all = _n_true_cross_pairs(tid, lid)
    # the same on the de-duplicated representatives (the audit / linkage frame)
    n_true_cand_rep = int((tid[rep_idx][pairs[:, 0]] == tid[rep_idx][pairs[:, 1]]).sum())
    n_true_cross_rep = _n_true_cross_pairs(tid[rep_idx], rl)
    info = dict(n_records=int(n), n_reps=int(len(rep_idx)), n_candidate_pairs_all=int(len(pairs_all)),
                n_cross_pairs=int(len(pairs)), within_weights=[float(x) for x in w_w],
                n_dedup_merged=int(n - len(rep_idx)), n_false_dedup=n_false_dedup,
                n_missed_dup=n_missed_dup, n_true_dups=int(records.is_dup.sum()),
                n_true_cross_candidates=n_true_cand, n_true_cross_pairs=n_true_cross_all,
                blocking_recall=float(n_true_cand / n_true_cross_all) if n_true_cross_all else 1.0,
                n_true_cross_candidates_reps=n_true_cand_rep, n_true_cross_pairs_reps=n_true_cross_rep,
                blocking_recall_reps=float(n_true_cand_rep / n_true_cross_rep) if n_true_cross_rep else 1.0,
                fs_weights=[float(x) for x in model.weights], fs_iter=int(model.n_iter),
                fs_converged=bool(model.converged))
    return LinkageResult(rep_idx=rep_idx, rep_of=rep_of, pairs=pairs, post=post, labels=labels,
                         accepted=accepted, list_id=rl, true_id=tid[rep_idx], model=model, info=info)
