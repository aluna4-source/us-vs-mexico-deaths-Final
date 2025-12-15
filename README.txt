# Final Project (US vs Mexico): Leading Causes & Mental Health

## How to run (quick)
1. Open this folder in VS Code.
2. (Optional) Regenerate the cleaned JSON:
   - `python preprocess.py`
3. Start a simple local web server (recommended):
   - `python -m http.server 8000`
4. Open in your browser:
   - http://localhost:8000/index.html

## Files
- `index.html` — main web page
- `main.js` — interactive Plotly charts
- `data/raw/` — original CSV files
- `data/clean/` — cleaned JSON used by the website
- `preprocess.py` — converts CSV -> JSON


## Data sources (links)
- Mexico (UN Data tableCode=105): https://data.un.org/Data.aspx?q=DEATHS&d=POP&f=tableCode%3a105
- United States (data.gov resource): https://catalog.data.gov/dataset/nchs-leading-causes-of-death-united-states/resource/9096aa3c-0d4b-42f1-bb01-284816d92a15
