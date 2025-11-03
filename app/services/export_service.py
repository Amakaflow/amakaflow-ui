"""Export service for converting workouts to various formats."""
import re
from typing import Optional
from app.models import Workout
from app.utils import upper_from_range

# FIT export (robust for fit-tool 0.9.13+)
FitFileBuilder = None
FileType = None
WorkoutMessage = None
WorkoutStepMessage = None
Sport = None
DUR = None
TGT = None
try:
    from fit_tool.fit_file_builder import FitFileBuilder  # type: ignore
    from fit_tool.profile.messages.workout_message import WorkoutMessage  # type: ignore
    from fit_tool.profile.messages.workout_step_message import WorkoutStepMessage  # type: ignore
    from fit_tool.profile import profile_type as p  # type: ignore
    FileType = getattr(p, "FileType", None) or type("FileType", (), {"WORKOUT": 5})
    Sport = getattr(p, "Sport", None)
    DUR = getattr(p, "WktStepDuration", None) or getattr(p, "WorkoutStepDuration", None)
    TGT = getattr(p, "WktStepTarget", None) or getattr(p, "WorkoutStepTarget", None)
except Exception as e:
    print(f"[WARN] FIT export disabled: {e}")
    FitFileBuilder = None


class ExportService:
    """Service for exporting workouts to various formats."""
    
    @staticmethod
    def render_text_for_tp(workout: Workout) -> str:
        """
        Render workout as text for Training Peaks.
        
        Args:
            workout: Workout to render
            
        Returns:
            Formatted text string
        """
        lines = [f"# {workout.title}"]
        if workout.source:
            lines.append(f"(source: {workout.source})")
        lines.append("")
        for bi, b in enumerate(workout.blocks, 1):
            hdr = b.label or f"Block {bi}"
            meta = []
            if b.structure:
                meta.append(b.structure)
            if b.time_work_sec:
                meta.append(f"{b.time_work_sec}s work")
            if b.rest_between_sec:
                meta.append(f"{b.rest_between_sec}s rest")
            if meta:
                hdr += f" ({', '.join(meta)})"
            lines.append(f"## {hdr}")
            
            # Render supersets
            for si, superset in enumerate(b.supersets):
                if len(b.supersets) > 1:
                    lines.append(f"### Superset {si + 1}")
                for e in superset.exercises:
                    parts = [e.name]
                    if e.sets:
                        parts.append(f"{e.sets} sets")
                    if e.reps_range:
                        parts.append(f"{e.reps_range} reps")
                    elif e.reps:
                        parts.append(f"{e.reps} reps")
                    if e.distance_range:
                        parts.append(e.distance_range)
                    elif e.distance_m:
                        parts.append(f"{e.distance_m}m")
                    if b.time_work_sec and not e.reps and not e.reps_range and not e.distance_m and not e.distance_range:
                        parts.append(f"{b.time_work_sec}s")
                    lines.append("• " + " — ".join(parts))
                if superset.rest_between_sec:
                    lines.append(f"Rest: {superset.rest_between_sec}s between exercises")
            
            # Render individual exercises
            for e in b.exercises:
                parts = [e.name]
                if e.sets:
                    parts.append(f"{e.sets} sets")
                if e.reps_range:
                    parts.append(f"{e.reps_range} reps")
                elif e.reps:
                    parts.append(f"{e.reps} reps")
                if e.distance_range:
                    parts.append(e.distance_range)
                elif e.distance_m:
                    parts.append(f"{e.distance_m}m")
                if b.time_work_sec and not e.reps and not e.reps_range and not e.distance_m and not e.distance_range:
                    parts.append(f"{b.time_work_sec}s")
                lines.append("• " + " — ".join(parts))
            lines.append("")
        return "\n".join(lines)
    
    @staticmethod
    def render_tcx(workout: Workout) -> str:
        """
        Render workout as TCX (Training Center XML) format.
        
        Args:
            workout: Workout to render
            
        Returns:
            TCX XML string
        """
        def esc(x: str) -> str:
            return (x or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        
        notes = []
        for bi, b in enumerate(workout.blocks, 1):
            header = b.label or f"Block {bi}"
            meta = []
            if b.structure:
                meta.append(b.structure)
            if b.time_work_sec:
                meta.append(f"{b.time_work_sec}s work")
            if b.rest_between_sec:
                meta.append(f"{b.rest_between_sec}s rest")
            notes.append(header + (" (" + ", ".join(meta) + ")" if meta else ""))
            for e in b.exercises:
                parts = [e.name]
                if e.reps_range:
                    parts.append(f"{e.reps_range} reps")
                elif e.reps:
                    parts.append(f"{e.reps} reps")
                if e.distance_range:
                    parts.append(e.distance_range)
                elif e.distance_m:
                    parts.append(f"{e.distance_m}m")
                notes.append(" - " + ", ".join(parts))
        
        tcx = f"""<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">
  <Activities>
    <Activity Sport="Other">
      <Id>2025-01-01T00:00:00Z</Id>
      <Lap StartTime="2025-01-01T00:00:00Z">
        <TotalTimeSeconds>0</TotalTimeSeconds>
        <DistanceMeters>0</DistanceMeters>
        <Intensity>Active</Intensity>
        <TriggerMethod>Manual</TriggerMethod>
        <Notes>{esc("\\n".join(notes))}</Notes>
      </Lap>
    </Activity>
  </Activities>
</TrainingCenterDatabase>
"""
        return tcx
    
    @staticmethod
    def _canonical_name(name: str) -> str:
        """Normalize exercise names to canonical forms."""
        CANON = {
            "db incline bench press": "Dumbbell Incline Bench Press",
            "trx row": "TRX Row",
            "trx rows": "TRX Row",
            "goodmorings": "Good Mornings",
            "kneeling medball slams": "Kneeling Med Ball Slams",
            "medball slams": "Kneeling Med Ball Slams",
        }
        low = " ".join(name.split()).lower()
        return CANON.get(low, name.strip())
    
    @staticmethod
    def _infer_sets_reps(exercise) -> tuple[int, int]:
        """Infer sets and reps from exercise data."""
        sets = exercise.sets or 3
        if exercise.reps:
            reps = exercise.reps
        elif exercise.reps_range:
            reps = upper_from_range(exercise.reps_range) or 10
        else:
            reps = 8
        return sets, reps
    
    @staticmethod
    def _rounds_from_structure(structure: Optional[str]) -> int:
        """Extract number of rounds from structure string."""
        if not structure:
            return 1
        m = re.match(r"\s*(\d+)", structure)
        return int(m.group(1)) if m else 1
    
    @staticmethod
    def build_fit_bytes_from_workout(wk: Workout) -> bytes:
        """
        Build FIT file bytes from workout.
        
        Args:
            wk: Workout to convert
            
        Returns:
            FIT file bytes
            
        Raises:
            RuntimeError: If fit-tool is not installed
        """
        if FitFileBuilder is None:
            raise RuntimeError("fit-tool not installed. Run: pip install fit-tool")
        ffb = FitFileBuilder()
        ffb.add(WorkoutMessage(sport=Sport.STRENGTH, name=(wk.title or "Workout")[:14]))
        step_index = 0

        for b in wk.blocks:
            reps_mode = not b.time_work_sec  # timed blocks => time steps
            rounds = max(1, ExportService._rounds_from_structure(b.structure))
            between = b.rest_between_sec or (10 if not reps_mode else 60)

            for _ in range(rounds):
                for e in b.exercises:
                    name = ExportService._canonical_name(e.name)[:15]
                    if reps_mode:
                        # distance-based strength: convert to time placeholder if no reps present
                        if (e.distance_m or e.distance_range) and not (e.reps or e.reps_range):
                            step_index += 1
                            ffb.add(WorkoutStepMessage(
                                message_index=step_index,
                                workout_step_name=name,
                                duration_type=DUR.TIME,
                                duration_value=45,  # heuristic placeholder
                                target_type=TGT.OPEN,
                            ))
                            step_index += 1
                            ffb.add(WorkoutStepMessage(
                                message_index=step_index,
                                workout_step_name="Rest",
                                duration_type=DUR.TIME,
                                duration_value=between,
                                target_type=TGT.OPEN,
                            ))
                            continue

                        sets, reps = ExportService._infer_sets_reps(e)
                        for s in range(sets):
                            step_index += 1
                            ffb.add(WorkoutStepMessage(
                                message_index=step_index,
                                workout_step_name=name,
                                duration_type=DUR.REPS,
                                duration_value=reps,
                                target_type=TGT.OPEN,
                            ))
                            if s < sets - 1:
                                step_index += 1
                                ffb.add(WorkoutStepMessage(
                                    message_index=step_index,
                                    workout_step_name="Rest",
                                    duration_type=DUR.TIME,
                                    duration_value=between,
                                    target_type=TGT.OPEN,
                                ))
                    else:
                        # time-based (e.g., SkiErg/Tabata)
                        step_index += 1
                        ffb.add(WorkoutStepMessage(
                            message_index=step_index,
                            workout_step_name=name,
                            duration_type=DUR.TIME,
                            duration_value=b.time_work_sec or 20,
                            target_type=TGT.OPEN,
                        ))
                        step_index += 1
                        ffb.add(WorkoutStepMessage(
                            message_index=step_index,
                            workout_step_name="Rest",
                            duration_type=DUR.TIME,
                            duration_value=between,
                            target_type=TGT.OPEN,
                        ))

        return ffb.build(file_type=FileType.WORKOUT)

