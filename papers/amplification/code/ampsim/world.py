"""Synthetic catalogue, classifier regimes and personas (demand profiles).

All objects are synthetic. Item types:
    0 neutral, 1 borderline, 2 antisemitic (coded), 3 antisemitic (explicit).
True label L_c = 1{type >= 2}. Content states for the Markov model: N (0), B (1), A (2).

Embedding geometry (dim 8): dims 0-5 are topic directions (news, sport, entertainment,
Jewish culture/community, Middle East, conspiracy); dim 6 is an "antisemitism" direction e_A;
dim 7 is a spare noise dimension. An item's embedding is
    x_c = normalise(e_topic + a_type * e_A + sigma * eps),  eps ~ N(0, I_8),
so antisemitic items cluster along e_A, coded items sit closer to topical content, and
borderline items lie in between.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass

import numpy as np
from scipy.stats import norm

TOPICS = ("news", "sport", "entertainment", "jewish", "mideast", "conspiracy")
TYPES = ("neutral", "borderline", "anti_coded", "anti_explicit")
STATES = ("N", "B", "A")
STATE_OF_TYPE = np.array([0, 1, 2, 2], dtype=np.int64)
LABEL_OF_TYPE = np.array([0, 0, 1, 1], dtype=np.int64)
N_TYPES = 4
N_BANDS = 5
BAND_CUTS = np.array([-2.0, -1.0, 0.0, 1.0])  # classifier-logit bands; flagged <=> logit >= 0 <=> band >= 3
FLAG_BANDS = np.array([False, False, False, True, True])
A_DIM = 6

PERSONAS = ("general", "jewish", "mideast", "conspiracy")
PERSONA_LABEL = dict(general="General interest", jewish="Jewish interest", mideast="Middle East news",
                     conspiracy="Conspiracy-adjacent")
PERSONA_TOPICS = {
    "general": {"news": 1.0, "sport": 0.8, "entertainment": 0.8},
    "jewish": {"jewish": 1.0, "news": 0.4, "entertainment": 0.25},
    "mideast": {"mideast": 1.0, "news": 0.5, "jewish": 0.2},
    "conspiracy": {"conspiracy": 1.0, "news": 0.3, "mideast": 0.25},
}
# appetite (utility shift) by content state N, B, A for the naturalistic choice rule
PERSONA_ALPHA = {
    "general": (0.0, -0.5, -2.5),
    "jewish": (0.0, -1.0, -4.0),
    "mideast": (0.0, 0.0, -2.0),
    "conspiracy": (0.0, 0.5, -1.0),
}
# shares of real-user demand types in the E3 population
REAL_USER_SHARES = (0.6, 0.1, 0.15, 0.15)

# classifier regimes: specificity on (neutral, borderline) and sensitivity on (coded, explicit).
# The classifier logit of an impression of item c is  m_type(c) + sqrt(omega) z_c + sqrt(1 - omega) z_imp,
# with z_c fixed per item and z_imp fresh per impression; flagged <=> logit >= 0, so P(flag | type) is
# exactly the regime's rate whatever omega. omega = 0: error depends on content type only (the
# classifier-error structure of thm:misclass); omega = 1: a deterministic item-level classifier.
REGIMES = {
    "ND": dict(label="non-differential", sp=(0.98, 0.98), se=(0.85, 0.85), omega=0.0),
    "DU": dict(label="differential (borderline false positives)", sp=(0.99, 0.60), se=(0.85, 0.85), omega=0.0),
    "DD": dict(label="differential (coded false negatives)", sp=(0.98, 0.98), se=(0.35, 0.95), omega=0.0),
    "NDI": dict(label="non-differential by type, deterministic per item", sp=(0.98, 0.98), se=(0.85, 0.85),
                omega=1.0),
}


@dataclass(frozen=True)
class WorldConfig:
    n_items: int = 5000
    dim: int = 8
    topic_share: tuple = (0.30, 0.18, 0.18, 0.08, 0.11, 0.15)
    prevalence: float = 0.04          # share of antisemitic items (types 2, 3) in the catalogue
    border_ratio: float = 2.0         # borderline share = border_ratio * prevalence
    topic_weight: tuple = (0.4, 0.1, 0.1, 1.0, 1.5, 2.0)   # relative propensity of B / A items by topic
    frac_coded: float = 0.5           # share of antisemitic items that are coded
    emb_noise: float = 0.35
    anti_loading: tuple = (0.0, 0.5, 0.7, 1.4)   # loading on e_A by type
    bait_mean: tuple = (0.0, 0.5, 0.4, 0.3)      # engagement prior ("bait") by type
    bait_sd: float = 0.3
    pop_sigma: float = 1.0            # log-normal spread of background popularity
    pop_bait: float = 1.0             # background popularity loading on bait
    rate_sigma: float = 0.5           # spread of posting rates (reverse-chronological feed)
    rate_mult: tuple = (1.0, 1.2, 1.3, 1.5)      # posting-rate multipliers by type
    n_nn: int = 15                    # item-to-item neighbours used by the algorithm
    seed_pool: int = 200              # persona seed pool (neutral items closest to the persona)
    pool_table: int = 1 << 15         # resolution of the eligible-pool sampling tables

    def to_dict(self):
        return asdict(self)


class World:
    """A synthetic catalogue plus personas. Items are sorted by topic."""

    def __init__(self, cfg: WorldConfig, seed):
        self.cfg = cfg
        rng = np.random.default_rng(np.random.SeedSequence(seed))
        N, D = cfg.n_items, cfg.dim
        share = np.asarray(cfg.topic_share, float)
        share = share / share.sum()
        n_t = np.floor(share * N).astype(int)
        n_t[0] += N - n_t.sum()
        wt = np.asarray(cfg.topic_weight, float)
        scale = cfg.prevalence / float((share * wt).sum())
        topic = np.repeat(np.arange(len(TOPICS)), n_t)
        typ = np.zeros(N, dtype=np.int64)
        start = np.concatenate([[0], np.cumsum(n_t)[:-1]])
        for t in range(len(TOPICS)):
            nA = int(round(n_t[t] * scale * wt[t]))
            nB = int(round(n_t[t] * scale * wt[t] * cfg.border_ratio))
            nC = int(round(nA * cfg.frac_coded))
            idx = start[t] + rng.permutation(n_t[t])
            typ[idx[:nB]] = 1
            typ[idx[nB:nB + nC]] = 2
            typ[idx[nB + nC:nB + nA]] = 3
        E = np.zeros((len(TOPICS), D))
        E[np.arange(len(TOPICS)), np.arange(len(TOPICS))] = 1.0
        load = np.asarray(cfg.anti_loading)[typ]
        X = E[topic] + cfg.emb_noise * rng.standard_normal((N, D))
        X[:, A_DIM] += load
        X /= np.linalg.norm(X, axis=1, keepdims=True)
        bait = np.asarray(cfg.bait_mean)[typ] + cfg.bait_sd * rng.standard_normal(N)
        logw = cfg.pop_sigma * rng.standard_normal(N) + cfg.pop_bait * bait
        w = np.exp(logw - logw.max())
        w /= w.sum()
        rate = np.asarray(cfg.rate_mult)[typ] * np.exp(cfg.rate_sigma * rng.standard_normal(N))
        z_cls = rng.standard_normal(N)       # item-level classifier noise, shared across regimes

        self.N, self.D = N, D
        self.topic, self.type = topic, typ
        self.state = STATE_OF_TYPE[typ]
        self.L = LABEL_OF_TYPE[typ]
        self.X = X.astype(np.float32)
        self.bait = bait
        self.w_bg = w
        self.log_rate = np.log(rate)
        self.z_cls = z_cls
        self.topic_start = start.astype(np.int64)
        self.topic_size = n_t.astype(np.int64)
        # item-to-item neighbours (cosine), excluding self; computed in row blocks
        nn = np.empty((N, cfg.n_nn), np.int64)
        for r0 in range(0, N, 1000):
            S = X[r0:r0 + 1000] @ X.T
            S[np.arange(S.shape[0]), np.arange(r0, r0 + S.shape[0])] = -np.inf
            part = np.argpartition(-S, cfg.n_nn, axis=1)[:, :cfg.n_nn]
            order = np.argsort(-np.take_along_axis(S, part, axis=1), axis=1, kind="stable")
            nn[r0:r0 + S.shape[0]] = np.take_along_axis(part, order, axis=1)
        self.nn = nn
        # personas
        P = len(PERSONAS)
        self.theta = np.zeros((P, D))
        self.phi = np.zeros((P, len(TOPICS)))
        self.alpha = np.zeros((P, 3))
        self.seeds = []
        for p, name in enumerate(PERSONAS):
            for tname, wgt in PERSONA_TOPICS[name].items():
                t = TOPICS.index(tname)
                self.theta[p, t] = wgt
                self.phi[p, t] = wgt
            self.theta[p] /= np.linalg.norm(self.theta[p])
            self.phi[p] /= self.phi[p].sum()
            self.alpha[p] = PERSONA_ALPHA[name]
            sim = X @ self.theta[p]
            sim[typ != 0] = -np.inf           # seeds are screened: neutral items only
            self.seeds.append(np.argsort(-sim)[:cfg.seed_pool].astype(np.int64))
        self.theta = self.theta.astype(np.float32)
        # eligible-pool sampling tables: item = pool_tab[persona, floor(U * Q)] gives an item drawn with
        # P(topic) = phi_persona(topic) and uniformly within the topic (up to 1/Q rounding)
        Q = cfg.pool_table
        self.pool_tab = np.empty((P, Q), np.int64)
        for p in range(P):
            slots = np.floor(self.phi[p] * Q).astype(int)
            slots[np.argmax(self.phi[p])] += Q - slots.sum()
            parts = [np.resize(np.arange(start[t], start[t] + n_t[t]), slots[t]) for t in range(len(TOPICS))]
            self.pool_tab[p] = np.concatenate(parts)
        # "fringe sources": borderline and antisemitic items, which accounts can come to follow (E3)
        self.fringe_items = np.flatnonzero(typ >= 1).astype(np.int64)
        self.anti_items = np.flatnonzero(typ >= 2).astype(np.int64)
        self._regime_cache = {}

    # ------------------------------------------------------------------ classifier
    def classifier(self, regime: str):
        """Return (m_type (4,), omega) for a classifier regime."""
        r = REGIMES[regime]
        m = np.array([norm.ppf(1 - r["sp"][0]), norm.ppf(1 - r["sp"][1]),
                      norm.ppf(r["se"][0]), norm.ppf(r["se"][1])])
        return m, float(r["omega"])

    def score(self, regime: str, items, rng):
        """Classifier logits for impressions of `items` (any shape)."""
        m, om = self.classifier(regime)
        out = m[self.type[items]]
        if om > 0:
            out = out + np.sqrt(om) * self.z_cls[items]
        if om < 1:
            out = out + np.sqrt(1 - om) * rng.standard_normal(np.shape(items))
        return out

    @staticmethod
    def band_of(logit):
        return np.searchsorted(BAND_CUTS, logit, side="right").astype(np.int64)

    def summary(self):
        out = dict(n_items=int(self.N),
                   type_counts={TYPES[i]: int((self.type == i).sum()) for i in range(N_TYPES)},
                   prevalence_items=float(self.L.mean()),
                   prevalence_bg_weighted=float((self.L * self.w_bg).sum()),
                   borderline_bg_weighted=float(((self.type == 1) * self.w_bg).sum()))
        by_topic = {}
        for t, name in enumerate(TOPICS):
            m = self.topic == t
            by_topic[name] = dict(n=int(m.sum()), anti=float(self.L[m].mean()),
                                  border=float((self.type[m] == 1).mean()))
        out["by_topic"] = by_topic
        cls = {}
        for g in REGIMES:
            m, om = self.classifier(g)
            d = dict(flag_rate_by_type={TYPES[i]: float(norm.cdf(m[i])) for i in range(N_TYPES)}, omega=om)
            if om == 1.0:
                flag = (m[self.type] + self.z_cls) >= 0
                d["realised_item_flag_rate_by_type"] = {TYPES[i]: float(flag[self.type == i].mean())
                                                        for i in range(N_TYPES)}
            cls[g] = d
        out["classifier"] = cls
        return out
