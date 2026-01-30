import time
from swim_backend.core.services.workflow.base import BaseStep
from unicon.eal.dialogs import Dialog, Statement
from genie.conf.base.device import Device as GenieDevice

class ActivationStep(BaseStep):
    def execute(self):
        job = self.get_job()
        device = job.device
        
        # 1. Check Prerequisites: Readiness and Distribution
        # These steps MUST be present and successful in the current job execution.
        steps_log = job.steps or []
        
        required_steps = ['readiness', 'distribution']
        missing_reqs = []
        for req in required_steps:
            # Check for success by step_type
            found = next((s for s in steps_log if s.get('step_type') == req), None)
            if not found or found['status'] != 'success':
                 missing_reqs.append(req)
        
        if missing_reqs:
             self.log(f"CRITICAL: Prerequisites not met: {', '.join(missing_reqs)}. Activation aborted.")
             return 'failed', f"Missing {', '.join(missing_reqs)}"

        if not job.activate_after_distribute:
            self.log("Activation skipped by job configuration.")
            return 'warning', "Skipped"

        # self.log("Starting Activation Phase...")
        
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

        # Explicitly define the connection structure to avoid ambiguity
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
                    # 'port': 22 # Optional if non-standard
                }
            }
        )
        
        try:
            self.log(f"Connecting to {device.hostname}...")
            # Connect using the 'default' alias we just defined
            genie_device.connect(
                via='default',
                log_stdout=False, 
                learn_hostname=True,
                connection_timeout=60
            )
            
            # 1. Update Boot variables and enforce startup configuration
            self.log("Updating Boot variables and enforcing startup configuration...")
            try:
                config_cmd = [
                    "no boot system",
                    "boot system flash:packages.conf",
                    "no boot manual",
                    "no system ignore startupconfig switch all"
                ]
                genie_device.configure(command=config_cmd, timeout=30)
            except Exception as e:
                self.log(f"Warning: Boot variable update failed but continuing: {e}")

            # 2. Save Configuration
            self.log("Saving running configuration...")
            try:
                dialog = Dialog([
                    Statement(pattern=r"Destination filename \[startup-config\]\?",
                              action='sendline(y)',
                              loop_continue=False,
                              continue_timer=False)
                ])
                genie_device.execute('copy running-config startup-config', timeout=60, reply=dialog)
            except Exception as e:
                self.log(f"Warning: Config save failed but continuing: {e}")


            # 3. Execute Activation Command
            image_filename = job.image.filename
            cmd = f"install add file flash:{image_filename} activate commit"
            dialog = Dialog([
                Statement(
                    pattern=r"This operation may require a reload of the system\. Do you want to proceed\? \[y/n\]",
                    action='sendline(y)',
                    loop_continue=True
                ),
                Statement(
                    pattern=r'\[y/n\]',
                    action='sendline(y)',
                    loop_continue=True
                ),
            ])

            
            self.log(f"Executing Activation Command: {cmd}")
            self.log("This may take significant time and trigger a reload...")
            
            # Use a very long timeout for install command
            output = genie_device.execute(cmd, timeout=2700, reply=dialog) # 45 minutes
            
            if "Error" in output or "Failed" in output:
                self.log(f"Activation Command Failed: {output}")
                return 'failed', "Activation Command Failed"
            
            self.log("Activation command initiated successfully.")
            return 'success', "Activation Initiated"

        except Exception as e:
            self.log(f"Activation Error: {e}")
            return 'failed', str(e)
            
        finally:
            try:
                genie_device.disconnect()
            except:
                pass
