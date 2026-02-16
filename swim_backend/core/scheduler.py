import time
import threading
import logging
from datetime import timedelta
from django.utils import timezone
from django.db import transaction
from .models import Job
from .logic import run_swim_job

logger = logging.getLogger(__name__)

# Scheduler health tracking
_scheduler_status = {
    'started': False,
    'last_tick': None,
    'error': None,
}

# Grace period - jobs within this time after scheduled time can still execute
# Jobs beyond this period will be marked as failed
GRACE_PERIOD_MINUTES = 5


def scheduler_tick():
    """
    Background thread that runs every 30 seconds to check for scheduled jobs.

    Logic:
    - Jobs within grace period: execute normally (status -> pending)
    - Jobs beyond grace period: mark as failed (status -> failed)
    """
    while True:
        try:
            now = timezone.now()
            _scheduler_status['last_tick'] = now
            _scheduler_status['error'] = None
            grace_deadline = now - timedelta(minutes=GRACE_PERIOD_MINUTES)

            # Find all scheduled jobs that have passed their time
            all_scheduled_jobs = list(
                Job.objects.filter(status="scheduled", distribution_time__lte=now)[:20]
            )

            if not all_scheduled_jobs:
                time.sleep(30)
                continue

            # Separate jobs into to-execute and missed
            job_ids_to_execute = []
            jobs_missed = []

            for job in all_scheduled_jobs:
                # Re-verify status hasn't changed
                current_job = Job.objects.filter(id=job.id, status="scheduled").first()
                if not current_job:
                    continue

                # Check if missed the grace period
                if current_job.distribution_time < grace_deadline:
                    # Job missed its scheduled time - auto-cancel
                    jobs_missed.append(current_job)
                    logger.warning(
                        f"[Scheduler] Job {current_job.id} missed scheduled time "
                        f"({current_job.distribution_time}), auto-cancelling"
                    )
                else:
                    # Job is within grace period - can execute
                    job_ids_to_execute.append(current_job.id)
                    logger.info(
                        f"[Scheduler] Found scheduled job {current_job.id} "
                        f"for device {current_job.device.hostname}"
                    )

            # Auto-cancel missed jobs with reason
            for missed_job in jobs_missed:
                delay_min = int((now - missed_job.distribution_time).total_seconds() / 60)
                reason = (
                    f"[AUTO-CANCELLED] Scheduled time {missed_job.distribution_time.strftime('%Y-%m-%d %H:%M:%S %Z')} "
                    f"has passed by {delay_min} min (exceeded {GRACE_PERIOD_MINUTES} min grace period). "
                    f"Current time: {now.strftime('%Y-%m-%d %H:%M:%S %Z')}. "
                    f"Job was automatically cancelled by the scheduler."
                )
                missed_job.status = "cancelled"
                missed_job.log = (missed_job.log or "") + "\n" + reason
                missed_job.save(update_fields=["status", "log", "updated_at"])
            if jobs_missed:
                logger.warning(
                    f"[Scheduler] Auto-cancelled {len(jobs_missed)} missed jobs"
                )

            # Update jobs to execute to pending status
            if job_ids_to_execute:
                with transaction.atomic():
                    updated_count = Job.objects.filter(
                        id__in=job_ids_to_execute, status="scheduled"
                    ).update(status="pending")

                logger.info(
                    f"[Scheduler] Updated {updated_count} jobs to pending status"
                )

                # Execute the jobs
                for job_id in job_ids_to_execute:
                    try:
                        job = Job.objects.get(id=job_id)
                        logger.info(
                            f"[Scheduler] Triggering scheduled job {job.id} "
                            f"for device {job.device.hostname}"
                        )

                        # Spawn thread to run the job
                        t = threading.Thread(target=run_swim_job, args=(job.id,))
                        t.daemon = True
                        t.start()

                    except Job.DoesNotExist:
                        logger.warning(f"[Scheduler] Job {job_id} no longer exists")
                    except Exception as e:
                        logger.error(f"[Scheduler] Failed to trigger job {job_id}: {e}")

        except Exception as e:
            _scheduler_status['error'] = str(e)
            logger.error(f"[Scheduler] Error in scheduler tick: {e}")

        time.sleep(30)


_scheduler_started = False

def start_scheduler():
    """Start the scheduler in a background thread."""
    global _scheduler_started
    if _scheduler_started:
        logger.debug("[Scheduler] Scheduler already running, skipping duplicate start")
        return
    _scheduler_started = True
    _scheduler_status['started'] = True
    t = threading.Thread(target=scheduler_tick, daemon=True)
    t.start()
    logger.info("[Scheduler] Background scheduler started")


def get_scheduler_status():
    """Return scheduler health info."""
    now = timezone.now()
    last_tick = _scheduler_status.get('last_tick')
    healthy = (
        _scheduler_status.get('started', False)
        and last_tick is not None
        and (now - last_tick).total_seconds() < 90  # should tick every 30s
    )
    return {
        'running': _scheduler_status.get('started', False),
        'healthy': healthy,
        'last_tick': last_tick.isoformat() if last_tick else None,
        'error': _scheduler_status.get('error'),
    }
