#!/usr/bin/env python3
"""
build-connectome-glb.py
-----------------------
Fetches the FlyWire whole-brain neuropil meshes, decimates them, and
exports a single Draco-friendly GLB to `assets/connectome.glb` for the
interactive Three.js hero.

Run from the project root:
    tools/.venv/bin/python tools/build-connectome-glb.py
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "connectome.glb"

# Target ~50k triangles total — browser-friendly, hits 60fps easily.
TARGET_TRIS = 50000


def fetch_meshes():
    from fafbseg import flywire

    print("Fetching FlyWire neuropil meshes (public, no auth required)...")
    try:
        flywire.get_neuropil_volumes("__list__")
        names = []
    except Exception as e:
        msg = str(e)
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
    if not isinstance(vols, list):
        vols = [vols]
    out = []
    for v in vols:
        m = v.to_trimesh() if hasattr(v, "to_trimesh") else v
        out.append((getattr(v, "name", None) or f"region_{len(out):02d}", m))
    return out


def main() -> None:
    import numpy as np
    import trimesh

    pairs = fetch_meshes()
    raw_tris = sum(len(m.faces) for _, m in pairs)
    print(f"  raw triangles: {raw_tris:,}")

    # Compute combined bounds for centering + normalization.
    all_verts = np.concatenate([m.vertices for _, m in pairs])
    bounds_min = all_verts.min(axis=0)
    bounds_max = all_verts.max(axis=0)
    center = (bounds_min + bounds_max) / 2.0
    extent = float((bounds_max - bounds_min).max())
    scale = 2.0 / extent  # normalize to fit within [-1, 1] roughly

    print(f"Decimating to ~{TARGET_TRIS:,} triangles total...")
    decimated = []
    for name, m in pairs:
        share = max(int(TARGET_TRIS * len(m.faces) / raw_tris), 64)
        if len(m.faces) > share:
            try:
                m = m.simplify_quadric_decimation(share)
            except Exception as exc:
                print(f"  [{name}] decimate failed ({exc}); using raw mesh")
        # Center + normalize. The Three.js scene then doesn't need to scale.
        m.vertices = (m.vertices - center) * scale
        # Flat white vertex colors so the glTF can ship without a texture.
        m.visual = trimesh.visual.ColorVisuals(
            m, vertex_colors=np.tile([255, 255, 255, 255], (len(m.vertices), 1))
        )
        decimated.append((name, m))

    new_tris = sum(len(m.faces) for _, m in decimated)
    print(f"  decimated triangles: {new_tris:,}")

    # Pack into a single Scene with named nodes (so raycast can identify
    # the region by name later if we want region-level interactivity).
    scene = trimesh.Scene()
    for name, m in decimated:
        scene.add_geometry(m, node_name=name)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    print(f"Exporting → {OUT}")
    scene.export(str(OUT))
    size_kb = OUT.stat().st_size // 1024
    print(f"Done. {size_kb} KB ({new_tris:,} tris)")


if __name__ == "__main__":
    main()
