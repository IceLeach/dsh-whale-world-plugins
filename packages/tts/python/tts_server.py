"""dsh-whale-tts 的推理服务：加载 GPT-SoVITS 的 TTS 类，暴露 HTTP。

只依赖配置的 GPT-SoVITS 代码根、模型文件和一个带 torch 的 Python 环境，
不依赖 WebUI，也不依赖整合包的固定目录结构。
"""

import argparse
import os
import sys
import wave
from io import BytesIO

import numpy as np
from fastapi import FastAPI
from fastapi.responses import JSONResponse, Response
import uvicorn

app = FastAPI()
STATE = {"pipeline": None, "sovits": None, "gpt": None, "root": None}


def _prepare_path(root):
    sys.path.insert(0, root)
    sys.path.insert(0, os.path.join(root, "GPT_SoVITS"))
    sys.path.insert(0, os.path.join(root, "GPT_SoVITS", "eres2net"))
    runtime = os.path.join(root, "runtime")
    if os.path.isdir(runtime) and runtime not in os.environ.get("PATH", ""):
        os.environ["PATH"] = runtime + os.pathsep + os.environ.get("PATH", "")


def load_pipeline(sovits, gpt, version, device, is_half):
    root = STATE["root"]
    from GPT_SoVITS.TTS_infer_pack.TTS import TTS, TTS_Config

    config = {
        "custom": {
            "device": device,
            "is_half": is_half,
            "version": version,
            "t2s_weights_path": gpt,
            "vits_weights_path": sovits,
            "bert_base_path": os.path.join(root, "GPT_SoVITS", "pretrained_models", "chinese-roberta-wwm-ext-large"),
            "cnhuhbert_base_path": os.path.join(root, "GPT_SoVITS", "pretrained_models", "chinese-hubert-base"),
        }
    }
    tts_config = TTS_Config(config)
    pipeline = TTS(tts_config)
    return pipeline


@app.get("/health")
def health():
    return {"ok": True, "loaded": STATE["pipeline"] is not None}


@app.post("/tts")
async def tts(req: dict):
    text = (req.get("text") or "").strip()
    if not text:
        return JSONResponse({"error": "text is empty"}, status_code=400)

    ref_audio = req.get("ref_audio")
    if not ref_audio or not os.path.isfile(ref_audio):
        return JSONResponse({"error": "ref_audio not found: %s" % ref_audio}, status_code=400)

    sovits = req.get("sovits") or ""
    gpt = req.get("gpt") or ""

    if not sovits or not os.path.isfile(sovits):
        return JSONResponse({"error": "sovits model not found: %s" % sovits}, status_code=400)
    if not gpt or not os.path.isfile(gpt):
        return JSONResponse({"error": "gpt model not found: %s" % gpt}, status_code=400)

    try:
        need_reload = STATE["pipeline"] is None or STATE["sovits"] != sovits or STATE["gpt"] != gpt
        if need_reload:
            STATE["pipeline"] = load_pipeline(
                sovits,
                gpt,
                req.get("version", "v4"),
                req.get("device", "cuda"),
                bool(req.get("is_half", True)),
            )
            STATE["sovits"] = sovits
            STATE["gpt"] = gpt

        inputs = {
            "text": text,
            "text_lang": req.get("text_lang", "zh"),
            "ref_audio_path": ref_audio,
            "prompt_text": req.get("ref_text", ""),
            "prompt_lang": req.get("ref_lang", "zh"),
            "text_split_method": "cut5",
            "batch_size": 1,
            "speed_factor": float(req.get("speed", 1.0)),
            "streaming_mode": False,
            "return_fragment": False,
        }

        chunks = []
        sample_rate = 32000
        for sr, audio in STATE["pipeline"].run(inputs):
            sample_rate = int(sr)
            chunks.append(np.asarray(audio).reshape(-1))

        if not chunks:
            return JSONResponse({"error": "empty audio"}, status_code=500)

        audio = np.concatenate(chunks) if len(chunks) > 1 else chunks[0]
        peak = float(np.max(np.abs(audio))) if audio.size else 0.0
        if peak > 1.0:
            audio = audio / peak * 0.95
        pcm = (np.clip(audio, -1.0, 1.0) * 32767).astype(np.int16)

        buf = BytesIO()
        with wave.open(buf, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(sample_rate)
            wf.writeframes(pcm.tobytes())
        return Response(content=buf.getvalue(), media_type="audio/wav")
    except Exception as exc:  # noqa: BLE001
        return JSONResponse({"error": str(exc)}, status_code=500)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--gsv-root", required=True)
    parser.add_argument("--port", type=int, default=9880)
    parser.add_argument("--host", default="127.0.0.1")
    args = parser.parse_args()

    root = os.path.abspath(args.gsv_root)
    os.chdir(root)
    STATE["root"] = root
    _prepare_path(root)
    uvicorn.run(app, host=args.host, port=args.port, log_level="warning")


if __name__ == "__main__":
    main()
