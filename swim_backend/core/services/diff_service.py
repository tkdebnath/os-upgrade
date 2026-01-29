import os
import difflib
import logging
from swim_backend.core.models import Job
from django.utils import timezone

logger = logging.getLogger(__name__)

# Try to import Genie Diff, fallback to difflib
try:
    from genie.diff import Diff
    HAS_GENIE_DIFF = True
except ImportError:
    HAS_GENIE_DIFF = False

def log_update(job_id, message):
    try:
        job = Job.objects.get(id=job_id)
        timestamp = timezone.now().strftime("%Y-%m-%d %H:%M:%S")
        entry = f"[{timestamp}] {message}\n"
        job.log += entry
        job.save(update_fields=['log'])
    except (Job.DoesNotExist, ValueError):
        # ValueError happens if job_id is a string (e.g. from readiness check view)
        pass

import subprocess

def generate_diffs(job, checks, log_dir):
    """
    Compares pre and post check directories using 'genie diff' CLI.
    Falls back to per-file python comparison if CLI fails.
    """
    pre_dir = os.path.join(log_dir, "precheck")
    post_dir = os.path.join(log_dir, "postcheck")
    diff_dir = os.path.join(log_dir, "diffs")
    
    if os.path.exists(pre_dir) and os.path.exists(post_dir):
        # Method 1: Try Genie CLI (Directory Diff)
        # matches user request: "genie diff pre post --output diff"
        cli_success = False
        try:
            os.makedirs(diff_dir, exist_ok=True)
            # Use Python module invocation for genie diff
            import sys
            python_exec = sys.executable
            cmd = [python_exec, "-m", "genie.cli", "diff", pre_dir, post_dir, "--output", diff_dir]
            logger.info(f"Running Genie Diff CLI: {' '.join(cmd)}")
            
            # Run command
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode == 0:
                log_update(job.id, "Genie Diff (CLI) generated successfully.")
                cli_success = True
                
                # Save the CLI summary output
                summary_output = result.stdout if result.stdout else result.stderr
                if summary_output:
                    summary_file = os.path.join(log_dir, 'diff_summary.txt')
                    with open(summary_file, 'w') as f:
                        f.write("="*80 + "\n")
                        f.write(f"GENIE DIFF CLI SUMMARY - Job #{job.id}\n")
                        f.write(f"Device: {job.device.hostname}\n")
                        f.write(f"Generated: {timezone.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
                        f.write("="*80 + "\n\n")
                        f.write(summary_output)
                    log_update(job.id, "Genie Diff summary saved.")
            else:
                logger.warning(f"Genie Diff CLI failed (code {result.returncode}): {result.stderr}")
        except Exception as e:
            logger.warning(f"Failed to run Genie Diff CLI: {e}")

        if cli_success:
            return

        # Method 2: Fallback to Per-File Python Logic
        log_update(job.id, "Genie CLI diff failed or not available. Falling back to internal diff.")
        
        summary_lines = []
        summary_lines.append("="*80)
        summary_lines.append(f"DIFF SUMMARY REPORT - Job #{job.id}")
        summary_lines.append(f"Device: {job.device.hostname}")
        summary_lines.append(f"Generated: {timezone.now().strftime('%Y-%m-%d %H:%M:%S')}")
        summary_lines.append("="*80)
        summary_lines.append("")
        
        changes_found = 0
        no_changes = 0
        errors = 0
        
        for check in checks:
            if check.category == 'genie':
                # Construct Genie Filename
                feature = check.command
                hostname = job.device.hostname
                dev_os = job.device.platform if job.device.platform else 'iosxe'
                filename = f"{feature}_{dev_os}_{hostname}_ops.txt"
            else:
                # Construct Custom Filename
                safe_name = "".join(c if c.isalnum() else "_" for c in check.name)
                filename = f"{safe_name}.txt"
            
            pre_file = os.path.join(pre_dir, filename)
            post_file = os.path.join(post_dir, filename)
            
            # Diff filename
            diff_safe_name = "".join(c if c.isalnum() else "_" for c in check.name)
            diff_file = os.path.join(diff_dir, f"diff_{diff_safe_name}.txt")
            
            if os.path.exists(pre_file) and os.path.exists(post_file):
                diff_content = ""
                
                if HAS_GENIE_DIFF:
                    try:
                        # Genie Python Diff
                        diff_obj = Diff(pre_file, post_file)
                        diff_obj.diff()
                        diff_content = str(diff_obj)
                    except Exception as e:
                        pass

                if not diff_content:
                    # Text Diff Fallback
                    with open(pre_file, 'r') as f1, open(post_file, 'r') as f2:
                        pre_lines = f1.readlines()
                        post_lines = f2.readlines()
                        
                    diff = difflib.unified_diff(
                        pre_lines, post_lines,
                        fromfile=f'Pre-Check {check.name}',
                        tofile=f'Post-Check {check.name}',
                        lineterm=''
                    )
                    diff_content = '\n'.join(list(diff))
                
                # Determine if changes were found
                has_changes = diff_content and diff_content.strip() and diff_content.strip() != f"No differences found for {check.name}."
                
                if not diff_content or diff_content.strip() == "":
                    diff_content = f"No differences found for {check.name}."
                    has_changes = False
                
                # Update summary
                if has_changes:
                    status = "✓ CHANGES DETECTED"
                    changes_found += 1
                else:
                    status = "○ NO CHANGES"
                    no_changes += 1
                    
                summary_lines.append(f"{status:25} | {check.name}")
                    
                with open(diff_file, 'w') as f:
                    f.write(diff_content)
                
                log_update(job.id, f"Generated fallback diff for {check.name}.")
            else:
                # Missing pre or post file
                missing = []
                if not os.path.exists(pre_file):
                    missing.append("pre-check")
                if not os.path.exists(post_file):
                    missing.append("post-check")
                
                summary_lines.append(f"✗ ERROR                  | {check.name} (Missing: {', '.join(missing)})")
                errors += 1
        
        # Add summary statistics
        summary_lines.append("")
        summary_lines.append("="*80)
        summary_lines.append("SUMMARY STATISTICS")
        summary_lines.append("="*80)
        summary_lines.append(f"Total Checks:        {len(checks)}")
        summary_lines.append(f"Changes Detected:    {changes_found}")
        summary_lines.append(f"No Changes:          {no_changes}")
        summary_lines.append(f"Errors:              {errors}")
        summary_lines.append("="*80)
        
        # Write summary file
        summary_file = os.path.join(log_dir, 'diff_summary.txt')
        with open(summary_file, 'w') as f:
            f.write('\n'.join(summary_lines))
        
        log_update(job.id, f"Diff summary generated: {changes_found} with changes, {no_changes} unchanged, {errors} errors.")
