import os, cv2, numpy as np
from pathlib import Path
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from collections import Counter
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch
from matplotlib.colors import to_rgba_array

ROOT_DIR = Path(__file__).resolve().parent
PUBLIC_DIR = ROOT_DIR / "public"
VIDEO_PATH = PUBLIC_DIR / "Asset_Video.mp4"
OUTPUT_IMAGE = PUBLIC_DIR / "tactical_snapshot.png"
CAPTION_PATH = PUBLIC_DIR / "tactical_snapshot_caption.txt"

FRAME_SKIP = 30
CONF_PERSON = 0.3
CONF_BALL = 0.25

COCO_PERSON = 0
COCO_BALL = 32

ZONE_LABELS_H = ["Left", "Center", "Right"]
ZONE_LABELS_V = ["Attacking", "Middle", "Defensive"]

REFEREE_COLOR_DIST_THRESHOLD = 40.0

def get_frame_size(cap):
    return int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

def zone_buckets(x, y, w, h):
    hz = w // 3
    vz = h // 3
    h_idx = min(x // hz, 2)
    v_idx = min(y // vz, 2)
    return ZONE_LABELS_H[h_idx], ZONE_LABELS_V[v_idx], h_idx, v_idx

def detect(frame, model):
    results = model(frame, conf=CONF_PERSON, verbose=False)[0]
    persons, balls = [], []
    if results.boxes is not None and len(results.boxes) > 0:
        for xyxy, conf, cls in zip(
            results.boxes.xyxy.cpu().numpy(),
            results.boxes.conf.cpu().numpy(),
            results.boxes.cls.cpu().numpy().astype(int)
        ):
            if cls == COCO_PERSON and conf >= CONF_PERSON:
                persons.append(xyxy)
            elif cls == COCO_BALL and conf >= CONF_BALL:
                balls.append(xyxy)
    return np.array(persons) if persons else np.zeros((0, 4)), np.array(balls) if balls else np.zeros((0, 4))

def jersey_color(box, frame):
    x1, y1, x2, y2 = map(int, box)
    crop = frame[max(0, y1):min(frame.shape[0], y2), max(0, x1):min(frame.shape[1], x2)]
    if crop.size == 0:
        return None
    torso = crop[crop.shape[0]//3:2*crop.shape[0]//3, :, :]
    if torso.size == 0:
        torso = crop
    hsv = cv2.cvtColor(torso, cv2.COLOR_BGR2HSV)
    mask = (hsv[:, :, 2] > 30) & (hsv[:, :, 1] > 30)
    pixels = hsv[mask]
    if pixels.shape[0] < 10:
        return None
    return pixels.mean(axis=0)

def assign_teams_with_referee(color_vectors):
    if len(color_vectors) < 2:
        return [0] * len(color_vectors), None
    stacked = np.vstack(color_vectors)
    scaler = StandardScaler()
    scaled = scaler.fit_transform(stacked)
    kmeans = KMeans(n_clusters=2, random_state=42, n_init=10).fit(scaled)
    labels = list(kmeans.labels_)

    centers = scaler.inverse_transform(kmeans.cluster_centers_)
    refined = []
    for i, (cv, lbl) in enumerate(zip(color_vectors, labels)):
        dist = np.linalg.norm(cv - centers[lbl])
        if dist > REFEREE_COLOR_DIST_THRESHOLD:
            refined.append("official")
        else:
            refined.append(str(lbl))
    return refined, centers

def process_video():
    if not VIDEO_PATH.exists():
        print(f"ERROR: Video not found at {VIDEO_PATH}", flush=True)
        return None

    print(f"Loading YOLOv8n...", flush=True)
    from ultralytics import YOLO
    model = YOLO("yolov8n.pt")

    cap = cv2.VideoCapture(str(VIDEO_PATH))
    if not cap.isOpened():
        print("ERROR: Cannot open video")
        return None

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    W, H = get_frame_size(cap)
    print(f"Video: {total_frames} frames at {fps:.0f} fps, {W}x{H}")

    team_zones = {"0": Counter(), "1": Counter()}
    team_totals = {"0": 0, "1": 0}
    officials = 0
    ball_zones = Counter()
    ball_total = 0

    frame_index = 0
    processed = 0

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break
        if frame_index % FRAME_SKIP != 0:
            frame_index += 1
            continue

        persons, balls = detect(frame, model)

        color_vectors = []
        person_data = []

        for box in persons:
            c = jersey_color(box, frame)
            if c is None:
                continue
            color_vectors.append(c)
            cx = (box[0] + box[2]) / 2.0
            cy = (box[1] + box[3]) / 2.0
            person_data.append((c, cx, cy, box))

        if len(color_vectors) >= 2:
            labels, centers = assign_teams_with_referee(color_vectors)
            for lbl, (c, cx, cy, box) in zip(labels, person_data):
                if lbl == "official":
                    officials += 1
                    continue
                h_label, v_label, hi, vi = zone_buckets(int(cx), int(cy), W, H)
                zone_key = f"{h_label}-{v_label}"
                team_zones[lbl][zone_key] += 1
                team_totals[lbl] += 1
        elif len(color_vectors) == 1:
            lbl = "0"
            _, cx, cy, box = person_data[0]
            h_label, v_label, hi, vi = zone_buckets(int(cx), int(cy), W, H)
            team_zones[lbl][f"{h_label}-{v_label}"] += 1
            team_totals[lbl] += 1

        for box in balls:
            cx = (box[0] + box[2]) / 2.0
            cy = (box[1] + box[3]) / 2.0
            h_label, v_label, hi, vi = zone_buckets(int(cx), int(cy), W, H)
            ball_zones[f"{h_label}-{v_label}"] += 1
            ball_total += 1

        processed += 1
        if processed % 20 == 0:
            print(f"  Processed {processed} frames ({frame_index}/{total_frames})")

        frame_index += 1

    cap.release()
    print(f"Done. Processed {processed} frames.")
    print(f"  Team A: {team_totals['0']} detections, Team B: {team_totals['1']} detections")
    print(f"  Officials filtered: {officials}")
    print(f"  Ball detections: {ball_total}")

    if team_totals["0"] == 0 and team_totals["1"] == 0:
        return None

    return {
        "team_zones": team_zones,
        "team_totals": team_totals,
        "officials": officials,
        "ball_zones": dict(ball_zones),
        "ball_total": ball_total,
        "total_frames_processed": processed,
    }

def zone_pct(zone_counter, total):
    if total == 0:
        return {}
    return {k: round(v / total * 100, 1) for k, v in zone_counter.items()}

def render_zones(data):
    W, H = 960, 600
    fig, ax = plt.subplots(figsize=(10, 6))
    fig.patch.set_facecolor("#0B1920")
    ax.set_facecolor("#0B1920")

    color_a = "#D9622B"
    color_b = "#5DA0FC"
    color_ball = "#FFD700"

    team_a_pct = zone_pct(data["team_zones"]["0"], data["team_totals"]["0"])
    team_b_pct = zone_pct(data["team_zones"]["1"], data["team_totals"]["1"])
    ball_pct = zone_pct(data["ball_zones"], data["ball_total"])

    z_w, z_h = W // 3, H // 3

    for vi, v_label in enumerate(ZONE_LABELS_V):
        for hi, h_label in enumerate(ZONE_LABELS_H):
            x0, y0 = hi * z_w, vi * z_h
            rect = FancyBboxPatch(
                (x0, y0), z_w, z_h,
                boxstyle="round,pad=0.05",
                facecolor="#112233",
                edgecolor="#334466",
                linewidth=1.5
            )
            ax.add_patch(rect)

            zone_key = f"{h_label}-{v_label}"
            a_pct = team_a_pct.get(zone_key, 0)
            b_pct = team_b_pct.get(zone_key, 0)
            b_p = ball_pct.get(zone_key, 0)

            ax.text(
                x0 + z_w / 2, y0 + z_h * 0.25,
                f"A: {a_pct}%",
                ha="center", va="center", fontsize=9, fontweight="bold",
                color=color_a
            )
            ax.text(
                x0 + z_w / 2, y0 + z_h * 0.50,
                f"B: {b_pct}%",
                ha="center", va="center", fontsize=9, fontweight="bold",
                color=color_b
            )
            if b_p > 0:
                ax.text(
                    x0 + z_w / 2, y0 + z_h * 0.75,
                    f"Ball {b_p}%",
                    ha="center", va="center", fontsize=8,
                    color=color_ball
                )

            if vi == 0:
                ax.text(
                    x0 + z_w / 2, y0 - 20,
                    h_label,
                    ha="center", va="bottom", fontsize=11, fontweight="bold",
                    color="white"
                )
        ax.text(
            W - 30, y0 + z_h / 2,
            v_label,
            ha="center", va="center", fontsize=11, fontweight="bold",
            color="white", rotation=90
        )

    ax.set_xlim(0, W)
    ax.set_ylim(H, 0)
    ax.axis("off")

    legend_text = (
        f"Team A  |  Team B  |  Officials filtered: {data['officials']}  |  "
        f"Frames: {data['total_frames_processed']}"
    )
    ax.text(
        W / 2, H + 15, legend_text,
        ha="center", va="top", fontsize=9, color="#8899AA"
    )

    fig.savefig(str(OUTPUT_IMAGE), dpi=200, bbox_inches="tight", facecolor="#0B1920")
    plt.close(fig)
    print(f"Saved: {OUTPUT_IMAGE}")

def generate_caption(data):
    if data["team_totals"]["0"] == 0 and data["team_totals"]["1"] == 0:
        caption = "No player positions could be reliably detected."
    else:
        lines = []
        for team_key, team_label in [("0", "A"), ("1", "B")]:
            total = data["team_totals"][team_key]
            if total == 0:
                lines.append(f"Team {team_label}: not detected.")
                continue
            pcts = zone_pct(data["team_zones"][team_key], total)
            top_zone = max(pcts, key=pcts.get)
            top_pct = pcts[top_zone]
            lines.append(
                f"Team {team_label}: most frequent in {top_zone} ({top_pct}% of {total} detections)."
            )

        ball_info = ""
        if data["ball_total"] > 0:
            bp = zone_pct(data["ball_zones"], data["ball_total"])
            top_b = max(bp, key=bp.get)
            ball_info = f" Ball most often in {top_b} ({bp[top_b]}%)."

        caption = " ".join(lines) + ball_info
        caption += f" Officials filtered: {data['officials']}."

    print(f"Caption: {caption}")
    with open(str(CAPTION_PATH), "w") as f:
        f.write(caption)
    return caption

def main():
    print("=" * 60)
    print("FULL BACK — Tactical Snapshot Pipeline (Zone-Bucket)")
    print("=" * 60)

    data = process_video()
    if data is None:
        print("No detections found.")
        caption = "The pipeline could not detect any players."
        with open(str(CAPTION_PATH), "w") as f:
            f.write(caption)
        return

    render_zones(data)
    generate_caption(data)

    print("\nDone. Output files:")
    print(f"  Image:    {OUTPUT_IMAGE}")
    print(f"  Caption:  {CAPTION_PATH}")

if __name__ == "__main__":
    main()
