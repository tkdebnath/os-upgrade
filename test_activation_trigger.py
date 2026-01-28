import requests
import json
import time

url = "http://localhost:8000/api/devices/activate_image/"
payload = {
    "ids": [64],
    "checks": [],
    "execution_config": { "sequential": [], "parallel": [64] },
    "workflow_id": 7
}

print(f"Triggering Activation for Device 64 with Workflow 7 (No Activation Step)...")
try:
    response = requests.post(url, json=payload)
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text}")
    
    if response.status_code == 200:
        data = response.json()
        job_ids = data.get('job_ids', [])
        if job_ids:
            job_id = job_ids[0]
            print(f"Job Created: {job_id}. Waiting for execution...")
            time.sleep(5) # Wait for engine to pick it up
            
            # Fetch Job Details
            job_url = f"http://localhost:8000/api/jobs/{job_id}/"
            job_resp = requests.get(job_url)
            job_data = job_resp.json()
            
            print("\n--- JOB DETAILS ---")
            print(f"ID: {job_data['id']}")
            print(f"Status: {job_data['status']}")
            print("Steps:")
            print(json.dumps(job_data['steps'], indent=2))
            print("\nLogs:")
            print(job_data['log'])
            
except Exception as e:
    print(f"Error: {e}")
