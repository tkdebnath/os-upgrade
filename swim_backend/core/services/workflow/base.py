from abc import ABC, abstractmethod
import logging
import datetime
from swim_backend.core.models import Job

logger = logging.getLogger(__name__)

class BaseStep(ABC):
    """
    Abstract Base Class for all Workflow Steps.
    """
    def __init__(self, job_id, step_config=None):
        self.job_id = job_id
        self.config = step_config or {}
        
    def get_job(self):
        return Job.objects.get(id=self.job_id)

    def log(self, message):
        """Helper to append to job log and system log"""
        from swim_backend.core.models import Job
        # We fetch fresh to avoid overwriting concurrent updates
        # Ideally we use an atomic update or a separate Log model
        # Append to the big text field
        try:
             job = Job.objects.get(id=self.job_id)
             timestamp = datetime.datetime.now().strftime("[%Y-%m-%d %H:%M:%S]")
             entry = f"{timestamp} {message}"
             job.log += entry + "\n"
             job.save(update_fields=['log'])
             logger.info(f"Job {self.job_id}: {message}")
        except Exception as e:
             logger.error(f"Failed to log for job {self.job_id}: {e}")

    @abstractmethod
    def execute(self):
        """
        Main execution logic.
        Returns:
            (status: str, message: str)
            status should be 'success', 'failed', or 'warning'
        """
        pass

    def can_proceed(self):
        """
        Checks if dependencies are met.
        By default returns True. Override if a step depends on previous steps.
        """
        return True
