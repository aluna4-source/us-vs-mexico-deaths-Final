import os
import json
import pandas as pd

RAW_DIR = os.path.join("data", "raw")
CLEAN_DIR = os.path.join("data", "clean")
os.makedirs(CLEAN_DIR, exist_ok=True)

US_FILE = os.path.join(RAW_DIR, "NCHS_-_Leading_Causes_of_Death__United_States.csv")
MX_FILE = os.path.join(RAW_DIR, "mexico_mortality_2000_2021.csv")

# Only include these snapshot years (old-format UI uses 5-year steps)
YEARS = [2000, 2005, 2010, 2015]

# ---------------- Load ----------------
us = pd.read_csv(US_FILE)
mx = pd.read_csv(MX_FILE)

us["Year"] = us["Year"].astype(int)
mx["year"] = mx["year"].astype(int)

# ---------------- US: determine top causes for 2015 (exclude All causes, Alzheimer's) ----------------
us_us = us[us["State"] == "United States"].copy()
rank = (us_us[us_us["Year"] == 2015]
        .groupby("Cause Name", as_index=False)["Deaths"].sum()
        .sort_values("Deaths", ascending=False))

exclude = {"All causes", "Alzheimer's disease"}
causes = [c for c in rank["Cause Name"].tolist() if c not in exclude]

# Take top 10 from US (will display as dropdown items)
causes = causes[:10]

# Find suicide label used in this US dataset
def find_us_suicide_name():
    for s in ["Suicide", "Intentional self-harm (suicide)"]:
        if s in us_us["Cause Name"].unique():
            return s
    for c in us_us["Cause Name"].unique():
        if "suicide" in str(c).lower() or "self-harm" in str(c).lower():
            return c
    return None

US_SUICIDE = find_us_suicide_name() or "Suicide"

# IMPORTANT: remove standalone "Suicide" from the cause dropdown (to avoid duplicates)
# We will represent it ONLY via the combined label below.
causes = [c for c in causes if c.lower() != "suicide" and "self-harm" not in c.lower()]

# ---------------- Mexico ICD10 mappings (best-effort) ----------------
# NOTE: For "Mental health/suicide" we will use Mexico *mental disorders only* (5199 in 2015),
# because you do NOT want a separate suicide column.
mx_map = {
    "Heart disease": ["Ischaemic heart diseases, ICD10"],
    "Cancer": ["Malignant neoplasms, ICD10"],
    "CLRD": ["Chronic lower respiratory diseases, ICD10"],
    "Unintentional injuries": ["Accidents, ICD10"],
    "Stroke": ["Cerebrovascular diseases, ICD10"],
    "Diabetes": ["Diabetes mellitus, ICD10"],
    "Influenza and pneumonia": ["Influenza, ICD10", "Pneumonia, ICD10"],
    "Kidney disease": ["Disorders of kidney and ureter, ICD10"],
}

MX_MENTAL = "Mental and behavioural disorders, ICD10"

# Mexico file has Male/Female/Unknown (no sex='Total'), so compute totals by summing sex
mx_tot = (mx[(mx["population"] == "Total") & (mx["age_group"] == "Total") & (mx["year"].isin(YEARS))]
          .groupby(["year", "cause"], as_index=False)["deaths"].sum()
          .rename(columns={"year": "Year", "deaths": "Deaths"}))

# ---------------- Build US national rows ----------------
us_nat = us_us[us_us["Cause Name"].isin(causes)][["Year", "Cause Name", "Deaths"]].copy()
us_nat = us_nat[us_nat["Year"].isin(YEARS)]
us_nat["Entity"] = "United States"
us_nat = us_nat.rename(columns={"Cause Name": "Cause"})
us_nat_records = us_nat[["Entity", "Year", "Cause", "Deaths"]].to_dict(orient="records")

# Add combined label row for US using suicide deaths
us_su = us_us[us_us["Cause Name"] == US_SUICIDE][["Year", "Deaths"]].copy()
us_su = us_su[us_su["Year"].isin(YEARS)].groupby("Year", as_index=False)["Deaths"].sum()
us_su["Entity"] = "United States"
us_su["Cause"] = "Mental health/suicide"
us_mh_records = us_su[["Entity", "Year", "Cause", "Deaths"]].to_dict(orient="records")

# ---------------- Build Mexico national rows ----------------
mx_parts = []
for us_cause in causes:
    mx_causes = mx_map.get(us_cause)
    if not mx_causes:
        continue
    sub = mx_tot[mx_tot["cause"].isin(mx_causes)].copy()
    if sub.empty:
        continue
    sub = sub.groupby("Year", as_index=False)["Deaths"].sum()
    sub["Entity"] = "Mexico"
    sub["Cause"] = us_cause
    mx_parts.append(sub[["Entity", "Year", "Cause", "Deaths"]])

# Add combined label row for Mexico using *mental disorders only*
mx_m = mx_tot[mx_tot["cause"] == MX_MENTAL].copy()
mx_m = mx_m.groupby("Year", as_index=False)["Deaths"].sum()
mx_m["Entity"] = "Mexico"
mx_m["Cause"] = "Mental health/suicide"
mx_parts.append(mx_m[["Entity", "Year", "Cause", "Deaths"]])

mx_nat = pd.concat(mx_parts, ignore_index=True) if mx_parts else pd.DataFrame(columns=["Entity","Year","Cause","Deaths"])
mx_nat_records = mx_nat.to_dict(orient="records")

# ---------------- Combine national ----------------
national_records = us_nat_records + us_mh_records + mx_nat_records

# ---------------- US states JSON (keep original behavior, but exclude standalone Suicide if present) ----------------
us_states = us[(us["State"] != "United States") & (us["Cause Name"].isin(causes))].copy()
us_states = us_states[us_states["Year"].isin(YEARS)]
us_states = us_states[["State", "Year", "Cause Name", "Deaths"]]
us_states_records = us_states.to_dict(orient="records")

# ---------------- Write JSON ----------------
with open(os.path.join(CLEAN_DIR, "us_mexico_national.json"), "w", encoding="utf-8") as f:
    json.dump(national_records, f, indent=2)

with open(os.path.join(CLEAN_DIR, "us_states_top10.json"), "w", encoding="utf-8") as f:
    json.dump(us_states_records, f, indent=2)

# ---------------- Sanity checks ----------------
def get_nat(entity, cause, year):
    for r in national_records:
        if r["Entity"] == entity and r["Cause"] == cause and int(r["Year"]) == int(year):
            return int(r["Deaths"])
    return None

print("Wrote:")
print(" - data/clean/us_mexico_national.json")
print(" - data/clean/us_states_top10.json")
print("Sanity checks:")
print(" US 2015 (Mental health/suicide) =", get_nat("United States", "Mental health/suicide", 2015))
print(" MX 2015 (Mental health/suicide) =", get_nat("Mexico", "Mental health/suicide", 2015))
