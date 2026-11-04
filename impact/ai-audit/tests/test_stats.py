"""Scoring maths: Wilson, Rogan-Gladen (point, clipping, delta method, bootstrap), bootstrap, McNemar."""

import math
import random
import unittest

import _support  # noqa: F401
from harness import stats as S


class TestWilson(unittest.TestCase):
    def test_known_value(self):
        lo, hi = S.wilson(8, 10)
        # Reference values for the Wilson 95% interval for 8/10.
        self.assertAlmostEqual(lo, 0.4902, places=3)
        self.assertAlmostEqual(hi, 0.9433, places=3)

    def test_edges(self):
        self.assertEqual(S.wilson(0, 0), (None, None))
        lo, hi = S.wilson(0, 20)
        self.assertEqual(lo, 0.0)
        self.assertLess(hi, 0.2)
        lo, hi = S.wilson(20, 20)
        self.assertEqual(hi, 1.0)


class TestRoganGladen(unittest.TestCase):
    def test_point_estimate(self):
        # True prevalence 0.2, Se 0.9, Sp 0.95 -> apparent 0.2*0.9 + 0.8*0.05 = 0.22
        self.assertAlmostEqual(S.rogan_gladen(0.22, 0.9, 0.95), 0.2)

    def test_perfect_judge_is_identity(self):
        for q in (0.0, 0.13, 0.5, 1.0):
            self.assertAlmostEqual(S.rogan_gladen(q, 1.0, 1.0), q)

    def test_clipping(self):
        self.assertEqual(S.rogan_gladen(0.01, 0.9, 0.9), 0.0)  # raw value is negative
        self.assertEqual(S.rogan_gladen(0.99, 0.9, 0.95), 1.0)
        self.assertLess(S.rogan_gladen(0.01, 0.9, 0.9, clip=False), 0)

    def test_uninformative_judge(self):
        self.assertIsNone(S.rogan_gladen(0.3, 0.5, 0.5))
        self.assertIsNone(S.rogan_gladen_delta(0.3, 100, 0.4, 50, 0.5, 50)["estimate"])

    def test_delta_method_matches_formula_and_simulation(self):
        q, nq, se, nse, sp, nsp = 0.22, 400, 0.9, 60, 0.95, 90
        r = S.rogan_gladen_delta(q, nq, se, nse, sp, nsp)
        p = 0.2
        j = se + sp - 1
        var = (q * (1 - q) / nq + p * p * se * (1 - se) / nse + (1 - p) ** 2 * sp * (1 - sp) / nsp) / j ** 2
        self.assertAlmostEqual(r["se"], math.sqrt(var))
        self.assertAlmostEqual(r["lo"], p - S.Z95 * math.sqrt(var))
        # Monte Carlo check of the delta-method standard error.
        rng = random.Random(1)
        draws = []
        for _ in range(4000):
            qb = sum(rng.random() < q for _ in range(nq)) / nq
            seb = sum(rng.random() < se for _ in range(nse)) / nse
            spb = sum(rng.random() < sp for _ in range(nsp)) / nsp
            draws.append(S.rogan_gladen(qb, seb, spb, clip=False))
        m = sum(draws) / len(draws)
        sd = math.sqrt(sum((d - m) ** 2 for d in draws) / (len(draws) - 1))
        self.assertAlmostEqual(sd, r["se"], delta=0.15 * r["se"])

    def test_interval_clipped(self):
        r = S.rogan_gladen_delta(0.02, 50, 0.85, 20, 0.97, 30)
        self.assertGreaterEqual(r["lo"], 0.0)
        self.assertLessEqual(r["hi"], 1.0)

    def test_bootstrap_interval_covers_estimate(self):
        outcomes = [1] * 22 + [0] * 78
        r = S.rogan_gladen_bootstrap(outcomes, tp=54, n_pos=60, tn=85, n_neg=90, B=800, seed=3)
        self.assertLessEqual(r["lo"], r["estimate"])
        self.assertGreaterEqual(r["hi"], r["estimate"])
        self.assertTrue(0.0 <= r["lo"] < r["hi"] <= 1.0)


class TestBootstrap(unittest.TestCase):
    def test_bootstrap_ci_of_mean(self):
        rng = random.Random(0)
        xs = [1 if rng.random() < 0.3 else 0 for _ in range(400)]
        lo, hi = S.bootstrap_ci(xs, S.mean, B=1500, seed=1)
        p = sum(xs) / len(xs)
        half = S.Z95 * math.sqrt(p * (1 - p) / len(xs))
        self.assertAlmostEqual(lo, p - half, delta=0.012)
        self.assertAlmostEqual(hi, p + half, delta=0.012)

    def test_deterministic_with_seed(self):
        xs = list(range(50))
        self.assertEqual(S.bootstrap_ci(xs, S.mean, B=200, seed=5), S.bootstrap_ci(xs, S.mean, B=200, seed=5))

    def test_paired_bootstrap_detects_difference(self):
        units = [(1, 0)] * 30 + [(0, 0)] * 60 + [(1, 1)] * 10
        r = S.paired_bootstrap(units, lambda u: S.mean([a for a, _ in u]), lambda u: S.mean([b for _, b in u]),
                               B=1000, seed=2)
        self.assertAlmostEqual(r["diff"], 0.30)
        self.assertGreater(r["lo"], 0)
        self.assertLess(r["p"], 0.01)

    def test_paired_bootstrap_null(self):
        units = [(1, 0)] * 10 + [(0, 1)] * 10 + [(0, 0)] * 80
        r = S.paired_bootstrap(units, lambda u: S.mean([a for a, _ in u]), lambda u: S.mean([b for _, b in u]),
                               B=1000, seed=2)
        self.assertAlmostEqual(r["diff"], 0.0)
        self.assertLess(r["lo"], 0)
        self.assertGreater(r["hi"], 0)
        self.assertGreater(r["p"], 0.5)


class TestMcNemar(unittest.TestCase):
    def test_exact(self):
        # b=1, c=9: two-sided exact p = 2 * P(X<=1 | n=10, 0.5) = 2 * 11/1024
        self.assertAlmostEqual(S.mcnemar(1, 9)["p"], 22 / 1024)
        self.assertEqual(S.mcnemar(5, 5)["p"], 1.0)
        self.assertEqual(S.mcnemar(0, 0)["p"], 1.0)


if __name__ == "__main__":
    unittest.main()
