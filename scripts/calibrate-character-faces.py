"""Optional offline calibration; normal asset builds use the checked-in result.

Authoring dependencies on macOS: mediapipe==0.10.21, numpy<2,
opencv-contrib-python<4.12, pillow. See the character asset README for the
official detector download and the preceding raw-head rendering command.
"""
import argparse
import hashlib
import json
from pathlib import Path
import struct

import mediapipe as mp
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'packages/client/public/assets/characters'
CHARACTERS = ['neo', 'trinity', 'smith', 'morpheus']


def hairline(pixels, landmarks):
    eye_y = landmarks[[468, 473], 1].mean(); center = landmarks[[468, 473], 0].mean()
    result = []
    for u in np.linspace(center - .27, center + .27, 55):
        x = int(u * pixels.shape[1])
        column = pixels[:int((eye_y - .01) * pixels.shape[0]), max(0, x - 3):x + 4].mean(axis=1)
        skin = (column[:, 0] > 100) & (column[:, 0] > column[:, 1] + 12) & (column[:, 0] > column[:, 2] + 22)
        skin[:int(pixels.shape[0] * .08)] = False
        stable = np.where(np.convolve(skin.astype(int), np.ones(9, dtype=int), 'valid') >= 8)[0]
        # Background can share skin hues. Require a preceding dark hair band.
        dark = column.max(axis=1) < 115
        candidates = [y for y in stable if dark[max(0, y - 65):y].sum() >= 9]
        v = candidates[0] / pixels.shape[0] if candidates else eye_y - .02
        result.append([round(float(u), 6), round(float(v), 6)])
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--model', type=Path, required=True, help='Official face_landmarker.task file')
    parser.add_argument('--profile', type=Path, required=True, help='Front/profile reference sheet; see turnaround-prompt.txt')
    parser.add_argument('--renders', type=Path, default=ROOT / 'output/characters/calibration')
    parser.add_argument('--assets', type=Path, default=ASSETS)
    args = parser.parse_args()
    front = np.array(Image.open(ASSETS / 'matrix-faces.png').convert('RGB'))
    profile = np.array(Image.open(args.profile).convert('RGB'))
    options = mp.tasks.vision.FaceLandmarkerOptions(base_options=mp.tasks.BaseOptions(
        model_asset_path=str(args.model), delegate=mp.tasks.BaseOptions.Delegate.CPU),
        num_faces=1, min_face_detection_confidence=.35, min_face_presence_confidence=.35)
    data = {'referenceFront': 'matrix-faces.png', 'referenceProfile': args.profile.name,
            'detector': f'MediaPipe {mp.__version__} Face Landmarker', 'characters': {}}
    with mp.tasks.vision.FaceLandmarker.create_from_options(options) as detector:
        for index, character in enumerate(CHARACTERS):
            raw = (args.assets / (character + '.glb')).read_bytes()
            document = json.loads(raw[20:20 + struct.unpack_from('<I', raw, 12)[0]])
            if document['extras'].get('skinBaked'): raise RuntimeError('Calibrate unprojected raw heads; run build-characters.py first.')
            entry = {'camera': json.loads((args.renders / (character + '-camera.json')).read_text()),
                     'sourceSha256': hashlib.sha256(raw).hexdigest()}
            h, w = front.shape[:2]; row, column = divmod(index, 2)
            face = front[row * h // 2:(row + 1) * h // 2, column * w // 2:(column + 1) * w // 2]
            h, w = profile.shape[:2]
            side = profile[h // 2:, index * w // 4:(index + 1) * w // 4]
            source = np.array(Image.open(args.renders / (character + '-front.png')).convert('RGB'))
            for name, pixels in [('source', source), ('front', face), ('profile', side)]:
                found = detector.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(pixels)))
                if not found.face_landmarks: raise RuntimeError(f'{character} {name}: no usable face detected.')
                points = [[round(p.x, 7), round(p.y, 7), round(p.z, 7)] for p in found.face_landmarks[0]]
                entry[name] = {'size': [pixels.shape[1], pixels.shape[0]], 'points': points}
            if character != 'morpheus': entry['hairline'] = hairline(face.astype(float), np.array(entry['front']['points']))
            data['characters'][character] = entry
    path = Path(__file__).with_name('character-landmarks.json')
    path.write_text(json.dumps(data, separators=(',', ':')) + '\n')
    print('Saved four-character calibration:', path)


if __name__ == '__main__': main()
