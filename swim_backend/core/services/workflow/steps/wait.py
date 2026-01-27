import time
from .base import BaseStep, StepResult

class WaitStep(BaseStep):
    """
    Pauses the workflow for a specified duration.
    Parameters:
    - duration: int (seconds)
    """
    
    def execute(self, context) -> StepResult:
        duration = int(context.get('duration', 30))
        self.log(f"Waiting for {duration} seconds...")
        
        # In a real async engine (Celery), this should be a retry/countdown.
        # For this thread-based prototype, we sleep.
        time.sleep(duration)
        
        self.log("Wait complete.")
        return StepResult(success=True, output=f"Waited {duration}s")
