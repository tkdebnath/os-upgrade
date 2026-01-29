from swim_backend.core.services.workflow.base import BaseStep
from swim_backend.core.services.genie_service import create_genie_device, run_check_operation
from swim_backend.core.services.diff_service import generate_diffs
from swim_backend.core.models import CheckRun

class PostCheckStep(BaseStep):
    def execute(self):
        job = self.get_job()
        device = job.device
        
        # 1. Post Checks
        all_checks = job.selected_checks.all()
        if all_checks.exists():
            genie_dev, log_dir = create_genie_device(device, job.id)
            self.log(f"Running Post-Checks...")
            
            try:
                genie_dev.connect(log_stdout=False)
                
                for check in all_checks:
                    check_run = CheckRun.objects.create(
                        device=device,
                        job=job,
                        validation_check=check,
                        status='running'
                    )
                    
                    success, msg = run_check_operation(
                        genie_dev, 
                        check.category, 
                        check.command, 
                        check.name, 
                        'post', 
                        log_dir
                    )
                    status = "success" if success else "failed"
                    
                    check_run.status = status
                    check_run.output = f"postcheck:{log_dir}:{check.name}:{check.category}:{check.command}"
                    check_run.save()
                    
                    self.log(f"Post-Check {check.name}: {status}")
            except Exception as e:
                self.log(f"Error during Post-Checks: {e}")
            finally:
                try:
                    genie_dev.disconnect()
                except:
                   pass

            # 2. Diff Generation
            self.log("Generating Pre/Post Comparison Diffs...")
            generate_diffs(job, all_checks, log_dir)
            self.log("Diff Generation Complete.")
        
        return 'success', "Post-checks and Diff Complete"
