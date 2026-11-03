# NOTES-BAYES (requests to LEAD)

- Preamble: the log has ~19 pdfTeX warnings "destination with the same identifier (name{ALG@line.N}) has been already used". Algorithm line anchors collide across the three algorithms under hyperref. Suggested fix, after hyperref is loaded:
  `\makeatletter\renewcommand{\theHALG@line}{\arabic{algorithm}.\arabic{ALG@line}}\makeatother`
