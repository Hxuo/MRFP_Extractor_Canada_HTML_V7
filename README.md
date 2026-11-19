# MRFP Extractor Canada HTML v7

**Edition:** `MRFP_Extractor_Canada_HTML_v7_Ready`  
**Documentation updated:** November 19, 2026  
**Current application:** v7, including Mawer Investment Management Ltd. (FMC #50)  
**Supported Fund Management Companies (FMCs):** 50

This is the current documentation for the application **as supplied**. It covers use, included files, data interpretation, source highlighting, saved records, limitations, and the release history from v6-5 through the current v7 edition.

## 1. Open and use the application

1. Extract `MRFP_Extractor_Canada_HTML_v7_Ready.zip`. Keep the folder `MRFP_Extractor_Canada_HTML_v7_Ready` and all its contents together.
2. Open `index.html` directly in **Google Chrome** or **Microsoft Edge**.
3. Select Canadian Management Reports of Fund Performance (MRFPs) in PDF format. The application supports its existing **sequential batch workflow of up to 10 PDFs**.
4. Review the detected FMC, full fund name, report period, Class/Series, MER, Total TER, and PTR.
5. Inspect the source PDF and evidence highlights, correct any values that require manual review, and export results as needed.

No installation, server, Node.js, or internet connection is needed for the normal **native-text PDF** workflow. Optional OCR and certain dependency fallbacks may require internet access.

**Important:** Keep a backup of important saved History before moving the application to a different folder or changing browser profiles. Local-file storage access can depend on the browser and file location.

## 2. Main features

| Feature | Current behavior |
| --- | --- |
| FMC detection | Manager-aware recognition across the 50 registered FMC adapters |
| Fund identity | Complete fund names detected from document context, not from a list of individual fund names |
| Class/Series | Published designations, including supported alphanumeric, named, combined, and ETF-unit forms |
| Financial ratios | MER, **Total Expense Ratio only** (TER), and PTR from applicable financial tables |
| Reporting period | Annual and semi-annual MRFPs, with source-backed selection of the current financial-table period |
| Multiple PDFs | Existing 10-PDF sequential batch handling and document identity separation |
| Source evidence | PDF preview, positioned metric highlights, and yellow/orange evidence interactions |
| Review | Manual editing, verification, and re-scan review behavior |
| Saved work | Recent Documents, History/Restore, and saved PDF/record handling in browser storage |
| Filtering and exports | Data Filter, CSV/Excel workflows, Lipper mapping, and existing workbook/export formats |
| PDF reading | Bundled PDF.js native-text reader; optional OCR support for applicable pages |

The application preserves blank/missing values rather than turning them into numeric zero. Verify any uncertain result against the actual PDF before relying on it.

## 3. Extraction and evidence rules

### Fund and Class/Series

- The **actual issuer/manager role** determines the FMC. A passing mention of another company in a holding or narrative is not enough to assign ownership.
- Extract the complete published fund name and the Class/Series **associated with an actual financial-ratio table**.
- A single combined published table corresponds to one result. Independently reported Class/Series tables correspond to separate results.
- If no distinct Class/Series is published for the ratio table, use the **full fund name as the Class/Series display fallback**, without duplicating the fund name in exports.
- Match complete designations: `Series A` must not be confused with `Series AA` or `Series A10`; `ETF Units` is not automatically `ETF Series Units`.

### Financial metrics

| Output | Meaning | Source rule |
| --- | --- | --- |
| MER | Management Expense Ratio | Current applicable period and published Class/Series |
| Total TER | **Total Expense Ratio** | Use only an explicitly supported total expense ratio disclosure; **never** substitute Trading Expense Ratio |
| PTR | Portfolio Turnover Rate | Current applicable period and associated financial table |

Do not substitute `Management expense ratio before waivers or absorptions` for the primary MER. A missing or ambiguous disclosure remains blank (`null`), not `0`.

### Reporting date and highlights

- Select the applicable current-period ratio column; do not default to an older comparison year or to the largest date appearing elsewhere in the PDF.
- Recognize valid printed date formats where supported and use surrounding report/table context to resolve reporting-period identity. Ambiguous dates require review.
- Metric evidence must correspond to the same **PDF, page, table, Class/Series, reporting column, row, and printed value** as the extraction result.
- The app uses PDF.js native text positioning for source-cell highlights when available. Unsupported or ambiguous geometry must not be represented as a verified metric location.
- Yellow and orange highlights serve different source-evidence/search interactions. Verify the selected page and printed figure when reviewing a result.

## 4. Included application structure

```text
MRFP_Extractor_Canada_HTML_v7_Ready/
├── Assets/
│   └── Icons/
│       ├── LSEG.jpg
│       └── sales-report.png
├── css/
│   └── style.css
├── dev-tools/
│   ├── build.cjs
│   └── fmc-manifest.json
├── js/
│   ├── core/                    7 shared JavaScript source modules
│   ├── fmc/                     50 FMC adapters
│   ├── app.js
│   ├── engine.js
│   ├── evidence-locator.js
│   ├── evidence-viewer.js
│   ├── excel-export.js
│   ├── filter-excel.js
│   ├── pdf-reader.js
│   └── storage.js
├── vendor/
│   └── pdfjs/
│       ├── pdf.min.js
│       └── pdf.worker.min.js
├── index.html
├── README.md
└── skeleton-creation.txt
```

**File roles:** `index.html`, `css/`, and `Assets/` provide the interface. `js/app.js` coordinates application behavior; `js/pdf-reader.js` reads PDFs; `js/engine.js` handles extraction; `js/evidence-locator.js` locates source evidence; `js/evidence-viewer.js` displays it; `js/storage.js` manages saved data; and the remaining scripts support filtering and exports. The `js/core/` modules contain shared behavior, while `js/fmc/` contains manager-specific logic. `dev-tools/fmc-manifest.json` records the current FMC registrations.

`skeleton-creation.txt` contains Windows Command Prompt commands to create the folder/file **skeleton** under the user's Documents folder. Its commands create missing empty placeholders; they do **not** insert code, produce images, or create a working copy of the app on their own. The ZIP already includes the working files.

### Registered FMC adapter files (50)

```text
accelerate.js       agf.js            arrow_capital.js    barrantagh.js
beutel_goodman.js   blackrock.js      bmg.js              bmo.js
brandes.js          brompton.js       canada_life.js       capital_group.js
capstone.js         ccl.js            ci.js               cibc.js
desjardins.js       dynamic.js        edgepoint.js         fidelity.js
first_trust.js      franklin.js       global_x.js          guardian.js
hamilton.js         harvest.js        ia_clarington.js     ig_mackenzie.js
invesco.js          leith_wheeler.js  lysander.js          mackenzie.js
manulife.js         mawer.js          middlefield.js       nbi.js
nei.js              newgen.js         ninepoint.js         pender.js
purpose.js          rbc.js            rgp.js               rpia.js
scotia.js           sei.js            sun_life.js          td.js
three_iq.js         vanguard.js
```

The `ADAPTER_TEMPLATE.txt` file is not a registered FMC. The application has **50 active FMC adapters**, not 51.

## 5. Saved data, review, and exports

- **History / Restore:** Stored data and source PDF copies use the existing browser storage behavior. Do not clear browser data or discard the source folder until important records have been reviewed and backed up.
- **Recent Documents:** Removing a saved PDF copy and deleting saved records are different operations. Review each confirmation carefully.
- **Re-scan / Verify:** A re-scan is a comparison/review step. Check manually corrected or verified values before accepting changes.
- **Filtering:** Use the existing Data Filter and source-matching options. Class/Series matches are intended to distinguish complete labels rather than partial prefixes.
- **Exports:** Existing CSV and Excel functionality includes the `Extraction Results` and `Lipper Format` conventions, with Lipper ID mapping where provided.

## 6. Offline and OCR behavior

- The PDF.js library and worker are included in `vendor/pdfjs/`, supporting normal native-text reading without a server.
- Some scanned or low-text PDF pages may depend on optional OCR. Its scripts, worker, or language data may require an online resource unless already available locally or cached.
- When OCR **supplements** a readable native-text page, valid PDF.js text coordinates remain available for metric evidence. When OCR **replaces** missing native text, the application must not invent native-coordinate highlights for OCR-only text.
- Very unusual layouts, scanned documents, ambiguous ratio tables, or unsupported date/Series presentations may require manual review. Source highlighting and saved-record behavior should be checked in the browser used for day-to-day operation.

## 7. Version history — v6-5 to current v7

The current edition keeps the application label **v7**. The intermediate labels below describe earlier revisions whose applicable functionality is incorporated into the present application.

| Version / stage | Changes retained in the current application |
| --- | --- |
| **v6-5 — November 3, 2026** | Established FMC-isolated extraction and evidence logic, with shared core functions retained for general processing. Existing interface, saved-data behavior, and financial outputs were preserved. |
| **Evidence-viewer refinements** | Kept source highlighting and evidence-refresh behavior manager-independent, including existing record-stamp and History compatibility safeguards. |
| **v7 — November 18, 2026** | Introduced seven shared core modules, consistent Class/Series recognition for extraction and evidence, improved exact-label handling, and manager-isolation safeguards. Preserved strict Total TER meaning. |
| **v7-5 — November 19, 2026** | Extended recognition for complete named/units Series in BMO, Dynamic, Fidelity, and Invesco; refined handling of supported Series table layouts. |
| **v7-6 — November 19, 2026** | Refined layout-specific behavior for RGP, Manulife, Harvest, and general evidence grammar. |
| **v7-7 — November 19, 2026** | Improved Hamilton Class-table extraction and evidence behavior, including separately published Class financial tables. |
| **Consolidated v7 — November 19, 2026** | Added support for distinct, source-published Class/Series ratio tables in BlackRock, Vanguard, Global X, Accelerate, and Brompton. |
| **Mawer FMC #50 — November 19, 2026** | Added Mawer support for annual and interim MRFP layouts; handled the 2026 `Series F (formerly Series A)` designation as one current Series, plus exact Data Filter matching and corrected native-text/OCR evidence-status behavior. The source examples covered Global Balanced, Global Small Cap, and Canadian Bond funds. |
| **v7 Ready — November 19, 2026** | Consolidated the application into the current ready-to-use folder and this single README while retaining existing operating features and source files. |

### Mawer designation note

Mawer's 2025 reports used `Series A`; its 2026 interim reports use `Series F (formerly Series A)` following the May 27, 2026 renaming. The 2026 ratio table represents **one Series F record**, not separate Series F and legacy Series A results. As with every issuer, **Trading Expense Ratio is not Total TER**.

## 8. Everyday-use checklist

1. Open the included `index.html` in Chrome or Edge, retaining all folders in their original relative locations.
2. Load the intended PDF or batch and review detected FMC, full fund name, reporting date, and published Class/Series.
3. Check MER, **Total TER only**, PTR, and any missing/blank outputs against the original ratio tables.
4. Review evidence highlights and page positions before marking results verified.
5. Confirm filtered rows and exports, and maintain backups of important browser-stored History.
6. Use OCR where needed and available; do not treat uncertain OCR or missing highlights as independently verified figures.

**Source priority:** The original MRFP controls financial disclosures. The application's output is an extraction and review aid, not a substitute for examining the published document.
