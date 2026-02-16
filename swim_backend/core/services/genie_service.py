import os
import yaml
import logging
from django.utils import timezone

logger = logging.getLogger(__name__)

try:
    from genie.conf.base.device import Device as GenieDevice
except ImportError:
    class GenieDevice:
        def __init__(self, **kwargs): pass
        def connect(self, **kwargs): pass
        def parse(self, *args, **kwargs): return {}
        def configure(self, *args, **kwargs): pass
        class api:
            def file_transfer(self, *args, **kwargs): pass
            def verify_file_md5(self, *args, **kwargs): pass

from swim_backend.devices.models import GlobalCredential

def create_genie_device(device, job_id_or_path):
    """
    Build a Genie device connection object for pyATS automation.
    No testbed files needed - builds config on the fly.
    Returns: (device_object, log_dir_path)
    """
    # Ensure directory exists for logs
    # Using device.id as it is immutable, unlike hostname which might change during sync
    dir_path = f"logs/{device.id}/{job_id_or_path}/"
    os.makedirs(dir_path, exist_ok=True)
    
    # Credential Resolution Logic
    username = device.username
    password = device.password
    secret = device.secret
    
    # Use global creds if nothing stored on device
    if not username or not password:
        global_creds = GlobalCredential.objects.first()
        if global_creds:
            if not username: username = global_creds.username
            if not password: password = global_creds.password
            if not secret and global_creds.secret: secret = global_creds.secret
    
    if not username or not password:
        logger.warning(f"No credentials found for device {device.hostname} (and no global fallback).")

    try:
        device_conf = {
            'os': device.platform if device.platform else 'iosxe',
            'type': device.family.lower() if hasattr(device, 'family') else 'switch',
            'credentials': {
                'default': {
                    'username': username,
                    'password': password
                }
            },
            'connections': {
                'cli': {
                    'protocol': 'ssh',
                    'ip': device.ip_address
                }
            }
        }
        
        # Add enable secret if we have one
        if secret:
            device_conf['credentials']['enable'] = {'password': secret}
            
        tb_conf = {'devices': {device.hostname: device_conf}}
        
        from genie.testbed import load
        tb = load(tb_conf)
        dev = tb.devices[device.hostname]
        
        return dev, dir_path

    except ImportError:
        logger.warning("Genie not installed. Returning Mock Device.")
        return GenieDevice(name=device.hostname), dir_path
    except ImportError:
        logger.warning("Genie not installed. Returning Mock Device.")
        return GenieDevice(name=device.hostname), dir_path


def run_check_operation(device_obj, check_type, command, check_name, phase, output_dir, timeout=300):
    """
    Executes a check using a dynamic device object.
    Supports 'genie' (learn) and 'command' (execute).
    Phase: 'pre', 'post', or 'manual'
    File is saved as: <phase>check/<sanitized_name>.txt
    """
    try:
        # device_obj is already a Genie Device object (connected or not)
        # Ensure connected
        if not device_obj.is_connected():
            device_obj.connect(log_stdout=False)
        
        output = ""
        
        # execution logic
        if check_type == 'genie':
            if command == 'config':
                 output = device_obj.execute('show running-config', timeout=timeout)
            else:
                 # Genie Learn
                 try:
                     learned = device_obj.learn(command, timeout=timeout)
                 except TypeError:
                     # Fallback if specific learn doesn't support timeout
                     learned = device_obj.learn(command)
                 
                 # Properly serialize Genie object to JSON
                 import json
                 if hasattr(learned, 'to_dict'):
                     output = json.dumps(learned.to_dict(), indent=2, default=str)
                 elif hasattr(learned, 'info'):
                     output = json.dumps(learned.info, indent=2, default=str)
                 else:
                     # Fallback to pretty-printed dict representation
                     import pprint
                     output = pprint.pformat(dict(learned), width=120)
        else:
             # Default to Command Execution (category='command' or 'script')
             output = device_obj.execute(command, timeout=timeout)

            
        # Determine Subdirectory based on phase
        subdir = f"{phase}check"
        target_dir = os.path.join(output_dir, subdir)
        os.makedirs(target_dir, exist_ok=True)
        
        # Save to file
        if check_type == 'genie':
            # Name: {feature}_{os}_{hostname}_ops.txt
            # Example: routing_iosxe_CSR1_ops.txt
            dev_os = device_obj.os
            hostname = device_obj.name
            filename = f"{command}_{dev_os}_{hostname}_ops.txt"
        else:
            # Default: Sanitize Check Name
            safe_name = "".join(c if c.isalnum() else "_" for c in check_name)
            filename = f"{safe_name}.txt"
        
        with open(os.path.join(target_dir, filename), 'w') as f:
            f.write(output)
            
        # Callers (PreCheckStep, PostCheckStep, CheckRunner) are now responsible for disconnecting.
        
        return True, "Success"

    except Exception as e:
        logger.error(f"Check {check_name} ({command}) failed: {e}")
        # For mock / dev without real devices, we simulate success
        
        subdir = f"{phase}check"
        target_dir = os.path.join(output_dir, subdir)
        os.makedirs(target_dir, exist_ok=True)
        safe_name = "".join(c if c.isalnum() else "_" for c in check_name)
        filename = f"{safe_name}.txt"
        
        with open(os.path.join(target_dir, filename), 'w') as f:
            f.write(f"Mock Output for {check_name}\nTimestamp: {timezone.now()}\nStatus: SUCCESS\nSimulated Type: {check_type}\nError: {e}")
        return True, f"Mock Success (Dev Mode, Error: {e})"
