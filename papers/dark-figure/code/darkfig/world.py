"""Synthetic antisemitic-incident worlds for the dark-figure simulation study.

Everything produced here is SYNTHETIC. Place names, venue names and incidents
are generated from generic word lists and random numbers; no real incident,
victim, institution or location is represented.

A world consists of
  * N latent incidents with attributes (true date, county, type, target,
    venue string, campus flag) and a latent reportability class;
  * a capture matrix Y (N x K) for the K = 4 lists
    (0 police, 1 NGO audit, 2 community security organisation, 3 campus /
    self-report portal);
  * the observed records of every list, carrying list-specific noise
    (date lags, county errors / coarsening, type vocabularies and relabelling,
    venue typos, within-list duplicates), referral provenance metadata and
    the ground-truth incident id of every record.

Capture models (``WorldConfig.capture_model``)
  "independent"  p_ik = p_k for every incident (lists independent).
  "latent"       pure latent-class model: z_i ~ Cat(pi), Y_ik | z_i ~ Bern(lambda_{z_i,k}),
                 independent of covariates (LCMCR is correctly specified).
  "latent_cov"   class membership depends on incident type and capture
                 probabilities also depend on type / target / campus covariates.
Referral dependence: the NGO list additionally ingests every police-captured
incident with probability ``referral_q`` (provenance flag ``referral``).
"""
from __future__ import annotations

from dataclasses import dataclass, asdict, field
import numpy as np

K_LISTS = 4
LIST_NAMES = ("police", "ngo", "cso", "portal")
TYPES = ("assault", "vandalism", "threat", "harassment")
TARGETS = ("person", "institution", "property")
CLASS_NAMES = ("severe_visible", "moderate", "low_visibility")

# ---------------------------------------------------------------------------
# List-specific type vocabularies and the analyst's harmonisation crosswalk.
# VOCAB[k][canonical type] = list of (label, probability)
# ---------------------------------------------------------------------------
VOCAB = {
    0: {"assault": [("Simple Assault", 0.7), ("Aggravated Assault", 0.3)],
        "vandalism": [("Destruction/Damage/Vandalism", 1.0)],
        "threat": [("Intimidation", 1.0)],
        "harassment": [("Intimidation", 1.0)]},
    1: {"assault": [("Assault", 1.0)],
        "vandalism": [("Vandalism", 1.0)],
        "threat": [("Harassment", 1.0)],
        "harassment": [("Harassment", 1.0)]},
    2: {"assault": [("Physical attack", 1.0)],
        "vandalism": [("Property damage", 1.0)],
        "threat": [("Threat", 1.0)],
        "harassment": [("Abusive behaviour", 1.0)]},
    3: {"assault": [("Physical violence", 1.0)],
        "vandalism": [("Graffiti or vandalism", 1.0)],
        "threat": [("Threat", 1.0)],
        "harassment": [("Verbal harassment", 0.6), ("Online harassment", 0.4)]},
}


def _build_crosswalk():
    """label -> bitmask over canonical TYPES (bit t set if label can mean type t)."""
    cw = {}
    for k, voc in VOCAB.items():
        for t_idx, t in enumerate(TYPES):
            for lab, _ in voc[t]:
                cw[(k, lab)] = cw.get((k, lab), 0) | (1 << t_idx)
    return cw


CROSSWALK = _build_crosswalk()

# Confusion used for type relabelling noise: row = true type, columns = TYPES.
TYPE_CONFUSION = np.array([
    [0.0, 0.10, 0.20, 0.70],   # assault   -> mostly harassment / threat
    [0.0, 0.0, 0.70, 0.30],    # vandalism -> threat (threatening graffiti)
    [0.05, 0.15, 0.0, 0.80],   # threat    -> harassment
    [0.15, 0.05, 0.80, 0.0],   # harassment-> threat
])

# ---------------------------------------------------------------------------
# Synthetic name pools (generic words; no real places or institutions)
# ---------------------------------------------------------------------------
TOWN_ROOTS = ["Ash", "Brook", "Cedar", "Dale", "Elm", "Fair", "Glen", "Hazel", "Iron",
              "Juniper", "Kings", "Lake", "Maple", "North", "Oak", "Pine", "Quarry",
              "River", "Stone", "Thorn", "Union", "Vale", "West", "Willow", "York",
              "Amber", "Birch", "Clover", "Drift", "Ember", "Falcon", "Granite"]
TOWN_SUFFIX = ["ford", "field", "ton", "ville", "wood", "haven", "port", "dale", "bridge", "view"]
SYN_NAMES = ["Temple Beth Shalom", "Temple Beth El", "Congregation Ahavat Achim",
             "Congregation Beth Israel", "Temple Emanuel", "Congregation Shaarei Tefila",
             "Temple Sinai", "Congregation Bnai Yaakov", "Temple Israel",
             "Congregation Kehilat Yeshurun", "Agudat Achim Synagogue", "Beth Tikvah Synagogue",
             "Ohev Shalom Congregation", "Temple Rodef Shalom", "Kol Ami Synagogue",
             "Congregation Or Chadash", "Beth Am Synagogue", "Temple Adat Shalom",
             "Congregation Tiferet Israel", "Shomrei Torah Synagogue"]
STREETS = ["Main Street", "Oak Street", "Maple Avenue", "Elm Street", "Washington Boulevard",
           "Park Avenue", "Lincoln Road", "Cedar Lane", "Highland Avenue", "River Road",
           "Church Street", "Market Street", "Second Avenue", "Third Avenue", "Pine Street",
           "Lake Drive", "Spring Street", "Mill Road", "Union Avenue", "Hill Street",
           "Chestnut Street", "Walnut Avenue", "Grove Street", "Prospect Avenue"]
SURNAMES = ["Goldberg", "Cohen", "Levy", "Katz", "Friedman", "Shapiro", "Rosen", "Klein",
            "Adler", "Weiss", "Stern", "Kaplan", "Abrams", "Feld", "Halpern", "Marcus"]
SHOPS = ["Deli", "Bakery", "Pharmacy", "Bookstore", "Market", "Jewelers", "Hardware", "Cafe"]
CEMETERIES = ["Mount Sinai Cemetery", "Beth David Cemetery", "Sons of Israel Cemetery",
              "Hebrew Memorial Park", "Mount Zion Cemetery"]
BUILDINGS = ["Hillel House", "Student Union", "Main Library", "Science Hall",
             "Residence Hall A", "Residence Hall B", "Campus Quad", "Humanities Building"]

# Abbreviations applied by some lists (normalisation in linkage.py undoes them).
ABBREV = {"Street": "St", "Avenue": "Ave", "Boulevard": "Blvd", "Road": "Rd", "Lane": "Ln",
          "Drive": "Dr", "Congregation": "Cong", "Synagogue": "Syn", "Cemetery": "Cem",
          "Second": "2nd", "Third": "3rd", "Building": "Bldg", "University": "Univ",
          "Community": "Comm", "Center": "Ctr"}


@dataclass
class WorldConfig:
    """Configuration of a synthetic world. All probabilities are per incident / record."""
    N: int = 2000
    grid_shape: tuple = (6, 5)          # counties on a grid -> C = 30
    n_days: int = 365
    spike_frac: float = 0.25            # share of incidents in 3 two-week "flashpoint" spikes
    county_zipf: float = 0.8            # county weights proportional to rank^-county_zipf
    type_probs: tuple = (0.08, 0.30, 0.22, 0.40)
    campus_prob: float = 0.15           # P(campus venue | county has a university)

    capture_model: str = "latent"       # "independent" | "latent" | "latent_cov"
    class_weights: tuple = (0.15, 0.35, 0.50)
    class_capture: tuple = ((0.80, 0.70, 0.55, 0.30),
                            (0.35, 0.40, 0.30, 0.25),
                            (0.06, 0.12, 0.08, 0.15))
    indep_capture: tuple | None = None  # None -> marginal of the latent-class model
    referral_q: float = 0.0             # NGO ingests police-captured incidents w.p. q

    # record noise; every rate below is multiplied by ``noise``
    noise: float = 0.0
    lag_prob: tuple = (0.35, 0.60, 0.45, 0.65)    # P(report date later than incident)
    lag_mean: tuple = (1.5, 4.0, 2.0, 5.0)        # extra lag ~ 1 + Poisson(lag_mean * noise)
    gross_date_err: float = 0.02                   # date mis-recorded by up to +-30 days
    adj_county_err: tuple = (0.03, 0.05, 0.04, 0.08)
    coarsen_prob: tuple = (0.01, 0.03, 0.02, 0.08) # county recorded as unknown
    type_relabel: tuple = (0.06, 0.08, 0.06, 0.12)
    typo_rate: tuple = (0.4, 0.5, 0.4, 0.9)        # character edits ~ Poisson(rate * noise)
    word_drop: tuple = (0.05, 0.08, 0.05, 0.15)
    venue_missing: tuple = (0.01, 0.02, 0.01, 0.08)
    hour_missing: tuple = (0.15, 0.60, 0.30, 0.40) # structural: list schema lacks time of day
    hour_err: tuple = (0.15, 0.30, 0.20, 0.40)     # P(hour off by 1-3 h), times noise
    dup_prob: float | None = None                  # None -> 0.04 * noise

    def as_dict(self):
        d = asdict(self)
        return {k: (list(v) if isinstance(v, tuple) else v) for k, v in d.items()}


@dataclass
class Records:
    """Observed records of all lists (one row per record)."""
    list_id: np.ndarray        # int, 0..K-1
    date: np.ndarray           # int, recorded date (day index)
    hour: np.ndarray           # int, recorded hour of day 0-23, -1 = missing
    county: np.ndarray         # int, -1 = unknown / coarsened
    type_label: np.ndarray     # object (str), list-specific vocabulary
    venue: np.ndarray          # object (str), raw venue text ('' = missing)
    true_id: np.ndarray        # int, ground-truth incident id
    provenance: np.ndarray     # int, 0 = direct report, 1 = referral-only (NGO ingested police)
    is_dup: np.ndarray         # bool, ground truth: a within-list duplicate record

    def __len__(self):
        return len(self.list_id)

    def subset(self, idx):
        idx = np.asarray(idx)
        return Records(**{k: getattr(self, k)[idx] for k in self.__dataclass_fields__})


@dataclass
class World:
    config: WorldConfig
    seed: int
    county_latlon: np.ndarray        # (C, 2)
    county_names: list
    neighbours: list                 # list of arrays of adjacent county ids
    adjacency: np.ndarray            # (C, C) bool, True for same or adjacent counties
    # incidents
    date: np.ndarray
    hour: np.ndarray
    county: np.ndarray
    itype: np.ndarray                # index into TYPES
    target: np.ndarray               # index into TARGETS
    campus: np.ndarray               # bool
    venue: np.ndarray                # object (str)
    latent_class: np.ndarray         # index into CLASS_NAMES
    capture_prob: np.ndarray         # (N, K) direct capture probabilities p_ik given class
    Y: np.ndarray                    # (N, K) bool, true capture (incl. referral)
    Y_direct: np.ndarray             # (N, K) bool, capture without referral
    records: Records
    meta: dict = field(default_factory=dict)

    @property
    def N(self):
        return len(self.date)

    @property
    def K(self):
        return self.Y.shape[1]


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------
def _choice(rng, options, probs=None):
    return options[rng.choice(len(options), p=probs)]


def _logit(p):
    p = np.clip(p, 1e-9, 1 - 1e-9)
    return np.log(p / (1 - p))


def _expit(x):
    return 1.0 / (1.0 + np.exp(-x))


def _county_geography(rng, shape):
    rows, cols = shape
    C = rows * cols
    latlon = np.zeros((C, 2))
    adjacency = np.eye(C, dtype=bool)
    neighbours = []
    for r in range(rows):
        for c in range(cols):
            i = r * cols + c
            latlon[i] = (40.0 + 0.45 * r + rng.normal(0, 0.05), -80.0 + 0.55 * c + rng.normal(0, 0.05))
            nb = []
            for dr, dc in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                rr, cc = r + dr, c + dc
                if 0 <= rr < rows and 0 <= cc < cols:
                    nb.append(rr * cols + cc)
            neighbours.append(np.array(nb, dtype=int))
            adjacency[i, nb] = True
    names = []
    used = set()
    while len(names) < C:
        nm = _choice(rng, TOWN_ROOTS) + _choice(rng, TOWN_SUFFIX)
        if nm not in used:
            used.add(nm)
            names.append(nm)
    return latlon, names, neighbours, adjacency


def _venue_pools(rng, town_names):
    """Per-county pools of synthetic venue strings with popularity weights."""
    pools = []
    for town in town_names:
        n_syn = rng.integers(1, 5)
        syn = list(rng.choice(SYN_NAMES, size=n_syn, replace=False))
        inst = syn + [f"{town} Jewish Community Center"]
        if rng.random() < 0.5:
            inst.append(f"Hebrew Academy of {town}")
        inst_w = 1.0 / np.arange(1, len(inst) + 1) ** 0.7
        has_univ = rng.random() < 0.4
        univ = (f"University of {town}" if rng.random() < 0.5 else f"{town} State University") if has_univ else None
        streets = list(rng.choice(STREETS, size=8, replace=False))
        shops = [f"{_choice(rng, SURNAMES)}s {_choice(rng, SHOPS)}" for _ in range(rng.integers(2, 6))]
        cem = list(rng.choice(CEMETERIES, size=rng.integers(1, 3), replace=False))
        pools.append(dict(town=town, inst=inst, inst_w=inst_w / inst_w.sum(), univ=univ,
                          streets=streets, shops=shops, cem=cem))
    return pools


def _draw_venue(rng, pool, target, campus):
    if campus and pool["univ"] is not None:
        return f"{_choice(rng, BUILDINGS)}, {pool['univ']}"
    st = pool["streets"]
    if target == 1:   # institution
        return pool["inst"][rng.choice(len(pool["inst"]), p=pool["inst_w"])]
    if target == 2:   # property
        u = rng.random()
        if u < 0.5:
            return f"{rng.integers(10, 9999)} {_choice(rng, st)}"
        if u < 0.8:
            return _choice(rng, pool["shops"])
        return _choice(rng, pool["cem"])
    # person
    u = rng.random()
    if u < 0.4:
        a, b = rng.choice(len(st), size=2, replace=False)
        return f"{st[a]} and {st[b]}"
    if u < 0.6:
        return f"{pool['town']} {_choice(rng, ['Central Park', 'Riverside Park', 'Central Station', 'Public Library'])}"
    if u < 0.8:
        return f"{rng.integers(10, 9999)} {_choice(rng, st)}"
    return _choice(rng, pool["shops"])


def _format_venue(rng, venue, k, noise, cfg):
    """List-specific formatting plus noise (word drop, typos, missingness)."""
    if venue == "":
        return ""
    if rng.random() < cfg.venue_missing[k] * noise:
        return ""
    words = venue.replace(",", " ,").split()
    # list styles: police abbreviates + upper case; CSO abbreviates; portal lower-case
    if k in (0, 2):
        words = [ABBREV.get(w, w) for w in words]
    if len(words) > 2 and rng.random() < cfg.word_drop[k] * noise:
        cand = [i for i, w in enumerate(words) if w != ","]
        del words[cand[rng.integers(len(cand))]]
    s = " ".join(words).replace(" ,", ",")
    if k == 0:
        s = s.upper()
    elif k == 3:
        s = s.lower()
        if rng.random() < 0.3 * min(noise, 1.0):
            s = _choice(rng, ["near ", "outside ", "at "]) + s
    n_edit = rng.poisson(cfg.typo_rate[k] * noise)
    alphabet = "abcdefghijklmnopqrstuvwxyz"
    for _ in range(n_edit):
        if len(s) < 3:
            break
        pos = int(rng.integers(len(s)))
        op = rng.integers(4)
        ch = alphabet[rng.integers(26)]
        if k == 0:
            ch = ch.upper()
        if op == 0:      # substitution
            s = s[:pos] + ch + s[pos + 1:]
        elif op == 1:    # deletion
            s = s[:pos] + s[pos + 1:]
        elif op == 2:    # insertion
            s = s[:pos] + ch + s[pos:]
        elif pos < len(s) - 1:   # transposition
            s = s[:pos] + s[pos + 1] + s[pos] + s[pos + 2:]
    return s


def _type_label(rng, k, t_idx, noise, cfg):
    if noise > 0 and rng.random() < cfg.type_relabel[k] * noise:
        t_idx = int(rng.choice(4, p=TYPE_CONFUSION[t_idx]))
    opts = VOCAB[k][TYPES[t_idx]]
    labs = [o[0] for o in opts]
    ps = np.array([o[1] for o in opts])
    return labs[rng.choice(len(labs), p=ps / ps.sum())]


def _record_date(rng, true_date, k, noise, cfg):
    d = int(true_date)
    if noise <= 0:
        return d
    if rng.random() < min(0.95, cfg.lag_prob[k] * noise):
        d += 1 + int(rng.poisson(cfg.lag_mean[k] * noise))
    if rng.random() < cfg.gross_date_err * noise:
        d += int(rng.choice([-1, 1]) * rng.integers(1, 31))
    return d


def _record_hour(rng, true_hour, k, noise, cfg):
    if rng.random() < cfg.hour_missing[k]:
        return -1
    h = int(true_hour)
    if noise > 0 and rng.random() < min(0.9, cfg.hour_err[k] * noise):
        h = (h + int(rng.choice([-1, 1])) * int(rng.integers(1, 4))) % 24
    return h


def _record_county(rng, county, k, noise, neighbours, cfg):
    if noise <= 0:
        return int(county)
    u = rng.random()
    if u < cfg.coarsen_prob[k] * noise:
        return -1
    if u < (cfg.coarsen_prob[k] + cfg.adj_county_err[k]) * noise and len(neighbours[county]):
        return int(rng.choice(neighbours[county]))
    return int(county)


# ---------------------------------------------------------------------------
# capture model
# ---------------------------------------------------------------------------
def _covariate_shift(itype, target, campus):
    """Additive logit shifts (N, K) used by capture_model == 'latent_cov'."""
    N = len(itype)
    s = np.zeros((N, K_LISTS))
    # police: assaults and threats more likely reported; harassment and campus less
    s[:, 0] += np.select([itype == 0, itype == 2, itype == 3], [0.8, 0.2, -0.6], 0.0)
    s[:, 0] += 0.3 * (target == 1) - 0.5 * campus
    # NGO audit: institutional targets, harassment campaigns
    s[:, 1] += 0.4 * (target == 1) + 0.2 * (itype == 3)
    # community security organisation: institutions, less person-targeted
    s[:, 2] += 0.8 * (target == 1) - 0.3 * (target == 0)
    # campus / self-report portal
    s[:, 3] += 1.5 * campus + 0.5 * (itype == 3) - 0.3 * (target == 1)
    return s


CLASS_GIVEN_TYPE = np.array([   # used by latent_cov: P(class | type)
    [0.45, 0.35, 0.20],   # assault
    [0.20, 0.40, 0.40],   # vandalism
    [0.15, 0.35, 0.50],   # threat
    [0.08, 0.32, 0.60],   # harassment
])


def class_probabilities(cfg: WorldConfig, itype):
    N = len(itype)
    if cfg.capture_model == "latent_cov":
        return CLASS_GIVEN_TYPE[itype]
    return np.tile(np.asarray(cfg.class_weights, float), (N, 1))


def capture_probabilities(cfg: WorldConfig, itype, target, campus):
    """(N, J, K) direct capture probabilities p_{ijk} for every incident and class."""
    N = len(itype)
    lam = np.asarray(cfg.class_capture, float)
    J = lam.shape[0]
    if cfg.capture_model == "independent":
        if cfg.indep_capture is None:
            pk = np.asarray(cfg.class_weights) @ lam
        else:
            pk = np.asarray(cfg.indep_capture, float)
        return np.broadcast_to(pk, (N, J, K_LISTS)).copy()
    base = np.broadcast_to(lam, (N, J, K_LISTS)).copy()
    if cfg.capture_model == "latent":
        return base
    if cfg.capture_model == "latent_cov":
        shift = _covariate_shift(itype, target, campus)
        return _expit(_logit(base) + shift[:, None, :])
    raise ValueError(f"unknown capture_model {cfg.capture_model!r}")


def expected_cell_counts(cfg: WorldConfig, itype, target, campus):
    """Exact expected capture-history counts mu_h (h in {0,1}^K, incl. 0) given covariates.

    Integrates over the latent class and the referral mechanism. Returns a
    dict {h tuple: mu_h}.
    """
    P = capture_probabilities(cfg, itype, target, campus)        # (N, J, K)
    W = class_probabilities(cfg, itype)                            # (N, J)
    q = cfg.referral_q
    mu = {}
    for code in range(2 ** K_LISTS):
        h = tuple((code >> k) & 1 for k in range(K_LISTS))
        # police / NGO joint with referral
        p1, p2 = P[..., 0], P[..., 1]
        if h[0] == 1 and h[1] == 1:
            j12 = p1 * (p2 + (1 - p2) * q)
        elif h[0] == 1 and h[1] == 0:
            j12 = p1 * (1 - p2) * (1 - q)
        elif h[0] == 0 and h[1] == 1:
            j12 = (1 - p1) * p2
        else:
            j12 = (1 - p1) * (1 - p2)
        prob = j12.copy()
        for k in range(2, K_LISTS):
            prob = prob * (P[..., k] if h[k] else 1 - P[..., k])
        mu[h] = float((W * prob).sum())
    return mu


def population_omega(mu):
    """Highest-order log-linear interaction omega = sum_h (-1)^{K-|h|} log mu_h (corner coding)."""
    K = len(next(iter(mu)))
    if min(mu.values()) <= 0:
        return float("nan")     # a structurally empty cell (e.g. referral_q = 1): omega undefined
    return float(sum((-1) ** (K - sum(h)) * np.log(m) for h, m in mu.items()))


# ---------------------------------------------------------------------------
# main generator
# ---------------------------------------------------------------------------
def generate_world(cfg: WorldConfig, seed) -> World:
    """Generate one synthetic world. Fully determined by (cfg, seed)."""
    ss = np.random.SeedSequence(seed)
    rng_geo, rng_inc, rng_cap, rng_rec = (np.random.default_rng(s) for s in ss.spawn(4))
    N, K = cfg.N, K_LISTS

    latlon, names, neighbours, adjacency = _county_geography(rng_geo, cfg.grid_shape)
    C = len(names)
    pools = _venue_pools(rng_geo, names)
    cw = 1.0 / np.arange(1, C + 1) ** cfg.county_zipf
    cw = cw[rng_geo.permutation(C)]
    cw /= cw.sum()

    # ---- incidents
    county = rng_inc.choice(C, size=N, p=cw)
    spikes = rng_inc.integers(0, cfg.n_days - 14, size=3)
    in_spike = rng_inc.random(N) < cfg.spike_frac
    date = np.where(in_spike,
                    spikes[rng_inc.integers(0, 3, size=N)] + rng_inc.integers(0, 14, size=N),
                    rng_inc.integers(0, cfg.n_days, size=N))
    # diurnal hour distribution (synthetic): more incidents in the afternoon / evening
    hw = 1.0 + 0.8 * np.sin((np.arange(24) - 10) / 24 * 2 * np.pi)
    hour = rng_inc.choice(24, size=N, p=hw / hw.sum())
    itype = rng_inc.choice(4, size=N, p=np.asarray(cfg.type_probs) / sum(cfg.type_probs))
    target = np.empty(N, dtype=int)
    for i in range(N):
        t = itype[i]
        if t == 0:
            target[i] = 0
        elif t == 1:
            target[i] = 1 if rng_inc.random() < 0.5 else 2
        elif t == 2:
            target[i] = 1 if rng_inc.random() < 0.5 else 0
        else:
            target[i] = 0 if rng_inc.random() < 0.8 else 1
    campus = np.array([pools[c]["univ"] is not None and rng_inc.random() < cfg.campus_prob
                       for c in county], dtype=bool)
    venue = np.array([_draw_venue(rng_inc, pools[county[i]], target[i], campus[i]) for i in range(N)],
                     dtype=object)

    # ---- latent class and capture
    W = class_probabilities(cfg, itype)
    u = rng_cap.random(N)
    z = (u[:, None] > np.cumsum(W, axis=1)).sum(axis=1)
    z = np.minimum(z, W.shape[1] - 1)
    P = capture_probabilities(cfg, itype, target, campus)[np.arange(N), z]   # (N, K)
    Y_direct = rng_cap.random((N, K)) < P
    referred = Y_direct[:, 0] & (rng_cap.random(N) < cfg.referral_q)
    Y = Y_direct.copy()
    Y[:, 1] |= referred

    # ---- records
    noise = cfg.noise
    dup_p = cfg.dup_prob if cfg.dup_prob is not None else 0.04 * noise
    cols = {k: [] for k in ("list_id", "date", "hour", "county", "type_label", "venue", "true_id", "provenance", "is_dup")}

    def make_record(i, k, is_dup):
        cols["list_id"].append(k)
        cols["date"].append(_record_date(rng_rec, date[i], k, noise, cfg))
        cols["hour"].append(_record_hour(rng_rec, hour[i], k, noise, cfg))
        cols["county"].append(_record_county(rng_rec, county[i], k, noise, neighbours, cfg))
        cols["type_label"].append(_type_label(rng_rec, k, itype[i], noise, cfg))
        cols["venue"].append(_format_venue(rng_rec, venue[i], k, noise, cfg))
        cols["true_id"].append(i)
        cols["provenance"].append(0)
        cols["is_dup"].append(is_dup)

    police_row = {}
    for i in range(N):
        for k in (0, 2, 3):
            if Y[i, k]:
                if k == 0:
                    police_row[i] = len(cols["list_id"])
                make_record(i, k, False)
                if rng_rec.random() < dup_p:
                    make_record(i, k, True)
    # NGO list last, because referral-only records copy the police record
    for i in range(N):
        if not Y[i, 1]:
            continue
        if Y_direct[i, 1]:
            make_record(i, 1, False)
            if rng_rec.random() < dup_p:
                make_record(i, 1, True)
        else:   # referral-only: NGO ingests the police record
            r = police_row[i]
            pol_label = cols["type_label"][r]
            mask = CROSSWALK[(0, pol_label)]
            t_cands = [t for t in range(4) if mask >> t & 1]
            t_idx = t_cands[-1] if len(t_cands) > 1 else t_cands[0]   # Intimidation -> harassment
            cols["list_id"].append(1)
            cols["date"].append(cols["date"][r] + (int(rng_rec.poisson(1.0)) if noise > 0 else 0))
            cols["hour"].append(cols["hour"][r])
            cols["county"].append(cols["county"][r])
            cols["type_label"].append(VOCAB[1][TYPES[t_idx]][0][0])
            pv = cols["venue"][r]
            cols["venue"].append(pv.title() if pv else "")
            cols["true_id"].append(i)
            cols["provenance"].append(1)
            cols["is_dup"].append(False)

    records = Records(
        list_id=np.array(cols["list_id"], dtype=np.int64),
        date=np.array(cols["date"], dtype=np.int64),
        hour=np.array(cols["hour"], dtype=np.int64),
        county=np.array(cols["county"], dtype=np.int64),
        type_label=np.array(cols["type_label"], dtype=object),
        venue=np.array(cols["venue"], dtype=object),
        true_id=np.array(cols["true_id"], dtype=np.int64),
        provenance=np.array(cols["provenance"], dtype=np.int64),
        is_dup=np.array(cols["is_dup"], dtype=bool),
    )
    # canonical record order: by list, then date (removes generation-order artefacts)
    order = np.lexsort((rng_rec.random(len(records)), records.date, records.list_id))
    records = records.subset(order)

    return World(config=cfg, seed=int(seed) if np.isscalar(seed) else seed, county_latlon=latlon,
                 county_names=names, neighbours=neighbours, adjacency=adjacency,
                 date=date, hour=hour, county=county, itype=itype, target=target, campus=campus,
                 venue=venue, latent_class=z, capture_prob=P, Y=Y, Y_direct=Y_direct,
                 records=records, meta=dict(n_counties=C))


# ---------------------------------------------------------------------------
# ground-truth summaries
# ---------------------------------------------------------------------------
def histories_to_table(H):
    """(n, K) 0/1 array of capture histories -> {h: n_h} over nonzero h."""
    H = np.asarray(H, dtype=np.int64)
    K = H.shape[1]
    codes = H @ (1 << np.arange(K))
    counts = np.bincount(codes, minlength=2 ** K)
    return {tuple((c >> k) & 1 for k in range(K)): int(counts[c]) for c in range(1, 2 ** K)}


def true_capture_table(world: World, use_direct_ngo: bool = False):
    """True capture table; with use_direct_ngo the NGO column counts direct captures only."""
    Y = world.Y.copy()
    if use_direct_ngo:
        Y[:, 1] = world.Y_direct[:, 1]
    return histories_to_table(Y)


def world_truth(world: World):
    """Ground-truth quantities used by the experiment runner."""
    cfg = world.config
    mu = expected_cell_counts(cfg, world.itype, world.target, world.campus)
    n_obs = int(world.Y.any(axis=1).sum())
    return dict(N=int(world.N), n_obs=n_obs, n0=int(world.N - n_obs),
                omega_pop=population_omega(mu),
                mu0=float(mu[(0,) * K_LISTS]),
                n_records=int(len(world.records)),
                n_dups=int(world.records.is_dup.sum()),
                n_referral_only=int((world.records.provenance == 1).sum()),
                list_sizes=[int(x) for x in world.Y.sum(axis=0)])
