#!/usr/bin/env python3
"""
build-connectome-video.py
-------------------------
Fetches the FlyWire whole-brain neuropil meshes, renders a 360° turntable
animation, and writes it to assets/connectome-loop.mp4.

One-shot run from the project root:
    python3 tools/build-connectome-video.py

The script installs its own Python dependencies on first run.
Requires `ffmpeg` on PATH (brew install ffmpeg).
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "connectome-loop.mp4"
POSTER = ROOT / "assets" / "connectome-poster.jpg"

FRAMES = 120        # 8 seconds at 15fps; one full revolution
FPS = 15
RES = (1600, 900)   # 16:9 video
ELEV = 12           # camera elevation in degrees above the equator
ORBIT_RADIUS_FACTOR = 2.4  # higher = farther camera; 2.0–3.0 looks natural

# Number of individual neurons to overlay on top of the neuropil shells.
# Set to 0 to skip and just render the smooth shells.
# Requires a CAVE token — see tools/README.md for setup.
NEURON_SAMPLE = 800

DEPS = [
    "fafbseg",
    "navis",
    "pyvista",
    "trimesh",
    "imageio[ffmpeg]",
    "numpy",
]


def ensure_deps() -> None:
    """Install runtime dependencies on first run."""
    try:
        import pyvista  # noqa: F401
        import fafbseg  # noqa: F401
        return
    except ImportError:
        pass
    print("Installing Python dependencies (one-time, ~3 min)...")
    subprocess.check_call(
        [sys.executable, "-m", "pip", "install", "--quiet", *DEPS]
    )


def check_ffmpeg() -> None:
    try:
        subprocess.check_output(["ffmpeg", "-version"], stderr=subprocess.STDOUT)
    except (FileNotFoundError, subprocess.CalledProcessError):
        sys.exit(
            "ERROR: ffmpeg not found on PATH.\n"
            "Install it (macOS): brew install ffmpeg"
        )


def fetch_meshes():
    """Return a list of trimesh.Trimesh — one per FlyWire neuropil region."""
    from fafbseg import flywire

    print("Fetching FlyWire neuropil meshes (public data, no auth)...")
    # Pull the list of all available neuropil names from the helper,
    # then fetch all of them. (`get_neuropil_volumes` takes a name or list.)
    try:
        # Probe with a known-good single region to surface the full available list.
        try:
            flywire.get_neuropil_volumes("__list__")
            names = []
        except Exception as e:
            msg = str(e)
            # The error message enumerates available neuropils — parse it.
            if "Available neuropils:" in msg:
                names = [
                    n.strip()
                    for n in msg.split("Available neuropils:", 1)[1].split(",")
                    if n.strip()
                ]
            else:
                raise
        print(f"  region count: {len(names)}")
        vols = flywire.get_neuropil_volumes(names)
    except Exception as exc:
        sys.exit(
            f"ERROR: failed to fetch FlyWire neuropils: {exc}\n"
            "If this is a CAVE auth error, run:\n"
            "  python -c 'import cloudvolume; cloudvolume.secrets.cave_credentials.add_token(\"flywire\", \"YOUR_TOKEN\")'\n"
            "Get a token from https://global.daf-apis.com/auth/api/v1/create_token"
        )

    if not isinstance(vols, list):
        vols = [vols]


def fetch_neuron_skeletons(n: int):
    """Try to fetch `n` random neuron skeletons from FlyWire.

    Requires a CAVE token. Returns a list of skeleton objects, or None
    if the token isn't configured."""
    if n <= 0:
        return None
    from fafbseg import flywire
    import navis

    try:
        flywire.get_chunkedgraph_secret()
    except Exception:
        print(
            "\n[neurons] No CAVE token configured — skipping neuron overlay.\n"
            "To add individual neurons (recommended for the FlyWire 'wiring' look):\n"
            "  1. Register at https://global.daf-apis.com/auth/api/v1/create_token\n"
            "  2. Run: tools/.venv/bin/python -c 'from fafbseg import flywire; flywire.set_chunkedgraph_secret(\"YOUR_TOKEN\")'\n"
            "  3. Re-run this script.\n"
        )
        return None

    print(f"[neurons] Sampling {n} neurons from FlyWire annotations...")
    try:
        # The hierarchical annotations table doesn't depend on the
        # materialize service (which can be flaky); it returns ~139k
        # neurons with root_ids and soma positions.
        df = flywire.get_hierarchical_annotations(verbose=False)
    except Exception as exc:
        print(f"[neurons] couldn't list annotations: {exc}")
        return None

    if "root_id" not in df.columns:
        print(f"[neurons] unexpected annotation columns: {list(df.columns)[:8]}")
        return None

    ids = df["root_id"].dropna().astype("int64").drop_duplicates().sample(
        min(n, len(df)), random_state=42
    ).tolist()
    print(f"[neurons] fetching {len(ids)} L2 skeletons (this can take a few minutes)...")
    try:
        skels = flywire.get_l2_skeleton(
            ids, refine=False, omit_failures=True, progress=True
        )
    except Exception as exc:
        print(f"[neurons] skeleton fetch failed: {exc}")
        return None

    if not isinstance(skels, list) and hasattr(skels, "__iter__"):
        # navis.NeuronList → list
        try:
            skels = list(skels)
        except Exception:
            skels = [skels]
    elif not isinstance(skels, list):
        skels = [skels]
    print(f"[neurons] got {len(skels)} skeletons")
    return skels

    meshes = []
    for v in vols:
        # navis Volume → trimesh
        if hasattr(v, "to_trimesh"):
            meshes.append(v.to_trimesh())
        else:
            meshes.append(v)
    print(f"  fetched {len(meshes)} regions")
    return meshes


def render(meshes, skeletons=None) -> None:
    import numpy as np
    import pyvista as pv

    # Solid black background — the page uses CSS `mix-blend-mode: lighten`
    # so anything darker than the page bg disappears automatically.
    pv.global_theme.background = "black"
    pv.global_theme.transparent_background = False

    plotter = pv.Plotter(off_screen=True, window_size=RES)

    # Neuropil shells: render as a faint envelope so the neurons inside
    # are the visual focus. (Without skeletons, bump the opacity up so the
    # shells alone are still legible.)
    shell_opacity = 0.06 if skeletons else 0.18
    for m in meshes:
        pmesh = pv.wrap(m)
        plotter.add_mesh(
            pmesh,
            color="white",
            opacity=shell_opacity,
            smooth_shading=True,
            specular=0.6,
            specular_power=20,
            ambient=0.25,
            diffuse=0.85,
        )

    # Neuron skeletons: render as thin bright white polylines.
    if skeletons:
        print(f"[neurons] adding {len(skeletons)} skeleton overlays to scene")
        line_count = 0
        for sk in skeletons:
            try:
                # navis.TreeNeuron: nodes DataFrame with node_id/parent_id, x/y/z
                nodes = sk.nodes if hasattr(sk, "nodes") else None
                if nodes is None or len(nodes) == 0:
                    continue
                # Build a node_id -> row_index map
                id_to_idx = {nid: i for i, nid in enumerate(nodes["node_id"].values)}
                pts = nodes[["x", "y", "z"]].to_numpy(dtype=np.float32)
                # Edge list from parent_id (-1 means root)
                parents = nodes["parent_id"].to_numpy()
                edges = []
                for i, p in enumerate(parents):
                    if p in id_to_idx:
                        edges.append((i, id_to_idx[p]))
                if not edges:
                    continue
                # pyvista PolyData lines need [2, i, j, 2, k, l, ...]
                lines = np.empty((len(edges), 3), dtype=np.int64)
                lines[:, 0] = 2
                lines[:, 1:3] = edges
                poly = pv.PolyData(pts)
                poly.lines = lines.ravel()
                plotter.add_mesh(
                    poly,
                    color="white",
                    line_width=0.6,
                    opacity=0.45,
                    render_lines_as_tubes=False,
                )
                line_count += len(edges)
            except Exception as exc:
                # Skip malformed skeletons silently — one bad neuron shouldn't fail the render.
                continue
        print(f"[neurons] added {line_count} line segments total")

    # Subtle bloom-ish look via screen-space tweaks.
    plotter.enable_anti_aliasing("ssaa")
    plotter.enable_eye_dome_lighting()

    # Camera path: orbit around the centroid at fixed elevation.
    plotter.reset_camera()
    bounds = plotter.bounds  # (xmin, xmax, ymin, ymax, zmin, zmax)
    cx = (bounds[0] + bounds[1]) / 2
    cy = (bounds[2] + bounds[3]) / 2
    cz = (bounds[4] + bounds[5]) / 2
    extent = max(
        bounds[1] - bounds[0],
        bounds[3] - bounds[2],
        bounds[5] - bounds[4],
    )
    radius = extent * ORBIT_RADIUS_FACTOR / 2

    OUT.parent.mkdir(parents=True, exist_ok=True)
    print(f"Rendering {FRAMES} frames → {OUT}")
    plotter.open_movie(str(OUT), framerate=FPS, quality=8)

    elev_rad = np.deg2rad(ELEV)
    poster_written = False
    for i in range(FRAMES):
        theta = (i / FRAMES) * 2 * np.pi
        ex = cx + radius * np.cos(theta) * np.cos(elev_rad)
        ey = cy + radius * np.sin(theta) * np.cos(elev_rad)
        ez = cz + radius * np.sin(elev_rad)
        plotter.camera.position = (ex, ey, ez)
        plotter.camera.focal_point = (cx, cy, cz)
        plotter.camera.up = (0, 0, 1)
        plotter.write_frame()

        if not poster_written and i == FRAMES // 8:
            plotter.screenshot(str(POSTER), transparent_background=False)
            poster_written = True

        if (i + 1) % 15 == 0 or i == FRAMES - 1:
            print(f"  frame {i + 1}/{FRAMES}")

    plotter.close()


def main() -> None:
    ensure_deps()
    check_ffmpeg()
    meshes = fetch_meshes()
    skeletons = fetch_neuron_skeletons(NEURON_SAMPLE)
    render(meshes, skeletons=skeletons)
    print(f"\nDone.\n  video:  {OUT}\n  poster: {POSTER}")


if __name__ == "__main__":
    main()
