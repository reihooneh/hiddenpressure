# HiddenPressure data sources

| What | Source | Used for |
|---|---|---|
| Population by 5-year age group, top languages at home, for 13 councils | ABS 2021 Census QuickStats (LGA pages, e.g. LGA10750 Blacktown) | Adults per age band, outreach languages |
| Measured high blood pressure by age (persons %) | ABS National Health Survey 2022, *Hypertension and measured high blood pressure* (released 15 December 2023) | Expected adults with high BP |
| Share with measured high BP who did not report hypertension, by age | Same ABS release | Expected undiagnosed adults |
| Index of Relative Socio-economic Disadvantage (IRSD) 2021 | ABS SEIFA 2021, via .id community profiles | Optional priority for disadvantaged areas |
| Council boundaries | ABS Australian Statistical Geography Standard (ASGS) Edition 3, Local Government Areas 2021, © Commonwealth of Australia (ABS), CC BY 4.0. Taken from the `lga_nsw` data in the nswgeo R package (MIT) and simplified to about 750 m (`data/lga.json`) | Maps and the 3D model |
| Venue locations | Public locations of train stations, shopping centres and libraries (approximate coordinates) | Candidate check-station sites |

Age bands: 18–24 uses 40% of the 15–19 group plus 20–24. Measured high rates for 18–24 and 75+ are the published persons figures; the other bands are the mean of the published male and female rates. The unreported share for 18–44 (92.3%) is published as one group and is used for all three bands under 45.

Check against the survey: across the 13 councils the model gives 22.1% measuring high (national 23.3%) and 75.7% of those not reporting it (national 74.5%). Western Sydney is younger than Australia overall, which explains both differences. About 39% of survey participants didn't have a measurement taken; the ABS imputed their values.

`estimate.py` reproduces every council estimate shown on the site and checks that `data.json` (which the build turns into `site/assets/js/data.js`) matches these sources. Run `python3 data/estimate.py`; it reads `data.json` but never changes it.
