import time
from ..base import BaseStep

class ActivationStep(BaseStep):
    def execute(self):
        job = self.get_job()
        device = job.device
        
        if not job.activate_after_distribute:
            self.log("Activation skipped by job configuration.")
            return 'warning', "Skipped"

        self.log("Starting Activation Phase (Reboot)...")
        time.sleep(5)
        
        # MOCK FAILURE LOGIC
        if 'FailActivation' in device.hostname:
             self.log("Activation Failed during reboot sequence (Mock Failure).")
             # We assume WorkflowEngine treats 'failed' as stop unless 'continue_on_failure' is set?
             # But WAIT: User wanted PostChecks to run even if Activation failed.
             # So we should probably return 'failed' and rely on WorkflowStep config `continue_on_failure=True`.
             # OR we return 'warning' to let engine proceed?
             # 'failed' is semantically correct. We need to ensure the WorkflowStep is configured to continue.
             return 'failed', "Activation Failed"
        
        self.log("Activation Complete. Device is online with new image.")
        return 'success', "Activation Success"
