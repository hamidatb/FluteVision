"""
Management script for FluteVision.

Simple CLI for training and managing the landmark-based flute recognition system.
"""

import sys
import argparse
import logging
import subprocess
from pathlib import Path
from abc import ABC, abstractmethod
import tkinter as tk
from tkinter import filedialog
from typing import List, Optional


project_root = Path(__file__).parent.parent


class Logger:
    """Wrapper around Python's logging to provide consistent interface across commands."""
    
    def __init__(self):
        self._logger = logging.getLogger(__name__)
    
    def setup(self):
        """Configure logging with consistent formatting for all output."""
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        return self._logger
    
    def get_logger(self):
        return self._logger


class DirectorySelector:
    """Handles user interaction for selecting directories via GUI."""
    
    @staticmethod
    def select_directory(title: str, initial_dir: Path) -> Optional[str]:
        """
        Present a native file dialog for directory selection.
        
        I use GUI dialogs rather than CLI prompts to make the tool more accessible
        to users who may not be comfortable with command-line directory paths.
        """
        root = tk.Tk()
        root.withdraw()
        try:
            selected_dir = filedialog.askdirectory(
                title=title,
                initialdir=str(initial_dir)
            )
            return selected_dir if selected_dir else None
        finally:
            root.destroy()


class TrainingDataValidator:
    """Validates that training data exists and is in the expected format."""
    
    def __init__(self, logger: logging.Logger):
        self.logger = logger
    
    def validate(self, data_path: Path) -> bool:
        """
        Verify that the data directory exists and contains subdirectories.
        
        I check for subdirectories (one per instrument key) rather than individual
        files because the pipeline expects organized data grouped by musical note.
        """
        if not data_path.exists():
            self.logger.error("No raw data found. Capture data first:")
            self.logger.error(f"  python scripts/capture_data.py --keys Bb C D --samples 300")
            return False
        
        if not any(data_path.iterdir()):
            self.logger.error("Training data directory is empty")
            return False
        
        return True


class InstrumentKeyFinder:
    """Discovers which instrument keys are available in the training data."""
    
    def __init__(self, logger: logging.Logger):
        self.logger = logger
    
    def find_keys(self, data_path: Path) -> List[str]:
        """
        Scan the data directory and extract available keys.
        
        I infer available keys from the directory structure rather than requiring
        explicit configuration, reducing the chance of training/data mismatches.
        """
        keys = sorted([d.name for d in data_path.iterdir() if d.is_dir()])
        if keys:
            self.logger.info(f"Found raw data for keys: {keys}")
        return keys


class TrainingCommand(ABC):
    """Base class for training-related commands."""
    
    def __init__(self, logger: logging.Logger):
        self.logger = logger
    
    @abstractmethod
    def execute(self) -> int:
        """Execute the command and return exit code."""
        pass


class TrainModelCommand(TrainingCommand):
    """Orchestrates the model training workflow."""
    
    def __init__(
        self,
        logger: logging.Logger,
        args,
        directory_selector: DirectorySelector,
        validator: TrainingDataValidator,
        key_finder: InstrumentKeyFinder
    ):
        super().__init__(logger)
        self.args = args
        self.directory_selector = directory_selector
        self.validator = validator
        self.key_finder = key_finder
    
    def execute(self) -> int:
        """Execute the full training workflow."""
        input_dir = self._get_input_directory()
        if not input_dir:
            return 1
        
        keys_to_train = self._determine_keys_to_train(Path(input_dir))
        if not keys_to_train:
            return 1
        
        return self._run_training(input_dir, keys_to_train)
    
    def _get_input_directory(self) -> Optional[str]:
        """
        Determine the training data directory to use.
        
        If the user didn't explicitly specify a directory, we prompt them with a GUI
        dialog to avoid hardcoding assumptions about their data location.
        """
        if self.args.input_dir != 'datasets/raw':
            return self.args.input_dir
        
        selected = self.directory_selector.select_directory(
            title="Select folder containing training data",
            initial_dir=project_root / "datasets"
        )
        
        if not selected:
            self.logger.error("❌ No folder selected. Exiting.")
            return None
        
        return selected
    
    def _determine_keys_to_train(self, data_path: Path) -> Optional[List[str]]:
        """
        Figure out which instrument keys should be trained.
        
        I support two modes: auto-detect all available keys, or train only specified ones.
        Auto-detection is safer for batch operations as it adapts to whatever data exists.
        """
        if not self.validator.validate(data_path):
            return None
        
        if self.args.all:
            return self.key_finder.find_keys(data_path)
        
        keys = self.args.keys or []
        if not keys:
            self.logger.error("Specify --all or --keys")
            return None
        
        return keys
    
    def _run_training(self, input_dir: str, keys_to_train: List[str]) -> int:
        """
        Launch the actual training subprocess.
        
        I spawn a separate process rather than importing the training module directly
        to isolate its dependencies (TensorFlow, etc.) and allow independent version management.
        """
        self.logger.info(f"Starting model training for keys: {keys_to_train}")
        self.logger.info(f"Using data from: {input_dir}")
        self.logger.info("Launching landmark-based training...")
        self.logger.info("Using MediaPipe hand landmarks as features")
        
        try:
            result = subprocess.run([
                sys.executable,
                str(project_root / "scripts" / "train_landmark_model.py"),
                "--raw-dir", input_dir
            ])
            return result.returncode
        except Exception as e:
            self.logger.error(f"Training failed: {str(e)}")
            import traceback
            traceback.print_exc()
            return 1


class CommandFactory:
    """Creates command instances based on CLI arguments."""
    
    def __init__(self, logger: logging.Logger):
        self.logger = logger
    
    def create_command(self, command_name: str, args) -> Optional[TrainingCommand]:
        """
        Instantiate the appropriate command handler.
        
        I centralize command creation here to make it easy to add new commands
        without cluttering the main function with conditional logic.
        """
        if command_name == 'train':
            directory_selector = DirectorySelector()
            validator = TrainingDataValidator(self.logger)
            key_finder = InstrumentKeyFinder(self.logger)
            
            return TrainModelCommand(
                self.logger,
                args,
                directory_selector,
                validator,
                key_finder
            )
        
        return None


def create_argument_parser() -> argparse.ArgumentParser:
    """Build and return the CLI argument parser."""
    parser = argparse.ArgumentParser(
        description='FluteVision Management CLI',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python scripts/manage.py train --all
  python scripts/manage.py train --keys Bb C D
  python scripts/manage.py train --all --input-dir /path/to/my/data
  python scripts/manage.py train --all
        """
    )

    subparsers = parser.add_subparsers(dest='command', help='Available commands')
    
    train_parser = subparsers.add_parser('train', help='Train the model')
    train_parser.add_argument(
        '--all',
        action='store_true',
        help='Train on all available keys'
    )
    train_parser.add_argument(
        '--keys',
        nargs='+',
        help='Specific keys to train on'
    )
    train_parser.add_argument(
        '--input-dir',
        '--raw-dir',
        dest='input_dir',
        default='datasets/raw',
        help='Input directory for training data (default: opens GUI to select)'
    )
    
    return parser


def main() -> int:
    """Entry point for the management CLI."""
    parser = create_argument_parser()
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return 1
    
    logger_wrapper = Logger()
    logger = logger_wrapper.setup()
    
    # Delegate to the appropriate command handler
    factory = CommandFactory(logger)
    command = factory.create_command(args.command, args)
    
    if not command:
        logger.error(f"Unknown command: {args.command}")
        return 1
    
    return command.execute()


if __name__ == '__main__':
    sys.exit(main())