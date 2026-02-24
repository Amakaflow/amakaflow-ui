"""Service for fusing transcript, OCR, chapters, and description into unified text."""
import re
from typing import Dict, List


class FusionService:
    """Service for merging multiple text sources with timestamps."""
    
    @staticmethod
    def fuse_texts(
        transcript_segments: List[Dict],
        ocr_segments: List[Dict],
        chapters: List[Dict],
        description: str,
        window_seconds: float = 3.0
    ) -> List[Dict]:
        """
        Fuse transcript, OCR, chapters, and description into timestamped segments.
        
        Args:
            transcript_segments: List of dicts with {text, start, duration} from ASR/captions
            ocr_segments: List of dicts with {text, timestamp, confidence} from OCR
            chapters: List of dicts with {title, start_time, end_time}
            description: Video description text
            window_seconds: Time window for merging nearby segments
            
        Returns:
            List of fused segments with provenance
        """
        # Create time-bucketed segments
        all_segments = []
        
        # Add transcript segments
        for seg in transcript_segments:
            all_segments.append({
                "text": seg.get("text", ""),
                "start": seg.get("start", 0),
                "duration": seg.get("duration", 0),
                "source": "transcript",
                "confidence": 0.8,  # ASR/captions generally reliable
            })
        
        # Add OCR segments
        for seg in ocr_segments:
            all_segments.append({
                "text": seg.get("text", ""),
                "start": seg.get("timestamp", 0),
                "duration": 0.1,  # OCR is instantaneous
                "source": "ocr",
                "confidence": seg.get("confidence", 0.7),
            })
        
        # Sort by timestamp
        all_segments.sort(key=lambda x: x["start"])
        
        # Merge segments within time window
        merged = []
        current_bucket = []
        current_start = None
        
        for seg in all_segments:
            if current_start is None:
                current_start = seg["start"]
                current_bucket = [seg]
            elif seg["start"] - current_start <= window_seconds:
                current_bucket.append(seg)
            else:
                # Merge current bucket
                if current_bucket:
                    merged.append(FusionService._merge_bucket(current_bucket))
                current_start = seg["start"]
                current_bucket = [seg]
        
        # Merge last bucket
        if current_bucket:
            merged.append(FusionService._merge_bucket(current_bucket))
        
        # Add chapter markers
        for chapter in chapters:
            merged.append({
                "text": f"[CHAPTER: {chapter.get('title', '')}]",
                "start": chapter.get("start_time", 0),
                "duration": 0,
                "source": "chapter",
                "confidence": 1.0,
            })
        
        # Sort final merged segments
        merged.sort(key=lambda x: x["start"])
        
        # Add description at the beginning
        if description.strip():
            merged.insert(0, {
                "text": description.strip(),
                "start": 0,
                "duration": 0,
                "source": "description",
                "confidence": 1.0,
            })
        
        return merged
    
    @staticmethod
    def _merge_bucket(bucket: List[Dict]) -> Dict:
        """Merge segments in a time bucket."""
        # Deduplicate similar text
        texts = []
        sources = []
        confidences = []
        
        for seg in bucket:
            text = seg.get("text", "").strip()
            if text and text not in texts:  # Simple deduplication
                texts.append(text)
                sources.append(seg.get("source", "unknown"))
                confidences.append(seg.get("confidence", 0.5))
        
        # Combine texts, preferring OCR for numbers
        combined_text = FusionService._combine_texts(bucket)
        
        return {
            "text": combined_text,
            "start": bucket[0]["start"],
            "duration": max(seg.get("duration", 0) for seg in bucket),
            "source": ",".join(set(sources)),
            "confidence": max(confidences) if confidences else 0.5,
        }
    
    @staticmethod
    def _combine_texts(segments: List[Dict]) -> str:
        """
        Combine texts from multiple sources, preferring OCR for numeric data.
        
        Strategy:
        - OCR is best for numbers (reps, weights, timers)
        - ASR/captions are best for instructions
        - Merge intelligently
        """
        ocr_texts = []
        transcript_texts = []
        
        for seg in segments:
            text = seg.get("text", "").strip()
            source = seg.get("source", "")
            
            if source == "ocr":
                ocr_texts.append(text)
            else:
                transcript_texts.append(text)
        
        # If we have OCR with numbers, prefer it
        has_numeric_ocr = any(
            re.search(r'\d+(\.\d+)?(x|reps?|kg|lb|sec|min|%)', text, re.I)
            for text in ocr_texts
        )
        
        if has_numeric_ocr and ocr_texts:
            # Use OCR for numbers, transcript for context
            combined = " ".join(ocr_texts)
            if transcript_texts:
                # Append transcript for additional context
                combined += " " + " ".join(transcript_texts)
            return combined
        else:
            # Prefer transcript, append OCR if available
            combined = " ".join(transcript_texts)
            if ocr_texts:
                combined += " " + " ".join(ocr_texts)
            return combined
    
    @staticmethod
    def to_flat_text(fused_segments: List[Dict]) -> str:
        """
        Convert fused segments to flat text for parsing.
        
        Args:
            fused_segments: List of fused segments
            
        Returns:
            Combined text string
        """
        lines = []
        for seg in fused_segments:
            text = seg.get("text", "").strip()
            if text:
                lines.append(text)
        
        return "\n".join(lines)
    
    @staticmethod
    def extract_numeric_data(text: str) -> Dict:
        """
        Extract numeric workout data (reps, weights, times) with provenance.
        
        Args:
            text: Text to analyze
            
        Returns:
            Dict with extracted numeric data and source hints
        """
        # Regex patterns for common workout data
        patterns = {
            "reps": r'(\d+)\s*(?:x|×|reps?|repetitions?)',
            "sets": r'(\d+)\s*sets?',
            "weight": r'(\d+(?:\.\d+)?)\s*(?:kg|lb|pounds?|kilos?)',
            "time": r'(\d+)\s*(?:sec|seconds?|min|minutes?)',
            "distance": r'(\d+)\s*(?:m|meters?|km|kilometers?|mi|miles?)',
        }
        
        extracted = {}
        for key, pattern in patterns.items():
            matches = re.findall(pattern, text, re.I)
            if matches:
                extracted[key] = matches
        
        return extracted

