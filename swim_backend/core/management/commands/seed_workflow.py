from django.core.management.base import BaseCommand
from swim_backend.core.models import Workflow, WorkflowStep

class Command(BaseCommand):
    help = 'Seeds the default Upgrade Workflow'

    def handle(self, *args, **kwargs):
        wf, created = Workflow.objects.get_or_create(
            name="Default Upgrade Workflow",
            defaults={
                "description": "Standard SWIM Upgrade: Readiness -> Pre-Checks -> Distribute -> Activate -> Post-Checks -> Diff",
                "is_default": True
            }
        )
        
        if not created:
            self.stdout.write(self.style.WARNING("Default Workflow already exists. Skipping."))
            return

        steps = [
            (1, 'readiness', 'Readiness Check', {}),
            (2, 'precheck', 'Pre-Checks', {'continue_on_failure': True}),
            (3, 'distribution', 'Software Distribution', {}),
            (4, 'activation', 'Activation', {}),
            (5, 'postcheck', 'Post-Checks & Diff', {'continue_on_failure': True}),
        ]

        for order, stype, name, config in steps:
            WorkflowStep.objects.create(
                workflow=wf,
                name=name,
                step_type=stype,
                order=order,
                config=config
            )
            
        self.stdout.write(self.style.SUCCESS(f"Created Default Workflow with {len(steps)} steps."))
