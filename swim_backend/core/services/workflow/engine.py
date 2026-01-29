import logging
import traceback
from swim_backend.core.models import Job, Workflow, WorkflowStep
from swim_backend.core.services.diff_service import log_update
from django.utils import timezone

logger = logging.getLogger(__name__)

class WorkflowEngine:
    def __init__(self, job_id):
        self.job_id = job_id
        
    def get_step_class(self, step_type):
        """Factory to get step implementation class"""
        from .steps.readiness import ReadinessStep
        from .steps.distribution import DistributeStep
        from .steps.prechecks import PreCheckStep
        from .steps.activation import ActivationStep
        from .steps.postchecks import PostCheckStep
        from .steps.ping import PingStep
        from .steps.wait import WaitStep
        
        MAPPING = {
            'readiness': ReadinessStep,
            'distribution': DistributeStep,
            'precheck': PreCheckStep,
            'activation': ActivationStep,
            'postcheck': PostCheckStep,
            'ping': PingStep,
            'wait': WaitStep,
            # 'custom': CustomStep
        }
        return MAPPING.get(step_type)

    def run(self):
        job = Job.objects.get(id=self.job_id)
        
        # 1. Determine Workflow
        workflow = job.workflow
        if not workflow:
            # Fallback for legacy jobs or if no workflow selected
            # For now, we can create a temporary in-memory sequence or fail
            log_update(self.job_id, "No workflow assigned. Using Default Legacy Flow.")
            # TODO: Assign default workflow if exists, else generic
            # For now, let's assume a Default Workflow exists or we build one on the fly?
            # Better strategy: creating a 'Default Upgrade' workflow in migration was cleaner, 
            # but let's assume the user will pick one. If None, we abort or run legacy.
            # Let's ABORT to force usage of new system, or migrate on the fly.
            
            # Or better: If no workflow, we just run the old function?
            # The goal is to Refactor. So we need the engine to work.
            # Let's create a default workflow if none exists.
            
            default_wf = Workflow.objects.filter(is_default=True).first()
            if default_wf:
                job.workflow = default_wf
                job.save()
                workflow = default_wf
                log_update(self.job_id, f"Auto-assigned default workflow: {workflow.name}")
            else:
                log_update(self.job_id, "Error: No default workflow found.")
                job.status = 'failed'
                job.save()
                return

        log_update(self.job_id, f"Starting Workflow: {workflow.name}")
        job.status = 'running'
        job.save()

        # 2. Determine Execution Plan (Dynamic or Static)
        # Check if job.steps already contains a PLAN (steps with 'step_type')
        # This allows views to inject a specific sequence (e.g. Distribution Only)
        job.refresh_from_db()
        existing_steps = job.steps or []
        execution_plan = []
        
        # Check if we have a pre-defined plan in steps (look for 'step_type' in the JSON)
        if existing_steps and any('step_type' in s for s in existing_steps):
            # Convert JSON dicts to objects compatible with loop below
            class DynamicStep:
                def __init__(self, data):
                    self.name = data.get('name', 'Unknown')
                    self.step_type = data.get('step_type')
                    self.config = data.get('config', {})
            
            execution_plan = [DynamicStep(s) for s in existing_steps if 'step_type' in s]
        
        else:
            # Fallback to Workflow Model (Standard Behavior)
            steps = workflow.steps.all().order_by('order')
            execution_plan = list(steps)
        
        for step_model in execution_plan:
            # Check for cancellation
            job.refresh_from_db()
            job.refresh_from_db()
            if job.status == 'cancelled':
                log_update(self.job_id, "Workflow Cancelled by User.")
                return

            # Execute
            try:
                StepClass = self.get_step_class(step_model.step_type)
                if not StepClass:
                    log_update(self.job_id, f"Unknown step type: {step_model.step_type}. Skipping.")
                    continue
                
                # Log step start with visual separator
                log_update(self.job_id, "")
                log_update(self.job_id, "="*80)
                log_update(self.job_id, f"▶ STARTING STEP: {step_model.name}")
                log_update(self.job_id, "="*80)
                log_update(self.job_id, "")
                    
                # Initialize Step
                step_instance = StepClass(self.job_id, step_model.config)
                
                # Update UI Progress
                self.update_job_step(job, step_model.name, "running")

                if not step_instance.can_proceed():
                    log_update(self.job_id, f"Skipping {step_model.name}: Dependencies not met.")
                    self.update_job_step(job, step_model.name, "skipped")
                    continue

                status, msg = step_instance.execute()
                
                # Log step completion with visual separator
                log_update(self.job_id, "")
                log_update(self.job_id, "-"*80)
                log_update(self.job_id, f"✓ COMPLETED STEP: {step_model.name} ({status.upper()})")
                log_update(self.job_id, "-"*80)
                log_update(self.job_id, "")
                
                self.update_job_step(job, step_model.name, status)
                
                if status == 'failed':
                    if step_model.config.get('continue_on_failure'):
                        log_update(self.job_id, f"Step {step_model.name} failed but configured to continue.")
                    else:
                        log_update(self.job_id, f"Workflow Aborted due to failure in {step_model.name}.")
                        job.status = 'failed'
                        job.save(update_fields=['status'])
                        return
                        
            except Exception as e:
                logger.error(f"Error in step {step_model.name}: {e}\n{traceback.format_exc()}")
                log_update(self.job_id, f"Critical Error in {step_model.name}: {e}")
                log_update(self.job_id, "")
                log_update(self.job_id, "-"*80)
                log_update(self.job_id, f"✗ FAILED STEP: {step_model.name}")
                log_update(self.job_id, "-"*80)
                log_update(self.job_id, "")
                self.update_job_step(job, step_model.name, "failed")
                job.status = 'failed'
                job.save(update_fields=['status'])
                return

        # If we got here, workflow is done
        log_update(self.job_id, "")
        log_update(self.job_id, "="*80)
        log_update(self.job_id, "🎉 WORKFLOW COMPLETED SUCCESSFULLY")
        log_update(self.job_id, "="*80)
        job.status = 'success' # Or partial?
        job.save(update_fields=['status'])

    def update_job_step(self, job, step_name, status):
        # Helper to update the JSON steps field
        # We reload job to be safe
        j = Job.objects.get(id=job.id)
        existing = next((s for s in j.steps if s['name'] == step_name), None)
        if existing:
            existing['status'] = status
            existing['timestamp'] = timezone.now().strftime("%H:%M:%S")
        else:
            j.steps.append({
                'name': step_name,
                'status': status,
                'timestamp': timezone.now().strftime("%H:%M:%S")
            })
        j.save(update_fields=['steps'])
