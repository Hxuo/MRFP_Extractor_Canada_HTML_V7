# MRFP Extractor Canada HTML v7 — Production Ready

**Edition:** `MRFP_Extractor_Canada_HTML_v7_Ready`  
**Documentation updated:** November 19, 2026  
**Application version:** Browser v7 (latest approved v7 code, including Mawer FMC #50)  
**Registered Fund Management Companies (FMCs):** **50**  
**Distribution type:** Complete browser application and rebuildable source tree

This README is the **single current documentation** for the production package. It consolidates the relevant operating instructions, architecture and release evolution from **v6-5 through the latest v7 + Mawer FMC #50**. The application and its generated bundles are copied unchanged from the supplied updated v7 baseline; the production cleanup changes packaging and documentation only.

## 1. Quick start

1. Extract `MRFP_Extractor_Canada_HTML_v7_Ready.zip`. The archive contains a **single folder** named `MRFP_Extractor_Canada_HTML_v7_Ready`.
2. Keep its `Assets/`, `css/`, `js/`, and `vendor/` folders together with `index.html`.
3. Open **`index.html` in Google Chrome or Microsoft Edge** (double-click or Open File). A server, Node.js, and `npm` are **not** required to use the already-built browser application.
4. Select one or more Canadian Management Reports of Fund Performance (MRFPs), extract, and **independently verify** fund identity, report period, Class/Series, MER, Total TER, PTR, and evidence highlighting against the original report.
5. Back up important saved History before changing browser profiles or folder paths. The new `_Ready` folder location may be treated as a different local-file storage context, so previously saved records may not appear automatically.

Native-text PDF extraction uses the locally bundled PDF.js worker and can work without an internet connection. Optional OCR and emergency dependency fallback may need network access (see §6). This software provides source-assisted extraction; ambiguous values should be manually reviewed rather than treated as audited facts.

## 2. Included production architecture

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
│   ├── core/                       7 shared source modules
│   │   ├── shared-utils.js
│   │   ├── series-designations.js
│   │   ├── total-expense-ratio.js
│   │   ├── fmc-registry.js
│   │   ├── extraction-engine.js
│   │   ├── evidence-utils.js
│   │   └── evidence-engine.js
│   ├── fmc/                        50 FMC adapters + ADAPTER_TEMPLATE.txt
│   ├── app.js
│   ├── engine.js                  generated browser bundle
│   ├── evidence-locator.js        generated browser bundle
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

**Total:** 76 packaged files: **74 original source/runtime/build/assets files**, plus this README and the corrected skeleton script. There are **no** sample or fixture PDFs, `tests/`, `batch-test/`, `node_modules/`, `qa-v4/`, `results/`, archived `docs/`, `migration/`, golden JSON, or regression reports.

**Why `dev-tools/` remains:** Only `build.cjs` and `fmc-manifest.json` are retained. They are **build dependencies**, not test tools. These preserve the ability to edit a manager adapter and regenerate the two classic-script bundles. Both bundles are also included prebuilt, so end users never need to rebuild to run the app.

### Role of the source files

| Path | Function |
| --- | --- |
| `index.html`, `css/style.css`, `Assets/Icons/` | Browser interface, styling and local image assets |
| `js/app.js` | UI workflow, PDF batch queue, filters, review, History navigation and exports orchestration |
| `js/pdf-reader.js` | PDF.js native text, positioned text items, optional OCR fallback/supplementation |
| `js/storage.js` | Existing browser storage, saved source PDFs and extraction/history state |
| `js/excel-export.js`, `js/filter-excel.js` | Existing Excel/CSV generation and Excel/CSV filtering |
| `js/evidence-viewer.js` | PDF preview and yellow/orange source highlighting, manager independent |
| `js/core/*.js` | Shared general parser, exact Class/Series grammar, Total TER policy, dispatch, ratio extraction and source evidence |
| `js/fmc/<key>.js` | Manager-specific identity, fund and Class/Series ownership, period/layout strategy, extraction and source evidence |
| `js/engine.js`, `js/evidence-locator.js` | **Generated classic scripts** loaded directly by the browser; do not hand-edit |
| `dev-tools/fmc-manifest.json` | Actual FMC registration: `key`, `profile`, `extract`, `file` |
| `dev-tools/build.cjs` | Deterministic Node.js developer build of **both** generated bundles |
| `vendor/pdfjs/*.js` | Local PDF.js and worker for file-based browser use |
| `skeleton-creation.txt` | Windows CMD commands to make the exact empty architecture for manual source population |

### Registered FMC adapters (50)

The **authoritative identities and names are the manifest**, not an independently maintained runtime allowlist. The currently shipped source filenames are:

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

`ADAPTER_TEMPLATE.txt` in the same folder is a source template, not an active 51st adapter.

## 3. Core extraction and evidence contract

- **Source truth:** Read the original MRFP. Identify the legal manager/issuer, complete **fund name**, actual report-ended date, and the latest appropriate financial-table column. Do not infer a date from an unrelated footnote, holdings date, or a larger year elsewhere in the report.
- **Published Class/Series comes first.** Support structurally valid names, including single-letter, two-letter, letter-number, named or combined Series and explicit ETF-unit designations, **only when tied to a published financial ratio table**. A combined published ratio table is one row; separate published tables are separate rows. A heading alone is insufficient.
- **No distinct published Class/Series:** Use the **complete dynamically identified Fund Name as Class/Series** as the display/identity fallback, not fabricated `Units`. In the existing combined export naming, do not print the fund title twice.
- **Ratios:** `MER` is **Management Expense Ratio**, taken from the correct current-period row; **TER means Total Expense Ratio only**. **Trading Expense Ratio is never substituted for Total TER.** `PTR` is Portfolio Turnover Rate. Do not confuse *MER before waivers/absorptions* with MER.
- **Unreported/ambiguous data:** Preserve `null`/blank versus genuine numeric zero. Do not synthesize figures or borrow another Series' values. MER, Total TER, and PTR must be sourced separately.
- **Source evidence:** Associate a result with the correct document, fund, Class/Series, financial-table heading, period, metric, current column, printed number and PDF.js page/position. If evidence is ambiguous or native geometry unavailable, report unavailable evidence rather than make up a highlight.
- **No individual-fund hardcoding:** FMC/manager identity cues and reusable table grammar may be adapter-specific. Individual example fund names, filenames, numeric ratios, ticker allowlists or fixed source pages must not be hardcoded into production recognition or evidence rules.
- **Mixed date formats:** Where actually printed, compare validated calendar dates from formats such as ISO, month-first and written dates. Do not guess ambiguous day/month order; corroborate report headings against the financial table's physical header.
- **Dynamic exact labels:** `Series A` must not partially match `Series A10` or `Series AA`, and `ETF Units` is not automatically the same as `ETF Series Units`.

These are **implementation/verification rules**, not claims that every possible future issuer PDF template or OCR-rendered page has already been certified.

## 4. User workflows and saved data

### Extract and review

- Select a PDF or prepare the existing **up-to-10-PDF sequential batch**. Review each document's detected manager, fund, MRFP period, Class/Series, MER/Total TER/PTR and any missing fields.
- Inspect the original PDF and positioned source evidence (yellow extraction highlighting and orange Search focus), including navigation and page/zoom controls when available.
- Use the existing manual correction and **Verify** actions for reviewed rows. Re-scan offers a comparison/review flow; do not assume it silently preserves or replaces verified manual edits.
- The existing paste-text fallback is less reliable than directly selecting a native-text PDF, especially for geometry-sensitive evidence.

### History, storage and exports

- Extraction results, document identity and original PDF copies can be retained in the existing browser storage/History implementation. Recent Documents, History/Restore, editing and verification remain in place.
- Do not clear browser site data or delete the original application folder before taking necessary backups. A different browser profile or `file://` folder location can make prior IndexedDB data inaccessible from the new location; this is not a server-side account.
- Retain the existing Data Filter, Excel/CSV import/filter path, Lipper ID mapping, filtered CSV, standard CSV/Excel exports and the `Extraction Results` / `Lipper Format` workbook conventions.
- The app includes storage-management actions; **remove saved PDF copies** is not the same as **delete all saved PDFs and extraction/history records**. Review the confirmation before choosing destructive options.

## 5. Developer maintenance and rebuild

The installed Ready ZIP **works as-is**. The commands in this section apply only when a developer changes adapter or core source.

1. Edit the matching `js/fmc/<key>.js` sections: `// @mrfp:profile`, `// @mrfp:extraction`, `// @mrfp:evidence`. Keep manager-specific detection, report dates, class ownership, financial layout and evidence in that adapter whenever possible.
2. To add a genuinely new FMC, copy `js/fmc/ADAPTER_TEMPLATE.txt` to `js/fmc/<new_key>.js`, implement the functions and add exactly one entry to `dev-tools/fmc-manifest.json`. Do **not** assume profile identifiers are uniformly named `profile_<key>`; follow the actual manifest and neighboring adapters.
3. From the project root, with Node.js installed on the **developer** PC, run:

   ```cmd
   node dev-tools\build.cjs
   ```

4. The builder validates the JavaScript and rewrites **both** `js/engine.js` and `js/evidence-locator.js`. These must always come from the **same source tree**. Do not manually patch either generated bundle or mix output files from separate builds.
5. For a real new manager/layout, validate multiple original source documents and exact financial/source-cell expectations **outside this production-only ZIP**. Keep a separate, complete Developer project containing PDFs, tests and approved regression golden; re-test all existing managers before distributing another Ready ZIP. No testing infrastructure is bundled here.
6. Changes to shared files such as `js/app.js`, `js/pdf-reader.js`, the seven core modules or `js/evidence-viewer.js` require a demonstrated cross-manager need and relevant independent safety testing. Ordinary new-manager layouts should remain adapter-isolated.

**Source code and binary assets:** `skeleton-creation.txt` creates missing *empty* files/folders only. It cannot create a working application by itself. Paste valid source into text files, copy real JPG/PNG and PDF.js vendor binaries from a trusted build, then run the bundler. Never replace actual binary assets with empty placeholders in a deployed package.

## 6. Offline, OCR and current limits

- Native text PDF reading uses local `vendor/pdfjs/pdf.min.js` and `pdf.worker.min.js`; `file://` use in Chrome/Edge remains the intended deployment model.
- Optional Tesseract OCR for low-text pages or chart supplements may load JavaScript, worker or language data from online CDNs unless already cached. No claim of full offline OCR support is made. A local PDF.js load failure may trigger the existing online fallback.
- **Reader status safeguard added with FMC #50:** OCR **supplementation** retains valid native text items and `ocrUsed:false`, with `ocrSupplemented:true`; genuine native-text **replacement** sets `ocrUsed:true`. Native metric source boxes must not disappear merely because chart OCR appended text, and OCR-only text must not receive invented PDF-native metric boxes.
- The source identity, date and cell geometry rules are intentionally conservative. New or scanned layouts may require manual review or a verified adapter change.
- Production packaging **does not certify** end-user Chrome/Edge visual yellow/orange overlays, live IndexedDB History/Restore, interactive exports, or OCR accuracy in every target installation. Validate those behaviors on the actual production browser.
- The historical developer-only approval cohort after Mawer was **204 PDFs / 873 extracted rows / 112 fixtures**, with 50 registered FMCs. Those test originals, snapshots, candidate review files and runners are **deliberately absent** from this ZIP. These counts describe the previously approved corpus, **not** an executable regression claim for the stripped Ready package.

## 7. Release lineage — v6-5 to current v7 + Mawer

The application label intentionally remains **v7**; the intermediate `v7-5`, `v7-6`, and `v7-7` names describe prior development stages and were ultimately consolidated into the approved v7 baseline.

| Stage | Consolidated changes carried into this edition |
| --- | --- |
| **v6-5 (Nov 3, 2026)** | FMC-isolated architecture: manager-specific identity/Series/date/ratio/evidence behavior moved from shared paths into FMC adapters, leaving generic parser and dispatch in shared core. Existing UI, storage and financial formulas were deliberately retained. Historical comparison: 120 PDFs/549 rows, 112 fixtures unchanged. |
| **v6 evidence-viewer maintenance** | Manager-agnostic `js/evidence-viewer.js` delegates freshness checks to `MRFP_EVIDENCE.needsRefresh`; adapter evidence policies/stamps support safe History revalidation, including legacy BMG policy compatibility. This behavior remains in v7. |
| **v7 (Nov 18, 2026)** | Seven-module core includes shared dynamic Class/Series recognition (`series-designations.js`) in **both** generated bundles. Recognizes exact letter/multi-letter/alphanumeric, valid named, combined and ETF-related designations in supported financial-table strategies; adds IA Clarington detection/isolation safeguards. Retains strict Total TER policy. |
| **v7-5 (Nov 19, 2026)** | Expanded complete named/units Series support in **BMO, Dynamic, Fidelity and Invesco** with source/evidence checks. Corrected production skeleton for the then-current 49 adapter sources. Historical original parity: 168 PDFs/761 rows and 112 fixture cases. |
| **v7-6 (Nov 19, 2026)** | Adapter-focused changes for **RGP**, **Manulife**, **Harvest** and opt-in generic evidence grammar. Compared 49 managers under source-derived future-table scenarios: 42 qualified additions, 7 not certified at that stage. Original corpus remained 198 PDFs/859 rows; 112 fixtures unchanged. |
| **v7-7 (Nov 19, 2026)** | Verified a separate First Trust ticker-table scenario without production adapter changes; extended **Hamilton** to recognize separately printed Class financial tables and source evidence. Qualified source-derived scenarios reached 44 of 49; unverified scenarios were not silently called passes. Original 198 PDFs/859 rows and 112 fixtures remained unchanged. |
| **Approved v7 baseline (Nov 19, 2026)** | Source-backed **independent financial-table** recognition added for **BlackRock, Vanguard, Global X, Accelerate, Brompton**. Five additional controlled synthetic layouts brought the combined tested-layout scenarios to 49/49, without claiming universal future issuer support. Original 198-PDF output parity remained intact. |
| **Unified v7 developer regression (Nov 19, 2026)** | One append-only approved v7 golden and dynamic original PDF/fixture discovery replaced historic executable cross-version parity dependencies. New cases require independent source review and explicit approval; this developer-only subsystem is **not shipped** in this Ready edition. |
| **Mawer FMC #50 (Nov 19, 2026)** | Added `js/fmc/mawer.js` and manifest registration. Six genuine Mawer 2025 annual/2026 interim MRFPs cover three funds and **14 source-verified rows** (14 MER, 14 PTR, Total TER `null`); **28 numeric physical evidence cells**. Handles `Series F (formerly Series A)` as one 2026 published Series, including exact Data Filter matching in `js/app.js`; corrects supplementary-OCR/native-evidence status in `js/pdf-reader.js`. Developer regression golden expanded append-only from 198 to 204 PDFs and 859 to 873 rows; 112 fixtures preserved. |
| **v7 Ready production packaging (this edition)** | Production files and complete rebuildable source retained unchanged. Testing suites, input/sample PDFs, historical documents, regression baselines and reports removed. One up-to-date README and one CMD-only skeleton replace outdated documentation. |

### Important qualification of historical coverage

The old added-Series numbers (`42/49`, `44/49`, and `49/49`) were **staged, layout-specific synthetic or source-derived simulations**, not proof that all 50 issuers publish every possible Class/Series table. Similarly, old original-PDF parity checked preservation against a frozen baseline, not independent audit of every financial value. The six Mawer PDFs were real issuer reports, but interactive browser visuals remained a separate acceptance activity.

## 8. Deployment / update checklist

1. Back up the existing project and export important History before switching folders or browser profiles.
2. Extract the Ready ZIP without renaming/moving its internal paths. Confirm `index.html`, both generated bundles, PDF.js vendor files and both icons are present.
3. Open `index.html` directly in Chrome/Edge. Validate actual original PDFs from the intended FMCs: manager, complete fund name, report period, published Class/Series, current MER/PTR, explicit Total TER only, and missing values.
4. Check yellow source highlighting, orange Search focus, page navigation, evidence refresh, edits/Verify, Re-scan, History/Restore and CSV/Excel exports with representative real documents.
5. Confirm OCR behavior separately online and offline if OCR is required. Keep original PDFs available for manual checking.
6. Keep a **separate complete Developer baseline** if future FMC regression approvals are planned. This Ready ZIP is not a substitute for the removed test/approved-golden corpus.

---

**Current source-of-truth hierarchy:** original Canadian MRFP PDFs for financial values; `dev-tools/fmc-manifest.json` for registered managers; `js/fmc/` and `js/core/` for implemented parsing and evidence behavior; `dev-tools/build.cjs` for deterministic bundles. This README is documentation, not an independent financial audit or source code override.
