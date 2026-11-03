# refs.bib key index (BIB curator)

Status: VERIFIED 2026-11-03. 52 entries, all checked by web search against publisher pages
(OUP, Wiley, T&F, Project Euclid, Springer, SAGE, Annual Reviews), JSTOR/RePEc/DBLP/PMC records
or library catalogues. Crossref and doi.org could not be reached from this session (host blocked), so DOIs
were confirmed through publisher or index pages instead. Fields that could not be confirmed were
removed rather than guessed. Test: `\nocite{*}` + plainnat + bibtex runs with 0 errors and 0 warnings.

Citing: `\citet{key}` / `\citep{key}`. Before adding a key to your own bib/<owner>.bib, check this list.

## Capture-recapture / MSE
- petersen1896 -- Petersen 1896, Report of the Danish Biological Station 6: plaice tagging; origin of the Lincoln-Petersen estimator
- lincoln1930 -- Lincoln 1930, USDA Circular 118: waterfowl banding returns (the "Lincoln index")
- darroch1958 -- Darroch 1958 Biometrika 45: multiple-recapture census I, closed population
- fienberg1972 -- Fienberg 1972 Biometrika 59: log-linear models for incomplete 2^k tables (K-list MSE)
- bishop1975 -- Bishop, Fienberg, Holland 1975 MIT Press: Discrete Multivariate Analysis (book)
- chao1987 -- Chao 1987 Biometrics 43: lower bound under unequal catchability (heterogeneity)
- chao2005 -- Chao 2005, Encyclopedia of Statistical Sciences 2nd ed. vol 12: species estimation (bias-corrected Chao bound used by the code). ADDED by fact-check
- turek2012 -- Turek & Fletcher 2012 CSDA 56(9): model-averaged (MATA) Wald intervals, used by loglinear_bma. ADDED by fact-check
- huggins1989 -- Huggins 1989 Biometrika 76: conditional likelihood with individual covariates
- alho1990 -- Alho 1990 Biometrics 46: logistic regression in capture-recapture
- international1995 -- IWGDMF 1995 Am J Epidemiol 142: capture-recapture and multiple-record systems I: history and theory
- madigan1997 -- Madigan & York 1997 Biometrika 84: Bayesian model averaging over decomposable graphical models for population size
- fienberg1999 -- Fienberg, Johnson, Junker 1999 JRSS-A 162: multilevel/Bayesian (Rasch) heterogeneity MSE
- chao2001 -- Chao, Tsay, Lin, Shau, Chao 2001 Stat Med 20: capture-recapture in epidemiology (tutorial)
- lum2013 -- Lum, Price, Banks 2013 Am Stat 67: MSE in human-rights research
- manriquevallier2016 -- Manrique-Vallier 2016 Biometrics 72: DP latent-class MSE (LCMCR)
- bird2018 -- Bird & King 2018 Annu Rev Stat Appl 5: MSE to inform public policy (review)
- silverman2020 -- Silverman 2020 JRSS-A 183: MSE for modern slavery, classical vs Bayesian
- ball2018 -- Ball & Price 2018 CHANCE 31(1): the statistics of genocide (HRDAG, Guatemala; MSE in court)
- ball2019 -- Ball & Price 2019 Annu Rev Stat Appl 6: statistics to assess lethal violence in war (HRDAG; MSE review). ADDED
- king2008 -- King & Brooks 2008 Biometrics 64: Bayesian closed-population size with heterogeneity, RJMCMC model averaging
- wolter1986 -- Wolter 1986 JASA 81: coverage error models for census data (dual-system assumptions)
- manski2003 -- Manski 2003 Springer: Partial Identification of Probability Distributions (book)

## Record linkage
- fellegi1969 -- Fellegi & Sunter 1969 JASA 64: a theory for record linkage
- winkler1990 -- Winkler 1990 ASA SRMS Proceedings: string comparators (Jaro-Winkler) in the FS model
- ding1994 -- Ding & Fienberg 1994 Survey Methodology 20(2): dual-system estimation with matching error (first author is Ye Ding, per Statistics Canada; corrected from "Yiping")
- diconsiglio2015 -- Di Consiglio & Tuoto 2015 JOS 31: coverage evaluation on probabilistically linked data
- sadinle2017 -- Sadinle 2017 JASA 112: Bayesian bipartite matchings
- sadinle2018 -- Sadinle 2018 AoAS 12: propagating linkage uncertainty into population-size estimation (El Salvador)
- steorts2016 -- Steorts, Hall, Fienberg 2016 JASA 111: Bayesian graphical record linkage and deduplication
- tancredi2011 -- Tancredi & Liseo 2011 AoAS 5: joint Bayesian record linkage and population size
- binette2022 -- Binette & Steorts 2022 Science Advances 8: (Almost) all of entity resolution (review)
- enamorado2019 -- Enamorado, Fifield, Imai 2019 APSR 113: fastLink, scalable Fellegi-Sunter
- lahiri2005 -- Lahiri & Larsen 2005 JASA 100: regression with linked data
- marchant2021 -- Marchant, Kaplan, Elazar, Rubinstein, Steorts 2021 JCGS 30: d-blink distributed Bayesian ER
- christen2012 -- Christen 2012 Springer: Data Matching (book)
- herzog2007 -- Herzog, Scheuren, Winkler 2007 Springer: Data Quality and Record Linkage Techniques (book)
- schnell2009 -- Schnell, Bachteler, Reiher 2009 BMC MIDM 9: privacy-preserving linkage with Bloom filters

## Bayesian / computation / decomposition / privacy / design
- rubin1987 -- Rubin 1987 Wiley: Multiple Imputation for Nonresponse in Surveys (book)
- gelman2013 -- Gelman et al. 2013 CRC: Bayesian Data Analysis, 3rd ed. (book)
- vehtari2021 -- Vehtari et al. 2021 Bayesian Analysis 16: rank-normalized R-hat
- sethuraman1994 -- Sethuraman 1994 Stat Sinica 4: stick-breaking construction of the DP
- ishwaran2001 -- Ishwaran & James 2001 JASA 96: blocked Gibbs / truncated stick-breaking
- riebler2016 -- Riebler, Sorbye, Simpson, Rue 2016 SMMR 25: BYM2 scaled spatial model
- besag1991 -- Besag, York, Mollie 1991 AISM 43: BYM / ICAR spatial model
- shapley1953 -- Shapley 1953, in Contributions to the Theory of Games II: the Shapley value
- shorrocks2013 -- Shorrocks 2013 J Econ Inequality 11: Shapley decomposition for distributional analysis
- ang2004 -- Ang 2004 Energy Policy 32: index decomposition, LMDI preferred
- dwork2014 -- Dwork & Roth 2014 FnT TCS 9: algorithmic foundations of differential privacy
- neyman1934 -- Neyman 1934 JRSS 97: stratified sampling, optimal (Neyman) allocation

## Hate-crime measurement and under-reporting (peer-reviewed)
- pezzella2019 -- Pezzella, Fetzer, Keller 2019 Am Behav Sci: the dark figure of hate-crime under-reporting (UCR vs NCVS)
- mcdevitt2003 -- McDevitt, Balboni, Bennett, Weiss, Orchowsky, Walbolt 2003, chapter in Perry (ed.) Hate and Bias Crime: A Reader (Routledge): quality of US bias-crime statistics, first ten years
- zaykowski2010 -- Zaykowski 2010 Violence and Victims 25(3): racial disparities in reporting hate crime to police (NCVS). ADDED
- lantz2022 -- Lantz & Wenger 2022 Crime & Delinquency 68(8): Asian victims' lower police reporting of hate crime (COVID-19). ADDED

## Verification notes (read before citing a specific detail)
- petersen1896: page range dropped; sources disagree (1--48 vs 5--84). Volume 6 (report for 1895, publ. 1896) confirmed.
- international1995: DOI dropped (could not be confirmed); journal, volume, issue, pages confirmed.
- ball2018: confirmed on chance.amstat.org (Feb 2018 issue). Pages and DOI not found, so omitted; volume 31(1) follows CHANCE numbering.
- ball2019: DOI confirmed; page range not confirmed, so omitted.
- gelman2013: DOI not confirmable; replaced by ISBN 978-1-4398-4095-5.
- fellegi1969: DOI is the JSTOR DOI 10.2307/2286061 (confirmed); the T&F DOI could not be confirmed.
- winkler1990: pages 354--359 (Wikipedia/most citations); one R-package reference gives 354--369.
- pezzella2019: published online 2019 (advance online publication); no volume/issue/pages found. One catalogue (KrimDok) orders authors Pezzella, Keller, Fetzer; the author's faculty page and the CRS report use Pezzella, Fetzer, Keller (used here).
- mcdevitt2003: chapter pages corrected 77--89 -> 77--90 (KrimDok). The underlying study is the 2000 BJS-funded Northeastern report.
- lantz2022: volume, issue, pages, DOI confirmed; the subtitle ("Implications for research and policy in the wake of the COVID-19 pandemic") is from memory and could not be re-checked (search budget exhausted).
- Do NOT use these works for factual claims they do not make. No numeric findings from any of them are recorded here.

## Dropped
(none: every canonical work was found and kept under its canonical key)
