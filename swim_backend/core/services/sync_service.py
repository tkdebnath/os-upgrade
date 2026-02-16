import logging
import os
import threading
from swim_backend.core.services.genie_service import create_genie_device
from swim_backend.devices.models import Device, DeviceModel, DeviceSyncHistory

from django.utils import timezone

logger = logging.getLogger(__name__)


def sync_device_details(device_id):
    """
    SSH to device, run show version, pull hardware/software info.
    """
    try:
        device = Device.objects.get(id=device_id)

        # Capture previous values for history tracking
        previous_values = {
            "hostname": device.hostname,
            "version": device.version,
            "model": device.model.name if device.model else None,
            "boot_method": device.boot_method,
            "reachability": device.reachability,
        }

        # Mark as In Progress
        device.last_sync_status = "In Progress"
        device.save(update_fields=["last_sync_status"])

        # Temporary job ID for logs
        temp_id = f"sync_{device.id}"
        dev, log_dir = create_genie_device(device, temp_id)

        # Log connection attempt
        logger.info(
            f"[SYNC] Starting sync for device {device.hostname} ({device.ip_address})"
        )

        # SSH to device and run show version
        try:
            dev.connect(log_stdout=True, learn_hostname=True)

            # Parse show version output with Genie
            logger.info(
                f"[SYNC] Connected to {device.hostname}, parsing show version..."
            )
            output = dev.parse("show version")

            logger.info(f"[SYNC] Show version output: {output}")

            # Pull version and hardware details
            version = None
            hardware_model = None
            boot_method = None

            if isinstance(output, dict) and isinstance(output.get("version", {}), dict):
                version = output.get("version", {}).get("version", "")

                # Platform usually holds the chassis info in Genie
                hardware_info = output.get("platform", {}).get("hardware", [])
                hardware_model = (
                    hardware_info[0]
                    if hardware_info and hardware_info[0]
                    else "unknown"
                )
                hardware_model = output.get("version", {}).get("chassis", "unknown")

                # Extract Boot Method / System Image
                boot_method = output.get("version", {}).get("system_image")
                if not boot_method and isinstance(output.get("version", {}), dict):
                    # Fallback check
                    boot_method = output.get("version", {}).get("boot_image")

            if isinstance(output, dict) and isinstance(output.get("version", {}), str):
                version = output["version"]

                # Platform usually holds the chassis info in Genie
                hardware_model = output.get("pid", "unknown")

            # Update hostname
            if dev.learned_hostname and dev.learned_hostname != device.hostname:
                device.hostname = dev.learned_hostname

            if boot_method:
                device.boot_method = boot_method

            # Update Device
            if version:
                device.version = version
            if hardware_model:
                mod_obj, _ = DeviceModel.objects.get_or_create(name=hardware_model)
                device.model = mod_obj
            device.reachability = "Reachable"
            device.last_sync_status = "Completed"
            device.last_sync_time = timezone.now()

            # Capture new values
            new_values = {
                "hostname": device.hostname,
                "version": device.version,
                "model": device.model.name if device.model else None,
                "boot_method": device.boot_method,
                "reachability": device.reachability,
            }

            # Calculate changes
            changes = {}
            all_keys = set(list(previous_values.keys()) + list(new_values.keys()))
            for key in all_keys:
                old_val = previous_values.get(key)
                new_val = new_values.get(key)
                if old_val != new_val:
                    changes[key] = {"old": old_val, "new": new_val}

            # Save device without validation
            device.save(
                update_fields=[
                    "version",
                    "model",
                    "reachability",
                    "last_sync_status",
                    "last_sync_time",
                    "hostname",
                    "boot_method",
                ]
            )

            # Create sync history record
            DeviceSyncHistory.objects.create(
                device=device,
                status="success",
                previous_values=previous_values,
                new_values=new_values,
                changes=changes,
                version_discovered=version,
                model_discovered=hardware_model,
            )

            logger.info(
                f"[SYNC] Sync completed for {device.hostname}: version={version}, model={hardware_model}, changes={changes}"
            )
            dev.disconnect()

        except Exception as e:
            logger.error(f"[SYNC] Connection/parsing failed for {device.hostname}: {e}")
            # Log the full exception traceback
            import traceback

            logger.error(f"[SYNC] Traceback: {traceback.format_exc()}")

            # Create failed sync history
            DeviceSyncHistory.objects.create(
                device=device,
                status="failed",
                previous_values=previous_values,
                new_values={},
                error_message=str(e),
            )

            device.reachability = "Unreachable"
            device.last_sync_status = "Failed"
            device.last_sync_time = timezone.now()
            device.save(
                update_fields=["reachability", "last_sync_status", "last_sync_time"]
            )

    except Exception as e:
        logger.error(f"Sync failed for {device_id}: {e}")
        import traceback

        logger.error(f"Traceback: {traceback.format_exc()}")
        try:
            d = Device.objects.get(id=device_id)
            d.reachability = "Unreachable"
            d.last_sync_status = "Failed"
            d.last_sync_time = timezone.now()
            d.save(update_fields=["reachability", "last_sync_status", "last_sync_time"])
        except:
            pass


def run_sync_task(scope_type, scope_value=None):
    """
    Triggers sync for multiple devices based on scope.
    """
    devices = []
    if scope_type == "all":
        devices = Device.objects.all()
    elif scope_type == "site":
        devices = Device.objects.filter(site=scope_value)
    elif scope_type == "selection":
        devices = Device.objects.filter(id__in=scope_value)

    for dev in devices:
        t = threading.Thread(target=sync_device_details, args=(dev.id,))
        t.daemon = True
        t.start()

    return len(devices)
