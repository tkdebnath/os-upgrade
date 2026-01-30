from swim_backend.core.services.workflow.base import BaseStep
from genie.conf.base.device import Device as GenieDevice
import time

class VerificationStep(BaseStep):
    def execute(self):
        job = self.get_job()
        device = job.device
        
        target_version = job.image.version if job.image else None
        
        if not target_version:
            self.log("No target image version defined for this job. Skipping verification.")
            return 'warning', "No target version"

        self.log(f"Starting Post-Activation Verification... Target Version: {target_version}")
        
        # Initialize credentials
        from swim_backend.devices.models import GlobalCredential
        username = device.username
        password = device.password
        secret = device.secret
        
        if not username or not password:
            global_creds = GlobalCredential.objects.first()
            if global_creds:
                if not username: username = global_creds.username
                if not password: password = global_creds.password
                if not secret and global_creds.secret: secret = global_creds.secret

        genie_device = GenieDevice(
            name=device.hostname,
            os=device.platform if device.platform else 'iosxe',
            credentials={
                'default': {
                    'username': username,
                    'password': password
                },
                'enable': {
                    'password': secret if secret else password
                }
            },
            connections={
                'default': {
                    'protocol': 'ssh',
                    'ip': device.ip_address,
                }
            }
        )
        
        try:
            self.log(f"Connecting to {device.hostname} to check version...")
            genie_device.connect(
                via='default',
                log_stdout=False, 
                learn_hostname=True,
                connection_timeout=60
            )
            
            # Parse version using Genie
            self.log("Retrieving current version info...")
            output = genie_device.parse('show version')
            
            current_version = None

            if isinstance(output, dict) and isinstance(output.get('version', {}), dict):
               current_version = output.get('version', {}).get('version', '')
               if not current_version:
                  current_version = output.get('version', {}).get('version_short')
           
            if isinstance(output, dict) and isinstance(output.get('version', {}), str):
               current_version = output['version']
            
            if not current_version:
                self.log("Failed to parse version from device output.")
                return 'failed', "Version Parse Error"
            
            self.log(f"Device Running Version: {current_version}")
            
            # Compare
            # Normalize strings (trim whitespace, maybe lower case)
            if str(current_version).strip().lower() == str(target_version).strip().lower():
                self.log("✅ SUCCESS: Device version matches target version.")
                return 'success', f"Match: {current_version}"
            else:
                self.log(f"❌ FAILURE: Version Mismatch. Expected: {target_version}, Found: {current_version}")
                return 'failed', f"Mismatch: {current_version}"
                
        except Exception as e:
            self.log(f"Verification Error: {e}")
            return 'failed', str(e)
            
        finally:
            try:
                genie_device.disconnect()
            except:
                pass
