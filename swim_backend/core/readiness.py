import logging
from swim_backend.core.services.diff_service import log_update

logger = logging.getLogger(__name__)


def check_readiness(device, job):
    from swim_backend.core.services.workflow.readiness_strategies import (
        ReadinessStrategyRegistry,
    )
    from swim_backend.core.services.workflow.readiness_strategies.catalyst9300_strategy import (
        Catalyst9300ReadinessStrategy,
    )
    from swim_backend.core.services.workflow.readiness_strategies.lab_device_strategy import (
        LabDeviceReadinessStrategy,
    )
    from swim_backend.core.services.workflow.readiness_strategies.default_strategy import (
        DefaultReadinessStrategy,
    )

    logger.info(f"Running readiness checks for {device.hostname}")
    log_update(job.id, f"Initiating readiness checks for {device.hostname}...")

    strategy = ReadinessStrategyRegistry.get_strategy(device, job, logger)

    if not strategy:
        logger.warning(
            f"No readiness strategy found for {device.hostname}, using default strategy"
        )
        strategy = DefaultReadinessStrategy(device, job, logger)

    try:
        username, password, secret = strategy.get_credentials()
        genie_device = strategy.create_genie_device(username, password, secret)
        ready, checks = strategy.execute(genie_device)
        return ready, checks
    except Exception as e:
        logger.error(f"Readiness check failed: {e}")
        log_update(job.id, f"Readiness check error: {e}")
        return False, {"error": str(e)}
