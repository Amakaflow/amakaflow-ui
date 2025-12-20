"""Export service for converting workouts to various formats."""
import csv
import io
import re
from datetime import datetime
from typing import Optional, List, Literal
from workout_ingestor_api.models import Workout
from workout_ingestor_api.utils import upper_from_range

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
        
        notes_text = "\n".join(notes)
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
        <Notes>{esc(notes_text)}</Notes>
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

    @staticmethod
    def render_csv_strong(
        workout: Workout,
        workout_date: Optional[datetime] = None,
        duration_minutes: Optional[int] = None,
        workout_notes: Optional[str] = None,
    ) -> bytes:
        """
        Render workout as Strong-compatible CSV format.

        This format can be imported directly into Hevy and HeavySet.

        Args:
            workout: Workout to render
            workout_date: Optional workout date (defaults to now)
            duration_minutes: Optional workout duration in minutes
            workout_notes: Optional overall workout notes

        Returns:
            CSV file bytes with UTF-8 BOM for Excel compatibility
        """
        output = io.StringIO()
        writer = csv.writer(output)

        # Strong CSV headers
        writer.writerow([
            "Date", "Workout Name", "Duration", "Exercise Name",
            "Set Order", "Weight", "Reps", "Distance", "Seconds",
            "Notes", "Workout Notes", "RPE"
        ])

        # Format date as YYYY-MM-DD HH:MM:SS
        date = workout_date or datetime.now()
        date_str = date.strftime("%Y-%m-%d %H:%M:%S")

        # Format duration as MM:SS
        duration_str = f"{duration_minutes or 0}:00"

        workout_name = workout.title or "Workout"
        notes_str = workout_notes or ""

        # Flatten workout structure to individual sets
        for block in workout.blocks:
            # Handle supersets (legacy format)
            for superset in block.supersets:
                for exercise in superset.exercises:
                    ExportService._write_exercise_sets(
                        writer, exercise, date_str, workout_name,
                        duration_str, notes_str, block
                    )

            # Handle exercises
            for exercise in block.exercises:
                ExportService._write_exercise_sets(
                    writer, exercise, date_str, workout_name,
                    duration_str, notes_str, block
                )

        # UTF-8 BOM for Excel compatibility
        return b'\xef\xbb\xbf' + output.getvalue().encode('utf-8')

    @staticmethod
    def _write_exercise_sets(
        writer,
        exercise,
        date_str: str,
        workout_name: str,
        duration_str: str,
        workout_notes: str,
        block,
    ) -> None:
        """Write individual sets for an exercise to CSV."""
        sets, reps = ExportService._infer_sets_reps(exercise)

        # Duration-based exercises
        duration_sec = exercise.duration_sec or block.time_work_sec or 0

        # Distance for cardio exercises
        distance = exercise.distance_m or 0

        # Exercise notes
        exercise_notes = exercise.notes or ""

        for set_order in range(1, sets + 1):
            writer.writerow([
                date_str,
                workout_name,
                duration_str,
                exercise.name,
                set_order,
                0,  # Weight - not stored in current model
                reps if not duration_sec else 0,
                distance,
                duration_sec,
                exercise_notes if set_order == sets else "",  # Notes on last set
                workout_notes if set_order == 1 else "",  # Workout notes on first set
                ""  # RPE - not stored in current model
            ])

    @staticmethod
    def render_csv_extended(
        workout: Workout,
        workout_date: Optional[datetime] = None,
        source_url: Optional[str] = None,
        creator: Optional[str] = None,
    ) -> bytes:
        """
        Render workout as AmakaFlow extended CSV format.

        Includes additional metadata not supported by Strong format.

        Args:
            workout: Workout to render
            workout_date: Optional workout date (defaults to now)
            source_url: Optional source URL
            creator: Optional creator name

        Returns:
            CSV file bytes with UTF-8 BOM for Excel compatibility
        """
        output = io.StringIO()
        writer = csv.writer(output)

        # Extended CSV headers
        writer.writerow([
            "Workout", "Date", "Source", "Creator", "Block", "Exercise",
            "Set", "Type", "Reps", "Duration (sec)", "Distance (m)",
            "Rest (sec)", "Notes"
        ])

        # Format date
        date = workout_date or datetime.now()
        date_str = date.strftime("%Y-%m-%d")

        workout_name = workout.title or "Workout"
        source = source_url or workout.source or ""
        creator_str = creator or ""

        for block in workout.blocks:
            block_label = block.label or ""
            structure = block.structure or "regular"
            rest_sec = block.rest_between_sec or block.rest_between_rounds_sec or ""

            # Handle supersets (legacy format)
            for superset in block.supersets:
                for exercise in superset.exercises:
                    ExportService._write_exercise_extended(
                        writer, exercise, workout_name, date_str,
                        source, creator_str, block_label, structure, rest_sec
                    )

            # Handle exercises
            for exercise in block.exercises:
                ExportService._write_exercise_extended(
                    writer, exercise, workout_name, date_str,
                    source, creator_str, block_label, structure, rest_sec
                )

        # UTF-8 BOM for Excel compatibility
        return b'\xef\xbb\xbf' + output.getvalue().encode('utf-8')

    @staticmethod
    def _write_exercise_extended(
        writer,
        exercise,
        workout_name: str,
        date_str: str,
        source: str,
        creator: str,
        block_label: str,
        structure: str,
        rest_sec,
    ) -> None:
        """Write individual sets for an exercise to extended CSV."""
        sets, reps = ExportService._infer_sets_reps(exercise)
        duration_sec = exercise.duration_sec or ""
        distance = exercise.distance_m or ""
        exercise_rest = exercise.rest_sec or rest_sec or ""
        notes = exercise.notes or ""

        # Determine set type based on warmup
        warmup_sets = exercise.warmup_sets or 0

        for set_order in range(1, sets + 1):
            set_type = "warmup" if set_order <= warmup_sets else "working"

            writer.writerow([
                workout_name,
                date_str,
                source,
                creator,
                block_label,
                exercise.name,
                set_order,
                set_type,
                reps if not duration_sec else "",
                duration_sec,
                distance,
                exercise_rest,
                notes if set_order == sets else ""  # Notes on last set
            ])

    @staticmethod
    def render_csv_bulk(
        workouts: List[Workout],
        style: Literal["strong", "extended"] = "strong",
        workout_dates: Optional[List[datetime]] = None,
    ) -> bytes:
        """
        Export multiple workouts to a single CSV file.

        Args:
            workouts: List of workouts to export
            style: CSV format style ("strong" or "extended")
            workout_dates: Optional list of dates for each workout

        Returns:
            CSV file bytes with UTF-8 BOM for Excel compatibility
        """
        output = io.StringIO()
        writer = csv.writer(output)

        if style == "strong":
            # Strong CSV headers
            writer.writerow([
                "Date", "Workout Name", "Duration", "Exercise Name",
                "Set Order", "Weight", "Reps", "Distance", "Seconds",
                "Notes", "Workout Notes", "RPE"
            ])

            for i, workout in enumerate(workouts):
                date = (workout_dates[i] if workout_dates and i < len(workout_dates)
                        else datetime.now())
                date_str = date.strftime("%Y-%m-%d %H:%M:%S")
                workout_name = workout.title or f"Workout {i + 1}"

                for block in workout.blocks:
                    for superset in block.supersets:
                        for exercise in superset.exercises:
                            ExportService._write_exercise_sets(
                                writer, exercise, date_str, workout_name,
                                "0:00", "", block
                            )

                    for exercise in block.exercises:
                        ExportService._write_exercise_sets(
                            writer, exercise, date_str, workout_name,
                            "0:00", "", block
                        )
        else:
            # Extended CSV headers
            writer.writerow([
                "Workout", "Date", "Source", "Creator", "Block", "Exercise",
                "Set", "Type", "Reps", "Duration (sec)", "Distance (m)",
                "Rest (sec)", "Notes"
            ])

            for i, workout in enumerate(workouts):
                date = (workout_dates[i] if workout_dates and i < len(workout_dates)
                        else datetime.now())
                date_str = date.strftime("%Y-%m-%d")
                workout_name = workout.title or f"Workout {i + 1}"
                source = workout.source or ""

                for block in workout.blocks:
                    block_label = block.label or ""
                    structure = block.structure or "regular"
                    rest_sec = block.rest_between_sec or ""

                    for superset in block.supersets:
                        for exercise in superset.exercises:
                            ExportService._write_exercise_extended(
                                writer, exercise, workout_name, date_str,
                                source, "", block_label, structure, rest_sec
                            )

                    for exercise in block.exercises:
                        ExportService._write_exercise_extended(
                            writer, exercise, workout_name, date_str,
                            source, "", block_label, structure, rest_sec
                        )

        # UTF-8 BOM for Excel compatibility
        return b'\xef\xbb\xbf' + output.getvalue().encode('utf-8')

