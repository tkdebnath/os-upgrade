import logging
import threading
from swim_backend.core.services.genie_service import create_genie_device
from swim_backend.devices.models import Device, DeviceModel

from django.utils import timezone

logger = logging.getLogger(__name__)

def sync_device_details(device_id):
    """
    Connects to device, fetches version/platform, and updates DB.
    """
    try:
        device = Device.objects.get(id=device_id)
        
        # Mark as In Progress
        device.last_sync_status = 'In Progress'
        device.save()

        # We need a temporary job ID for logs
        temp_id = f"sync_{device.id}"
        dev, log_dir = create_genie_device(device, temp_id)
        
        # In a real scenario, use Genie or Netmiko to fetch 'show version'
        # Here we mock or use Genie basic learn if available
        
        try:
           # dev is now the Device object directly
           # tb.devices lookup is removed
           dev.connect(log_stdout=True, learn_hostname=True)
           
           # For IOSXE
           # suppress
           output = dev.parse("show version")

           # initalise variables
           version = None
           hardware_model = None
           boot_method = None
           
           if isinstance(output, dict) and isinstance(output.get('version', {}), dict):
               version = output.get('version', {}).get('version', '')
           
               # Platform usually holds the chassis info in Genie
               hardware_info = output.get('platform', {}).get('hardware', [])
               hardware_model = hardware_info[0] if hardware_info and hardware_info[0] else 'unknown'
               hardware_model = output.get('version', {}).get('chassis', 'unknown')

               # Extract Boot Method / System Image
               boot_method = output.get('version', {}).get('system_image')
               if not boot_method and isinstance(output.get('version', {}), dict):
                    # Fallback check
                    boot_method = output.get('version', {}).get('boot_image')
           
           if isinstance(output, dict) and isinstance(output.get('version', {}), str):
               version = output['version']
           
               # Platform usually holds the chassis info in Genie
               hardware_model = output.get('platform', 'unknown')
           
           print(output)

           # Update hostname
           if dev.learned_hostname and dev.learned_hostname != device.hostname:
               device.hostname = dev.learned_hostname
           
           if boot_method:
               device.boot_method = boot_method

           # Update Device
           if version: device.version = version
           if hardware_model:
                mod_obj, _ = DeviceModel.objects.get_or_create(name=hardware_model)
                device.model = mod_obj
           device.reachability = 'Reachable'
           device.last_sync_status = 'Completed'
           device.last_sync_time = timezone.now()
           device.save()
           dev.disconnect()
           
        except Exception:
            # # Mock update
            import time
            time.sleep(2)
            # device.version = "17.9.4a (Mock)"
            
            # mock_model_name = "C9300-48U (Mock)"
            # mod_obj, _ = DeviceModel.objects.get_or_create(name=mock_model_name)
            # device.model = mod_obj
            
            device.reachability = 'Unreachable'
            device.last_sync_status = 'Failed'
            device.last_sync_time = timezone.now()
            device.save()
            
    except Exception as e:
        logger.error(f"Sync failed for {device_id}: {e}")
        try:
             d = Device.objects.get(id=device_id)
             d.reachability = 'Unreachable'
             d.last_sync_status = 'Failed'
             d.last_sync_time = timezone.now()
             d.save()
        except: pass

def run_sync_task(scope_type, scope_value=None):
    """
    Triggers sync for multiple devices based on scope.
    """
    devices = []
    if scope_type == 'all':
        devices = Device.objects.all()
    elif scope_type == 'site':
        devices = Device.objects.filter(site=scope_value)
    elif scope_type == 'selection':
        devices = Device.objects.filter(id__in=scope_value)
        
    for dev in devices:
        t = threading.Thread(target=sync_device_details, args=(dev.id,))
        t.daemon = True
        t.start()
    
    return len(devices)
