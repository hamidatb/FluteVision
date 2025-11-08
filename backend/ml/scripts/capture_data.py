"""
Data capture script for FluteVision.

Run this to capture images for training the model.
The flags are:
--keys: The keys to collect data for
--samples: The number of samples to collect per key
--user: The user ID
--replace: Replace existing photos for keys (default: keeps old photos and adds new ones)
--output-dir: The directory to save the output to
--mode: flute or hand

e.g. python ml/scripts/capture_data.py --keys neutral open close --samples 30 --mode hand

The script will open a webcam and show you the keys to collect data for.
Press 'B' to begin capturing, 'S' to skip, or 'Q' to quit.
The script will then count down from 3 and collect samples automatically.
The script will then save the samples to the datasets/raw directory.
"""

import sys
import cv2
import shutil
import json
import time
from pathlib import Path
from datetime import datetime
from typing import Optional, List, Tuple
from dataclasses import dataclass
import tkinter as tk
from tkinter import filedialog
import argparse
from config import PROJECT_ROOT, SCRIPTS_DIR, SAVED_DATASETS_DIR, SAVED_HAND_DATASETS_DIR

sys.path.insert(0, str(PROJECT_ROOT))
sys.path.insert(0, str(SCRIPTS_DIR))

from ui_utils import CaptureUIRenderer

@dataclass
class CaptureSession:
    """Configuration for a data capture session."""
    keys: List[str]
    samples_per_key: int
    user_id: str
    output_dir: Path
    keep_old: bool
    mode: str # flute or hand, default flute


class StorageManager:
    """Handles all file and directory operations."""
    
    def __init__(self, base_dir: Path):
        self.base_dir = base_dir
    
    def validate_directory(self) -> Tuple[bool, Optional[str]]:
        """Validate that the directory is accessible and writable."""
        try:
            self.base_dir.mkdir(parents=True, exist_ok=True)
            
            # Test write permissions
            test_file = self.base_dir / "test_write.tmp"
            test_file.write_text("test")
            test_file.unlink()
            
            # Check available space
            total, used, free = shutil.disk_usage(self.base_dir)
            free_gb = free // (1024**3)
            
            if free_gb < 1:
                return True, f"Warning: Only {free_gb}GB free space available"
            
            return True, None
            
        except PermissionError:
            return False, f"Permission denied: Cannot write to {self.base_dir}"
        except OSError as e:
            return False, f"Error accessing directory: {e}"
    
    def prepare_key_directory(self, key: str, keep_old: bool) -> Path:
        """Prepare directory for a specific key."""
        key_dir = self.base_dir / key
        
        if not keep_old and key_dir.exists():
            # if we're not keeping the old dir, then removing it
            shutil.rmtree(key_dir)
        
        return key_dir
    
    def create_session_directory(self, key: str, user_id: str) -> Path:
        """Create a new session directory with timestamp."""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        session_dir = self.base_dir / key / f"{user_id}_{timestamp}"
        session_dir.mkdir(parents=True, exist_ok=True)
        return session_dir
    
    def count_existing_sessions(self, key: str) -> int:
        """Count existing sessions for a key."""
        key_dir = self.base_dir / key
        if not key_dir.exists():
            return 0
        return len([d for d in key_dir.iterdir() if d.is_dir()])
    
    def test_connection(self, session_dir: Path) -> bool:
        """Test if storage is still accessible."""
        try:
            test_file = session_dir / "connection_test.tmp"
            test_file.write_text("test")
            test_file.unlink()
            return True
        except OSError:
            return False


class SampleRecorder:
    """Handles saving of image samples and metadata."""
    
    def __init__(self, session_dir: Path, key: str, user_id: str):
        self.session_dir = session_dir
        self.key = key
        self.user_id = user_id
    
    def save_sample(self, frame, sample_index: int) -> Tuple[bool, Optional[str]]:
        """Save a single sample with metadata."""
        sample_path = self.session_dir / f"sample_{sample_index:04d}.jpg"
        
        try:
            success = cv2.imwrite(str(sample_path), frame)
            if not success:
                return False, f"Failed to save image {sample_index}"
            
            metadata = {
                'filename': f"sample_{sample_index:04d}.jpg",
                'key': self.key,
                'user_id': self.user_id,
                'timestamp': datetime.now().isoformat(),
                'image_shape': list(frame.shape),
                'session_dir': str(self.session_dir)
            }
            
            metadata_path = self.session_dir / f"sample_{sample_index:04d}_metadata.json"
            with open(metadata_path, 'w') as f:
                json.dump(metadata, f, indent=2)
            
            return True, None
            
        except OSError as e:
            return False, f"Error saving image: {e}"
        except Exception as e:
            return False, f"Unexpected error: {e}"


class WebcamManager:
    """Manages webcam initialization and frame capture."""
    
    def __init__(self):
        self.cap: Optional[cv2.VideoCapture] = None
    
    def initialize(self) -> Tuple[bool, Optional[str]]:
        """Initialize webcam, trying multiple camera indices."""
        # Small delay to ensure clean state before opencv access
        time.sleep(0.1)
        
        for camera_index in [0, 1, 2]:
            try:
                cap = cv2.VideoCapture(camera_index)
                if cap.isOpened():
                    # Give camera time to initialize
                    time.sleep(0.2)
                    ret, frame = cap.read()
                    if ret and frame is not None:
                        self.cap = cap
                        return True, f"Webcam initialized on camera {camera_index}"
                    else:
                        cap.release()
                else:
                    if cap:
                        cap.release()
            except Exception as e:
                print(f"  Camera {camera_index} error: {e}")
                if cap:
                    try:
                        cap.release()
                    except:
                        pass
        
        return False, "Could not open any webcam"
    
    def read_frame(self, mirror: bool = False):
        """Read a frame from the webcam."""
        if not self.cap:
            return False, None
        
        ret, frame = self.cap.read()
        if ret and mirror:
            frame = cv2.flip(frame, 1)
        
        return ret, frame
    
    def release(self):
        """Release the webcam."""
        if self.cap:
            self.cap.release()
        cv2.destroyAllWindows()


class CaptureController:
    """Orchestrates the data capture workflow (coordinates components)."""
    
    def __init__(self, session: CaptureSession):
        self.session = session
        self.storage = StorageManager(session.output_dir)
        print(f"Output dir for this run: {session.output_dir}")
        self.webcam = WebcamManager()
        self.ui = CaptureUIRenderer()
    
    def run(self) -> int:
        """Execute the capture workflow."""
        # validating storage
        valid, message = self.storage.validate_directory()
        if not valid:
            print(f"Error: {message}")
            return 1
        
        if message:
            print(f"Warning: {message}")
        
        self._print_session_info()
        
        print("Initializing webcam...")
        
        success, message = self.webcam.initialize()
        if not success:
            print(f"Error: {message}")
            print("Try:")
            print("1. Check if camera is connected")
            print("2. Close other apps using the camera")
            return 1
        
        print(message)
        
        # capturing data for each key
        for key_index, key in enumerate(self.session.keys):
            result = self._capture_key(key, key_index)
            if result == -1:  # Quit requested
                break
        
        self.webcam.release()
        self._print_completion_summary()
        return 0
    
    def _print_session_info(self):
        """Print session information."""
        print("\n" + "="*60)
        print("FluteVision Data Capture")
        print("="*60)
        print(f"Keys to collect: {', '.join(self.session.keys)}")
        print(f"Capture mode: {self.session.mode}")
        print(f"Samples per key: {self.session.samples_per_key}")
        print(f"User: {self.session.user_id}")
        print(f"Output directory: {self.session.output_dir}")
        
        if str(self.session.output_dir).startswith('/Volumes/'):
            print("Using external drive - make sure it stays connected!")
        
        print("="*60 + "\n")
    
    def _capture_key(self, key: str, key_index: int) -> int:
        """Capture samples for a single key. Returns -1 to quit, 0 to skip, 1 on success."""
        print(f"\n{'='*60}")
        print(f"Key {key_index + 1}/{len(self.session.keys)}: {key}")
        print(f"{'='*60}")
        print(f"Position your hands for the '{key}' fingering")
        print("Press 'B' to begin capturing, 'S' to skip, or 'Q' to quit\n")
        
        # Wait for user to be ready
        action = self._wait_for_user_ready(key)
        if action == 'q':
            print("\nQuitting data capture")
            return -1
        elif action == 's':
            print(f"Skipping key '{key}'")
            return 0
        
        self._show_countdown(key)
        
        # Prepare storage
        print("   GO! Collecting samples...")
        self.storage.prepare_key_directory(key, self.session.keep_old)
        session_dir = self.storage.create_session_directory(key, self.session.user_id)
        print(f"   Saving to: {session_dir}")
        
        if self.session.keep_old:
            existing_count = self.storage.count_existing_sessions(key)
            if existing_count > 0:
                print(f"   (Existing {existing_count} session(s) for '{key}' will be preserved)")
        
        samples_captured = self._capture_samples(key, session_dir)
        
        print("100% Done")
        print(f"Completed {samples_captured} samples for key '{key}'")
        print(f"Saved to: {session_dir}\n")
        
        return 1
    
    def _wait_for_user_ready(self, key: str) -> str:
        """Wait for user input. Returns 'b' to begin, 's' to skip, 'q' to quit."""
        while True:
            ret, frame = self.webcam.read_frame(mirror=True)
            if not ret:
                print("Failed to read from webcam")
                return 'q'
            
            self.ui.render_waiting_screen(frame, key, self.session.samples_per_key)
            cv2.imshow('FluteVision Data Capture', frame)
            
            key_press = cv2.waitKey(25) & 0xFF
            if key_press in (ord('b'), ord('B')):
                return 'b'
            elif key_press in (ord('s'), ord('S')):
                return 's'
            elif key_press in (ord('q'), ord('Q')):
                return 'q'
    
    def _show_countdown(self, key: str):
        """Show countdown before capture."""
        print("\nStarting countdown...")
        for countdown in range(3, 0, -1):
            ret, frame = self.webcam.read_frame(mirror=True)
            if ret:
                self.ui.render_countdown(frame, key, countdown)
                cv2.imshow('FluteVision Data Capture', frame)
                cv2.waitKey(1)
            print(f"   {countdown}...")
            time.sleep(1)
    
    def _capture_samples(self, key: str, session_dir: Path) -> int:
        """Capture samples for a key. Returns number of samples captured."""
        recorder = SampleRecorder(session_dir, key, self.session.user_id)
        
        counter = 0
        print(f"\nProgress: ", end="", flush=True)
        last_progress = 0
        
        while counter < self.session.samples_per_key:
            ret, frame = self.webcam.read_frame(mirror=False)
            if not ret:
                print("\nFailed to read frame")
                break
            
            # Display progress (mirrored for user)
            ret_display, display_frame = self.webcam.read_frame(mirror=True)
            if ret_display:
                self.ui.render_capture_progress(
                    display_frame, key, counter, self.session.samples_per_key
                )
                cv2.imshow('FluteVision Data Capture', display_frame)
                cv2.waitKey(1)
            
            # Save sample (unflipped for training)
            success, error = recorder.save_sample(frame, counter)
            if not success:
                print(f"\n{error}")
                if "disconnected" in error.lower() or "full" in error.lower():
                    print("External drive may be disconnected or full")
                break
            
            counter += 1
            
            # Show progress every 10%
            progress_pct = int((counter / self.session.samples_per_key) * 100)
            if progress_pct >= last_progress + 10:
                print(f"{progress_pct}%... ", end="", flush=True)
                last_progress = progress_pct
            
            # Check storage connection every 50 images
            if counter % 50 == 0:
                if not self.storage.test_connection(session_dir):
                    print(f"\nExternal drive disconnected at image {counter}")
                    print("Please reconnect the drive and restart capture")
                    break
            
            time.sleep(0.03)  # ~30fps capture speed
        
        return counter
    
    def _print_completion_summary(self):
        """Print completion summary."""
        print("\n" + "="*60)
        print("Data Capture Complete!")
        print("="*60)
        print(f"Captured keys: {self.session.keys}")
        print(f"Samples per key: {self.session.samples_per_key}")
        print(f"Total samples: {len(self.session.keys) * self.session.samples_per_key}")
        print("\nTo train the model: python scripts/manage.py train --all")
        print("="*60 + "\n")


def select_output_directory() -> Optional[Path]:
    """Open a dialog to select output directory."""
    try:
        root = tk.Tk()
        root.withdraw()
        output_dir = filedialog.askdirectory(
            title="Select folder to save captured images",
            initialdir=str(SAVED_DATASETS_DIR)
        )
        root.destroy()
        
        if not output_dir:
            print("No folder selected. Exiting.")
            return None
        
        return Path(output_dir)
        
    except Exception as e:
        print(f"Error opening folder dialog: {e}")
        print("Try specifying --output-dir directly")
        return None


def main():
    """Main entry point for data capture."""
    
    parser = argparse.ArgumentParser(
        description='Capture training data for FluteVision',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=
        """
        Examples:
        # Single key
        python scripts/capture_data.py --keys Bb --samples 200
        
        # Multiple keys
        python scripts/capture_data.py --keys Bb C D --samples 150
        
        # All keys in Bb scale
        python scripts/capture_data.py --keys Bb C D Eb F G A --samples 200 --user hami
        
        # Custom output directory
        python scripts/capture_data.py --keys Bb C --samples 100 --output-dir /path/to/my/data
        
        # Replace existing photos (default: keeps old and adds new)
        python scripts/capture_data.py --keys Bb C --samples 100 --replace
        
        # Use Finder to select folder (default: keeps old photos) - this may crash if you're using continuityCamera on iOS, if that happens, please use the custom output directory script above. 
        python scripts/capture_data.py --keys Bb C --samples 100
        """
    )
    
    parser.add_argument(
        '--keys',
        nargs='+',
        required=True,
        help='Keys to capture (e.g., --keys Bb C D or open close if hand mode)'
    )

    parser.add_argument(
        '--mode',
        default="flute",
        required=True,
        help='mode of capture (flute or hand)'
    )
    
    parser.add_argument(
        '--samples',
        type=int,
        default=100,
        help='Number of samples per key (default: 100)'
    )
    
    parser.add_argument(
        '--user',
        default='anonymous',
        help='User identifier (default: anonymous)'
    )
    
    parser.add_argument(
        '--output-dir',
        default='datasets/raw',
        help='Output directory for captured images (default: datasets/raw)'
    )
    
    parser.add_argument(
        '--replace',
        action='store_true',
        help='Replace existing photos for keys (default: keeps old photos and adds new ones)'
    )
    
    args = parser.parse_args()
    
    try:
        if args.mode == "hand":
            args.output_dir = str(SAVED_HAND_DATASETS_DIR)
        
        # Handle output directory selection
        if args.output_dir == 'datasets/raw':
            output_dir = select_output_directory()
            if not output_dir:
                return 1
            # Critical: delay after tkinter closes to prevent segfault on macOS
            time.sleep(0.5)
        else:
            output_dir = Path(args.output_dir)
        
        # Create session and run
        session = CaptureSession(
            keys=args.keys,
            samples_per_key=args.samples,
            user_id=args.user,
            output_dir=output_dir,
            keep_old=not args.replace,
            mode=args.mode
        )
        
        controller = CaptureController(session)
        return controller.run()
        
    except KeyboardInterrupt:
        print("\n\nInterrupted by user")
        cv2.destroyAllWindows()
        return 1
    except Exception as e:
        print(f"\nError: {str(e)}")
        import traceback
        traceback.print_exc()
        cv2.destroyAllWindows()
        return 1


if __name__ == '__main__':
    sys.exit(main())
