import requests
import sys

BASE_URL = "http://localhost:8000/api"

def check(endpoint):
    print(f"Checking {endpoint}...")
    try:
        r = requests.get(f"{BASE_URL}{endpoint}")
        print(f"Status: {r.status_code}")
        if r.status_code != 200:
            print("Response:", r.text[:500])
        else:
            print("Success (First 100 bytes):", r.text[:100])
    except Exception as e:
        print(f"Failed to connect: {e}")

if __name__ == "__main__":
    check("/devices/")
    check("/sites/")
    check("/file-servers/")
