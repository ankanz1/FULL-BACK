import os, cv2, numpy as np
from pathlib import Path
from collections import defaultdict
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

ROOT_DIR = Path(__file__).resolve().parent
PUBLIC_DIR = ROOT_DIR / "public"
VIDEO_PATH = PUBLIC_DIR / "Asset_Video.mp4"
HOMOGRAPHY_H_PATH = PUBLIC_DIR / "homography_H.npy"
OUTPUT_IMAGE = PUBLIC_DIR / "tactical_analyst.png"
CAPTION_PATH = PUBLIC_DIR / "tactical_analyst_caption.txt"

FRAME_SKIP = 30
CONF_THRESH = 0.35

PITCH_LENGTH = 105.0
PITCH_WIDTH = 68.0

COCO_PERSON = 0
COCO_BALL = 32


class TacticalAnalyst:
    def __init__(self, model=None):
        self.model = model
        self.H = None
        self.H_inv = None
        self._load_homography()

    def _load_homography(self):
        if HOMOGRAPHY_H_PATH.exists():
            self.H = np.load(str(HOMOGRAPHY_H_PATH))
            self.H_inv = np.linalg.inv(self.H)
            print(f"Loaded homography from {HOMOGRAPHY_H_PATH}")
        else:
            print("WARNING: homography matrix not found")

    def image_to_pitch(self, img_x, img_y):
        if self.H_inv is None:
            return None, None
        pt = self.H_inv @ np.array([img_x, img_y, 1.0])
        return float(pt[0] / pt[2]), float(pt[1] / pt[2])

    def detect(self, frame):
        if self.model is None:
            return np.zeros((0, 6)), np.zeros((0, 4))
        results = self.model(frame, conf=CONF_THRESH, verbose=False)[0]
        persons, balls = [], []
        if results.boxes is not None and len(results.boxes) > 0:
            for xyxy, conf, cls in zip(
                results.boxes.xyxy.cpu().numpy(),
                results.boxes.conf.cpu().numpy(),
                results.boxes.cls.cpu().numpy().astype(int)
            ):
                if cls == COCO_PERSON and conf >= CONF_THRESH:
                    persons.append([*xyxy, conf, cls])
                elif cls == COCO_BALL and conf >= CONF_THRESH * 0.8:
                    balls.append(xyxy)
        return np.array(persons) if persons else np.zeros((0, 6)), np.array(balls) if balls else np.zeros((0, 4))

    def jersey_color(self, box, frame):
        x1, y1, x2, y2 = map(int, box[:4])
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

    def assign_teams_batch(self, color_vectors):
        if len(color_vectors) < 2:
            return [0] * len(color_vectors)
        stacked = np.vstack(color_vectors)
        scaler = StandardScaler()
        scaled = scaler.fit_transform(stacked)
        kmeans = KMeans(n_clusters=2, random_state=42, n_init=10).fit(scaled)
        labels = list(kmeans.labels_)
        centers = scaler.inverse_transform(kmeans.cluster_centers_)
        refined = []
        for i, cv in enumerate(color_vectors):
            dist = np.linalg.norm(cv - centers[labels[i]])
            refined.append(-1 if dist > 40.0 else int(labels[i]))
        return refined

    def detect_formation(self, pitch_positions):
        if len(pitch_positions) < 4:
            return "Unknown"
        X = np.array(pitch_positions)
        n_clusters = min(max(len(X) // 4, 2), 5)
        kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=5).fit(X)
        sorted_clusters = sorted(
            [(kmeans.cluster_centers_[i], int(np.sum(kmeans.labels_ == i)))
             for i in range(n_clusters)],
            key=lambda x: x[0][1]
        )
        line_counts = [c[1] for c in sorted_clusters]
        return "-".join(map(str, line_counts))

    def process_video(self):
        if not VIDEO_PATH.exists():
            print(f"ERROR: Video not found at {VIDEO_PATH}")
            return None

        if self.model is None:
            from ultralytics import YOLO
            model_path = ROOT_DIR / "models" / "football-detector" / "train" / "weights" / "best.pt"
            if model_path.exists():
                print(f"Loading football-specific model from {model_path}")
                self.model = YOLO(str(model_path))
            else:
                print("Loading base YOLOv8n")
                self.model = YOLO(str(ROOT_DIR / "yolov8n.pt"))

        cap = cv2.VideoCapture(str(VIDEO_PATH))
        if not cap.isOpened():
            print("ERROR: Cannot open video")
            return None

        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = cap.get(cv2.CAP_PROP_FPS)
        W = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        H = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        print(f"Video: {total_frames} frames, {fps:.0f} fps, {W}x{H}")

        frame_colors = defaultdict(list)
        team_positions = {0: [], 1: []}
        ball_positions = []
        frame_count = 0

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
            if frame_count % FRAME_SKIP != 0:
                frame_count += 1
                continue

            persons, balls = self.detect(frame)
            for i, box in enumerate(persons):
                c = self.jersey_color(box, frame)
                if c is None:
                    continue
                cx = (box[0] + box[2]) / 2.0
                cy = (box[1] + box[3]) / 2.0
                frame_colors[i].append((c, cx, cy))

            for box in balls:
                cx = (box[0] + box[2]) / 2.0
                cy = (box[1] + box[3]) / 2.0
                px, py = self.image_to_pitch(cx, cy)
                if px is not None:
                    ball_positions.append((px, py))

            if frame_count % 100 == 0:
                print(f"  Frame {frame_count}/{total_frames}")

            frame_count += 1

        cap.release()
        print(f"Processed {frame_count} frames")
        print(f"  Detected {len(frame_colors)} player tracks ({sum(len(v) for v in frame_colors.values())} total detections)")

        if len(frame_colors) < 2:
            print("Not enough players detected")
            return None

        avg_colors = [np.mean([c[0] for c in colors], axis=0) for colors in frame_colors.values()]
        team_labels = self.assign_teams_batch(avg_colors)
        track_teams = {}
        for idx, tid in enumerate(frame_colors.keys()):
            track_teams[tid] = team_labels[idx]

        print(f"  Team A: {sum(1 for t in team_labels if t == 0)} players")
        print(f"  Team B: {sum(1 for t in team_labels if t == 1)} players")
        print(f"  Officials/ambig: {sum(1 for t in team_labels if t == -1)}")

        for idx, tid in enumerate(frame_colors.keys()):
            if tid not in track_teams or track_teams[tid] < 0:
                continue
            for _c, cx, cy in frame_colors[tid]:
                px, py = self.image_to_pitch(cx, cy)
                if px is not None:
                    team_positions[track_teams[tid]].append((px, py))

        formations = {}
        for team in [0, 1]:
            n = len(team_positions[team])
            formations[team] = self.detect_formation(team_positions[team]) if n >= 4 else "Insufficient data"
            print(f"  Team {'A' if team == 0 else 'B'}: {n} positions, formation {formations[team]}")

        return {
            "team_positions": team_positions,
            "ball_positions": ball_positions,
            "formations": formations,
            "team_counts": {0: len(team_positions[0]), 1: len(team_positions[1])},
            "ball_count": len(ball_positions),
            "team_players": {0: sum(1 for t in team_labels if t == 0),
                             1: sum(1 for t in team_labels if t == 1)},
        }

    def render_pitch(self, data):
        fig, ax = plt.subplots(figsize=(12, 8))
        fig.patch.set_facecolor("#0B1920")
        ax.set_facecolor("#0B1920")

        pl, pw = PITCH_LENGTH, PITCH_WIDTH

        ax.plot([0, 0, pl, pl, 0], [0, pw, pw, 0, 0], color="white", lw=2, alpha=0.4)
        ax.plot([pl/2, pl/2], [0, pw], color="white", lw=2, alpha=0.4)
        ax.add_patch(plt.Circle((pl/2, pw/2), 9.15, color="white", fill=False, lw=2, alpha=0.4))

        for x0 in [0, pl - 5.5]:
            ax.add_patch(plt.Rectangle((x0, pw/2 - 11), 5.5, 22, color="white", fill=False, lw=2, alpha=0.4))
        for x0 in [0, pl - 2]:
            ax.add_patch(plt.Rectangle((x0, pw/2 - 7.32), 2, 14.64, color="white", fill=False, lw=2, alpha=0.4))

        color_a, color_b, color_ball = "#D9622B", "#5DA0FC", "#FFD700"

        for team in [0, 1]:
            positions = data["team_positions"][team]
            if len(positions) < 2:
                continue
            xs = [p[0] for p in positions]
            ys = [p[1] for p in positions]
            color = color_a if team == 0 else color_b
            ax.scatter(xs, ys, c=color, s=12, alpha=0.35, zorder=3)

            pos_arr = np.array(positions)
            if len(pos_arr) >= 8:
                k = min(4, len(pos_arr) // 4)
                kmeans = KMeans(n_clusters=k, random_state=42, n_init=5).fit(pos_arr)
                for center in kmeans.cluster_centers_:
                    ax.scatter(center[0], center[1], c=color, s=80, alpha=0.7,
                               zorder=5, marker='s', edgecolors='white', linewidth=1)

        if len(data["ball_positions"]) > 0:
            bxs = [p[0] for p in data["ball_positions"]]
            bys = [p[1] for p in data["ball_positions"]]
            ax.scatter(bxs, bys, c=color_ball, s=6, alpha=0.5, zorder=4)

        ax.set_xlim(-5, pl + 5)
        ax.set_ylim(-5, pw + 5)
        ax.set_aspect('equal')
        ax.axis("off")

        for team in [0, 1]:
            label = f"Team {'A' if team == 0 else 'B'}: {data['formations'][team]}"
            y_pos = pw + 3 + team * 3
            color = color_a if team == 0 else color_b
            ax.text(pl / 2, y_pos, label, ha="center", va="bottom",
                    fontsize=11, fontweight="bold", color=color, fontfamily='monospace')

        info = (f"Team A: {data['team_counts'][0]} dets ({data['team_players'][0]} players)  |  "
                f"Team B: {data['team_counts'][1]} dets ({data['team_players'][1]} players)  |  "
                f"Ball: {data['ball_count']} dets")
        ax.text(pl / 2, -3, info, ha="center", va="top",
                fontsize=9, color="#8899AA", fontfamily='monospace')

        fig.savefig(str(OUTPUT_IMAGE), dpi=200, bbox_inches="tight", facecolor="#0B1920")
        plt.close(fig)
        print(f"Saved: {OUTPUT_IMAGE}")

    def generate_caption(self, data):
        lines = []
        for team in [0, 1]:
            label = "A" if team == 0 else "B"
            lines.append(f"Team {label}: {data['formations'][team]} ({data['team_counts'][team]} samples, {data['team_players'][team]} players detected).")
        if data["ball_count"] > 0:
            xs = [p[0] for p in data["ball_positions"]]
            avg_x = np.mean(xs)
            if avg_x < PITCH_LENGTH / 3:
                zone = "defensive third"
            elif avg_x < PITCH_LENGTH * 2 / 3:
                zone = "middle third"
            else:
                zone = "attacking third"
            lines.append(f"Ball predominantly in {zone}.")
        caption = " ".join(lines)
        with open(str(CAPTION_PATH), "w") as f:
            f.write(caption)
        return caption

    def run(self):
        print("=" * 60)
        print("FULL BACK — Tactical Analyst Pipeline")
        print("=" * 60)
        data = self.process_video()
        if data is None:
            caption = "Pipeline could not detect any players."
            with open(str(CAPTION_PATH), "w") as f:
                f.write(caption)
            return None
        self.render_pitch(data)
        self.generate_caption(data)
        print(f"\nOutput: {OUTPUT_IMAGE}")
        return data


if __name__ == "__main__":
    TacticalAnalyst().run()
