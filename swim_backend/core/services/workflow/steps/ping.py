import time
import subprocess
import platform
from .base import BaseStep
from swim_backend.core.services.diff_service import log_update
from swim_backend.core.models import Job

class PingStep(BaseStep):
    def execute(self):
        job = Job.objects.get(id=self.job_id)
        device = job.device
        ip_address = device.ip_address
        
        # Config Defaults
        retries = self.config.get('retries', 3)
        interval = self.config.get('interval', 10)
        
        log_update(self.job_id, f"Checking reachability for {device.hostname} ({ip_address})...")
        
        for attempt in range(1, retries + 1):
            if self.ping_host(ip_address):
                log_update(self.job_id, f"Device {device.hostname} is reachable!")
                return 'success', f"Device reachable on attempt {attempt}"
            
            log_update(self.job_id, f"Ping attempt {attempt}/{retries} failed. Retrying in {interval}s...")
            time.sleep(interval)
            
        return 'failed', f"Device unreachable after {retries} attempts."

    def ping_host(self, host):
        """
        Returns True if host (str) responds to a ping request.
        """
        # Option for the number of packets as a function of
        param = '-n' if platform.system().lower() == 'windows' else '-c'

        # Building the command. Ex: "ping -c 1 google.com"
        command = ['ping', param, '1', host]
        
        # Set timeout to 2 seconds to avoid hanging
        try:
            return subprocess.call(command, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=2) == 0
        except subprocess.TimeoutExpired:
            return False
