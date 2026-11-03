"""ampsim: a synthetic recommender world for the simulation study of
"Supply or Demand? Auditing Algorithmic Amplification of Antisemitic Content".

Everything here is synthetic. No real platform, item or user data are used.

Modules
-------
world        catalogue (items, embeddings, true labels, classifier scores), personas, regimes
engine       batched recommender + account simulation (policies alg / chron / random / popular)
measurement  exposure from true / classifier labels, validation sampling, Rogan-Gladen correction
markov       content-state Markov chains: estimation, stationary law, fundamental matrix,
             group inverse, hitting times, perturbation bounds
sequential   confidence sequences (normal mixture, betting) for a bounded mean
"""

__version__ = "1.0.0"
