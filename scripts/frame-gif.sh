#!/usr/bin/env bash
# Arma el GIF de Haruhi para el README a partir de los frames ampliados con IA:
# recorta para que entren las dos manos completas y lo mete en una "ventana" con el mismo
# estilo y tamaño que assets/terminal.svg (760x504, fondo, borde redondeado y 3 puntitos).
#
# Genera dos versiones:
#   assets/haruhi-framed.gif         colores originales
#   assets/haruhi-framed-tokyo.gif   con tono Tokyo Night
#
# Uso: bash scripts/frame-gif.sh [carpeta_de_frames]      (requiere ffmpeg)
#   Por defecto lee ~/Downloads/haruhi_frames_upscaled_4x (frame_01.png ... a 20 fps).
#   Si algún frame está dañado, se reemplaza por el anterior y se avisa.
set -euo pipefail

cd "$(dirname "$0")/.."

SRC="${1:-$HOME/Downloads/haruhi_frames_upscaled_4x}"
FPS=20

# Suavizado temporal: el upscaler deja ruido distinto en cada frame y eso dispara el peso
# del GIF. Súbelo para menos peso, bájalo si notas estelas en las manos.
# Uso puntual: DENOISE=10 bash scripts/frame-gif.sh
DENOISE="${DENOISE:-20}"

# Recorte sobre los frames de 2000x1124: desde x=300 entran la mano izquierda y la derecha
CROP_X=300
CROP_Y=0
CROP_W=1700
CROP_H=1060

# Estabilización: en la escena original la cámara baja ~10 px (a 2000 px) durante el bucle y
# al reiniciar salta arriba, así que en bucle parece que la imagen se desliza hacia abajo.
# Desplazamiento del fondo medido en cada frame respecto al primero; el recorte de cada
# frame se mueve lo mismo para que el fondo quede quieto. Si cambias de GIF, ponlos a 0.
SHIFT_X=(0 0 0 0 0 0 0 0 0 0 -1 -1 -1 -1 -1 -1 0 0 0 0 0 0 0 0 1 1 1 1)
SHIFT_Y=(0 0 0 0 0 0 0 0 1 1 2 2 3 3 4 4 4 4 5 5 7 7 8 8 8 8 10 10)

# Ventana: mismas medidas que la terminal
W=760
H=504
TITLE=34      # alto de la barra de título
PAD=16        # margen lateral
RADIUS=10     # radio de las esquinas
DOT_R=6
DOT_Y=18
CW=$((W - 2 * PAD))       # ancho del contenido
CH=$((H - TITLE - PAD))   # alto del contenido

# --- Recortar y estabilizar cada frame en una carpeta temporal ---
# Los frames que no se pueden leer se sustituyen por el anterior.
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
n=0
prev=""
for f in "$SRC"/frame_*.png; do
  n=$((n + 1))
  dest="$TMP/$(printf 'frame_%02d.png' "$n")"
  src="$f"
  if ! ffmpeg -v error -i "$f" -f null - >/dev/null 2>&1; then
    if [[ -z "$prev" ]]; then
      echo "Error: $(basename "$f") está dañado y no hay frame anterior" >&2
      exit 1
    fi
    echo "Aviso: $(basename "$f") está dañado; se usa $(basename "$prev") en su lugar" >&2
    src="$prev"
  fi
  prev="$src"
  x=$((CROP_X + ${SHIFT_X[n - 1]:-0}))
  y=$((CROP_Y + ${SHIFT_Y[n - 1]:-0}))
  ffmpeg -v error -y -i "$src" -vf "crop=${CROP_W}:${CROP_H}:${x}:${y}" "$dest"
done
if ((n != ${#SHIFT_Y[@]})); then
  echo "Aviso: hay $n frames pero ${#SHIFT_Y[@]} valores de estabilización" >&2
fi
echo "Frames: $n"

# --- Marco de la ventana generado píxel a píxel ---
# Las esquinas van opacas con el fondo oscuro de GitHub (#0d1117) en vez de transparentes:
# con transparencia el codificador GIF de ffmpeg no puede reutilizar píxeles entre frames
# y el archivo pesa casi el triple.
D="hypot(max(0,max(${RADIUS}-X,X-(W-1-${RADIUS}))),max(0,max(${RADIUS}-Y,Y-(H-1-${RADIUS}))))"
dot() { echo "lte(hypot(X-$1,Y-${DOT_Y}),${DOT_R})"; }
channel() { # $1=esquina $2=fondo $3=borde $4=rojo $5=amarillo $6=verde
  echo "if(gt($D,${RADIUS}+0.5),$1,if(gt($D,${RADIUS}-1),$3,if($(dot 22),$4,if($(dot 42),$5,if($(dot 62),$6,$2)))))"
}
# Paleta: esquina #0d1117, fondo #1a1b26, borde #2f334d, #ff5f57, #febc2e, #28c840
R=$(channel 13 26 47 255 254 40)
G=$(channel 17 27 51 95 188 200)
B=$(channel 23 38 77 87 46 64)

render() { # $1=salida $2=filtro de color extra para el contenido (puede ir vacío)
  local out="$1" tone="$2"
  ffmpeg -v error -y -framerate "$FPS" -i "$TMP/frame_%02d.png" -filter_complex "
    color=c=black:s=${W}x${H}:r=${FPS},format=rgb24,geq=r='${R}':g='${G}':b='${B}'[frame];
    [0:v]scale=${CW}:${CH}:flags=lanczos,setsar=1,hqdn3d=2:2:${DENOISE}:${DENOISE}${tone}[content];
    [frame][content]overlay=${PAD}:${TITLE}:shortest=1,split[a][b];
    [a]palettegen=stats_mode=diff[p];
    [b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle
  " -loop 0 "$out"
  echo "Generado $out ($(du -h "$out" | cut -f1))"
}

render assets/haruhi-framed.gif ""
# Tono Tokyo Night: algo menos saturado, sombras y medios hacia el azul
render assets/haruhi-framed-tokyo.gif ",eq=saturation=0.8:contrast=1.04:brightness=-0.02,colorbalance=rs=-0.05:bs=0.1:rm=-0.04:bm=0.07:bh=0.03"
