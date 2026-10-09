# HiddenPressure data sources

| What | Source | Used for |
|---|---|---|
| Population by 5-year age group, top languages at home, for 13 councils | ABS 2021 Census QuickStats (LGA pages, e.g. LGA10750 Blacktown) | Adults per age band, outreach languages |
| Measured high blood pressure by age (persons %) | ABS National Health Survey 2017–18, *Hypertension and measured high blood pressure* | Expected adults with high BP |
| Share with measured high BP who did not report hypertension, by age | Same ABS release | Expected undiagnosed adults |
| Index of Relative Socio-economic Disadvantage (IRSD) 2021 | ABS SEIFA 2021, via .id community profiles | Optional priority for disadvantaged areas |
| Venue locations | Public locations of train stations, shopping centres and libraries (approximate coordinates) | Candidate check-station sites |

Age bands: 18–24 uses 40% of the 15–19 group plus 20–24. Persons rates for 25–34, 35–44, 55–64 and 65–74 are the mean of the published male and female rates. The 18–34 unreported share (96.6%) is used for both 18–24 and 25–34.

`estimate.py` reproduces every council estimate shown in the app and checks that `data.json` (the same data embedded in `index.html`) matches these sources. Run `python3 data/estimate.py`; it reads `data.json` but never changes it.
