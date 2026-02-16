from swim_backend.core.services.workflow.base import BaseStep
from swim_backend.core.services.workflow.activation_strategies import (
    ActivationStrategyRegistry,
)

from swim_backend.core.services.workflow.activation_strategies.catalyst9300_strategy import (
    Catalyst9300ActivationStrategy,
)  # noqa: F401
from swim_backend.core.services.workflow.activation_strategies.test_lab_switch import (
    LabVirtualDeviceStrategy,
)  # noqa: F401


class ActivationStep(BaseStep):
    def execute(self):
        job = self.get_job()
        device = job.device

        # Check prerequisites
        steps_log = job.steps or []
        required_steps = ["readiness", "distribution"]
        missing_reqs = []
        for req in required_steps:
            found = next((s for s in steps_log if s.get("step_type") == req), None)
            if not found or found["status"] not in ["success", "warning"]:
                missing_reqs.append(req)

        if missing_reqs:
            self.log(f"Prerequisites not met: {', '.join(missing_reqs)}")
            return "failed", f"Missing {', '.join(missing_reqs)}"

        if not job.activate_after_distribute:
            self.log("Activation skipped")
            return "warning", "Skipped"

        strategy = ActivationStrategyRegistry.get_strategy(device, job, self.log)

        if not strategy:
            self.log("No activation strategy found")
            return "failed", "No activation strategy available"

        self.log(f"Using {strategy.__class__.__name__}")

        username, password, secret = strategy.get_credentials()
        genie_device = strategy.create_genie_device(username, password, secret)

        try:
            self.log(f"Connecting to {device.hostname}...")
            genie_device.connect(
                via="default",
                log_stdout=False,
                learn_hostname=True,
                connection_timeout=60,
            )

            status, message = strategy.execute(genie_device)
            return status, message

        except Exception as e:
            self.log(f"Activation error: {e}")
            return "failed", str(e)

        finally:
            try:
                genie_device.disconnect()
            except:
                pass
