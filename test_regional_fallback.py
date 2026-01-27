
import os
import django
import time

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'swim_backend.settings') # If 'swim_backend' is the inner folder containing settings
# Ensure project root is in path
import sys
sys.path.append(os.getcwd())
django.setup()

from swim_backend.images.models import FileServer, Image
from swim_backend.devices.models import Device, DeviceModel
from swim_backend.core.models import Job
from swim_backend.core.services.workflow.steps.distribution import DistributeStep
import uuid

def run_test():
    print("--- Setting up Regional Fallback Test ---")
    
    # 1. Create File Servers
    # Primary (Regional) - Will simulate failure
    fm_fail, _ = FileServer.objects.get_or_create(
        name="Regional-Fail-Server",
        defaults={'address': '10.10.10.10', 'protocol': 'scp'}
    )
    
    # Global Default - Will succeed
    fm_default, _ = FileServer.objects.get_or_create(
        name="Global-Default-Server",
        defaults={'address': '8.8.8.8', 'protocol': 'https', 'is_global_default': True}
    )
    # Ensure it is set as default
    FileServer.objects.filter(is_global_default=True).update(is_global_default=False)
    fm_default.is_global_default = True
    fm_default.save()
    
    # 2. Create Device
    model, _ = DeviceModel.objects.get_or_create(name="C9300-Test")
    # Mock size for distribution logic (to force download)
    model.golden_image_size = 1000
    model.save()
    
    device, _ = Device.objects.get_or_create(
        hostname="Test-Device-Regional",
        defaults={
            'ip_address': '1.1.1.1',
            'username': 'admin',
            'password': 'password',
            'platform': 'iosxe',
            'model': model,
            'preferred_file_server': fm_fail
        }
    )
    device.preferred_file_server = fm_fail
    device.save()
    
    # 3. Create Image & Job
    image, _ = Image.objects.get_or_create(filename="test-image.bin", version="17.9.5")
    
    job = Job.objects.create(
        device=device,
        image=image,
        task_name="Regional-Fallback-Test",
        status='running',
        batch_id=uuid.uuid4()
    )
    
    print(f"Job {job.id} created for device {device.hostname}")
    print(f"Device Preferred FS: {device.preferred_file_server.name}")
    print(f"Global Default FS: {fm_default.name}")
    
    # 4. Run Distribution Step
    step = DistributeStep(job.id, {})
    
    print("\n--- Executing Distribution Step ---")
    status, msg = step.execute()
    
    print(f"\n--- Result: {status} ---")
    print(f"Message: {msg}")
    
    # 5. Verify Logs
    job.refresh_from_db()
    logs = job.log
    
    print("\n--- Logs Analysis ---")
    # Expected: 
    # 1. "Selected File Server: Regional-Fail-Server"
    # 2. "Transfer failed... Connection Timed Out" (Simulated by name 'Fail')
    # 3. "Falling back to Global Default Server: Global-Default-Server"
    # 4. "Initiating Download from Global-Default-Server"
    
    if "Selected File Server: Regional-Fail-Server" in logs:
        print("✅ Correctly selected preferred server initially.")
    else:
        print("❌ Failed to select preferred server.")
        
    if "Falling back to Global Default Server" in logs:
        print("✅ Fallback logic triggered.")
    else:
        print("❌ Fallback logic NOT triggered.")
        
    if "Initiating Download from Global-Default-Server" in logs:
        print("✅ Fallback attempt made.")
    else:
         print("❌ Fallback attempt missing.")

    if status == 'success':
        print("\nOVERALL TEST: PASS")
    else:
        print("\nOVERALL TEST: FAIL (Note: Simulated transfer to default might pass if no exception raised there)")

if __name__ == "__main__":
    run_test()
