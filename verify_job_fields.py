import os
import django
import sys

# Setup Django Environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'swim_backend.settings')
django.setup()

from swim_backend.core.models import Job

def verify_job(job_id):
    try:
        job = Job.objects.get(id=job_id)
        print(f"Verifying Job ID: {job.id}")
        
        errors = []
        
        # Mandatory Fields Validation
        if not job.device:
            errors.append("Missing Device")
        if not job.status:
            errors.append("Missing Status")
        if not job.task_name:
            errors.append("Missing Task Name")
        if not job.created_at:
            errors.append("Missing Created At")
            
        # Contextual Validation
        if job.status == 'scheduled' and not job.distribution_time:
             errors.append("Status is 'scheduled' but 'distribution_time' is missing")
        
        if errors:
            print("\u274c Validation Failed:")
            for err in errors:
                print(f" - {err}")
        else:
            print("\u2705 All mandatory fields present.")
            print(f"Device: {job.device.hostname}")
            print(f"Status: {job.status}")
            print(f"Task Name: {job.task_name}")
            
    except Job.DoesNotExist:
        print(f"\u274c Job {job_id} not found.")
    except Exception as e:
        print(f"\u274c Error: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python verify_job_fields.py <JOB_ID>")
    else:
        verify_job(sys.argv[1])
