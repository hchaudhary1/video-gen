# /// script
# requires-python = ">=3.11,<3.13"
# dependencies = ["nemo-toolkit[asr]==2.5.3", "pyarrow==19.0.1"]
# ///
"""NVIDIA Parakeet TDT 0.6B v2 (CC-BY-4.0), local English ASR only.
https://huggingface.co/nvidia/parakeet-tdt-0.6b-v2
Each input is decoded to mono 16 kHz and transcribed in <=30-second chunks.
"""
import argparse
import json
import subprocess
import tempfile
import wave
from pathlib import Path

MODEL = "nvidia/parakeet-tdt-0.6b-v2"

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("audio")
    parser.add_argument("output")
    args = parser.parse_args()
    import torch
    import nemo.collections.asr as nemo_asr
    model = nemo_asr.models.ASRModel.from_pretrained(MODEL, map_location="cuda" if torch.cuda.is_available() else "cpu")
    model.eval()
    result = {"model": MODEL, "device": str(model.device), "chunks": [], "words": []}
    with tempfile.TemporaryDirectory(prefix="parakeet-", dir=Path(args.output).parent) as work:
        decoded = Path(work) / "decoded.wav"
        subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-i", args.audio, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", str(decoded)], check=True)
        with wave.open(str(decoded), "rb") as source:
            index = 0
            while True:
                frames = source.readframes(30 * 16000)
                if not frames:
                    break
                chunk = Path(work) / f"{index:06d}.wav"
                with wave.open(str(chunk), "wb") as target:
                    target.setparams(source.getparams())
                    target.writeframes(frames)
                index += 1
        decoded.unlink()
        for index, chunk in enumerate(sorted(Path(work).glob("*.wav"))):
            output = model.transcribe([str(chunk)], timestamps=True)[0]
            words = [{"id": f"w{len(result['words']) + i}", "text": w["word"], "start": round(float(w["start"]) + index * 30, 3), "end": round(float(w["end"]) + index * 30, 3)} for i, w in enumerate(output.timestamp["word"])]
            result["chunks"].append({"start": index * 30, "text": output.text, "words": words})
            result["words"].extend(words)
    if not result["words"]:
        raise RuntimeError("Parakeet detected no speech")
    Path(args.output).write_text(json.dumps(result, indent=2) + "\n")

if __name__ == "__main__":
    main()
