#!/usr/bin/env python3
"""
build-brain-glb.py
------------------
Build the interactive 3D brain for the research hero.

Fetches the fsaverage5 human cortex pial surface + Destrieux parcellation
via nilearn, splits the cortex into 4 anatomical lobes (frontal, parietal,
occipital, temporal), adds primitive meshes for cerebellum and brainstem,
and exports a single GLB to `assets/connectome.glb` with 6 named nodes
matching the page's research-interest anchors.

Run from the project root:
    tools/.venv/bin/python tools/build-brain-glb.py
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import trimesh
import nibabel as nib  # noqa: F401  (nilearn dep, also useful directly)
from nilearn import datasets, surface

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "connectome.glb"

# Per-region triangle budget after decimation. Keep enough detail in the
# cortical lobes so gyri/sulci ridges read through the wireframe overlay.
TARGET_TRIS = 70000


# Destrieux 2009 region name → anatomical lobe.
# Names follow the `aparc.a2009s` convention: "G_..." (gyrus), "S_..." (sulcus),
# "Pole_..." (pole), "Lat_Fis-..." (lateral fissure), etc.
# Anything not listed here gets dropped (the corpus callosum / "Medial_wall"
# label, mostly). Cingulate is split: anterior → frontal, posterior → parietal.
LOBE_PREFIXES = {
    "frontal": (
        "G_front_", "G_subcallosal", "G_orbital", "G_rectus",
        "G_and_S_paracentral", "G_and_S_subcentral",
        "G_and_S_cingul-Ant", "G_and_S_cingul-Mid-Ant",
        "G_and_S_cingul-Mid-Post",
        "G_precentral", "S_precentral",
        "S_front_", "S_orbital", "S_suborbital", "S_subparietal",
        "S_pericallosal",
        "Lat_Fis-ant",
        "Pole_frontal",
    ),
    "parietal": (
        "G_pariet_", "G_parietal_sup", "G_postcentral", "S_postcentral",
        "G_precuneus", "S_intrapariet",
        "G_and_S_cingul-Post", "S_cingul-Marginalis",
        "S_parieto_occipital",
    ),
    "occipital": (
        "G_occipital", "G_oc-temp_med-Lingual", "G_cuneus", "S_oc",
        "S_calcarine", "S_collat_transv_post",
        "Pole_occipital",
    ),
    "temporal": (
        "G_temporal", "G_temp_sup", "S_temporal", "S_oc-temp",
        "G_oc-temp_lat", "G_oc-temp_med-Parahip", "G_insular",
        "S_circular_insula", "S_interm_prim-Jensen",
        "G_Ins_lg_and_S_cent_ins", "Lat_Fis-post",
        "Pole_temporal",
    ),
}


def lobe_for(label_name: str) -> str | None:
    for lobe, prefixes in LOBE_PREFIXES.items():
        for p in prefixes:
            if label_name.startswith(p):
                return lobe
    return None


def submesh(verts: np.ndarray, faces: np.ndarray, vert_mask: np.ndarray) -> trimesh.Trimesh:
    """Keep faces with ≥2 verts in the mask; rebuild compact mesh."""
    face_mask = vert_mask[faces].sum(axis=1) >= 2
    sub_faces = faces[face_mask]
    used = np.unique(sub_faces.ravel())
    remap = -np.ones(len(verts), dtype=np.int64)
    remap[used] = np.arange(len(used))
    sub_faces = remap[sub_faces]
    return trimesh.Trimesh(vertices=verts[used], faces=sub_faces, process=False)


def make_cerebellum(center: np.ndarray, radii: np.ndarray) -> trimesh.Trimesh:
    """Squashed ellipsoid for cerebellum."""
    s = trimesh.creation.icosphere(subdivisions=4, radius=1.0)
    # Add gentle radial wrinkle so it doesn't look like a perfect sphere
    # under the wireframe overlay.
    v = s.vertices
    r = np.linalg.norm(v, axis=1, keepdims=True)
    n = v / r
    wrinkle = 0.04 * np.sin(8 * np.arctan2(v[:, 0], v[:, 2]))[:, None]
    s.vertices = (n * (1.0 + wrinkle)) * radii + center
    return s


def make_brainstem(top: np.ndarray, bottom: np.ndarray, radius: float) -> trimesh.Trimesh:
    """Capsule from top to bottom; tapered slightly so it's not a pipe."""
    direction = top - bottom
    height = float(np.linalg.norm(direction))
    cyl = trimesh.creation.cylinder(radius=radius, height=height, sections=24)
    # Taper top vs bottom to suggest pons/medulla shape
    z = cyl.vertices[:, 2]
    zmin, zmax = z.min(), z.max()
    t = (z - zmin) / (zmax - zmin + 1e-9)
    # narrower near top
    taper = 1.0 - 0.25 * t
    cyl.vertices[:, 0] *= taper
    cyl.vertices[:, 1] *= taper
    # Align +Z to (top - bottom)
    align = trimesh.geometry.align_vectors(
        np.array([0.0, 0.0, 1.0]), direction / (height + 1e-9)
    )
    cyl.apply_transform(align)
    cyl.apply_translation(((top + bottom) / 2).tolist())
    return cyl


def main() -> None:
    print("Fetching fsaverage5 + Destrieux surface parcellation via nilearn...")
    parcel = datasets.fetch_atlas_surf_destrieux()
    fsavg = datasets.fetch_surf_fsaverage("fsaverage5")

    # labels: list of bytes/str, one per Destrieux ROI
    labels = [
        n.decode() if isinstance(n, (bytes, bytearray)) else n for n in parcel["labels"]
    ]
    map_l = np.asarray(parcel["map_left"])
    map_r = np.asarray(parcel["map_right"])

    # Pial surfaces — anatomically realistic (gyri + sulci preserved)
    coords_l, faces_l = surface.load_surf_mesh(fsavg["pial_left"])
    coords_r, faces_r = surface.load_surf_mesh(fsavg["pial_right"])
    coords_l = np.asarray(coords_l)
    coords_r = np.asarray(coords_r)
    faces_l = np.asarray(faces_l)
    faces_r = np.asarray(faces_r)

    # Per-vertex lobe assignment
    def vert_lobes(label_map: np.ndarray) -> dict[str, np.ndarray]:
        masks = {lobe: np.zeros(len(label_map), dtype=bool) for lobe in LOBE_PREFIXES}
        for idx, name in enumerate(labels):
            lobe = lobe_for(name)
            if lobe is None:
                continue
            masks[lobe] |= label_map == idx
        return masks

    masks_l = vert_lobes(map_l)
    masks_r = vert_lobes(map_r)

    print("Splitting cortex into 4 lobes...")
    lobe_meshes: dict[str, trimesh.Trimesh] = {}
    for lobe in LOBE_PREFIXES:
        m_l = submesh(coords_l, faces_l, masks_l[lobe])
        m_r = submesh(coords_r, faces_r, masks_r[lobe])
        m = trimesh.util.concatenate([m_l, m_r])
        m.process(validate=False)
        lobe_meshes[lobe] = m
        print(f"  {lobe:9s}  {len(m.vertices):6d} verts  {len(m.faces):6d} tris")

    # Position cerebellum + brainstem relative to cortex bounds.
    # fsaverage uses RAS-like coords: +X right, +Y anterior, +Z superior.
    all_v = np.concatenate([m.vertices for m in lobe_meshes.values()])
    bmin = all_v.min(axis=0)
    bmax = all_v.max(axis=0)
    extent = float((bmax - bmin).max())
    cx = (bmin[0] + bmax[0]) / 2

    # Cerebellum sits below + behind the cortex (negative Y, negative Z),
    # roughly centered on the midline. Flatter than before so the overall
    # silhouette stays cortex-dominated.
    cb_center = np.array(
        [cx, bmin[1] + 0.20 * extent, bmin[2] + 0.02 * extent]
    )
    cb_radii = np.array([0.26 * extent, 0.17 * extent, 0.12 * extent])
    cerebellum = make_cerebellum(cb_center, cb_radii)

    # Brainstem: short tapered capsule tucked under the cerebellum. Kept
    # intentionally small so it doesn't dominate the silhouette.
    bs_top = cb_center + np.array([0.0, 0.02 * extent, -0.02 * extent])
    bs_bot = cb_center + np.array([0.0, -0.03 * extent, -0.13 * extent])
    brainstem = make_brainstem(bs_top, bs_bot, 0.038 * extent)

    regions: dict[str, trimesh.Trimesh] = {
        **lobe_meshes,
        "cerebellum": cerebellum,
        "brainstem": brainstem,
    }

    # Center + normalize so the GLB drops straight into [-1, 1] in the scene.
    all_v = np.concatenate([m.vertices for m in regions.values()])
    c = (all_v.min(0) + all_v.max(0)) / 2
    scale = 2.0 / float((all_v.max(0) - all_v.min(0)).max())

    raw_tris = sum(len(m.faces) for m in regions.values())
    print(f"Raw triangles: {raw_tris:,}")

    print(f"Decimating to ~{TARGET_TRIS:,} tris total...")
    decimated: dict[str, trimesh.Trimesh] = {}
    for name, m in regions.items():
        share = max(int(TARGET_TRIS * len(m.faces) / raw_tris), 300)
        if len(m.faces) > share:
            try:
                m = m.simplify_quadric_decimation(share)
            except Exception as exc:
                print(f"  [{name}] decimate failed ({exc}); keeping raw")
        m.vertices = (m.vertices - c) * scale
        m.visual = trimesh.visual.ColorVisuals(
            m,
            vertex_colors=np.tile([255, 255, 255, 255], (len(m.vertices), 1)),
        )
        decimated[name] = m

    new_tris = sum(len(m.faces) for m in decimated.values())
    print(f"Decimated triangles: {new_tris:,}")

    scene = trimesh.Scene()
    for name, m in decimated.items():
        # node_name lets the Three.js side identify regions for hover glow.
        scene.add_geometry(m, node_name=name, geom_name=name)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    print(f"Exporting → {OUT}")
    scene.export(str(OUT))
    size_kb = OUT.stat().st_size // 1024
    print(f"Done. {size_kb} KB ({new_tris:,} tris)")


if __name__ == "__main__":
    main()
