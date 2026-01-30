import time
import threading
import re
from datetime import datetime
from genie.conf.base.device import Device as GenieDevice
from swim_backend.core.services.workflow.base import BaseStep
from swim_backend.core.services.diff_service import log_update

# Local Semaphore for isolation
DISTRIBUTION_SEMAPHORE = threading.Semaphore(40)


class DeviceFileDownloader:
    """Handle IOS file copies to Cisco devices with progress tracking and reconnects."""
    
    def __init__(self, device_config, logger_callback=None):
        """
        Set up the file transfer handler.
        
        Args:
            device_config: Connection info (IP, creds, etc.)
            logger_callback: Function to log progress updates
        """
        self.device_config = device_config
        self.device = None
        self.download_in_progress = False
        self.connection_check_interval = 5  # seconds
        self.logger = logger_callback

    def log(self, message):
        """Log message using callback or print as fallback."""
        if self.logger:
            self.logger(message)
        else:
            print(message)
        
    def connect(self):
        """SSH to device with auto-retry if connection drops."""
        max_retries = 3
        retry_count = 0
        
        while retry_count < max_retries:
            try:
                self.log("Connecting to device...")
                
                self.device = GenieDevice(
                    name=self.device_config['name'],
                    os=self.device_config.get('os', 'ios'),
                    credentials={
                        'default': {
                            'username': self.device_config['username'],
                            'password': self.device_config['password']
                        },
                        'enable': {
                            'password': self.device_config.get('enable_password', 
                                                               self.device_config['password'])
                        }
                    },
                    connections={
                        'default': {
                            'protocol': 'ssh',
                            'ip': self.device_config['ip']
                        }
                    }
                )
                
                # Connect with increased timeout for file transfers
                self.device.connect(
                    log_stdout=False,
                    learn_hostname=True,
                    connection_timeout=300  # 5 min timeout
                )
                
                self.log(f"Connection established to {self.device.name}")
                return True
                
            except Exception as e:
                retry_count += 1
                self.log(f"Connection failed (attempt {retry_count}/{max_retries}): {e}")
                if retry_count < max_retries:
                    self.log("Retrying in 10 seconds...")
                    time.sleep(10)
        
        return False
    
    def disconnect(self):
        """Disconnect from device."""
        if self.device:
            try:
                self.device.disconnect()
                self.log("Disconnected from device")
            except:
                pass
    
    
    def is_connected(self):
        """Check if device connection is alive."""
        try:
            if self.device and self.device.is_connected():
                # Send a simple command to verify connection is truly alive
                self.device.execute('', timeout=10)
                return True
        except:
            pass
        return False

    def get_file_size(self, filename, destination='flash:'):
        """Get file size in bytes if it exists, else None."""
        try:
            # Command: dir flash:filename
            # Output example: "   33554432 Jan 01 2024 12:00:00 filename.bin"
            cmd = f"dir {destination}{filename}"
            output = self.device.execute(cmd)
            
            # Pattern: size in bytes followed by date/time and filename
            # Adjust regex based on common IOS format
            # Example line: "  123456  -rw-   ..." or "  123456  Jul 1 2024 ..."
            # Basic fallback: look for the number before the filename?
            # Or use 'dir' summary?
            # Try matching a large number before permission flags or date
            
            # Simple approach: Check if "No such file" or similar
            if "No such file" in output or "Error opening" in output:
                return None
                
            # Try to find file entry
            # Pattern: <size> <date> <time> <filename>
            match = re.search(r'\s+(\d+)\s+\w{3}\s+\d+', output)
            if match:
                return int(match.group(1))
                
            # Fallback check
            if filename in output:
                 # Try to extract the first large number
                 nums = re.findall(r'(\d+)', output)
                 # Filter mostly likely candidates (e.g. > 1000)
                 candidates = [int(n) for n in nums if int(n) > 1000]
                 if candidates:
                     return candidates[0] # Best guess
            
            return None
        except Exception as e:
            self.log(f"Error checking file size: {e}")
            return None

    def verify_file_md5(self, filename, expected_md5, destination='flash:'):
        """Verify MD5 checksum of a file on the device."""
        try:
            self.log(f"Calculating MD5 for {filename}...")
            # Command: verify /md5 flash:filename
            cmd = f"verify /md5 {destination}{filename}"
            
            # This can take time, increase timeout
            output = self.device.execute(cmd, timeout=300)
            
            # Output contains: "Result = <md5>" or " = <md5>"
            # Expected MD5 might be in output if valid
            
            # Clean output and extract hex string
            # Look for 32 hex chars
            found_md5s = re.findall(r'[0-9a-fA-F]{32}', output)
            
            for md5 in found_md5s:
                if md5.lower() == expected_md5.lower():
                    return True
            
            return False
            
        except Exception as e:
            self.log(f"Error verifying MD5: {e}")
            return False

    
    def reconnect(self):
        """Reconnect to device if connection was lost."""
        self.log(f"[{self._timestamp()}] Connection lost. Attempting reconnect...")
        self.disconnect()
        return self.connect()
    
    def download_file(self, url, total_size_bytes=None, destination='flash:'):
        """
        Download file from URL to device with live output and file size monitoring.
        
        Args:
            url: HTTP/HTTPS URL of the file to download
            total_size_bytes: Expected file size in bytes (for percentage calculation)
            destination: Destination on device (default: flash:)
        
        Returns:
            bool: True if successful, False otherwise
        """
        # Extract filename from URL
        filename = url.split('/')[-1]
        self.filename = filename
        self.destination = destination
        self.total_size = total_size_bytes
        
        self.log(f"Starting Download: {url} -> {destination}{filename}")
        if total_size_bytes:
            self.log(f"Total Size: {total_size_bytes:,} bytes")
        
        if not self.is_connected():
            if not self.reconnect():
                self.log(f"[{self._timestamp()}] Failed to connect to device")
                return False
        
        # Start progress monitoring thread
        self.download_in_progress = True
        progress_thread = threading.Thread(target=self._monitor_progress, daemon=True)
        progress_thread.start()
        
        try:
            # Build the copy command
            copy_cmd = f"copy {url} {destination}"
            
            self.log(f"[{self._timestamp()}] Command: {copy_cmd}")
            
            # Disable log_stdout to keep output clean (only show progress bar)
            self.device.default.log_stdout = False
            
            from unicon.eal.dialogs import Dialog, Statement
            
            # Define dialog statements to handle copy prompts
            dialog = Dialog([
                Statement(
                    pattern=r'Destination filename \[.*\]\?',
                    action='sendline()',
                    loop_continue=True
                ),
                Statement(
                    pattern=r'Do you want to over write\? \[confirm\]',
                    action='sendline()',
                    loop_continue=True
                ),
                Statement(
                    pattern=r'\[confirm\]',
                    action='sendline()',
                    loop_continue=True
                ),
                Statement(
                    pattern=r'Address or name of remote host',
                    action='sendline()',
                    loop_continue=True
                ),
            ])
            
            result = self.device.execute(
                copy_cmd,
                timeout=3600,  # 1 hour timeout for large files
                reply=dialog
            )
            
            self.download_in_progress = False
            
            # Check if download was successful (size check)
            if self._verify_download_size(filename, destination, total_size_bytes):
                self.log(f"[{self._timestamp()}] Download verified successfully!")
                return True
            else:
                # Fallback to output check if size check fails or not provided
                if self._verify_download(result, filename, destination):
                    self.log(f"[{self._timestamp()}] Download completed (verified via output)")
                    return True
                
                self.log(f"[{self._timestamp()}] Download may have failed. Checking device...")
                return self._check_flash_for_file(filename, destination)
                
        except Exception as e:
            self.download_in_progress = False
            self.device.default.log_stdout = False
            self.log(f"[{self._timestamp()}] Download exception: {e}")
            
            if self.reconnect():
                return self._check_flash_for_file(filename, destination)
            return False

    def verify_file_md5(self, filename, expected_md5, destination='flash:'):
        """
        Verify file integrity using MD5 checksum.
        
        Args:
            filename: Name of file to verify
            expected_md5: Expected MD5 hash string
            destination: Storage location (default: flash:)
            
        Returns:
            bool: True if verification succeeds
        """
        if not expected_md5:
            self.log("Warning: No MD5 provided. Skipping verification.")
            return True
            
        self.log("Verifying MD5 checksum...")
        self.log(f"Expected: {expected_md5}")
        self.log("This may take a while for large files...")
        
        try:
            # The verify command can take a long time for large files
            # Syntax: verify /md5 flash:filename <expected_md5>
            cmd = f"verify /md5 {destination}{filename} {expected_md5}"
            
            # Use a large timeout (e.g., 10 minutes) to prevent session drop
            # resulting from long calculation time
            output = self.device.execute(cmd, timeout=600)
            
            # Check output for success
            # Typical success: "Verified (flash:filename) = <md5>"
            # Failure output contains "Submitted signature = <md5>" but NOT "Verified"
            if "Verified" in output and expected_md5 in output:
                self.log("MD5 Verification Successful!")
                return True
            else:
                self.log("MD5 Verification FAILED!")
                self.log(f"Output: {output}")
                return False
                
        except Exception as e:
            self.log(f"Verification error: {e}")
            return False

    def get_file_size(self, filename, destination='flash:'):
        """
        Get size of file on device if it exists.
        
        Args:
            filename: Name of file
            destination: Storage location
            
        Returns:
            int: File size in bytes, or None if file not found/error
        """
        try:
            cmd = f"dir {destination}{filename}"
            output = self.device.execute(cmd)
            
            # Regex to match size in dir output
            # Example: "  267  -rw-   107412732  Jan 28 2026 12:00:00 +00:00  filename"
            match = re.search(r'\s+(\d+)\s+\w{3}\s+\d+', output)
            if match:
                return int(match.group(1))
        except Exception:
            pass
        return None

    def _monitor_progress(self):
        """Monitor download progress with secondary connection."""
        
        # Create a secondary connection for monitoring
        monitor_device = None
        try:
            monitor_config = self.device_config.copy()
            monitor_config['name'] = f"{self.device_config['name']}_monitor"
            
            # Slight delay to let main download start
            time.sleep(5)
            
            if self.download_in_progress:
                self.log(f"[{self._timestamp()}] Opening secondary connection for monitoring...")
                
                monitor_device = GenieDevice(
                    name=monitor_config['name'],
                    os=monitor_config.get('os', 'ios'),
                    credentials={
                        'default': {'username': monitor_config['username'], 'password': monitor_config['password']},
                        'enable': {'password': monitor_config.get('enable_password', monitor_config['password'])}
                    },
                    connections={'default': {'protocol': 'ssh', 'ip': monitor_config['ip']}}
                )
                monitor_device.connect(log_stdout=False, learn_hostname=True)
        except Exception as e:
            self.log(f"[{self._timestamp()}] Monitor connection failed: {e}")
            monitor_device = None

        while self.download_in_progress:
            time.sleep(self.connection_check_interval)
            
            if not self.download_in_progress:
                break
            
            # Check file size if monitor connection exists
            current_size = 0
            if monitor_device:
                try:
                    # Execute dir flash:filename to get size
                    output = monitor_device.execute(f"dir {self.destination}{self.filename}", timeout=10)
                    match = re.search(r'\s+(\d+)\s+\w{3}\s+\d+', output)
                    if match:
                        current_size = int(match.group(1))
                except:
                    pass
            
            # Calculate and display progress
            progress_msg = f"Status Update:"
            
            if current_size > 0:
                size_mb = current_size / 1024 / 1024
                progress_msg += f" Downloaded: {current_size:,} bytes ({size_mb:.2f} MB)"
                
                if self.total_size:
                    percent = (current_size / self.total_size) * 100
                    
                    # Create visual bar
                    bar_length = 20
                    filled = int(bar_length * percent / 100)
                    bar = "=" * filled + ">" + "." * (bar_length - filled - 1)
                    
                    progress_msg += f" - [{bar}] {percent:.1f}%"
            else:
                progress_msg += " Waiting for data..."
                
            self.log(progress_msg)
        
        # Cleanup monitor connection
        if monitor_device:
            try:
                monitor_device.disconnect()
            except:
                pass

    def _verify_download_size(self, filename, destination, expected_size):
        """Verify download by checking file size matches expected."""
        if not expected_size:
            return False
            
        try:
            result = self.device.execute(f'dir {destination}{filename}')
            match = re.search(r'\s+(\d+)\s+\w{3}\s+\d+', result)
            if match:
                actual_size = int(match.group(1))
                if actual_size == expected_size:
                    self.log(f"[{self._timestamp()}] Size check passed: {actual_size:,} bytes")
                    return True
                else:
                    self.log(f"[{self._timestamp()}] Size mismatch: Expected {expected_size:,}, Got {actual_size:,}")
        except:
            pass
        return False
    
    def _verify_download(self, output, filename, destination):
        """Verify if download completed successfully."""
        # Check for success patterns
        if 'bytes copied' in output.lower():
            match = re.search(r'(\d+)\s+bytes copied', output, re.IGNORECASE)
            if match:
                bytes_copied = int(match.group(1))
                self.log(f"[{self._timestamp()}] Transferred: {bytes_copied:,} bytes")
                return True
        
        return 'OK' in output or 'bytes copied' in output.lower()
    
    def _check_flash_for_file(self, filename, destination='flash:'):
        """Check if file exists in flash."""
        try:
            result = self.device.execute(f'dir {destination}')
            if filename in result:
                match = re.search(rf'(\d+)\s+.*{re.escape(filename)}', result)
                if match:
                    size = int(match.group(1))
                    self.log(f"[{self._timestamp()}] File found on flash: {size:,} bytes")
                    return True
        except Exception as e:
            self.log(f"[{self._timestamp()}] Could not check flash: {e}")
        return False
    
    def _timestamp(self):
        """Return current timestamp string."""
        return datetime.now().strftime("%H:%M:%S")


class DistributeStep(BaseStep):
    def resolve_file_server(self, device):
        """
        Resolves the best file server for a device in order:
        1. Device Preferred
        2. Site Preferred
        3. Global Default
        """
        from swim_backend.images.models import FileServer
        
        # 1. Device Preferred
        if device.preferred_file_server:
            return device.preferred_file_server, "Device Preferred"
            
        # 2. Site Preferred
        if device.site and device.site.preferred_file_server:
            return device.site.preferred_file_server, f"Site Preferred ({device.site.name})"

        # 3. Region Preferred
        if device.site and device.site.region and device.site.region.preferred_file_server:
            return device.site.region.preferred_file_server, f"Region Preferred ({device.site.region.name})"
            
        # 4. Global Default
        default_fs = FileServer.objects.filter(is_global_default=True).first()
        if default_fs:
            return default_fs, "Global Default"
            
        return None, "None"

    def execute(self):
        job = self.get_job()
        device = job.device
        
        # Prerequisite validation: Readiness
        steps_log = job.steps or []
        required_steps = ['readiness']
        missing_reqs = []

        #disable readiness check for now
        # for req in required_steps:
        #     found = next((s for s in steps_log if s.get('step_type') == req), None)
        #     if not found or found['status'] != 'success':
        #          missing_reqs.append(req)
        
        if missing_reqs:
             self.log(f"CRITICAL: Prerequisites not met: {', '.join(missing_reqs)}. Distribution aborted.")
             return 'failed', f"Missing {', '.join(missing_reqs)}"
        
        if not job.image:
             self.log("No image assigned to job. Skipping Distribution.")
             return 'failed', "No image assigned to job"

        self.log("Waiting for distribution slot (Max 40 concurrent)...")
        
        with DISTRIBUTION_SEMAPHORE:
            # Re-check cancellation
            job.refresh_from_db()
            if job.status == 'cancelled':
                return 'failed', "Cancelled"
                
            self.log("Acquired slot. Starting Distribution Phase...")
            
            target_fs = job.file_server
            fs_source = "Manual Assignment"
            
            if not target_fs:
                target_fs, fs_source = self.resolve_file_server(device)
                if target_fs:
                     self.log(f"Selected File Server: {target_fs.name} ({fs_source})")
                else:
                     self.log("No File Server resolved. Attempting local transfer or failing if remote required.")

            # 1. Transfer Logic (Including Smart Download checks)
            try:
                self.perform_transfer(job, target_fs)
            except Exception as e:
                self.log(f"Transfer failed from {target_fs.name if target_fs else 'Local'}: {e}")
                
                # Fallback Logic
                from swim_backend.images.models import FileServer
                default_fs = FileServer.objects.filter(is_global_default=True).first()
                
                if target_fs and default_fs and target_fs.id != default_fs.id:
                    self.log(f"Falling back to Global Default Server: {default_fs.name}...")
                    try:
                        self.perform_transfer(job, default_fs)
                    except Exception as e2:
                        return 'failed', f"Fallback failed: {e2}"
                else:
                    return 'failed', f"Transfer failed: {e}"
            
            # Final MD5 Verification (redundant if perform_transfer does it, but keeping as safety or remove?)
            # perform_transfer handles post-check verification.
            
            return 'success', "Distribution Complete"

    def perform_transfer(self, job, file_server):
        """
        Executes the file download using DeviceFileDownloader.
        """
        if not file_server:
            self.log("Error: No File Server available to download from.")
            raise Exception("No File Server resolved")

        # Construct URL
        # Format: protocol://username:password@ip:port/base_path/filename
        # Basic auth in URL or no auth depending on environment.
        
        # Removing leading/trailing slashes for clean join
        base_path = file_server.base_path.strip('/') if file_server.base_path else ''
        filename = job.image.filename
        
        # Protocol handling
        proto = file_server.protocol.lower()
        if proto not in ['http', 'https', 'ftp', 'scp', 'tftp']:
             self.log(f"Warning: Protocol {proto} might not be supported by 'copy' command directly.")

        # Construct URL cleanly
        # http://192.168.1.5:80/images/ios.bin
        path_part = f"{base_path}/{filename}" if base_path else filename
        file_url = f"{proto}://{file_server.address}:{file_server.port}/{path_part}"
        
        # 2. Prepare Device Config for Genie
        device = job.device
        
        # Resolving credentials (similar to genie_service)
        from swim_backend.devices.models import GlobalCredential
        username = device.username
        password = device.password
        secret = device.secret
        
        if not username or not password:
            global_creds = GlobalCredential.objects.first()
            if global_creds:
                if not username: username = global_creds.username
                if not password: password = global_creds.password
                if not secret and global_creds.secret: secret = global_creds.secret

        device_config = {
            'name': device.hostname,
            'ip': device.ip_address,
            'username': username,
            'password': password,
            'enable_password': secret if secret else password, # Fallback to password which is common
            'os': device.platform if device.platform else 'iosxx' # Default to iosxe logic if unknown
        }

        self.log(f"Initiating transfer from {file_url}...")
        
        # 3. Instantiate Downloader
        downloader = DeviceFileDownloader(device_config, logger_callback=self.log)
        
        try:
            # 4. Connect
            if not downloader.connect():
                 raise Exception("Could not connect to device for transfer.")
            
            # 5. Smart Download Check
            # Check if file exists and matches size/md5
            expected_size = job.image.size_bytes if job.image else None
            expected_md5 = job.image.md5_checksum if job.image else None
            
            self.log(f"Checking if {filename} exists on device...")
            existing_size = downloader.get_file_size(filename, destination='flash:') # Default flash:
            
            should_download = True
            
            if existing_size is not None:
                self.log(f"File found. Size: {existing_size:,} bytes")
                
                if expected_size and existing_size == expected_size:
                    self.log(f"Size matches expected ({expected_size:,} bytes)")
                    
                    if expected_md5:
                        self.log("Verifying MD5 of existing file...")
                        if downloader.verify_file_md5(filename, expected_md5, destination='flash:'):
                            self.log("File already exists and is valid. SKIPPING DOWNLOAD.")
                            should_download = False
                        else:
                            self.log("MD5 mismatch on existing file. Will re-download.")
                    else:
                        self.log("Warning: No MD5 provided. Re-downloading to ensure integrity.")
                else:
                    self.log(f"Size mismatch (Expected: {expected_size if expected_size else 'Unknown'}, Got: {existing_size}). Will re-download.")
            else:
                self.log("File not found on device.")
            
            if not should_download:
                return # Success, skip download

            # 6. Start Download
            success = downloader.download_file(
                url=file_url,
                total_size_bytes=expected_size,
                destination='flash:' # Default to flash:
            )
            
            if success:
                self.log("Transfer Step Finished Successfully.")

                # 7. Post-Download MD5 Verification
                if expected_md5:
                    if downloader.verify_file_md5(filename, expected_md5, destination='flash:'):
                         self.log("Post-Download MD5 Verified.")
                    else:
                         raise Exception("Post-Download MD5 Verification Failed.")
                else:
                    self.log("Skipping MD5 Check (No Checksum in Database).")

            else:
                 raise Exception("Download reported failure.")
                 
        finally:
            downloader.disconnect()
