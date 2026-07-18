import os
from pathlib import Path
from typing import List, Dict, Optional, Tuple

import cv2
import numpy as np
import streamlit as st
from sklearn.cluster import KMeans
from ultralytics import YOLO
import supervision as sv
from mplsoccer import Pitch

# Base pitch dimensions in meters for visualization
PITCH_LENGTH = 105
PITCH_WIDTH = 68

ROOT_DIR = Path(__file__).resolve().parent
DEFAULT_VIDEO = ROOT_DIR / "public" / "sample_match.mp4"
DEFAULT_MODEL = os.getenv("FOOTBALL_YOLO_MODEL", "yolov8n.pt")

DEFAULT_SRC_POINTS = np.array([
    [150.0, 120.0],
    [1170.0, 120.0],
    [1170.0, 620.0],
    [150.0, 620.0],
], dtype=np.float32)
DEFAULT_DST_POINTS = np.array([
    [0.0, 0.0],
    [PITCH_LENGTH, 0.0],
    [PITCH_LENGTH, PITCH_WIDTH],
    [0.0, PITCH_WIDTH],
], dtype=np.float32)


@st.cache_resource
def load_yolo_model(model_path: str) -> YOLO:
    return YOLO(model_path)


@st.cache_resource
def create_tracker() -> sv.ByteTrack:
    return sv.ByteTrack()


def build_homography(src_points: np.ndarray, dst_points: np.ndarray) -> np.ndarray:
    return cv2.getPerspectiveTransform(src_points, dst_points)


def project_point(point: Tuple[float, float], homography: np.ndarray) -> Tuple[float, float]:
    point_arr = np.array([[point]], dtype=np.float32)
    projected = cv2.perspectiveTransform(point_arr, homography)[0][0]
    return float(projected[0]), float(projected[1])


def extract_player_detections(frame: np.ndarray, model: YOLO) -> sv.Detections:
    result = model(frame)[0]
    if len(result.boxes) == 0:
        return sv.Detections(xyxy=np.zeros((0, 4)), confidence=np.zeros((0,)), class_id=np.zeros((0,), dtype=int))

    xyxy = result.boxes.xyxy.cpu().numpy()
    confidence = result.boxes.conf.cpu().numpy()
    class_id = result.boxes.cls.cpu().numpy().astype(int)
    return sv.Detections(xyxy=xyxy, confidence=confidence, class_id=class_id)


def compute_jersey_color(box: np.ndarray, frame: np.ndarray) -> Optional[np.ndarray]:
    x1, y1, x2, y2 = map(int, box)
    crop = frame[y1:y2, x1:x2]
    if crop.size == 0:
        return None

    hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
    mask = (hsv[:, :, 2] > 30) & (hsv[:, :, 1] > 30)
    pixels = hsv[mask]
    if pixels.shape[0] < 10:
        return None
    return pixels.mean(axis=0)


def assign_team_labels(color_vectors: List[np.ndarray]) -> List[int]:
    if len(color_vectors) < 2:
        return [0] * len(color_vectors)
    stacked = np.vstack(color_vectors)
    kmeans = KMeans(n_clusters=2, random_state=42, n_init=10).fit(stacked)
    return list(kmeans.labels_)


def estimate_formation(coords: List[Tuple[float, float]]) -> str:
    if len(coords) < 4:
        return "unknown"
    xs = np.array([c[0] for c in coords]).reshape(-1, 1)
    n_clusters = min(4, len(coords))
    kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10).fit(xs)
    counts = np.bincount(kmeans.labels_, minlength=n_clusters)
    sorted_counts = sorted(counts, reverse=True)
    return "-".join(str(int(c)) for c in sorted_counts)


def render_pitch(positions: List[Tuple[float, float]], labels: List[int], formation: str) -> None:
    pitch = Pitch(pitch_type="statsbomb", pitch_color="#0B1920", line_color="#FFFFFF")
    fig, ax = pitch.draw(figsize=(10, 6), constrained_layout=True)
    colors = ["#D9622B", "#5DA0FC"]

    for (x, y), label in zip(positions, labels):
        pitch.scatter(x, y, ax=ax, s=150, c=colors[label], edgecolors="white", zorder=5)
    for label in set(labels):
        ax.scatter([], [], c=colors[label], label=f"Team {label+1}", s=100)
    ax.legend(loc="upper right", frameon=True, facecolor="#081117", edgecolor="#666")
    ax.text(0.5, 0.95, f"Formation estimate: {formation}", transform=ax.transAxes, ha="center", color="#FFFFFF", fontsize=14)
    st.pyplot(fig)


def render_detection_frame(frame: np.ndarray, tracked_objects: sv.TrackedObjects) -> None:
    annotated = frame.copy()
    for obj in tracked_objects:
        x1, y1, x2, y2 = map(int, obj.xyxy)
        cv2.rectangle(annotated, (x1, y1), (x2, y2), (217, 98, 43), 2)
        cv2.putText(
            annotated,
            f"ID {obj.track_id}",
            (x1, y1 - 10),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (255, 255, 255),
            2,
            cv2.LINE_AA,
        )
    st.image(cv2.cvtColor(annotated, cv2.COLOR_BGR2RGB), caption="Tracked players", use_column_width=True)


def run_frame_pipeline(
    video_path: Path,
    model: YOLO,
    tracker: sv.ByteTrack,
    homography: np.ndarray,
    max_frames: int,
    frame_skip: int,
    visualize: bool,
) -> Dict[str, Any]:
    cap = cv2.VideoCapture(str(video_path))
    frames = []
    positions = []
    labels = []
    formation_history = []
    frame_index = 0

    while cap.isOpened() and frame_index < max_frames:
        ret, frame = cap.read()
        if not ret:
            break
        if frame_index % frame_skip != 0:
            frame_index += 1
            continue
        detections = extract_player_detections(frame, model)
        if len(detections.xyxy) == 0:
            frame_index += 1
            continue

        tracks = tracker.update(detections=detections)
        player_boxes = [obj.xyxy for obj in tracks]
        team_colors = []
        pitch_positions = []

        for box in player_boxes:
            color = compute_jersey_color(box, frame)
            team_colors.append(color if color is not None else np.array([0, 0, 0]))
            bottom_center = ((box[0] + box[2]) / 2.0, box[3])
            pitch_positions.append(project_point(bottom_center, homography))

        team_labels = assign_team_labels([c for c in team_colors if c is not None])
        if len(team_labels) < len(player_boxes):
            team_labels = [0] * len(player_boxes)

        formation = estimate_formation(pitch_positions)
        positions.extend(pitch_positions)
        labels.extend(team_labels)
        formation_history.append((frame_index, formation, len(pitch_positions)))

        if frame_index == 0 or visualize:
            frames.append((frame.copy(), tracks))
        frame_index += 1

    cap.release()
    return {
        "frames": frames,
        "positions": positions,
        "labels": labels,
        "formation_history": formation_history,
        "processed_frames": frame_index,
    }


def main() -> None:
    st.set_page_config(page_title="FULL BACK Tactical Analyst", layout="wide")
    st.title("FULL BACK — AI Tactical Analyst")
    st.markdown(
        "Detect players and the ball, track movement, map locations to pitch coordinates, and surface formation changes in an interactive dashboard."
    )

    model_path = st.sidebar.text_input("YOLOv8 model path", str(DEFAULT_MODEL))
    input_video = st.sidebar.file_uploader("Upload football video", type=["mp4", "mov", "avi"])
    preview_video = str(DEFAULT_VIDEO) if input_video is None else None

    max_frames = st.sidebar.slider("Max frames to process", 10, 200, 80, step=10)
    frame_skip = st.sidebar.slider("Frame skip interval", 1, 30, 12)
    show_raw = st.sidebar.checkbox("Show raw detection frames", value=True)

    src_pts = st.sidebar.text_area(
        "Homography source points (x,y) in video coordinates",
        value="\n".join([f"{int(x)},{int(y)}" for x, y in DEFAULT_SRC_POINTS]),
        height=160,
    )

    if st.sidebar.button("Run Tactical Analysis"):
        if input_video is None and not DEFAULT_VIDEO.exists():
            st.error("No video selected and default sample video is missing.")
            return

        if input_video is not None:
            temp_path = ROOT_DIR / "temp_video.mp4"
            with open(temp_path, "wb") as f:
                f.write(input_video.read())
            video_path = temp_path
        else:
            video_path = DEFAULT_VIDEO

        model = load_yolo_model(model_path)
        tracker = create_tracker()

        try:
            src_points = np.array(
                [list(map(float, line.strip().split(","))) for line in src_pts.splitlines() if line.strip()],
                dtype=np.float32,
            )
            if src_points.shape != (4, 2):
                raise ValueError("Provide exactly four source points.")
        except Exception as exc:
            st.error(f"Invalid homography points: {exc}")
            return

        homography = build_homography(src_points, DEFAULT_DST_POINTS)
        with st.spinner("Running detection and tracking..."):
            results = run_frame_pipeline(
                video_path=Path(video_path),
                model=model,
                tracker=tracker,
                homography=homography,
                max_frames=max_frames,
                frame_skip=frame_skip,
                visualize=show_raw,
            )

        st.success(f"Processed {results['processed_frames']} frames.")

        if show_raw and results["frames"]:
            frame, tracked_objects = results["frames"][0]
            render_detection_frame(frame, tracked_objects)

        if results["positions"]:
            formation = estimate_formation(results["positions"])
            render_pitch(results["positions"], results["labels"], formation)

            st.header("Formation history")
            for frame_index, formation_name, count in results["formation_history"]:
                st.markdown(f"**Frame {frame_index}** — Formation estimate: `{formation_name}` — tracked players: {count}")
        else:
            st.warning("No player positions were projected to the pitch. Check your model selection and homography points.")

        if input_video is not None and video_path.exists():
            video_file = open(video_path, "rb")
            st.video(video_file)


if __name__ == "__main__":
    main()
