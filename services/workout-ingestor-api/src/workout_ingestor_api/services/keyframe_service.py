"""Service for extracting keyframes from videos for OCR."""
import os
import subprocess
from typing import List, Tuple

# Optional dependencies
try:
    import cv2  # type: ignore
    import numpy as np  # type: ignore
    OPENCV_AVAILABLE = True
except ImportError:
    OPENCV_AVAILABLE = False
    cv2 = None
    np = None

try:
    from scenedetect import VideoManager, SceneManager  # type: ignore
    from scenedetect.detectors import ContentDetector  # type: ignore
    SCENEDETECT_AVAILABLE = True
except ImportError:
    SCENEDETECT_AVAILABLE = False


class KeyframeService:
    """Service for extracting keyframes from videos."""
    
    @staticmethod
    def extract_scene_changes(video_path: str, threshold: float = 0.3) -> List[float]:
        """
        Detect scene changes in video using PySceneDetect.
        
        Args:
            video_path: Path to video file
            threshold: Scene change detection threshold (0.0-1.0)
            
        Returns:
            List of timestamps (in seconds) where scene changes occur
        """
        if not SCENEDETECT_AVAILABLE:
            # Fallback: use periodic sampling
            return KeyframeService.extract_periodic_frames(video_path, fps=0.5)
        
        try:
            video_manager = VideoManager([video_path])
            scene_manager = SceneManager()
            scene_manager.add_detector(ContentDetector(threshold=threshold))
            
            video_manager.set_duration()
            video_manager.start()
            scene_manager.detect_scenes(frame_source=video_manager)
            
            scene_list = scene_manager.get_scene_list()
            timestamps = [scene[0].get_seconds() for scene in scene_list]
            
            return timestamps
        except Exception:
            # Fallback to periodic sampling
            return KeyframeService.extract_periodic_frames(video_path, fps=0.5)
    
    @staticmethod
    def extract_periodic_frames(video_path: str, fps: float = 0.5) -> List[float]:
        """
        Extract frames at regular intervals.
        
        Args:
            video_path: Path to video file
            fps: Frames per second to extract (0.5 = 1 frame every 2 seconds)
            
        Returns:
            List of timestamps (in seconds) for extracted frames
        """
        # Get video duration
        result = subprocess.run(
            [
                "ffprobe", "-v", "error", "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1", video_path
            ],
            capture_output=True,
            text=True,
            check=True
        )
        
        duration = float(result.stdout.strip())
        
        # Calculate frame timestamps
        timestamps = []
        current_time = 0.0
        interval = 1.0 / fps if fps > 0 else 2.0
        
        while current_time < duration:
            timestamps.append(current_time)
            current_time += interval
        
        return timestamps
    
    @staticmethod
    def extract_frames_at_timestamps(
        video_path: str,
        timestamps: List[float],
        output_dir: str
    ) -> List[Tuple[str, float]]:
        """
        Extract frames from video at specific timestamps.
        
        Args:
            video_path: Path to video file
            timestamps: List of timestamps in seconds
            output_dir: Directory to save frames
            
        Returns:
            List of tuples (frame_path, timestamp)
        """
        os.makedirs(output_dir, exist_ok=True)
        frame_paths = []
        
        for i, timestamp in enumerate(timestamps):
            frame_path = os.path.join(output_dir, f"frame_{i:05d}_{timestamp:.2f}s.png")
            
            subprocess.run(
                [
                    "ffmpeg", "-hide_banner", "-loglevel", "error",
                    "-y", "-ss", str(timestamp),
                    "-i", video_path,
                    "-vframes", "1",
                    "-vf", "scale=1920:-1",  # Scale to reasonable size
                    frame_path
                ],
                check=True
            )
            
            frame_paths.append((frame_path, timestamp))
        
        return frame_paths
    
    @staticmethod
    def detect_text_regions(frame_path: str) -> List[Tuple[int, int, int, int]]:
        """
        Detect text regions in frame using OpenCV EAST/CRAFT text detector.
        
        Args:
            frame_path: Path to frame image
            
        Returns:
            List of bounding boxes (x, y, w, h) for text regions
        """
        if not OPENCV_AVAILABLE:
            # Return full frame as single region
            return [(0, 0, 1920, 1080)]  # Default assumption
        
        try:
            # Load image
            img = cv2.imread(frame_path)
            if img is None:
                return []
            
            # Simple heuristic: return full frame for now
            # Full implementation would use EAST/CRAFT text detector
            h, w = img.shape[:2]
            return [(0, 0, w, h)]
        except Exception:
            return [(0, 0, 1920, 1080)]
    
    @staticmethod
    def extract_keyframes(
        video_path: str,
        output_dir: str,
        use_scene_detection: bool = True,
        periodic_fps: float = 0.5,
        scene_threshold: float = 0.3
    ) -> List[Tuple[str, float]]:
        """
        Extract keyframes using scene detection + periodic sampling.
        
        Args:
            video_path: Path to video file
            output_dir: Directory to save frames
            use_scene_detection: Whether to use scene change detection
            periodic_fps: FPS for periodic sampling (fallback)
            scene_threshold: Scene detection threshold
            
        Returns:
            List of tuples (frame_path, timestamp)
        """
        if use_scene_detection:
            scene_timestamps = KeyframeService.extract_scene_changes(
                video_path, threshold=scene_threshold
            )
        else:
            scene_timestamps = []
        
        # Also add periodic frames to ensure coverage
        periodic_timestamps = KeyframeService.extract_periodic_frames(
            video_path, fps=periodic_fps
        )
        
        # Combine and deduplicate (within 1 second)
        all_timestamps = sorted(set(scene_timestamps + periodic_timestamps))
        deduplicated = []
        last_ts = -2.0
        for ts in all_timestamps:
            if ts - last_ts > 1.0:  # At least 1 second apart
                deduplicated.append(ts)
                last_ts = ts
        
        return KeyframeService.extract_frames_at_timestamps(
            video_path, deduplicated, output_dir
        )

