from unicon.eal.dialogs import Dialog, Statement
from .base import BaseActivationStrategy
from .registry import ActivationStrategyRegistry


@ActivationStrategyRegistry.register
class Catalyst9000ActivationStrategy(BaseActivationStrategy):
    supported_models = ['Catalyst 9300']
    supported_platforms = ['iosxe']
    
    def execute(self, genie_device):
        try:
            self.log(f"Cat9K activation for {self.device.hostname}")
            
            # Verify install mode
            try:
                output = genie_device.execute('show version | include Mode')
                if 'INSTALL' not in output:
                    self.log("Warning: Device not in INSTALL mode")
            except Exception as e:
                self.log(f"Could not verify install mode: {e}")
            
            # Configure boot parameters
            self.log("Setting boot config...")
            try:
                config_cmd = [
                    "no boot system",
                    "boot system flash:packages.conf",
                    "no boot manual",
                    "no system ignore startupconfig switch all"
                ]
                genie_device.configure(command=config_cmd, timeout=30)
            except Exception as e:
                self.log(f"Warning: Boot configuration failed: {e}")

            # Save config
            self.log("Saving config...")
            try:
                dialog = Dialog([
                    Statement(
                        pattern=r"Destination filename \[startup-config\]\?",
                        action='sendline(y)',
                        loop_continue=False,
                        continue_timer=False
                    )
                ])
                genie_device.execute('copy running-config startup-config', timeout=60, reply=dialog)
            except Exception as e:
                self.log(f"Warning: Config save failed: {e}")

            # Run install command
            image_filename = self.job.image.filename
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
                Statement(
                    pattern=r'Do you want to proceed with reload\?',
                    action='sendline(y)',
                    loop_continue=True
                ),
            ])
            
            self.log(f"Running: {cmd}")
            self.log("Device will reload...")
            
            output = genie_device.execute(cmd, timeout=3600, reply=dialog)
            
            if "Error" in output or "Failed" in output:
                self.log(f"Failed: {output}")
                return 'failed', "Activation failed"
            
            self.log("Activation started")
            return 'success', "Activation initiated"
            
        except Exception as e:
            self.log(f"Error: {e}")
            return 'failed', str(e)
