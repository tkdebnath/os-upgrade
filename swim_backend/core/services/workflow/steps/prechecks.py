from swim_backend.core.services.workflow.base import BaseStep
from swim_backend.core.services.genie_service import create_genie_device, run_check_operation
from swim_backend.core.models import CheckRun

class PreCheckStep(BaseStep):
    def execute(self):
        job = self.get_job()
        device = job.device
        
        all_checks = job.selected_checks.all()
        if not all_checks.exists():
            self.log("No Pre-Checks selected. Skipping.")
            return 'success', "No checks"
            
        try:
            # Create Genie Device Object (Dynamic Testbed)
            genie_dev, log_dir = create_genie_device(device, job.id)
            self.log(f"Using Logical Device Object for {device.hostname}")
            
            try:
                # Connect once for all checks
                genie_dev.connect(log_stdout=False)
                
                failures = 0
                for check in all_checks:
                    self.log(f"Running Pre-Check: {check.name} ({check.get_category_display()})...")
                    
                    # Create detailed record
                    check_run = CheckRun.objects.create(
                        device=device,
                        job=job,
                        validation_check=check,
                        status='running'
                    )
                    
                    # Execute Check (Genie or Command)
                    # Connection persists
                    success, msg = run_check_operation(
                        genie_dev, 
                        check.category, 
                        check.command, 
                        check.name, 
                        'pre', 
                        log_dir
                    )
                    
                    status = "success" if success else "failed"
                    
                    check_run.status = status
                    check_run.output = msg
                    check_run.save()
                    
                    self.log(f"Pre-Check {check.name}: {status}")
                    if not success:
                        failures += 1
                
                if failures > 0:
                    self.log(f"{failures} Pre-Checks Failed.")
                    return 'warning', f"{failures} checks failed"
                
                return 'success', "All checks passed"

            except Exception as e:
                self.log(f"Pre-Check Error: {e}")
                return 'failed', str(e)
            finally:
                # Always disconnect
                if 'genie_dev' in locals() and genie_dev:
                    try:
                        genie_dev.disconnect()
                    except:
                        pass

        except Exception as e:
             self.log(f"Pre-Check Setup Error: {e}")
             return 'failed', str(e)
