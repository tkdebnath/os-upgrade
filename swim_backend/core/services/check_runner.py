import os
import threading
from swim_backend.core.models import CheckRun
from .genie_service import create_genie_device, run_check_operation

def run_standalone_check(check_run_id):
    """
    Executes a standalone check (Genie or Script).
    """
    try:
        run = CheckRun.objects.get(id=check_run_id)
        run.status = 'running'
        run.save()
        
        device = run.device
        
        # Generate Device Obj
        # Note: We use a temp job_id of 0 or generic 'checks' folder
        genie_dev, log_dir = create_genie_device(device, f"checks/{run.id}")
        
        # Execute Check (Unified Logic)
        success, msg = run_check_operation(
            genie_dev, 
            run.validation_check.category, 
            run.validation_check.command, 
            run.validation_check.name,
            'manual', 
            log_dir
        )
        
        # Read output file content to store in DB
        # Logic matches genie_service and diff_service
        if run.validation_check.category == 'genie':
             feature = run.validation_check.command
             dev_os = device.platform if device.platform else 'iosxe'
             hostname = device.hostname
             filename = f"{feature}_{dev_os}_{hostname}_ops.txt"
        else:
             safe_name = "".join(c if c.isalnum() else "_" for c in run.validation_check.name)
             filename = f"{safe_name}.txt"
        
        try:
            with open(os.path.join(log_dir, "manualcheck", filename), 'r') as f:
                    run.output = f.read()
        except:
            run.output = msg
            
        run.status = 'success' if success else 'failed'
        run.save()

    except Exception as e:
        try:
            # If 'run' object is available, update its status and output
            if 'run' in locals() and run:
                run.status = 'failed'
                run.output = str(e)
                run.save()
            else:
                # If 'run' object is not available (e.g., CheckRun.objects.get failed),
                # try to retrieve it to update status
                run = CheckRun.objects.get(id=check_run_id)
                run.status = 'failed'
                run.output = f"Execution Error: {str(e)}"
                run.save()
        except:
            # If even retrieving/updating run fails, just pass
            pass
    finally:
        if genie_dev:
            try:
                genie_dev.disconnect()
            except Exception as disconnect_e:
                # Log or handle disconnect error if necessary, but don't fail the main process
                # Just pass as per provided structure
                pass
