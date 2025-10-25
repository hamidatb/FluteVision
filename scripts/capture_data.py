"""
Data capture script for FluteVision.

Run this to capture images for training the model.
The flags are:
--keys: The keys to collect data for
--samples: The number of samples to collect per key
--user: The user ID

e.g. python scripts/capture_data.py --keys Bb C D --samples 300 --user john

The script will open a webcam and show you the keys to collect data for.
Press 'B' to begin capturing, 'S' to skip, or 'Q' to quit.
The script will then count down from 3 and collect samples automatically.
The script will then save the samples to the datasets/raw directory.
The script will then save the metadata to the datasets/raw directory.
The script will then save the metadata to the datasets/raw directory.
"""

import sys
import os
import cv2
from pathlib import Path
from datetime import datetime
import json
import time

project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))


def capture_data_for_keys(keys_to_collect, samples_per_key, user_id="anonymous", output_dir=None):
    """
    capture training data for multiple keys using opencv windows
    """
    if output_dir is None:
        data_dir = project_root / "datasets" / "raw"
    else:
        data_dir = Path(output_dir)
    data_dir.mkdir(parents=True, exist_ok=True)
    
    print("\n" + "="*60)
    print("FluteVision Data Capture")
    print("="*60)
    print(f"Keys to collect: {', '.join(keys_to_collect)}")
    print(f"Samples per key: {samples_per_key}")
    print(f"User: {user_id}")
    print(f"Output directory: {data_dir}")
    print("="*60 + "\n")
    
    print("initializing webcam...")
    cap = cv2.VideoCapture(0)
    
    if not cap.isOpened():
        print("Error: Could not open webcam!")
        return 1
    
    print("✅ Webcam initialized!\n")
    
    # loop through each key
    for key_index, key in enumerate(keys_to_collect):
        print(f"\n{'='*60}")
        print(f"Key {key_index + 1}/{len(keys_to_collect)}: {key}")
        print(f"{'='*60}")
        print(f"Position your hands for the '{key}' fingering")
        print("Press 'B' to begin capturing, 'S' to skip, or 'Q' to quit\n")
        
        # waiting for user to be ready
        while True:
            ret, frame = cap.read()
            if not ret:
                print("Failed to read from webcam")
                break
            
            # mirror so user sees themselves naturally
            frame = cv2.flip(frame, 1)
            
            dark_green = (0, 180, 0)
            
            # display current key prominently for user guidance
            cv2.putText(
                frame, 
                f"KEY: {key}", 
                (10, 50), 
                cv2.FONT_HERSHEY_SIMPLEX, 
                1.5, 
                dark_green, 
                3,
                cv2.LINE_AA
            )
            
            cv2.putText(
                frame,
                "Press B to BEGIN | S to SKIP | Q to QUIT",
                (10, 100),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.7,
                (255, 255, 255),
                2,
                cv2.LINE_AA
            )
            
            cv2.putText(
                frame,
                f"Samples to collect: {samples_per_key}",
                (10, 140),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                (200, 200, 200),
                1,
                cv2.LINE_AA
            )
            
            cv2.imshow('FluteVision Data Capture', frame)
            
            key_press = cv2.waitKey(25) & 0xFF
            if key_press == ord('b') or key_press == ord('B'):
                break
            elif key_press == ord('s') or key_press == ord('S'):
                print(f"Skipping key '{key}'")
                break
            elif key_press == ord('q') or key_press == ord('Q'):
                print("\nQuitting data capture")
                cap.release()
                cv2.destroyAllWindows()
                return 0
        
        # skip if user pressed 'S'
        if key_press == ord('s') or key_press == ord('S'):
            continue
        
        # countdown before collection
        print("\nStarting countdown...")
        dark_green = (0, 180, 0)  # darker green
        
        for countdown in range(3, 0, -1):
            ret, frame = cap.read()
            if ret:
                frame = cv2.flip(frame, 1)
                
                # show key name at top
                cv2.putText(
                    frame,
                    f"KEY: {key}",
                    (10, 50),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    1.5,
                    dark_green,
                    3,
                    cv2.LINE_AA
                )
                
                # show countdown in center (darker green)
                cv2.putText(
                    frame,
                    str(countdown),
                    (frame.shape[1]//2 - 50, frame.shape[0]//2),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    5,
                    dark_green,
                    10,
                    cv2.LINE_AA
                )
                cv2.imshow('FluteVision Data Capture', frame)
                cv2.waitKey(1)
            print(f"   {countdown}...")
            time.sleep(1)
        
        print("   GO! Collecting samples...")
        
        # CLEAR old data for this key before capturing new data
        key_dir = data_dir / key
        if key_dir.exists():
            import shutil
            print(f"   🗑️  Clearing old data for key '{key}' to avoid duplicates...")
            shutil.rmtree(key_dir)
        
        # create fresh session directory
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        session_dir = data_dir / key / f"{user_id}_{timestamp}"
        session_dir.mkdir(parents=True, exist_ok=True)
        print(f"   Saving to: {session_dir}")
        
        # collect samples
        counter = 0
        print(f"\nProgress: ", end="", flush=True)
        last_progress = 0
        
        while counter < samples_per_key:
            ret, frame = cap.read()
            if not ret:
                print("\nFailed to read frame")
                break
            
            # display collection in progress
            display_frame = frame.copy()
            display_frame = cv2.flip(display_frame, 1)
            
            # darker green color (less neon)
            dark_green = (0, 180, 0)  # was (0, 255, 0)
            
            # show the KEY being captured (large and prominent)
            cv2.putText(
                display_frame,
                f"KEY: {key}",
                (10, 50),
                cv2.FONT_HERSHEY_SIMPLEX,
                1.5,
                dark_green,
                3,
                cv2.LINE_AA
            )
            
            # show collection progress below
            cv2.putText(
                display_frame,
                f"Collecting: {counter + 1}/{samples_per_key}",
                (10, 90),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.8,
                (255, 255, 255),
                2,
                cv2.LINE_AA
            )
            
            # progress bar
            bar_width = 400
            bar_height = 30
            bar_x = (display_frame.shape[1] - bar_width) // 2
            bar_y = display_frame.shape[0] - 60
            
            # background
            cv2.rectangle(
                display_frame,
                (bar_x, bar_y),
                (bar_x + bar_width, bar_y + bar_height),
                (50, 50, 50),
                -1
            )
            
            # progress (darker green)
            progress_width = int((counter / samples_per_key) * bar_width)
            cv2.rectangle(
                display_frame,
                (bar_x, bar_y),
                (bar_x + progress_width, bar_y + bar_height),
                dark_green,
                -1
            )
            
            cv2.imshow('FluteVision Data Capture', display_frame)
            cv2.waitKey(1)
            
            # save unflipped frame to match training data orientation
            sample_path = session_dir / f"sample_{counter:04d}.jpg"
            cv2.imwrite(str(sample_path), frame)
            metadata = {
                'filename': f"sample_{counter:04d}.jpg",
                'key': key,
                'user_id': user_id,
                'timestamp': datetime.now().isoformat(),
                'image_shape': list(frame.shape),
                'session_dir': str(session_dir)
            }
            
            metadata_path = session_dir / f"sample_{counter:04d}_metadata.json"
            with open(metadata_path, 'w') as f:
                json.dump(metadata, f, indent=2)
            
            counter += 1
            
            # show progress every 10% to avoid spam
            progress_pct = int((counter / samples_per_key) * 100)
            if progress_pct >= last_progress + 10:
                print(f"{progress_pct}%... ", end="", flush=True)
                last_progress = progress_pct
            
            time.sleep(0.03)  # ~30fps capture speed
        
        print("100% ✅")
        print(f"✅ Completed {counter} samples for key '{key}'")
        print(f"📁 Saved to: {session_dir}\n")
    
    # cleanup
    cap.release()
    cv2.destroyAllWindows()
    
    print("\n" + "="*60)
    print("Data Capture Complete!")
    print("="*60)
    print(f"Captured keys: {keys_to_collect}")
    print(f"Samples per key: {samples_per_key}")
    print(f"Total samples: {len(keys_to_collect) * samples_per_key}")
    print("\nTo train the next: python scripts/manage.py train --all")
    print("="*60 + "\n")
    
    return 0


def main():
    """Main entry point for data capture."""
    import argparse
    
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
        python scripts/capture_data.py --keys Bb C D Eb F G A --samples 200 --user john
        
        # Custom output directory
        python scripts/capture_data.py --keys Bb C --samples 100 --output-dir /path/to/my/data
        """
    )
    
    parser.add_argument(
        '--keys',
        nargs='+',
        required=True,
        help='Keys to capture (e.g., --keys Bb C D)'
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
        default=None,
        help='Output directory for captured images (default: datasets/raw)'
    )
    
    args = parser.parse_args()
    
    try:
        return capture_data_for_keys(args.keys, args.samples, args.user, args.output_dir)
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
