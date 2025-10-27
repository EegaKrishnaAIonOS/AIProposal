import requests
from bs4 import BeautifulSoup
import pandas as pd

# Step 1: Fetch the webpage
url = "https://gem.gov.in/cppp"
response = requests.get(url)
response.raise_for_status()  # Ensure page is fetched successfully

# Step 2: Parse the HTML
soup = BeautifulSoup(response.content, "html.parser")

# Step 3: Find the div with class "table-responsive"
table_responsive_div = soup.find("div", class_="table-responsive").find("table")

df = pd.read_html(table_responsive_div.prettify())[0].to_dict(orient='records')
if table_responsive_div:
    # Print the entire HTML content within this div
    print(df)
else:
    print("No table-responsive div found on the page.")

# Transform the dictionaries as per request
transformed = []
for entry in df:
    new_dict = {
        "DEADLINE": entry.get("Bid Submission Closing Date", None),
        "Tender Title": entry.get("Title/Ref.No./Tender Id", None),
        "COMPANY": entry.get("Organisation Name", None),
        "SECTOR": float('nan'),
        "Value": float('nan')
    }
    transformed.append(new_dict)

from pprint import pprint
pprint(transformed)