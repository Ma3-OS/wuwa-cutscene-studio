# Subtitle Specifications & Ruby Typography Engine

This document provides the technical specifications, mathematical calibration formulas, and rendering parameters for the subtitle generation engine in **WuWa Cutscene Studio**.

---

## 1. Subtitle Format & Header Specifications

Subtitles are generated dynamically in **Advanced SubStation Alpha v4.00+ (`.ass`)** format. This format is selected for its sub-pixel coordinate positioning capabilities, granular outline and shadow controls, and multi-layer rendering support via FFmpeg's `libass` filter.

### ASS Header Definition (`[Script Info]`)
```ini
[Script Info]
Title: WuWa Cutscene Subtitles
ScriptType: v4.00+
WrapStyle: 1
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709
PlayResX: 1920
PlayResY: 1080
```

### Critical Header Configurations
1. **`WrapStyle: 1` (End-of-Line Wrapping):**
   - Standard `WrapStyle: 0` (Smart Wrapping) attempts to divide sentences into two lines of equal length.
   - In-game Unreal Engine typography fills the first line to its maximum content width (1480px) before wrapping only the trailing words onto the second line. Setting `WrapStyle: 1` enforces this exact line-breaking behavior.
2. **`ScaledBorderAndShadow: yes`:**
   - Ensures outline strokes and shadow depths scale proportionally when rendered across different output resolutions (e.g., 1080p vs. 4K UHD).
3. **`PlayResX: 1920` / `PlayResY: 1080`:**
   - Anchors the coordinate space to standard 1080p full HD, allowing direct mapping of measured pixel coordinates.

---

## 2. Font Scale Calibration Equation

A fundamental challenge in cross-platform subtitle rendering is the discrepancy between browser canvas rasterization (DirectWrite / FreeType on web) and native FFmpeg `libass` font rasterization.

### The Scale Factor Discrepancy
In browser CSS, font sizes are defined in CSS pixels:
$$\text{Size}_{\text{CSS}} = 54\text{px}$$

In `libass`, font sizes represent point sizes scaled against `PlayResY`:
$$\text{Size}_{\text{ASS}} = \text{Size}_{\text{CSS}} \cdot \kappa_{\text{scale}}$$

Through empirical pixel measurement against in-game screenshots, the optimal scaling constant $\kappa_{\text{scale}}$ is established as:

$$\kappa_{\text{scale}} \approx 0.635 \quad (63.5\%)$$

| Target Dialogue Size (px) | ASS Font Size (`\fs`) | Web Preview Size (px) |
| :---                      | :---                  | :---                  |
| 30px (Compact)            | 19pt                  | 30px                  |
| 42px (Medium)             | 27pt                  | 42px                  |
| 54px (Standard In-Game)   | 34pt                  | 54px                  |
| 64px (Large)              | 41pt                  | 64px                  |

---

## 3. Sub-Pixel Ruby Annotation Engine

Furigana and Ruby annotations represent small reading-aid characters placed directly above Japanese Kanji or localized names (e.g., placing reading text above a character's name).

### Spatial Alignment Problem
When rendering Ruby text in standard subtitle editors, annotations frequently drift horizontally because they are centered relative to the whole sentence rather than the target word.

### Mathematical Coordinate Placement
WuWa Cutscene Studio calculates the exact horizontal center ($X_{\text{target}}$) and vertical elevation ($Y_{\text{target}}$) for Ruby tags:

```
                  ┌─────────┐
                  │ Xuanqing│  <-- Ruby Annotation (X_ruby, Y_ruby)
                  └─────────┘
                      ▲
     ... หากเป็นเจ้า  [นาง]  อาจจะยังมีชีวิตอยู่ ...
                      │
                      └── Target Anchor Word (X_center, Y_baseline)
```

#### 1. Horizontal Coordinate ($X_{\text{ruby}}$):
Given the bounding box width of the sentence preceding the target word ($W_{\text{pre}}$) and the width of the target word itself ($W_{\text{word}}$):

$$X_{\text{anchor}} = X_{\text{start}} + W_{\text{pre}} + \frac{W_{\text{word}}}{2}$$

$$X_{\text{ruby}} = X_{\text{anchor}}$$

The subtitle generator writes explicit positioning overrides using ASS tags:
```
{\an8\pos(X_ruby, Y_ruby)\fs24\bord1.5}Xuanqing
```

#### 2. Vertical Elevation ($Y_{\text{ruby}}$):
To prevent visual collision between the descending tails of Ruby characters and the ascending accents of main dialogue characters:

$$Y_{\text{ruby}} = Y_{\text{dialogue}} - H_{\text{dialogue}} - \delta_{\text{elevation}}$$

Where:
- $Y_{\text{dialogue}}$ is the baseline of the main dialogue line (default $Y = 980$ for bottom margin 100px).
- $H_{\text{dialogue}}$ is the rendered line height of the primary font.
- $\delta_{\text{elevation}}$ is the user-calibrated elevation offset (default $6\text{px}$).

---

## 4. Corner Lyrics Display Module

In cinematic musical sequences, translated lyrics appear in the upper-left corner of the screen.

### Styling Standards
- **Screen Alignment:** `\an7` (Top-Left Anchor).
- **Position Offset:**
  - $X_{\text{margin}} = 100\text{px}$ from the left border.
  - $Y_{\text{margin}} = 80\text{px}$ from the top border.
- **Font Styling:**
  - Size: 30pt to 38pt (Medium weight).
  - Outline: 2.0px dark outline stroke with no shadow.
  - Fade Transitions: Instant cuts matching musical downbeats without trailing alpha dissolves (`\fad(0,0)`).

---

## 5. Safe Area Visual Standards

To guarantee readability across diverse consumer monitors and television displays, the studio enforces SMPTE and EBU Title Safe framing:

```
+-----------------------------------------------------------------------+
|  Action Safe Area (95% Screen: 1824 x 1026)                          |
|  +-----------------------------------------------------------------+  |
|  |  Title Safe Area (90% Screen: 1728 x 972)                       |  |
|  |  Corner Lyrics                                                  |  |
|  |                                                                 |  |
|  |                                                                 |  |
|  |                                                                 |  |
|  |                     Dialogue Subtitles                          |  |
|  +-----------------------------------------------------------------+  |
+-----------------------------------------------------------------------+
```

- **Title Safe Boundaries:** Subtitle text never extends past $X = 96\text{px}$ and $X = 1824\text{px}$.
- **Lower Third Margin:** Bottom margin default is calibrated at $100\text{px}$ ($Y = 980$) to avoid overlapping HUD elements.
