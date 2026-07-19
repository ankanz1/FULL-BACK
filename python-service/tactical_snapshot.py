import os, sys, cv2, numpy as np
from pathlib import Path
from sklearn.cluster import KMeans
from mplsoccer import Pitch
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

ROOT_DIR = Path(__file__).resolve().parent
PUBLIC_DIR = ROOT_DIR / "public"
VIDEO_PATH = PUBLIC_DIR / "Asset_Video.mp4"
OUTPUT_IMAGE = PUBLIC_DIR / "tactical_snapshot.png"
CAPTION_PATH = PUBLIC_DIR / "tactical_snapshot_caption.txt"

PITCH_LENGTH = 105
PITCH_WIDTH = 68

HOMOGRAPHY_PATH = PUBLIC_DIR / "homography_H.npy"

KNOWN_SRC = np.array([[65, 500], [295, 470], [400, 195], [0, 217]], dtype=np.float32)
KNOWN_DST = np.array([[0, 30.34], [0, 37.66], [52.5, 0], [52.5, 68]], dtype=np.float32)

FRAME_SKIP = 30
CONFIDENCE_THRESHOLD = 0.3

COCO_CLASSES = {0: 'person'}

def load_homography():
    if HOMOGRAPHY_PATH.exists():
        H = np.load(str(HOMOGRAPHY_PATH))
        return H, np.linalg.inv(H)
    H = cv2.getPerspectiveTransform(KNOWN_SRC, KNOWN_DST)
    np.save(str(HOMOGRAPHY_PATH), H)
    return H, np.linalg.inv(H)

def detect_players(frame, model):
    results = model(frame, conf=CONFIDENCE_THRESHOLD, verbose=False)[0]
    boxes = []
    if results.boxes is not None and len(results.boxes) > 0:
        for xyxy, conf, cls in zip(
            results.boxes.xyxy.cpu().numpy(),
            results.boxes.conf.cpu().numpy(),
            results.boxes.cls.cpu().numpy().astype(int)
        ):
            if cls == 0 and conf >= CONFIDENCE_THRESHOLD:
                boxes.append(xyxy)
    return np.array(boxes) if boxes else np.zeros((0, 4))

def compute_jersey_color(box, frame):
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

def assign_teams(color_vectors):
    if len(color_vectors) < 2:
        return [0] * len(color_vectors)
    stacked = np.vstack(color_vectors)
    kmeans = KMeans(n_clusters=2, random_state=42, n_init=10).fit(stacked)
    return list(kmeans.labels_)

def project_point(point, homography):
    pt = np.array([[point]], dtype=np.float32)
    projected = cv2.perspectiveTransform(pt, homography)[0][0]
    return float(projected[0]), float(projected[1])

def process_video():
    if not VIDEO_PATH.exists():
        print(f"ERROR: Video not found at {VIDEO_PATH}", flush=True)
        return None, None

    print(f"Loading YOLOv8n model...", flush=True)
    from ultralytics import YOLO
    model = YOLO("yolov8n.pt")
    H, H_inv = load_homography()

    cap = cv2.VideoCapture(str(VIDEO_PATH))
    if not cap.isOpened():
        print("ERROR: Cannot open video")
        return None, None

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    print(f"Video: {total_frames} frames at {fps:.0f} fps")

    all_team_a_positions = []
    all_team_b_positions = []

    frame_index = 0
    processed = 0

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break
        if frame_index % FRAME_SKIP != 0:
            frame_index += 1
            continue

        boxes = detect_players(frame, model)
        if len(boxes) == 0:
            frame_index += 1
            continue

        color_vectors = []
        pitch_positions = []

        for box in boxes:
            color = compute_jersey_color(box, frame)
            if color is not None:
                color_vectors.append(color)
            cx = (box[0] + box[2]) / 2.0
            bottom = box[3]
            pitch_positions.append(project_point((cx, bottom), H))

        if len(color_vectors) < 2:
            frame_index += 1
            continue

        team_labels = assign_teams(color_vectors)

        for label, pitch_pos in zip(team_labels, pitch_positions):
            px, py = pitch_pos
            if 0 <= px <= PITCH_LENGTH and 0 <= py <= PITCH_WIDTH:
                if label == 0:
                    all_team_a_positions.append((px, py))
                else:
                    all_team_b_positions.append((px, py))

        processed += 1
        if processed % 20 == 0:
            print(f"  Processed {processed} frames ({frame_index}/{total_frames})")

        frame_index += 1

    cap.release()
    print(f"Done. Processed {processed} frames.")
    print(f"  Team A: {len(all_team_a_positions)} positions")
    print(f"  Team B: {len(all_team_b_positions)} positions")

    if len(all_team_a_positions) == 0 and len(all_team_b_positions) == 0:
        return None, None

    return all_team_a_positions, all_team_b_positions

def compute_average_positions(positions):
    if not positions:
        return None
    xs = [p[0] for p in positions]
    ys = [p[1] for p in positions]
    return (np.mean(xs), np.mean(ys))

def render_pitch(team_a_positions, team_b_positions):
    pitch = Pitch(pitch_type="statsbomb", pitch_color="#0B1920", line_color="#FFFFFF", linewidth=1.5)
    fig, ax = pitch.draw(figsize=(10, 6), constrained_layout=True)

    color_a = "#D9622B"
    color_b = "#5DA0FC"

    if team_a_positions:
        ax_a_avg = compute_average_positions(team_a_positions)
        pitch.scatter(
            [p[0] for p in team_a_positions], [p[1] for p in team_a_positions],
            ax=ax, s=30, c=color_a, alpha=0.3, edgecolors="none", zorder=3
        )
        if ax_a_avg:
            pitch.scatter(
                ax_a_avg[0], ax_a_avg[1],
                ax=ax, s=200, c=color_a, edgecolors="white", linewidths=2, zorder=5, label="Team A (avg)"
            )

    if team_b_positions:
        ax_b_avg = compute_average_positions(team_b_positions)
        pitch.scatter(
            [p[0] for p in team_b_positions], [p[1] for p in team_b_positions],
            ax=ax, s=30, c=color_b, alpha=0.3, edgecolors="none", zorder=3
        )
        if ax_b_avg:
            pitch.scatter(
                ax_b_avg[0], ax_b_avg[1],
                ax=ax, s=200, c=color_b, edgecolors="white", linewidths=2, zorder=5, label="Team B (avg)"
            )

    ax.legend(loc="upper right", frameon=True, facecolor="#081117", edgecolor="#666", fontsize=10)
    ax.set_title("Tactical Snapshot — Averaged Player Positions", color="white", fontsize=12, pad=15)

    fig.savefig(str(OUTPUT_IMAGE), dpi=200, bbox_inches="tight", facecolor="#0B1920")
    plt.close(fig)
    print(f"Saved: {OUTPUT_IMAGE}")

def generate_caption(team_a_positions, team_b_positions):
    if not team_a_positions and not team_b_positions:
        caption = "No player positions could be reliably detected in the clip. The camera angle or resolution may be unsuitable for automated tactical analysis."
    elif not team_a_positions or not team_b_positions:
        caption = "Only one team's positions were consistently detected. Team identification may be unreliable due to similar jersey colors or limited frame coverage."
    else:
        a_avg = compute_average_positions(team_a_positions)
        b_avg = compute_average_positions(team_b_positions)

        if a_avg and b_avg:
            a_x, a_y = a_avg
            b_x, b_y = b_avg
            x_spread_a = np.std([p[0] for p in team_a_positions])
            y_spread_a = np.std([p[1] for p in team_a_positions])
            x_spread_b = np.std([p[0] for p in team_b_positions])
            y_spread_b = np.std([p[1] for p in team_b_positions])

            depth_a = "deep" if x_spread_a > 25 else "compact"
            width_a = "narrow" if y_spread_a < 12 else "wide"
            depth_b = "deep" if x_spread_b > 25 else "compact"
            width_b = "narrow" if y_spread_b < 12 else "wide"

            caption = (
                f"Team A shows a {depth_a}, {width_a} shape (avg depth {a_x:.0f}m from own goal, "
                f"spread {x_spread_a:.0f}m × {y_spread_a:.0f}m). "
                f"Team B is {depth_b} and {width_b} (avg depth {b_x:.0f}m, "
                f"spread {x_spread_b:.0f}m × {y_spread_b:.0f}m). "
                f"Detection and homography are approximate — this is a qualitative illustration, not a precise formation map."
            )
        else:
            caption = "Player positions were detected but averaged positions could not be computed reliably."

    print(f"Caption: {caption}")
    with open(str(CAPTION_PATH), "w") as f:
        f.write(caption)
    return caption

def main():
    print("=" * 60)
    print("FULL BACK — Tactical Snapshot Pipeline")
    print("=" * 60)

    result = process_video()
    if result[0] is None and result[1] is None:
        print("No detections found. Check the video file and YOLO model.")
        caption = "The tactical snapshot pipeline could not detect any players. The clip may not contain a suitable football scene."
        with open(str(CAPTION_PATH), "w") as f:
            f.write(caption)
        return

    team_a_positions, team_b_positions = result
    render_pitch(team_a_positions, team_b_positions)
    generate_caption(team_a_positions, team_b_positions)

    print("\nDone. Output files:")
    print(f"  Image:    {OUTPUT_IMAGE}")
    print(f"  Caption:  {CAPTION_PATH}")

if __name__ == "__main__":
    main()
