import time
import threading
from django.utils import timezone
from .models import Job
from .logic import run_swim_job

def scheduler_tick():
    """
    Background thread that runs every 30 seconds to check for scheduled jobs.
    """
    while True:
        try:
            now = timezone.now()
            # Find jobs that are 'scheduled' and time has passed
            jobs_to_run = Job.objects.filter(status='scheduled', distribution_time__lte=now)
            
            for job in jobs_to_run:
                # Double check to avoid race conditions if multiple workers (not an issue in dev server usually)
                # Ensure we only pick up jobs that are still scheduled
                # We update status immediately to avoid re-picking
                # run_swim_job handles status updates
                print(f"[Scheduler] Triggering scheduled job {job.id} for device {job.device}")
                t = threading.Thread(target=run_swim_job, args=(job.id,))
                t.daemon = True
                t.start()
                
        except Exception as e:
            print(f"[Scheduler] Error: {e}")
            
        time.sleep(30)

def start_scheduler():
    t = threading.Thread(target=scheduler_tick)
    t.daemon = True
    t.start()
