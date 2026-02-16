from .base import BaseReadinessStrategy
from .registry import ReadinessStrategyRegistry


@ReadinessStrategyRegistry.register
class Catalyst9300ReadinessStrategy(BaseReadinessStrategy):
    supported_models = ["Catalyst 9300"]
    supported_platforms = ["iosxe"]

    def execute(self, dev):
        checks = {}

        self.log(
            f"Running Catalyst 9300 readiness checks for {self.device.hostname}..."
        )

        self.log("Checking connection...")
        connected, conn_msg = self.check_connection(dev)
        if not connected:
            checks["connection"] = {"status": "failed", "message": conn_msg}
            return False, checks
        checks["connection"] = {"status": "success", "message": conn_msg}
        self.log("Connection check passed.")

        # Check flash memory space
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
        except:
            pass

        return is_ready, checks
