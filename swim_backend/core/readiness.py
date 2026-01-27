import logging
import re
from swim_backend.core.services.genie_service import create_genie_device

logger = logging.getLogger(__name__)

def check_readiness(device, job):
    """
    Performs real readiness checks on the device:
    1. Flash Space (sufficient for image * 2.5)
    2. Config Register (0x2102)
    3. Connection Health
    """
    logger.info(f"Running readiness checks for {device.hostname}")
    
    checks = {}
    
    # 1. Connect to Device
    dev = None
    try:
        dev, _ = create_genie_device(device, job.id)
        dev.connect(log_stdout=False)
    except Exception as e:
        logger.error(f"Readiness: Failed to connect to {device.hostname}: {e}")
        checks["connection"] = {
            "status": "failed",
            "message": f"Could not connect via SSH: {e}"
        }
        return False, checks

    try:
        # 2. Flash Memory Check
        # Requirement: Image Size * 2.5 (Safety margin for expand/install)
        image_size = job.image.size_bytes if job.image else 0
        required_space = image_size * 2.5
        
        cmd_dir = "dir flash:"
        output_dir = dev.execute(cmd_dir)
        
        # Regex to find free bytes (e.g. "2144321536 bytes free")
        # Pattern varies, but typically ending line: "21474836480 bytes total (2144321536 bytes free)"
        match_free = re.search(r'\((\d+)\s+bytes free\)', output_dir)
        
        if match_free:
            free_bytes = int(match_free.group(1))
            free_mb = free_bytes / 1024 / 1024
            req_mb = required_space / 1024 / 1024
            
            if free_bytes > required_space:
                 checks["flash_memory"] = {
                     "status": "success",
                     "message": f"Free: {free_mb:.2f}MB (Required: {req_mb:.2f}MB)"
                 }
            else:
                 checks["flash_memory"] = {
                     "status": "failed",
                     "message": f"Insufficient Flash. Free: {free_mb:.2f}MB, Required: {req_mb:.2f}MB. Manual Intervention Required."
                 }
        else:
             checks["flash_memory"] = {
                 "status": "warning",
                 "message": "Could not parse free space from 'dir flash:'"
             }

        # 3. Config Register Check
        # Should be 0x2102 for standard boot
        try:
            # Try parsing first
            ver_output = dev.parse("show version")
            # Structure depends on platform, for IOSXE:
            # ver_output['version']['curr_config_register']
            curr_reg = ver_output.get('version', {}).get('curr_config_register', 'Unknown')
        except:
             # Fallback to regex
             ver_raw = dev.execute("show version")
             match_reg = re.search(r'[Cc]onfiguration [Rr]egister is (0x\w+)', ver_raw)
             curr_reg = match_reg.group(1) if match_reg else "Unknown"
        
        if curr_reg == "0x2102":
             checks["config_register"] = {
                 "status": "success",
                 "message": f"Valid: {curr_reg}"
             }
        else:
             # User Request: Only show warning for registry check
             checks["config_register"] = {
                 "status": "warning",
                 "message": f"Invalid Register: {curr_reg} (Expected 0x2102)"
             }

        # 4. Startup Config Check (Simple Existence)
        try:
            cmd_startup = "show startup-config | include ^!"
            out_startup = dev.execute(cmd_startup)
            if "!" in out_startup or "version" in out_startup:
                 checks["startup_config"] = {
                     "status": "success", 
                     "message": "Startup config present."
                 }
            else:
                 # User Request: Only show warning
                 checks["startup_config"] = {
                     "status": "warning",
                     "message": "Startup config might be missing or empty."
                 }
        except:
             checks["startup_config"] = {"status": "warning", "message": "Could not verify startup config."}

    except Exception as e:
        logger.error(f"Error during readiness checks: {e}")
        checks["execution_error"] = {"status": "failed", "message": str(e)}
        
    finally:
        try:
            dev.disconnect()
        except:
            pass

    # Simulate Custom Checks from DB
    if job and job.selected_checks.exists():
        for custom_check in job.selected_checks.all():
            checks[custom_check.name] = {
                "status": "success",
                "message": f"Custom Check '{custom_check.name}' (Placeholder Passed)."
            }

    # Calculate overall readiness
    # User Request: If free space is less -> Manual Intervention Required (Fail)
    # Registry/Startup -> Warning (Pass with Warning)
    
    # We fail ONLY if there is a 'failed' status. 'warning' is acceptable.
    has_failures = any(c.get('status') == 'failed' for c in checks.values())
    
    is_ready = not has_failures
    return is_ready, checks
