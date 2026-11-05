"""Load the pinned Ming model for setup diagnostics; no speech or review evidence is generated."""
import argparse
import json
import sys
from pathlib import Path
parser = argparse.ArgumentParser()
parser.add_argument('home')
args = parser.parse_args()
home = Path(args.home)
sys.path.insert(0, str(home / 'source'))
import torch
torch.set_num_threads(8)
from ming_tts import MingTTS
model = MingTTS(str(home / 'model'), device='cpu', text_normalization=False)
print(json.dumps({'model': 'Ming-3.0-tts-0.5B', 'ready': True, 'device': 'cpu'}))
