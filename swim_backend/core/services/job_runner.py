import time
import threading
import logging
import datetime
from django.utils import timezone
from dateutil import parser as date_parser
from swim_backend.core.models import Job
from swim_backend.core.readiness import check_readiness

from .diff_service import generate_diffs, log_update

logger = logging.getLogger(__name__)

# Global Semaphore for Concurrency Limits (Kept for backward compatibility or direct use)
DISTRIBUTION_SEMAPHORE = threading.Semaphore(40)

def update_step(job_id, step_name, status='pending'):
    """
    Legacy helper kept for backward compatibility if other modules use it.
    New WorkflowEngine uses its own update_job_step but logic is similar.
    """
    try:
        job = Job.objects.get(id=job_id)
        existing = next((s for s in job.steps if s['name'] == step_name), None)
        if existing:
            existing['status'] = status
            existing['timestamp'] = timezone.now().strftime("%H:%M:%S")
        else:
            job.steps.append({
                'name': step_name,
                'status': status,
                'timestamp': timezone.now().strftime("%H:%M:%S")
            })
        job.save()
    except:
        pass

def run_swim_job(job_id):
    """
    Refactored Entry point using Modular Workflow Engine.
    """
    try:
        from .workflow.engine import WorkflowEngine
        engine = WorkflowEngine(job_id)
        engine.run()
    except Exception as e:
        logger.error(f"Job {job_id} failed: {e}")
        try:
             # Ensure failure is visible in UI
             from .diff_service import log_update
             log_update(job_id, f"Critical System Error: {e}")
             
             job = Job.objects.get(id=job_id)
             job.status = 'failed'
             job.save()
        except:
             pass

def run_sequential_batch(job_ids):
    """
    Executes a list of jobs one by one.
    """
    for job_id in job_ids:
        try:
             # Run job synchronously in this thread
             # Check if cancelled before starting next
             job = Job.objects.get(id=job_id)
             if job.status == 'cancelled':
                 log_update(job_id, "Sequential Job Cancelled before start.")
                 continue

             log_update(job_id, "Starting Sequential Execution...")
             run_swim_job(job_id)
        except Exception as e:
             log_update(job_id, f"Sequential Batch Error: {e}")

def orchestrate_jobs(sequential_ids, parallel_ids, schedule_time=None):
    """
    Orchestrates the execution of jobs:
    1. Waits for schedule_time (if provided).
    2. Runs sequential_ids one by one.
    3. Runs parallel_ids concurrently.
    """
    
    # 1. Update status to 'scheduled' initially
    all_ids = sequential_ids + parallel_ids
    Job.objects.filter(id__in=all_ids).update(status='scheduled')
    
    # 2. Wait for schedule
    if schedule_time:
        try:
            # Parse if string
            if isinstance(schedule_time, str):
                target_time = date_parser.parse(schedule_time)
            else:
                target_time = schedule_time
            
            # Ensure target_time is aware if simple parser gave naive
            if timezone.is_naive(target_time):
                target_time = timezone.make_aware(target_time)

            now = timezone.now()
            if target_time > now:
                delay = (target_time - now).total_seconds()
                logger.info(f"Scheduling execution for {target_time} (in {delay}s)")
                for jid in all_ids:
                    log_update(jid, f"Scheduled for execution at {target_time}")
                
                time.sleep(delay)
        except Exception as e:
            logger.error(f"Scheduling Error: {e}")
            for jid in all_ids:
                log_update(jid, f"Scheduling Failed: {e}. Executing Now.")

    # 3. Sequential Phase (Thread)
    if sequential_ids:
        t_seq = threading.Thread(target=run_sequential_batch, args=(sequential_ids,))
        t_seq.daemon = True
        t_seq.start()

    # 4. Parallel Phase (Thread)
    if parallel_ids:
        # Launch each parallel job in its own thread
        for job_id in parallel_ids:
            t = threading.Thread(target=run_swim_job, args=(job_id,))
            t.daemon = True
            t.start()
