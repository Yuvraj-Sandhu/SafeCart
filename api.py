import requests

url = "https://www.fsis.usda.gov/fsis/api/recall/v/1"
params = {
    "field_states_id": "29", # california
    # "field_closed_year_id": "446" # 2021
}

headers = {
    "accept": "application/json",
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
}

response = requests.get(url, params=params, headers=headers)
print(response.status_code)
print(response.text)