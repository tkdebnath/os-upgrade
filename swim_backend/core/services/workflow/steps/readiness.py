from swim_backend.core.services.workflow.base import BaseStep
from swim_backend.core.readiness import check_readiness

from swim_backend.core.services.workflow.readiness_strategies import (
    ReadinessStrategyRegistry,
)
from swim_backend.core.services.workflow.readiness_strategies.catalyst9300_strategy import (
    Catalyst9300ReadinessStrategy,
)  # noqa: F401


class ReadinessStep(BaseStep):
    def execute(self):
        job = self.get_job()
        device = job.device

        self.log(f"Running Readiness Verification for {device.hostname}...")

        ready, checks = check_readiness(device, job)

        if ready:
            self.log("Device is READY for upgrade.")
            return "success", "Readiness passed"
        else:
            self.log("Device FAILED readiness checks.")
            return "failed", "Readiness failed"
