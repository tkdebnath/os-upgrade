import time
from swim_backend.core.services.workflow.base import BaseStep

class ActivationStep(BaseStep):
    def execute(self):
        job = self.get_job()
        device = job.device
        
        # 1. Check Prerequisite: Readiness
        # Check if 'readiness' step passed in this job (if workflow has it) or generally
        # We look at the 'steps' JSON in the job specifically for this execution
        steps_log = job.steps or []
        readiness_passed = any(s['name'] == 'readiness' and s['status'] == 'success' for s in steps_log)
        
        # If not in this job (e.g. Wizard split flow), check recent database history
        if not readiness_passed:
            # Fallback: Check DB for recent PASSING readiness check result
            # Assuming ReadinessStep creates a ReadinessCheckResult or similar. 
            # (Simplification: We enforce it must be in the current workflow/job per new requirement)
            # But the wizard runs them separately. 
            # So checking the JOB steps might be insufficient if it's a new Activation-only job.
            # Let's check the DEVICE Status if possible, or a recent Job.
            pass
            
        # 2. Check Prerequisite: Distribution
        # Check if 'distribution' passed
        dist_passed = any(s['name'] == 'distribution' and s['status'] == 'success' for s in steps_log)
        
        # Strict Enforcement for "Main Job" where user expects all in one
        # If the workflow forces them (per new rule), then they ARE in this job.
        # So we can safely rely on self-check.
        
        if not readiness_passed and not dist_passed:
             # Check if we are in a 'Split Wizard' mode where these might be skipped?
             # User said: "make some checks... if not passed, activation step can't start"
             # I will emit a Warning if missing, or Fail if strictly required.
             # Given the "Fixed Step" requirement, they SHOULD be there.
             pass

        # Real Implementation of the Check being requested:
        # "If readiness and distribution ... not passed ... job should fail"
        # I'll check the 'steps' log of the current job.
        
        # NOTE: Since the User is enforcing them in the workflow, checking `job.steps` is the correct way.
        # If they failed, the engine would have stopped anyway.
        # If they are MISSING (e.g. custom bad workflow), we fail.
        
        required_steps = ['readiness', 'distribution']
        missing_reqs = []
        for req in required_steps:
            # Check if step exists in workflow and has passed
            # Actually, just check if it executed successfully
            found = next((s for s in steps_log if s['name'] == req), None)
            if not found or found['status'] != 'success':
                 missing_reqs.append(req)
        
        if missing_reqs:
             self.log(f"CRITICAL: Prerequisites not met: {', '.join(missing_reqs)}. Activation aborted.")
             return 'failed', f"Missing {', '.join(missing_reqs)}"

        if not job.activate_after_distribute:
            self.log("Activation skipped by job configuration.")
            return 'warning', "Skipped"

        self.log("Starting Activation Phase (Reboot)...")
        time.sleep(5)
        
        # MOCK FAILURE LOGIC
        if 'FailActivation' in device.hostname:
             self.log("Activation Failed during reboot sequence (Mock Failure).")
             return 'failed', "Activation Failed"
        
        self.log("Activation Complete. Device is online with new image.")
        return 'success', "Activation Success"
