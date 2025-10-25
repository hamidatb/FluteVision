"""
Management script for FluteVision.

Simple CLI for training and managing the landmark-based flute recognition system.
"""

import sys
import argparse
import logging
from pathlib import Path
import tkinter as tk
from tkinter import filedialog

project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))


def setup_logging():
    """setup basic logging."""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    return logging.getLogger(__name__)


def main():
    """main entry point for management script."""
    parser = argparse.ArgumentParser(
        description='FluteVision Management CLI',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python scripts/manage.py train --all
  python scripts/manage.py train --keys Bb C D
  python scripts/manage.py train --all --input-dir /path/to/my/data
  # Use Finder to select folder (default behavior)
  python scripts/manage.py train --all
        """
    )

    subparsers = parser.add_subparsers(dest='command', help='Available commands')

    # Train command
    train_parser = subparsers.add_parser('train', help='Train the model')
    train_parser.add_argument('--all', action='store_true', help='Train on all available keys')
    train_parser.add_argument('--keys', nargs='+', help='Specific keys to train on')
    train_parser.add_argument('--input-dir', default='datasets/raw', help='Input directory for training data (default: opens Finder to select)')

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return 1

    logger = setup_logging()

    if args.command == 'train':
        return handle_train(args, logger)
    
    return 0


def handle_train(args, logger):
    """Handle training command."""
    # get input directory from finder if not specified
    input_dir = args.input_dir
    if input_dir == 'datasets/raw':  # default value
        root = tk.Tk()
        root.withdraw()  # hide the main window
        input_dir = filedialog.askdirectory(
            title="Select folder containing training data",
            initialdir=str(project_root / "datasets")
        )
        root.destroy()
        
        if not input_dir:
            logger.error("❌ No folder selected. Exiting.")
            return 1
    
    if args.all:
        # Find all available keys
        raw_data_path = Path(input_dir)
        if not raw_data_path.exists():
            logger.error("No raw data found. Capture data first:")
            logger.error(f"  python scripts/capture_data.py --keys Bb C D --samples 300")
            return 1
        
        keys_to_train = [d.name for d in raw_data_path.iterdir() if d.is_dir()]
        logger.info(f"Found raw data for keys: {keys_to_train}")
    else:
        keys_to_train = args.keys or []
        if not keys_to_train:
            logger.error("Specify --all or --keys")
            return 1

    logger.info(f"Starting model training for keys: {keys_to_train}")
    logger.info(f"Using data from: {input_dir}")
    
    try:
        # Check if raw data exists
        raw_data_path = Path(input_dir)
        
        if not raw_data_path.exists() or not any(raw_data_path.iterdir()):
            logger.error("No raw data found. Capture data first:")
            logger.error(f"  python scripts/capture_data.py --keys Bb C D --samples 300")
            return 1
        
        # Use landmark-based training
        logger.info("Launching landmark-based training...")
        logger.info("Using MediaPipe hand landmarks as features")
        
        import subprocess
        result = subprocess.run([
            sys.executable,
            str(project_root / "scripts" / "train_landmark_model.py"),
            "--raw-dir", args.input_dir
        ])
        
        return result.returncode
        
    except Exception as e:
        logger.error(f"Training failed: {str(e)}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == '__main__':
    sys.exit(main())