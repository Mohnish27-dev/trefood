# TreFood audit artifacts — 1 November 2026

Start with the [full report](TREFOOD_IMPLEMENTATION_AUDIT.md) or the [browser-readable report](TREFOOD_IMPLEMENTATION_AUDIT.html). The HTML includes contents navigation, backlog filters and Print / Save as PDF, with no external dependencies.

| Artifact | Use |
| --- | --- |
| [Full report](TREFOOD_IMPLEMENTATION_AUDIT.md) | Assessment, existing surfaces, all PDF sections, blockers, design/data/API requirements, phased rollout and source evidence |
| [HTML report](TREFOOD_IMPLEMENTATION_AUDIT.html) | Browser reading, filtering and printing |
| [Implementation backlog](implementation-backlog.csv) | 42 work items with priority, owner, effort, dependencies and acceptance criteria |
| [PDF QA matrix](pdf-acceptance-matrix.csv) | All 25 PDF acceptance items, current coverage and required evidence |
| [Homepage gap matrix](homepage-gap-matrix.csv) | All 12 homepage sections in the PDF order |
| [Confirmed decisions](confirmed-decisions.csv) | Six decisions supplied by the product owner during this review |
| [Verification record](verification.json) | Executed checks, scope, limitations and source PDF hash |
| [Lint evidence](eslint-baseline.json) | Existing lint failures by file, line and rule |
| [Extracted PDF](handoff-source.txt) | Requirement source; layout extraction can shift table cells |

The assessment is source-based. Type checking and 291 unit tests pass; lint reports 41 errors and one warning. Browser, integration, performance and production validation remain outstanding. Application code was not changed.

To regenerate the HTML/CSV/verification artifacts after editing the Markdown source, run `python docs/audits/2026-11-01/build_artifacts.py` from the repository root. The generator uses Python's standard library and validates the key table counts. It does not deploy anything or contact external services.
