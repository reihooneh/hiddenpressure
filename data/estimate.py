import json
# 2021 Census QuickStats (ABS): pop, ages 15-19..85+, top languages; SEIFA IRSD 2021 (.id / ABS)
L={
"Blacktown":dict(pop=396776,ages=[24375,26427,27812,31453,36436,30947,25402,22165,20158,17714,14786,12240,7622,4815,4304],langs=[["Punjabi",20554],["Hindi",17429],["Tagalog",14993],["Arabic",11687],["Gujarati",9380]],irsd=987.3,ll=(-33.765,150.875)),
"Parramatta":dict(pop=256729,ages=[11542,16999,23419,26515,26187,19343,15589,13506,12955,11834,10135,8052,5817,4130,4067],langs=[["Mandarin",31823],["Cantonese",16404],["Korean",14190],["Hindi",9590],["Arabic",8311]],irsd=1029.5,ll=(-33.795,151.035)),
"Cumberland":dict(pop=235439,ages=[12646,18657,22015,21619,20123,15958,13285,12713,12308,10858,8887,7244,5162,3645,3442],langs=[["Arabic",33264],["Mandarin",15777],["Nepali",10254],["Cantonese",9367],["Tamil",7764]],irsd=903.6,ll=(-33.852,150.985)),
"Penrith":dict(pop=217664,ages=[13523,14793,16191,16790,16905,14869,13990,12864,11928,11407,9349,8067,5042,3124,2713],langs=[["Arabic",3922],["Punjabi",3105],["Tagalog",2646],["Hindi",2367],["Mandarin",1747]],irsd=991.3,ll=(-33.755,150.700)),
"Liverpool":dict(pop=233446,ages=[16212,16481,16425,17030,17880,16101,15301,14296,13565,11601,8958,7029,4845,3206,2943],langs=[["Arabic",30501],["Vietnamese",12470],["Hindi",7942],["Serbian",5397],["Spanish",4899]],irsd=930.8,ll=(-33.940,150.850)),
"Fairfield":dict(pop=208475,ages=[14439,14686,14190,12855,12655,12304,13316,13872,14129,13816,11358,9014,5837,4319,4440],langs=[["Vietnamese",43936],["Arabic",19334],["Assyrian",16305],["Chaldean",8437],["Cantonese",7668]],irsd=814.0,ll=(-33.870,150.905)),
"Campbelltown":dict(pop=176519,ages=[10930,11285,12147,13457,14418,12172,10694,9592,10027,9472,8107,6709,4169,2523,1953],langs=[["Bengali",7475],["Arabic",7381],["Nepali",4391],["Hindi",3772],["Samoan",3208]],irsd=947.5,ll=(-34.075,150.810)),
"Camden":dict(pop=119325,ages=[7498,6987,8690,10766,10410,8423,7853,6429,5538,4790,3899,3295,2085,1343,1220],langs=[["Arabic",2689],["Spanish",1859],["Hindi",1745],["Punjabi",1333],["Italian",1315]],irsd=1044.8,ll=(-34.010,150.715)),
"The Hills":dict(pop=191876,ages=[13071,11436,8835,10497,15214,15616,14419,12706,11105,9903,8981,7876,5466,3254,2845],langs=[["Mandarin",15678],["Cantonese",6446],["Hindi",5418],["Korean",4052],["Arabic",3856]],irsd=1098.1,ll=(-33.655,150.975)),
"Hawkesbury":dict(pop=67207,ages=[4391,4245,4409,4428,4007,3906,4459,4720,4515,4134,3341,3022,2161,1398,1215],langs=[["Maltese",572],["Punjabi",339],["Italian",285],["Arabic",259],["Cantonese",235]],irsd=1025.9,ll=(-33.560,150.800)),
"Blue Mountains":dict(pop=78121,ages=[4665,3421,3098,4028,4678,4905,5489,5472,5408,5794,5533,4984,3339,1921,1763],langs=[["Spanish",489],["German",383],["Mandarin",256],["French",242],["Italian",202]],irsd=1048.2,ll=(-33.705,150.440)),
"Canterbury-Bankstown":dict(pop=371006,ages=[22662,25124,27651,27793,27026,24045,23222,22450,21938,19985,16245,13514,9929,7576,8374],langs=[["Arabic",63655],["Vietnamese",27916],["Mandarin",19049],["Greek",17394],["Cantonese",13588]],irsd=916.8,ll=(-33.925,151.055)),
"Wollondilly":dict(pop=53961,ages=[3712,3188,3081,3454,3550,3348,3759,3587,3215,3096,2682,2320,1517,944,766],langs=[["Italian",359],["Arabic",358],["Spanish",266],["Maltese",202],["Croatian",174]],irsd=1041.0,ll=(-34.150,150.570)),
}
# ABS National Health Survey 2022, "Hypertension and high measured blood pressure" (released 15 Dec 2023):
#   measured high BP (persons %): 18-24 and 75+ are the persons figures in the text; the others are
#   the mean of the published male and female rates. Not reporting hypertension: Table 2 (18-44 is one group).
BANDS=[("18-24",4.5,92.3),("25-34",12.0,92.3),("35-44",14.95,92.3),("45-54",27.0,81.1),("55-64",32.15,75.2),("65-74",39.1,63.6),("75+",42.9,54.0)]
def bands(a):
    return [0.4*a[0]+a[1], a[2]+a[3], a[4]+a[5], a[6]+a[7], a[8]+a[9], a[10]+a[11], a[12]+a[13]+a[14]]
tot=0;totA=0;totH=0
for k,v in L.items():
    b=bands(v['ages']); v['bands']=[round(x) for x in b]
    hi=sum(x*p/100 for x,(n,p,u) in zip(b,BANDS)); un=sum(x*p/100*u/100 for x,(n,p,u) in zip(b,BANDS))
    v['adults']=round(sum(b)); v['hbp']=round(hi); v['undx']=round(un)
    tot+=un;totA+=sum(b);totH+=hi
    print(f"{k:22s} adults {sum(b):8.0f}  highBP {hi:7.0f}  undiagnosed {un:7.0f}  per1000 {un/sum(b)*1000:5.1f}")
print('TOTAL adults',round(totA),'highBP',round(totH),'undx',round(tot), 'share',round(tot/totH*100,1))

# Check that the data the app uses (data.json, also embedded in index.html) matches these sources.
# This only reads data.json; it never overwrites it.
import os, sys
app = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data.json')))
problems = []
by_name = {a['name']: a for a in app['areas']}
for k, v in L.items():
    a = by_name.get(k)
    if a is None: problems.append(f'{k}: missing from data.json'); continue
    if a['bands'] != v['bands']: problems.append(f'{k}: age bands differ')
    if a['adults'] != v['adults']: problems.append(f'{k}: adult count differs')
    if a['irsd'] != v['irsd'] or a['langs'] != v['langs']: problems.append(f'{k}: SEIFA or languages differ')
if [list(b) for b in BANDS] != app['bands']: problems.append('blood pressure rates differ')
if problems:
    print('MISMATCH between estimate.py and data.json:'); [print('  ' + x) for x in problems]; sys.exit(1)
print('data.json matches the published sources used here.')
