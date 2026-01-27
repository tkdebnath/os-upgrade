
import os
import django
import requests
import json
import time

# Setup Django Environment for Direct DB Access if needed, but we'll use Requests for API
# Just using requests is better to simulate real client.

BASE_URL = "http://localhost:8000/api"

def create_scheduled_job():
    print("Creating a dummy scheduled job...")
    # Get a device first
    devices_res = requests.get(f"{BASE_URL}/devices/")
    if devices_res.status_code != 200 or not devices_res.json():
        print("No devices found due to error or empty DB. Cannot test.")
        return None
    
    data = devices_res.json()
    if isinstance(data, dict) and 'results' in data:
        devices = data['results']
    else:
        devices = data
        
    if not devices:
        print("No devices found.")
        return None
        
    device_id = devices[0]['id']
    
    # Create Job
    payload = {
        "devices": [device_id],
        "distribution_time": "2029-01-01T10:00:00Z", # Far future
        "execution_mode": "parallel",
        "task_name": "Test-Cancel-Job"
    }
    
    res = requests.post(f"{BASE_URL}/jobs/bulk_create/", json=payload)
    if res.status_code == 200:
        # Get the job ID. Since bulk_create returns count, we need to find it.
        # It's the latest job.
        time.sleep(1) 
        jobs_res = requests.get(f"{BASE_URL}/jobs/?task_name=Test-Cancel-Job")
        if jobs_res.json()['results']:
             job = jobs_res.json()['results'][0]
             print(f"Created Job {job['id']} with status {job['status']}")
             return job['id']
    else:
        print("Failed to create job:", res.text)
        return None

def verify_cancel(job_id):
    print(f"Attempting to cancel Job {job_id}...")
    url = f"{BASE_URL}/jobs/{job_id}/cancel/"
    res = requests.post(url)
    
    if res.status_code == 200:
        print("Cancel request successful (HTTP 200).")
        # Verify status
        job_res = requests.get(f"{BASE_URL}/jobs/{job_id}/")
        status = job_res.json()['status']
        print(f"Job Status after cancel: {status}")
        if status == 'cancelled':
            print("SUCCESS: Job is cancelled.")
            return True
        else:
            print(f"FAILURE: Job status is {status}, expected 'cancelled'.")
            return False
    else:
        print(f"FAILURE: Cancel request failed with {res.status_code}: {res.text}")
        return False

if __name__ == "__main__":
    job_id = create_scheduled_job()
    if job_id:
        if verify_cancel(job_id):
            exit(0)
        else:
            exit(1)
    else:
        print("Could not create job to test.")
        exit(1)
