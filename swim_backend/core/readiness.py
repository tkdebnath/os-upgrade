import logging
import re
from swim_backend.core.services.genie_service import create_genie_device
from swim_backend.core.services.diff_service import log_update

logger = logging.getLogger(__name__)

def check_readiness(device, job):
    logger.info(f"Running readiness checks for {device.hostname}")
    log_update(job.id, f"Initiating readiness checks for {device.hostname}...")
    
    checks = {}
    
    dev = None
    try:
        log_update(job.id, f"Connecting to {device.ip_address} via SSH...")
        dev, _ = create_genie_device(device, job.id)
        dev.connect(log_stdout=False)
        log_update(job.id, "Connection established successfully.")
    except Exception as e:
        logger.error(f"Readiness: Failed to connect to {device.hostname}: {e}")
        log_update(job.id, f"Connection Failed: {e}")
        checks["connection"] = {
            "status": "failed",
            "message": f"Could not connect via SSH: {e}"
        }
        return False, checks

    try:
        # Check flash space
        log_update(job.id, "Checking Flash Memory space...")
        image_size = job.image.size_bytes if job.image else 0
        required_space = image_size * 2.5
        
        # Run 'dir flash:' to see available space
        cmd_dir = "dir flash:"
        output_dir = dev.execute(cmd_dir)
        
        # Parse output for free bytes - format varies by IOS version
        # Typical: "21474836480 bytes total (2144321536 bytes free)"
        match_free = re.search(r'\((\d+)\s+bytes free\)', output_dir)
        
        if match_free:
            free_bytes = int(match_free.group(1))
            free_mb = free_bytes / 1024 / 1024
            req_mb = required_space / 1024 / 1024
            
            if free_bytes > required_space:
                 checks["flash_memory"] = {
                     "status": "success",
                     "message": f"Enough space: {free_mb:.2f}MB free (Need {req_mb:.2f}MB)"
                 }
                 log_update(job.id, f"Flash Check Passed: {free_mb:.2f}MB available.")
            else:
                 checks["flash_memory"] = {
                     "status": "failed",
                     "message": f"Not enough flash! Only {free_mb:.2f}MB free, need {req_mb:.2f}MB. Clean up flash first."
                 }
                 log_update(job.id, f"Flash Check Failed: Only {free_mb:.2f}MB available.")
        else:
             checks["flash_memory"] = {
                 "status": "warning",
                 "message": "Could not parse free space from 'dir flash:'"
             }
             log_update(job.id, "Flash Check Warning: Could not parse output.")

        # Config Register Check
        # Should be 0x2102 for standard boot
        # log_update(job.id, "Checking Configuration Register...")
        # try:
        #     # Try parsing first
        #     ver_output = dev.parse("show version")
        #     # Structure depends on platform, for IOSXE:
        #     # ver_output['version']['curr_config_register']
        #     curr_reg = ver_output.get('version', {}).get('curr_config_register', 'Unknown')
        # except:
        #      # Fallback to regex
        #      ver_raw = dev.execute("show version")
        #      match_reg = re.search(r'[Cc]onfiguration [Rr]egister is (0x\w+)', ver_raw)
        #      curr_reg = match_reg.group(1) if match_reg else "Unknown"
        
        # if curr_reg == "0x2102":
        #      checks["config_register"] = {
        #          "status": "success",
        #          "message": f"Valid: {curr_reg}"
        #      }
        # else:
        #      # User Request: Only show warning for registry check
        #      checks["config_register"] = {
        #          "status": "warning",
        #          "message": f"Invalid Register: {curr_reg} (Expected 0x2102)"
        #      }

        # Startup ignore Check
        log_update(job.id, "Checking Startup Configuration...")
        try:
            cmd_startup = "show romvar"
            out_startup = dev.execute(cmd_startup)
            if "SWITCH_IGNORE_STARTUP_CFG=1" not in out_startup:
                 checks["startup_config"] = {
                     "status": "success", 
                     "message": "Startup config not ignored"
                 }
            else:
                 # User Request: Only show warning
                 checks["startup_config"] = {
                     "status": "warning",
                     "message": "Startup config ignored"
                 }
        except:
             checks["startup_config"] = {"status": "warning", "message": "Could not verify startup config."}

    except Exception as e:
        logger.error(f"Error during readiness checks: {e}")
        log_update(job.id, f"Readiness Check Error: {e}")
        checks["execution_error"] = {"status": "failed", "message": str(e)}
        
    finally:
        try:
            dev.disconnect()
            log_update(job.id, "Disconnected from device.")
        except:
            pass

    # Calculate overall readiness
    
    # We fail ONLY if there is a 'failed' status. 'warning' is acceptable.
    has_failures = any(c.get('status') == 'failed' for c in checks.values())
    
    is_ready = not has_failures
    return is_ready, checks
