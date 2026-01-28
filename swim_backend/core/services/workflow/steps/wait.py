import time
from swim_backend.core.services.workflow.base import BaseStep

class WaitStep(BaseStep):
    """
    Pauses the workflow for a specified duration.
    Config:
    - duration: int (seconds)
    """
    
    def execute(self):
        duration = int(self.config.get('duration', 30))
        self.log(f"Waiting for {duration} seconds...")
        
        # In a real async engine (Celery), this should be a retry/countdown.
        # For this thread-based prototype, we sleep.
        time.sleep(duration)
        
        self.log("Wait complete.")
        return 'success', f"Waited {duration}s"
