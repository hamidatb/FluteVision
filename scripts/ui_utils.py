"""
Shared UI utilities for rendering overlays on video frames.

This module contains common UI rendering functions used across data capture, live recognition, and testing scripts to maintain consistent visual styling.
"""

import cv2
from typing import Dict, List, Optional, Tuple

class Colors:
    DARK_GREEN = (0, 180, 0)
    BRIGHT_GREEN = (0, 255, 0)
    YELLOW = (0, 255, 255)
    WHITE = (255, 255, 255)
    GRAY = (200, 200, 200)
    LIGHT_GRAY = (100, 100, 100)
    DARK_GRAY = (50, 50, 50)
    BLACK = (0, 0, 0)


class BaseUIRenderer:
    """
    Base class with common UI rendering utilities.
    
    I'm extracting these helper methods because cv2's parameter order is unintuitive and using named parameters makes the code much more readable
    """
    
    @staticmethod
    def put_text(
        img,
        text: str,
        org: Tuple[int, int],
        font_face=cv2.FONT_HERSHEY_SIMPLEX,
        font_scale: float = 1.0,
        color: Tuple[int, int, int] = Colors.WHITE,
        thickness: int = 1,
        line_type=cv2.LINE_AA
        ):
        cv2.putText(img, text, org, font_face, font_scale, color, thickness, line_type)
    
    @staticmethod
    def draw_rectangle(
        img,
        pt1: Tuple[int, int],
        pt2: Tuple[int, int],
        color: Tuple[int, int, int],
        thickness: int = 1,
        line_type=cv2.LINE_8
        ):
        cv2.rectangle(img, pt1, pt2, color, thickness, line_type)
    
    @staticmethod
    def draw_panel(
        img,
        x: int,
        y: int,
        width: int,
        height: int,
        background_color: Tuple[int, int, int] = Colors.BLACK,
        border_color: Tuple[int, int, int] = Colors.YELLOW,
        border_thickness: int = 2
        ):
        """
        Draw a panel (filled rectangle with border).
        
        I combine background and border drawing into one method since panels almost always need both for good visibility over varying backgrounds.
        """
        BaseUIRenderer.draw_rectangle(
            img, (x, y), (x + width, y + height), background_color, -1
        )
        BaseUIRenderer.draw_rectangle(
            img, (x, y), (x + width, y + height), border_color, border_thickness
        )
    
    @staticmethod
    def draw_progress_bar(
        img,
        x: int,
        y: int,
        width: int,
        height: int,
        progress: float,
        background_color: Tuple[int, int, int] = Colors.DARK_GRAY,
        fill_color: Tuple[int, int, int] = Colors.DARK_GREEN,
        border_color: Tuple[int, int, int] = None
    ):
        """
        Draw a horizontal progress bar.
        
        Using a normalized progress value (0.0 to 1.0) rather than current/total to keep this function generic and reusable across different contexts.
        """
        progress = max(0.0, min(1.0, progress))
        
        BaseUIRenderer.draw_rectangle(
            img, (x, y), (x + width, y + height), background_color, -1
        )
        
        filled_width = int(progress * width)
        if filled_width > 0:
            BaseUIRenderer.draw_rectangle(
                img, (x, y), (x + filled_width, y + height), fill_color, -1
            )
        
        if border_color:
            BaseUIRenderer.draw_rectangle(
                img, (x, y), (x + width, y + height), border_color, 1
            )


class CaptureUIRenderer(BaseUIRenderer):
    """UI renderer for data capture workflow."""
    
    @staticmethod
    def render_waiting_screen(frame, key: str, samples: int):
        """Render the waiting/ready screen before capture begins."""
        CaptureUIRenderer.put_text(
            img=frame,
            text=f"KEY: {key}",
            org=(10, 50),
            font_scale=1.5,
            color=Colors.DARK_GREEN,
            thickness=3,
        )
        
        CaptureUIRenderer.put_text(
            img=frame,
            text="Press B to BEGIN | S to SKIP | Q to QUIT",
            org=(10, 100),
            font_scale=0.7,
            color=Colors.WHITE,
            thickness=2,
        )
        
        CaptureUIRenderer.put_text(
            img=frame,
            text=f"Samples to collect: {samples}",
            org=(10, 140),
            font_scale=0.6,
            color=Colors.GRAY,
            thickness=1,
        )
    
    @staticmethod
    def render_countdown(frame, key: str, countdown: int):
        """Render countdown before capture starts."""
        CaptureUIRenderer.put_text(
            img=frame,
            text=f"KEY: {key}",
            org=(10, 50),
            font_scale=1.5,
            color=Colors.DARK_GREEN,
            thickness=3,
        )
        
        CaptureUIRenderer.put_text(
            img=frame,
            text=str(countdown),
            org=(frame.shape[1]//2 - 50, frame.shape[0]//2),
            font_scale=5,
            color=Colors.DARK_GREEN,
            thickness=10,
        )
    
    @staticmethod
    def render_capture_progress(frame, key: str, current: int, total: int):
        """Render capture progress with progress bar."""
        CaptureUIRenderer.put_text(
            img=frame,
            text=f"KEY: {key}",
            org=(10, 50),
            font_scale=1.5,
            color=Colors.DARK_GREEN,
            thickness=3,
        )
        
        CaptureUIRenderer.put_text(
            img=frame,
            text=f"Collecting: {current + 1}/{total}",
            org=(10, 90),
            font_scale=0.8,
            color=Colors.WHITE,
            thickness=2,
        )
        
        bar_width = 400
        bar_height = 30
        bar_x = (frame.shape[1] - bar_width) // 2
        bar_y = frame.shape[0] - 60
        
        CaptureUIRenderer.draw_progress_bar(
            img=frame,
            x=bar_x,
            y=bar_y,
            width=bar_width,
            height=bar_height,
            progress=current / total,
            background_color=Colors.DARK_GRAY,
            fill_color=Colors.DARK_GREEN
        )


class PredictionUIRenderer(BaseUIRenderer):
    """UI renderer for live prediction visualization."""
    
    def __init__(self, classes: List[str], panel_width: int = 250):
        self.classes = classes
        self.panel_width = panel_width
        self.panel_margin = 10
    
    def render_predictions(
        self,
        frame,
        predicted_class: Optional[str] = None,
        probabilities: Optional[Dict[str, float]] = None
    ):
        """
        Draw prediction panel on the frame in the top-right of the frame.
        """
        h, w = frame.shape[:2]
        
        panel_x = w - self.panel_width - self.panel_margin
        panel_height = 60 + len(self.classes) * 30
        
        self.draw_panel(
            img=frame,
            x=panel_x,
            y=10,
            width=self.panel_width,
            height=panel_height,
            background_color=Colors.BLACK,
            border_color=Colors.YELLOW,
            border_thickness=2
        )
        
        if predicted_class and probabilities:
            self._draw_predicted_key(frame, panel_x, predicted_class)
            self._draw_confidence_bars(frame, panel_x, probabilities)
        else:
            self._draw_no_hands_message(frame, panel_x)
    
    def _draw_predicted_key(self, frame, panel_x: int, predicted_key: str):
        """Draw the main prediction text."""
        self.put_text(
            img=frame,
            text=f"Key: {predicted_key}",
            org=(panel_x + 10, 40),
            font_scale=0.8,
            color=Colors.YELLOW,
            thickness=2
        )
    
    def _draw_confidence_bars(self, frame, panel_x: int, probabilities: Dict[str, float]):
        """
        Draw colored confidence bars for each class.
        """
        y_offset = 65
        bar_width = self.panel_width - 100
        
        for class_name in self.classes:
            prob = probabilities.get(class_name, 0.0)
            
            color = self._get_confidence_color(prob)
            
            self.put_text(
                img=frame,
                text=f"{class_name}:",
                org=(panel_x + 10, y_offset),
                font_scale=0.5,
                color=Colors.WHITE,
                thickness=1
            )
            
            bar_x = panel_x + 50
            self.draw_rectangle(
                img=frame,
                pt1=(bar_x, y_offset - 10),
                pt2=(bar_x + bar_width, y_offset - 2),
                color=Colors.DARK_GRAY,
                thickness=-1
            )
            
            filled_width = int(prob * bar_width)
            if filled_width > 0:
                self.draw_rectangle(
                    img=frame,
                    pt1=(bar_x, y_offset - 10),
                    pt2=(bar_x + filled_width, y_offset - 2),
                    color=color,
                    thickness=-1
                )
            
            self.put_text(
                img=frame,
                text=f"{prob:.0%}",
                org=(bar_x + bar_width + 5, y_offset),
                font_scale=0.4,
                color=Colors.WHITE,
                thickness=1
            )
            
            y_offset += 30
    
    @staticmethod
    def _get_confidence_color(probability: float) -> Tuple[int, int, int]:
        """
        Using green for high confidence and gray for low to give instant visual feedback about prediction reliability.
        """
        if probability > 0.7:
            return Colors.BRIGHT_GREEN
        elif probability > 0.4:
            return Colors.YELLOW
        return Colors.LIGHT_GRAY
    
    def _draw_no_hands_message(self, frame, panel_x: int):
        """Draw message when no hands are detected."""
        self.put_text(
            img=frame,
            text="Key: ---",
            org=(panel_x + 10, 40),
            font_scale=0.8,
            color=Colors.LIGHT_GRAY,
            thickness=2
        )

