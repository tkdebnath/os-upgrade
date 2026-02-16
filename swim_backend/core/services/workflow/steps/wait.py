import time
from swim_backend.core.services.workflow.base import BaseStep

class WaitStep(BaseStep):
    """
    Pauses the workflow for a specified duration.
    Config:
    - duration: int (seconds)
    """
    
    def execute(self):
        duration_val = self.config.get('duration')
        if duration_val is None:
            duration_val = 30
        duration = int(duration_val)
        self.log(f"Waiting for {duration} seconds...")
        
        time.sleep(duration)
        
        self.log("Wait complete.")
        return 'success', f"Waited {duration}s"
