"""Batched simulation of accounts (sock puppets, sentinels, real users) on the synthetic recommender.

Policies (index):
    0 alg      candidates = eligible pool + item-to-item neighbours of the current item + trending
               items (sampled proportionally to global popularity); score
                   beta_v <v_u, x_c> + beta_pop log popularity_c + beta_bait bait_c + eps 1{L_c=1}
                   + alg_gumbel * Gumbel,
               slate = top-k. v_u is the algorithm's user embedding (engagement-optimising update:
               v_u <- (1 - lam) v_u + lam x_c after each opened item).
    1 chron    reverse-chronological: the k most recent posts in the eligible pool. Posting is
               Poisson with item rates r_c, so the k most recent are a Gumbel-top-k draw on log r_c.
    2 random   k items uniformly at random from the eligible pool.
    3 popular  top-k of the eligible pool by global popularity (non-personalised).
The eligible pool (size M, fresh each step) is drawn from the catalogue by the account's follow
profile over topics (that of its persona / demand type), except that a share `fringe` of its slots is
drawn from followed fringe sources (borderline and antisemitic items); `fringe` is 0 for puppets and
evolves with real users' demand. All policies share the pool. Only alg can reach items outside it.

Global popularity pop_c (per-round open rate) is either frozen at the background steady state
V * w_c (no interference) or updated every round from the puppets' opens:
    pop <- delta pop + (1 - delta)(V w + o_round),
which is the interference channel (puppets change the model they audit).

Timing convention within a session: at step t the account is on item c_t (content state X_t),
is shown slate S_t (generated from c_t), and opens c_{t+1} (or nothing; then c_{t+1} = c_t).
Exposure at step t = share of the k slate items with L = 1.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass, field

import numpy as np

from .world import N_BANDS, N_TYPES, World

POLICIES = ("alg", "chron", "random", "popular")
POL = {p: i for i, p in enumerate(POLICIES)}
NCAT = N_TYPES * N_BANDS          # exposure-count categories: type * N_BANDS + band


@dataclass(frozen=True)
class RecConfig:
    pool_size: int = 50
    n_trend: int = 15
    slate_k: int = 4
    beta_v: float = 2.0
    beta_pop: float = 0.3
    beta_bait: float = 1.0
    alg_gumbel: float = 0.5
    lam: float = 0.1
    pop_gumbel: float = 0.05
    eps_anti: float = 0.0          # perturbation: tilt of the alg score toward items with L = 1
    replace_anti: float = -1.0     # perturbation of thm:perturb(c): with this probability the next item is
                                   # replaced by a random antisemitic item (< 0: disabled, no random draws)

    def to_dict(self):
        return asdict(self)


@dataclass(frozen=True)
class ChoiceConfig:
    # protocol puppet (avoid-on-flag): open the highest-ranked item with classifier logit < tau_safe
    # and similarity to the persona > sim_min; else the highest-ranked item with logit < tau_safe.
    tau_safe: float = -0.5
    sim_min: float = 0.25
    # naturalistic users: multinomial logit over the slate plus an outside option
    beta_theta: float = 3.0
    beta_bait: float = 0.8
    pos_cost: float = 0.3
    outside: float = 1.0
    beta_cur: float = 0.0          # continuation: utility of similarity to the item currently open

    def to_dict(self):
        return asdict(self)


@dataclass(frozen=True)
class SessionConfig:
    train_days: int = 3
    seeds_per_day: int = 10
    n_sessions: int = 10
    T: int = 20
    day_rounds: int = 100          # rounds per day; background-only rounds fill the rest of a day

    def to_dict(self):
        return asdict(self)


@dataclass(frozen=True)
class EvolveConfig:
    """Evolving demand of real users, applied after each session (f_x = share of the session's opens in state x)."""
    eta_theta: float = 0.05        # taste drifts toward the mean embedding of opened items
    eta_alpha: float = 0.4         # appetite: alpha_x += eta_alpha f_x - zeta (alpha_x - alpha_x(0)), x in {B, A}
    zeta: float = 0.1
    alpha_max: float = 2.0
    eta_fringe: float = 0.02       # follows of fringe (B / A) sources: s += eta_fringe (f_B + f_A) - zeta_fringe (s - s(0))
    zeta_fringe: float = 0.1
    fringe_max: float = 0.5

    def to_dict(self):
        return asdict(self)


class GlobalState:
    """Global popularity: frozen (no interference) or dynamic (puppet opens feed back)."""

    def __init__(self, world: World, rec: RecConfig, V: float = 1.0, delta: float = 0.993,
                 dynamic: bool = False):
        self.world, self.rec = world, rec
        self.V, self.delta, self.dynamic = float(V), float(delta), bool(dynamic)
        self.pop = self.V * world.w_bg.copy()
        self.puppet_opens = 0.0
        self.item_opens = np.zeros(world.N)     # puppet opens per item since the last reset (load accounting)
        self.active_rounds = 0
        self.rounds = 0
        self._refresh()

    def _refresh(self):
        w = self.world
        self.logpop = np.log(self.pop * w.N / self.V + 0.01)
        self.alg_item = (self.rec.beta_pop * self.logpop + self.rec.beta_bait * w.bait
                         + self.rec.eps_anti * w.L).astype(np.float32)
        c = np.cumsum(self.pop)
        self.cdf = c / c[-1]

    def add_round(self, opened_items: np.ndarray):
        self.rounds += 1
        self.active_rounds += 1
        if not self.dynamic:
            return
        o = np.bincount(opened_items, minlength=self.world.N).astype(float)
        self.puppet_opens += o.sum()
        self.item_opens += o
        self.pop = self.delta * self.pop + (1 - self.delta) * (self.V * self.world.w_bg + o)
        self._refresh()

    def idle(self, g: int):
        self.rounds += max(g, 0)
        if not self.dynamic or g <= 0:
            return
        d = self.delta ** g
        self.pop = d * self.pop + (1 - d) * self.V * self.world.w_bg
        self._refresh()

    def local_load(self, reset=True):
        """Puppets' share of the engagement signal on the items they opened since the last reset:
        sum_c o_c / sum_{c: o_c > 0} (o_c + V w_c * active rounds)."""
        o = self.item_opens
        m = o > 0
        bg = self.V * self.world.w_bg[m].sum() * self.active_rounds
        ell = float(o.sum() / (o.sum() + bg)) if o.sum() > 0 else 0.0
        if reset:
            self.item_opens = np.zeros(self.world.N)
            self.active_rounds = 0
        return ell

    def share_shift(self):
        """Total-variation distance between current and background popularity shares."""
        p = self.pop / self.pop.sum()
        return 0.5 * float(np.abs(p - self.world.w_bg).sum())


@dataclass
class Accounts:
    persona: np.ndarray
    policy: np.ndarray
    choice: np.ndarray             # 0 protocol puppet, 1 naturalistic
    theta: np.ndarray              # demand taste (B, D)
    alpha: np.ndarray              # appetite by state (B, 3)
    alpha0: np.ndarray
    cumphi: np.ndarray             # cumulative follow profile (B, n_topics - 1)
    v: np.ndarray                  # algorithm's user embedding (B, D)
    seeds: np.ndarray              # seed items: training opens and session entry points (B, n_s)
    train: np.ndarray              # bool: has a training phase
    counted: np.ndarray            # bool: opens feed global popularity (when dynamic)
    group: np.ndarray              # group id for per-step traces
    bucket: np.ndarray = field(default=None)   # per-account shift of the alg's bait weight (platform A/B bucket)
    fringe: np.ndarray = field(default=None)   # share of the eligible pool drawn from followed fringe sources
    fringe0: np.ndarray = field(default=None)
    cur: np.ndarray = field(default=None)

    @property
    def B(self):
        return self.persona.size

    def subset(self, idx):
        return Accounts(**{k: (getattr(self, k)[idx].copy() if getattr(self, k) is not None else None)
                           for k in self.__dataclass_fields__})

    def copy(self):
        return self.subset(np.arange(self.B))


def make_puppets(world: World, persona, policy, rng, *, n_seeds=30, seed_pool=None, choice=0,
                 train=True, group=None, coview_cap=None):
    """Sock puppets with fixed demand. Each draws its own random seed subset of size n_seeds from the
    first `seed_pool` items of its persona's seed pool (smaller pool = more co-viewing)."""
    persona = np.asarray(persona, np.int64)
    B = persona.size
    policy = np.broadcast_to(np.asarray(policy, np.int64), (B,)).copy()
    sp = world.cfg.seed_pool if seed_pool is None else int(seed_pool)
    seeds = np.empty((B, n_seeds), np.int64)
    for b in range(B):
        pool = world.seeds[persona[b]][:sp]
        seeds[b] = pool[rng.permutation(pool.size)[:n_seeds]] if pool.size >= n_seeds else \
            pool[rng.integers(0, pool.size, n_seeds)]
    theta = world.theta[persona].copy()
    alpha = world.alpha[persona].copy()
    return Accounts(persona=persona, policy=policy,
                    choice=np.broadcast_to(np.asarray(choice, np.int64), (B,)).copy(),
                    theta=theta, alpha=alpha, alpha0=alpha.copy(),
                    cumphi=np.cumsum(world.phi[persona], axis=1)[:, :-1],
                    v=np.zeros((B, world.D), np.float32), seeds=seeds,
                    train=np.broadcast_to(np.asarray(train, bool), (B,)).copy(),
                    counted=np.ones(B, bool),
                    group=np.zeros(B, np.int64) if group is None else np.asarray(group, np.int64),
                    bucket=np.zeros(B), fringe=np.zeros(B), fringe0=np.zeros(B), cur=seeds[:, 0].copy())


def make_real_users(world: World, n: int, rng, *, shares=None, theta_sd=0.15, alpha_sd=0.3, n_seeds=30):
    """Real users with heterogeneous initial demand (persona type + individual noise), naturalistic
    choice, cold start (v = 0), no scripted training."""
    from .world import REAL_USER_SHARES
    sh = np.asarray(REAL_USER_SHARES if shares is None else shares, float)
    persona = rng.choice(len(sh), size=n, p=sh / sh.sum()).astype(np.int64)
    acc = make_puppets(world, persona, POL["alg"], rng, n_seeds=n_seeds, choice=1, train=False, group=persona)
    th = acc.theta.astype(float) + theta_sd * rng.standard_normal(acc.theta.shape)
    acc.theta = (th / np.linalg.norm(th, axis=1, keepdims=True)).astype(np.float32)
    acc.alpha = acc.alpha + alpha_sd * rng.standard_normal(acc.alpha.shape) * np.array([0, 1, 1])
    acc.alpha0 = acc.alpha.copy()
    acc.counted[:] = False
    return acc


# ---------------------------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------------------------
def _gumbel(rng, shape):
    return -np.log(-np.log(rng.random(shape) + 1e-300) + 1e-300)


def _dup_mask(cand):
    o = np.argsort(cand, axis=1, kind="stable")
    s = np.take_along_axis(cand, o, axis=1)
    d = np.zeros(cand.shape, bool)
    np.put_along_axis(d, o[:, 1:], s[:, 1:] == s[:, :-1], axis=1)
    return d


def _topk(cand, sc, k):
    idx = np.argpartition(-sc, k - 1, axis=1)[:, :k]
    o = np.argsort(-np.take_along_axis(sc, idx, axis=1), axis=1, kind="stable")
    idx = np.take_along_axis(idx, o, axis=1)
    return np.take_along_axis(cand, idx, axis=1)


def step(world: World, acc: Accounts, glob: GlobalState, rec: RecConfig, ch: ChoiceConfig, rng, regime,
         alg_rows, ref_rows, prot_rows, nat_rows):
    """One step for every account: build the slate under its policy, score its impressions with the
    classifier, apply the account's choice rule.
    Returns (slate (B, k), classifier logits of the slate (B, k), opened item or -1 (B,))."""
    B, M, k = acc.B, rec.pool_size, rec.slate_k
    X = world.X
    Q = world.pool_tab.shape[1]
    pool = world.pool_tab[acc.persona[:, None], (rng.random((B, M)) * Q).astype(np.int64)]
    if acc.fringe is not None and acc.fringe.any():
        fm = rng.random((B, M)) < acc.fringe[:, None]
        nf = int(fm.sum())
        if nf:
            pool[fm] = world.fringe_items[rng.integers(0, world.fringe_items.size, nf)]
    slate = np.empty((B, k), np.int64)
    if alg_rows.size:
        a = alg_rows
        tr = np.searchsorted(glob.cdf, rng.random((a.size, rec.n_trend)), side="right")
        np.minimum(tr, world.N - 1, out=tr)
        cand = np.concatenate([pool[a], world.nn[acc.cur[a]], tr], axis=1)
        sc = rec.beta_v * np.einsum("bd,bcd->bc", acc.v[a], X[cand]) + glob.alg_item[cand] \
            + rec.alg_gumbel * _gumbel(rng, cand.shape)
        if acc.bucket is not None and acc.bucket.any():
            sc += acc.bucket[a, None] * world.bait[cand]
        sc[_dup_mask(cand) | (cand == acc.cur[a, None])] = -np.inf
        slate[a] = _topk(cand, sc, k)
    if ref_rows.size:
        r = ref_rows
        cand = pool[r]
        pol = acc.policy[r]
        gs = np.where(pol == POL["popular"], rec.pop_gumbel, 1.0)
        sc = gs[:, None] * _gumbel(rng, cand.shape)
        sc += np.where((pol == POL["chron"])[:, None], world.log_rate[cand], 0.0)
        sc += np.where((pol == POL["popular"])[:, None], glob.logpop[cand], 0.0)
        sc[_dup_mask(cand) | (cand == acc.cur[r, None])] = -np.inf
        slate[r] = _topk(cand, sc, k)
    logit = world.score(regime, slate, rng)
    pick = np.full(B, -1, np.int64)
    if prot_rows.size:
        p = prot_rows
        sl = slate[p]
        safe = logit[p] < ch.tau_safe
        sim = np.einsum("bd,bkd->bk", acc.theta[p], X[sl]) > ch.sim_min
        good = safe & sim
        pick[p] = np.where(good.any(1), good.argmax(1), np.where(safe.any(1), safe.argmax(1), -1))
    if nat_rows.size:
        n = nat_rows
        sl = slate[n]
        st = world.state[sl]
        util = ch.beta_theta * np.einsum("bd,bkd->bk", acc.theta[n], X[sl]) \
            + np.take_along_axis(acc.alpha[n], st, axis=1) + ch.beta_bait * world.bait[sl] \
            - ch.pos_cost * np.arange(k)[None, :] + _gumbel(rng, sl.shape)
        if ch.beta_cur:
            util += ch.beta_cur * np.einsum("bd,bkd->bk", X[acc.cur[n]], X[sl])
        u0 = ch.outside + _gumbel(rng, n.size)
        j = util.argmax(1)
        pick[n] = np.where(util[np.arange(n.size), j] > u0, j, -1)
    opened = np.where(pick >= 0, slate[np.arange(B), np.maximum(pick, 0)], -1)
    return slate, logit, opened


def _rows(acc):
    alg = np.flatnonzero(acc.policy == POL["alg"])
    ref = np.flatnonzero(acc.policy != POL["alg"])
    prot = np.flatnonzero(acc.choice == 0)
    nat = np.flatnonzero(acc.choice == 1)
    return alg, ref, prot, nat


# ---------------------------------------------------------------------------------------------
# phases
# ---------------------------------------------------------------------------------------------
def train(world: World, acc: Accounts, glob: GlobalState, rec: RecConfig, ses: SessionConfig):
    """Persona training: each training account opens its seed items, seeds_per_day per day.
    Updates the algorithm's user embedding and (if dynamic) global popularity."""
    tr = np.flatnonzero(acc.train)
    lam = rec.lam
    for d in range(ses.train_days):
        for j in range(ses.seeds_per_day):
            if tr.size:
                it = acc.seeds[tr, (d * ses.seeds_per_day + j) % acc.seeds.shape[1]]
                acc.v[tr] = (1 - lam) * acc.v[tr] + lam * world.X[it]
                glob.add_round(it[acc.counted[tr]])
            else:
                glob.add_round(np.zeros(0, np.int64))
        glob.idle(ses.day_rounds - ses.seeds_per_day)


def measure(world: World, acc: Accounts, glob: GlobalState, rec: RecConfig, ch: ChoiceConfig,
            ses: SessionConfig, rng, regime: str = "ND", *, n_sessions=None, T=None, evolve: EvolveConfig = None,
            record_markov=False, n_groups=0, idle_after=True, record_sessions=False):
    """Measurement sessions. Returns per-account exposure counts by (type, band) and optional
    Markov records (transitions, emission sums, hitting times) and per-step traces by group."""
    S = ses.n_sessions if n_sessions is None else n_sessions
    T = ses.T if T is None else T
    B, k = acc.B, rec.slate_k
    alg_r, ref_r, prot_r, nat_r = _rows(acc)
    rows = np.arange(B)
    counts = np.zeros(B * NCAT, np.int64)
    opens_state = np.zeros(B * 3, np.int64)
    out = {}
    if record_markov:
        trans = np.zeros(B * 9, np.int64)
        emis = np.zeros(B * 3, float)
        hit = np.full((B, S), -1, np.int64)
    if n_groups:
        occ = np.zeros((n_groups, T, 3), np.int64)
        expA = np.zeros((n_groups, T), float)
        gsize = np.bincount(acc.group, minlength=n_groups)
    seed_n = acc.seeds.shape[1]
    if record_sessions:
        sess = np.zeros((B, S, 2), np.int64)        # per session: impressions with L = 1, flagged impressions
    for s in range(S):
        acc.cur = acc.seeds[rows, rng.integers(0, seed_n, B)]
        if evolve is not None:
            sx = np.zeros((B, world.D))
            sn = np.zeros(B)
            sst = np.zeros(B * 3)
        for t in range(T):
            slate, logit, opened = step(world, acc, glob, rec, ch, rng, regime, alg_r, ref_r, prot_r, nat_r)
            if rec.replace_anti >= 0:
                rep = rng.random(B) < rec.replace_anti
                if rep.any():
                    opened[rep] = world.anti_items[rng.integers(0, world.anti_items.size, int(rep.sum()))]
            cat = world.type[slate] * N_BANDS + world.band_of(logit)
            counts += np.bincount((rows[:, None] * NCAT + cat).ravel(), minlength=B * NCAT)
            if record_sessions:
                sess[:, s, 0] += world.L[slate].sum(1)
                sess[:, s, 1] += (logit >= 0).sum(1)
            s0 = world.state[acc.cur]
            nA = world.L[slate].sum(1)
            has = opened >= 0
            o = opened[has]
            if o.size:
                acc.v[has] = (1 - rec.lam) * acc.v[has] + rec.lam * world.X[o]
                acc.cur[has] = o
            s1 = world.state[acc.cur]
            opens_state += np.bincount(rows[has] * 3 + world.state[o], minlength=B * 3)
            if record_markov:
                trans += np.bincount(rows * 9 + s0 * 3 + s1, minlength=B * 9)
                emis += np.bincount(rows * 3 + s0, weights=nA, minlength=B * 3)
                newhit = (s0 == 2) & (hit[:, s] < 0)
                hit[newhit, s] = t
            if n_groups:
                occ[:, t, :] += np.bincount(acc.group * 3 + s0, minlength=n_groups * 3).reshape(n_groups, 3)
                expA[:, t] += np.bincount(acc.group, weights=nA, minlength=n_groups)
            if evolve is not None and o.size:
                sx[has] += world.X[o]
                sn[has] += 1
                sst += np.bincount(rows[has] * 3 + world.state[o], minlength=B * 3)
            glob.add_round(o[acc.counted[has]])
        if idle_after:
            glob.idle(ses.day_rounds - T)
        if evolve is not None:
            m = sn > 0
            if m.any():
                th = (1 - evolve.eta_theta) * acc.theta[m] + evolve.eta_theta * (sx[m] / sn[m, None])
                acc.theta[m] = (th / np.linalg.norm(th, axis=1, keepdims=True)).astype(np.float32)
            f = sst.reshape(B, 3) / np.maximum(sn, 1)[:, None]
            for stt in (1, 2):
                a = acc.alpha[:, stt]
                a += evolve.eta_alpha * f[:, stt] - evolve.zeta * (a - acc.alpha0[:, stt])
                np.minimum(a, evolve.alpha_max, out=a)
            fr = acc.fringe + evolve.eta_fringe * (f[:, 1] + f[:, 2]) - evolve.zeta_fringe * (acc.fringe - acc.fringe0)
            acc.fringe = np.clip(fr, 0.0, evolve.fringe_max)
    out["counts"] = counts.reshape(B, NCAT)
    if record_sessions:
        out["sessions"] = sess
    out["opens_state"] = opens_state.reshape(B, 3)
    out["n_impr"] = S * T * k
    if record_markov:
        out["trans"] = trans.reshape(B, 3, 3)
        out["emis"] = emis.reshape(B, 3)
        out["hit"] = hit
    if n_groups:
        out["occ"] = occ
        out["expA"] = expA
        out["gsize"] = gsize * S
    return out


def exposure_true(world: World, counts, n_impr):
    """Per-account exposure from true labels (share of slate impressions with L = 1)."""
    c = counts.reshape(counts.shape[0], N_TYPES, N_BANDS)
    return c[:, 2:, :].sum(axis=(1, 2)) / n_impr
