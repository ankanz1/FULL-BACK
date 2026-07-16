
import os
import requests

def main():
    api_key = os.getenv("FOOTBALL_DATA_API_KEY")
    base_url = "https://api.football-data.org/v4"

    headers = {"X-Auth-Token": api_key}

    print("Testing Football Data API...")
    print("-" * 50)

    # Test 1: Get competitions
    print("\n1. Fetching competitions:")
    competitions_url = f"{base_url}/competitions"
    response = requests.get(competitions_url, headers=headers)
    if response.ok:
        comps = response.json()
        print(f"Found {len(comps['competitions'])} competitions")
        for comp in comps["competitions"][:10]:
            print(f"  - {comp['name']} ({comp['code']})")
    else:
        print(f"Failed: {response.status_code} - {response.text}")

    print("\n" + "-" * 50)

if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv()
    main()
