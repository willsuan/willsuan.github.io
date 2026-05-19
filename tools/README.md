# tools/

Automation scripts for site assets.

## build-connectome-video.py

Renders a 360° turntable of the FlyWire whole-brain neuropil mesh to
`assets/connectome-loop.mp4` (and a still poster to
`assets/connectome-poster.jpg`).

### Prerequisites

- macOS or Linux
- `ffmpeg` on PATH — `brew install ffmpeg`
- Python **3.11 or 3.12** recommended (pyvista/VTK wheels may not exist on 3.14 yet)

### One-shot run

```sh
python3 tools/build-connectome-video.py
```

First run pip-installs `fafbseg`, `navis`, `pyvista`, `trimesh`, `imageio`.
Subsequent runs reuse the install.

### Tuning

Edit the constants at the top of the script:

| const                  | default        | what                       |
|------------------------|----------------|----------------------------|
| `FRAMES`               | `120`          | total frames (×1/`FPS` = duration) |
| `FPS`                  | `15`           | output frame rate          |
| `RES`                  | `(1600, 900)`  | output resolution          |
| `ELEV`                 | `12`           | camera elevation, degrees  |
| `ORBIT_RADIUS_FACTOR`  | `2.4`          | camera distance multiplier |

### Troubleshooting

- **CAVE auth error fetching meshes** — the FlyWire neuropil *volumes* are
  public and shouldn't require auth, but if the API errors, follow the
  prompt the script prints to register a token at
  https://global.daf-apis.com/auth/api/v1/create_token.
- **VTK install fails on Python 3.14** — install Python 3.12 via
  pyenv or homebrew, then `python3.12 tools/build-connectome-video.py`.
- **Black frames / nothing rendered** — pyvista off-screen needs an OpenGL
  context. Should work out of the box on macOS; on a headless Linux box
  you may need `xvfb-run`.
