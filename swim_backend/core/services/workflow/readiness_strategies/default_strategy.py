import logging
from .base import BaseReadinessStrategy
from .registry import ReadinessStrategyRegistry


@ReadinessStrategyRegistry.register
class DefaultReadinessStrategy(BaseReadinessStrategy):
    """Default strategy for all devices - fallback when no specific strategy matches"""

    def can_handle(self, device):
        return True

    def execute(self, dev):
        checks = {}

        self.log(f"Running default readiness checks for {self.device.hostname}...")

        # Check connection
        self.log("Checking connection...")
        connected, conn_msg = self.check_connection(dev)
        if not connected:
            checks["connection"] = {"status": "failed", "message": conn_msg}
            try:
                dev.disconnect()
            except:
                pass
            return False, checks
        checks["connection"] = {"status": "success", "message": conn_msg}
        self.log("Connection check passed.")

        # Check flash memory
        self.log("Checking flash memory space...")
        flash_result = self.check_flash(dev)
        checks["flash_memory"] = flash_result
        if flash_result["status"] == "failed":
            self.log(f"Flash check failed: {flash_result['message']}")
        else:
            self.log(f"Flash check: {flash_result['message']}")

        # Check startup configuration
        self.log("Checking startup configuration...")
        startup_result = self.check_startup_config(dev)
        checks["startup_config"] = startup_result
        self.log(f"Startup config check: {startup_result['message']}")

        # Determine overall readiness
        has_failures = any(c.get("status") == "failed" for c in checks.values())
        is_ready = not has_failures

        if is_ready:
            self.log(f"Device {self.device.hostname} is READY for upgrade.")
        else:
            self.log(f"Device {self.device.hostname} FAILED readiness checks.")

        try:
            dev.disconnect()
            self.log("Disconnected from device.")
        except:
            pass

        return is_ready, checks
