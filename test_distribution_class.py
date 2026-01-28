import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'swim_backend.settings')
django.setup()

try:
    from swim_backend.core.services.workflow.steps.distribution import DistributeStep
    print("Import Successful")
    
    step = DistributeStep(344, {})
    print("Instantiation Successful")
    
    print("Methods:", dir(step))
except Exception as e:
    print(f"Failed: {e}")
