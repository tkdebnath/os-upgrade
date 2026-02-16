import logging
import re
from genie.conf.base.device import Device as GenieDevice

logger = logging.getLogger(__name__)


class BaseReadinessStrategy:
    supported_models = []
    supported_platforms = []
    min_version = None
    max_version = None

    def __init__(self, device, job, logger=None):
        self.device = device
        self.job = job
        self.logger = logger or logging.getLogger(__name__)

    def log(self, message):
        if self.logger:
            self.logger.info(message)
        log_update(self.job.id, message)

    def can_handle(self, device):
        if self.supported_models:
            model_name = device.model.name if device.model else None
            # Case-insensitive check
            if model_name:
                if not any(m.lower() == model_name.lower() for m in self.supported_models):
                    return False
            else:
                return False

        if self.supported_platforms:
            if device.platform:
                 if not any(p.lower() == device.platform.lower() for p in self.supported_platforms):
                    return False
            else:
                return False

        if self.min_version or self.max_version:
            current_version = device.version or "0.0.0"
            if self.min_version and not self._version_gte(
                current_version, self.min_version
            ):
                return False
            if self.max_version and not self._version_lte(
                current_version, self.max_version
            ):
                return False

        return True

    def _version_gte(self, v1, v2):
        try:
            p1 = [
                int("".join(filter(str.isdigit, x)) or "0")
                for x in str(v1).replace("-", ".").split(".")
            ]
            p2 = [
                int("".join(filter(str.isdigit, x)) or "0")
                for x in str(v2).replace("-", ".").split(".")
            ]
            return p1 >= p2
        except:
            return True

    def _version_lte(self, v1, v2):
        try:
            p1 = [
                int("".join(filter(str.isdigit, x)) or "0")
                for x in str(v1).replace("-", ".").split(".")
            ]
            p2 = [
                int("".join(filter(str.isdigit, x)) or "0")
                for x in str(v2).replace("-", ".").split(".")
            ]
            return p1 <= p2
        except:
            return True

    def get_credentials(self):
        from swim_backend.devices.models import GlobalCredential

        username = self.device.username
        password = self.device.password
        secret = self.device.secret

        if not username or not password:
            global_creds = GlobalCredential.objects.first()
            if global_creds:
                if not username:
                    username = global_creds.username
                if not password:
                    password = global_creds.password
                if not secret and global_creds.secret:
                    secret = global_creds.secret

        return username, password, secret

    def create_genie_device(self, username, password, secret):
        return GenieDevice(
            name=self.device.hostname,
            os=self.device.platform if self.device.platform else "iosxe",
            credentials={
                "default": {"username": username, "password": password},
                "enable": {"password": secret if secret else password},
            },
            connections={
                "default": {
                    "protocol": "ssh",
                    "ip": self.device.ip_address,
                }
            },
        )

    def check_connection(self, dev):
        try:
            dev.connect(log_stdout=False)
            return True, "Connection successful"
        except Exception as e:
            return False, f"Could not connect via SSH: {e}"

    def check_flash(self, dev):
        image_size = self.job.image.size_bytes if self.job.image else 0
        required_space = image_size * 2.5
        req_mb = required_space / 1024 / 1024

        # Strategy 1: Try parsing 'show file systems' (Integration of user's logic)
        try:
            output = dev.parse("show file systems")
            file_systems = output.get('file_systems', {})
            
            flash_found = False
            failures = []
            min_free_mb = float('inf')
            
            for index in file_systems:
                # Check for "flash" in prefixes as requested
                prefix = file_systems[index].get('prefixes', '')
                if "flash" in prefix:
                    flash_found = True
                    free_size = int(file_systems[index].get('free_size', 0))
                    current_free_mb = free_size / 1024 / 1024
                    
                    if current_free_mb < min_free_mb:
                        min_free_mb = current_free_mb

                    if free_size < required_space:
                        failures.append(f"{prefix} ({current_free_mb:.2f}MB)")
            
            if flash_found:
                if failures:
                    return {
                        "status": "failed",
                        "message": f"Not enough flash on: {', '.join(failures)}. Need {req_mb:.2f}MB.",
                    }
                else:
                    return {
                        "status": "success",
                        "message": f"Enough space on all detected flash drives (Min free: {min_free_mb:.2f}MB).",
                    }
        except Exception as e:
            # Parser might fail on some platforms or if not available
            self.log(f"Parser check failed, falling back to legacy check: {e}")

        # Strategy 2: Legacy 'dir flash:' with Regex (Fallback)
        try:
            cmd_dir = "dir flash:"
            output_dir = dev.execute(cmd_dir)

            # Improved regex to handle commas (e.g., 1,000,000 bytes free)
            match_free = re.search(r"\(([\d,]+)\s+bytes free\)", output_dir)

            if match_free:
                digits_clean = match_free.group(1).replace(",", "")
                free_bytes = int(digits_clean)
                free_mb = free_bytes / 1024 / 1024

                if free_bytes > required_space:
                    return {
                        "status": "success",
                        "message": f"Enough space: {free_mb:.2f}MB free (Need {req_mb:.2f}MB)",
                    }
                else:
                    return {
                        "status": "failed",
                        "message": f"Not enough flash! Only {free_mb:.2f}MB free, need {req_mb:.2f}MB. Clean up flash first.",
                    }
            else:
                return {
                    "status": "warning",
                    "message": "Could not parse free space from 'dir flash:'",
                }
        except Exception as e:
            return {"status": "failed", "message": f"Flash check error: {e}"}

    def check_startup_config(self, dev):
        try:
            cmd_startup = "show romvar"
            out_startup = dev.execute(cmd_startup)
            if "SWITCH_IGNORE_STARTUP_CFG=1" not in out_startup:
                return {"status": "success", "message": "Startup config not ignored"}
            else:
                return {"status": "warning", "message": "Startup config ignored"}
        except Exception as e:
            return {
                "status": "warning",
                "message": f"Could not verify startup config: {e}",
            }

    def execute(self, dev):
        raise NotImplementedError("Subclasses must implement execute()")


def log_update(job_id, message):
    from swim_backend.core.services.diff_service import log_update as diff_log_update

    try:
        diff_log_update(job_id, message)
    except Exception:
        pass
