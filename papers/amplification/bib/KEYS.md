# Key index (BIB curator: SOURCES) -- Paper 4, Supply or Demand?

Status: VERIFIED 2026-11-03. refs.bib: 25 entries; bib/sources.bib: 25 entries. `\nocite{*}` + plainnat + bibtex: 0 errors, 0 warnings.
Each entry carries a non-printing field `verification` saying how it was checked: `web: <where>` means
authors/title/venue/year/volume/pages/DOI were confirmed by web search against publisher or index records
(pnas.org, projecteuclid.org, dl.acm.org, academic.oup.com, nature.com, science.org, eur-lex/ec.europa.eu,
supremecourt.gov, aclanthology.org, ojs.aaai.org, Springer, PubMed); `web (Paper 1|2)` means copied verbatim
from a companion paper's verified bib; `curator knowledge` marks the few standard fields not separately
re-checked (rubin1974, imbensrubin2015, wald1945, two DOIs). Crossref/doi.org were not reachable.
`grep -n verification refs.bib bib/sources.bib` lists them.

Keys are stable; cite them freely. Do NOT redefine these keys in bib/<owner>.bib (bibtex "Repeated entry").
Put extra refs in your own bib file. Citing: `\citet{key}` / `\citep{key}`.
main.tex should list: `\bibliography{refs,bib/sources,bib/theory,bib/design,bib/lead}` (plainnat).

## refs.bib -- methodological core
### Audits and feedback loops
- sandvig2014 -- Sandvig, Hamilton, Karahalios, Langbort 2014, paper at ICA 2014 "Data and Discrimination" preconference (Seattle, 22 May 2014): auditing algorithms; sock-puppet, scraping, crowdsourced audit designs
- ribeiro2020 -- Ribeiro, Ottoni, West, Almeida, Meira 2020 FAT* '20 pp. 131-141: radicalization pathways on YouTube (logged-out, non-personalised recommendation crawls, May-Jul 2019)
- hosseinmardi2024 -- Hosseinmardi, Ghasemian, Rivera-Lanas, Horta Ribeiro, West, Watts 2024 PNAS 121(8) e2313377121: counterfactual bots
- haroon2023 -- Haroon, Wojcieszak, Chhabra, Liu, Mohapatra, Shafiq 2023 PNAS 120(50) e2213020120: 100,000 sock puppets on YouTube
- huszar2022 -- Huszar, Ktena, O'Brien, Belli, Schlaikjer, Hardt 2022 PNAS 119(1) e2025334119: randomized chronological-feed holdout on Twitter
- ledwich2020 -- Ledwich & Zaitsev 2020 First Monday 25(3): YouTube "rabbit hole" (logged-out recommendations)
- chaney2018 -- Chaney, Stewart, Engelhardt 2018 RecSys '18 pp. 224-232: algorithmic confounding / feedback loops (simulation)
- jiang2019 -- Jiang, Chiappa, Lattimore, Gyorgy, Kohli 2019 AIES '19 pp. 383-390: degenerate feedback loops (theory). Some lists mis-cite it as AAAI-19 33:4275-4282; the AIES citation is the one used. Abstract wording not re-checked: do not attribute specific sub-findings
### Markov chains
- kemeny1960 -- Kemeny & Snell 1960 Van Nostrand: Finite Markov Chains (fundamental matrix, absorption). PREFER this key.
- kemeny1976 -- Kemeny & Snell 1976 Springer UTM printing of the same book. Do not cite both.
- meyer1975 -- Meyer 1975 SIAM Review 17(3) 443-464: group inverse in finite Markov chains
- cho2001 -- Cho & Meyer 2001 Linear Algebra Appl 335 137-150: comparison of perturbation bounds (condition numbers) for stationary distributions
- seneta2006 -- Seneta 2006 Springer: Non-negative Matrices and Markov Chains (revised printing of 2nd ed. 1981)
### Potential outcomes and interference
- rubin1974 -- Rubin 1974 J Educ Psychol 66(5) 688-701: potential outcomes
- imbensrubin2015 -- Imbens & Rubin 2015 CUP (book)
- hudgens2008 -- Hudgens & Halloran 2008 JASA 103(482) 832-842: interference
- aronow2017 -- Aronow & Samii 2017 AoAS 11(4) 1912-1947: exposure mappings under general interference
### Misclassification, sequential, decomposition
- rogangladen1978 -- Rogan & Gladen 1978 Am J Epidemiol 107(1) 71-76: prevalence from an imperfect test
- wald1945 -- Wald 1945 Ann Math Stat 16(2) 117-186: sequential probability ratio test
- howard2021 -- Howard, Ramdas, McAuliffe, Sekhon 2021 Ann Stat 49(2) 1055-1080: time-uniform confidence sequences
- ramdas2023 -- Ramdas, Grunwald, Vovk, Shafer 2023 Stat Sci 38(4) 576-601: game-theoretic statistics, e-values, SAVI
- shapley1953 -- Shapley 1953 Annals of Math Studies 28: Shapley value (same entry as Paper 1)
### Protocol design
- nosek2018 -- Nosek, Ebersole, DeHaven, Mellor 2018 PNAS 115(11): preregistration (same entry as Paper 1)
- neyman1934 -- Neyman 1934 JRSS 97(4): stratified sampling, optimal allocation (same entry as Paper 1)
- cohen1960 -- Cohen 1960 Educ Psychol Meas 20(1) 37-46: Cohen's kappa

## bib/sources.bib -- empirical, legal, policy, lab
### Empirical studies of recommendation and exposure (cite only as reported; see section 2)
- hosseinmardi2021 -- Hosseinmardi, Ghasemian, Clauset, Mobius, Rothschild, Watts 2021 PNAS 118(32): real-user browsing panel, radical content on YouTube 2016-2019
- chen2023 -- Chen, Nyhan, Reifler, Robertson, Wilson 2023 Sci Adv 9(35) eadd8080: paired survey + browser data (n=1,181, 2020); alternative/extremist channels
- whittaker2021 -- Whittaker, Looney, Reed, Votta 2021 Internet Policy Review 10(2): sock-puppet audit of extremist content on three platforms
- munger2022 -- Munger & Phillips 2022 Int J Press/Politics 27(1) 186-219: "supply and demand" framework for right-wing YouTube
- robertson2023 -- Robertson, Green, Ruck, Ognyanova, Wilson, Lazer 2023 Nature 618 342-348: exposure vs engagement on Google Search
- guess2023 -- Guess, Malhotra, Pan et al. 2023 Science 381(6656) 398-404: randomized switch to chronological feed (2020 US election); erratum on Instagram classifier estimates
- adl2023badtoworse -- ADL & Tech Transparency Project 2023 report "From Bad to Worse": six test personas, four platforms (NGO report, not peer-reviewed)
### Classifier measurement of antisemitic / hateful content
- zannettou2020 -- Zannettou, Finkelstein, Bradlyn, Blackburn 2020 ICWSM 14(1) 786-797: quantitative study of online antisemitism, emergent coded terms
- rottger2021 -- Rottger et al. 2021 ACL-IJCNLP pp. 41-58: HateCheck functional tests (incl. counter-speech quoting hate)
- jikeli2023 -- Jikeli, Karali, Miehling, Soemer 2023 arXiv:2304.14599: IHRA-based annotation guide, double-annotated tweets
- steiger2021 -- Steiger, Bharucha, Venkatagiri, Riedl, Lease 2021 CHI '21: psychological well-being of content moderators
- ihra2016, jda2021 -- definitions of antisemitism (same entries as Paper 1)
### EU governance
- eu2022dsa -- Regulation (EU) 2022/2065 (DSA), OJ L 277, 27.10.2022 (same entry as Paper 2)
- eu2025delegated -- Commission Delegated Regulation (EU) 2025/2050 of 1 July 2025 (data access, Art 40(4)); OJ 9.10.2025; rules apply from 29 Oct 2025
- eu2024transparency -- Commission Implementing Regulation (EU) 2024/2835 of 4 Nov 2024: transparency-report templates and periods
- ec2025access -- Commission news: data access for researchers (29 Oct 2025; DSA data access portal)
- ec2026roundtable -- Commission news: roundtable of 19 May 2026; 49 applications received by DSCs
- ec2025fine -- Commission press release IP/25/2934 (Dec 2025): first DSA non-compliance decision; includes researcher access to public data
- ec2026actionplan -- Commission news (July 2026): action plan accepted; terms to state eligible researchers are not contractually prohibited from scraping public data
### EU data protection
- eu2016gdpr -- Regulation (EU) 2016/679 (GDPR), OJ L 119, 4.5.2016 (standard citation; special categories Art. 9, research safeguards Art. 89)
### US case law
- sandvigbarr2020 -- Sandvig v. Barr, 451 F. Supp. 3d 73 (D.D.C. 27 Mar 2020): violating public websites' ToS for research does not violate CFAA access provisions
- vanburen2021 -- Van Buren v. United States, 593 U.S. 374 (2021): "exceeds authorized access", gates-up-or-down
### Lab documents
- kornsteinlab2026detection -- lab proposal: evaluating algorithms for antisemitism detection (same key as Paper 2)
- kornsteinlab2026measurement -- lab proposal: measuring antisemitism in online discourse (same key as Paper 2)
- kornsteinlab2026darkfigure -- Paper 1 (same key as Paper 2)

## Dropped / not used
- Huszar 2022: exact data-collection window and amplification-ratio normalisation not re-checked; do not quote them.
- Haroon 2023: headline percentages (share of problematic recommendations; share of puppets exposed) appear only in secondary coverage in our checks; do not quote numbers.
- Ledwich, Zaitsev & Laukemper 2022 (personalised follow-up, First Monday) and Bagchi et al. 2024 critique of guess2023: findings not checked; not included.
- Kemeny & Snell "new appendix" subtitle: library records disagree on which printing added it; not used.
- Sandvig v. Barr WL citation: not confirmed; replaced by 451 F. Supp. 3d 73, which Van Buren cites (fact-check 2026-11-03).

## bib/lead.bib -- added in revision (TEXT-REVISER, 2026-11-04; each verified by web search, see comments in the file)
- armitage1969 -- Armitage, McPherson & Rowe 1969 JRSS A 132(2) 235-244: repeated significance tests (17.6% for eight looks)
- angelopoulos2023 -- Angelopoulos, Bates, Fannjiang, Jordan, Zrnic 2023 Science 382(6671) 669-674: prediction-powered inference
- egami2023 -- Egami, Hinck, Stewart, Wei 2023 NeurIPS 36: design-based supervised learning with imperfect surrogates
- johari2022 -- Johari, Li, Liskovich, Weintraub 2022 Management Science 68(10) 7069-7089: interference bias in two-sided platform experiments
- bajari2023 -- Bajari, Burdick, Imbens, Masoero, McQueen, Richardson, Rosen 2023 Stat Sci 38(3) 458-476: experimental design in marketplaces
- hiq2022 -- hiQ Labs v. LinkedIn, 639 F. Supp. 3d 944 (N.D. Cal. 2022): user agreement banning scraping and fake profiles enforceable (contract)
- eu2019dsm -- Directive (EU) 2019/790 (DSM copyright directive), OJ L 130, 17.5.2019, 92-125: Art. 3 text and data mining for research organisations
Companion papers (kornsteinlab2026darkfigure, ...contagion, ...attitudes) now all read "Working paper, Kornstein Lab, 2026".
Case entries (sandvigbarr2020, vanburen2021) no longer repeat the year in howpublished. vanderweele2014b: "Sti{}jn" breaks the font's ij ligature.
