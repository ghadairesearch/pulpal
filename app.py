from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from transformers import AutoTokenizer, AutoModelForCausalLM
import torch

app = FastAPI()

# Model Initialization
model_name = "Qwen/Qwen2.5-1.5B-Instruct"

tokenizer = None
model = None

@app.on_event("startup")
def load_model():
    global tokenizer, model
    try:
        print(f"Loading {model_name}...")
        tokenizer = AutoTokenizer.from_pretrained(model_name)
        model = AutoModelForCausalLM.from_pretrained(
            model_name,
            torch_dtype=torch.float16,
            device_map="auto"
        )
        print("Model loaded successfully!")
    except Exception as e:
        print(f"Error loading model (it may require HF_TOKEN): {e}")

class RephraseRequest(BaseModel):
    question: str

@app.post("/api/rephrase")
async def api_rephrase(request: RephraseRequest):
    if not model or not tokenizer:
        print("Model not loaded. Returning original question.")
        return {"rephrased": request.question}

    messages = [
        {
            "role": "system",
            "content": "You are a dental education expert."
        },
        {
            "role": "user",
            "content": f"""
Rephrase the following question while preserving all clinical findings,
diagnosis, meaning, and difficulty level.

Return only the rephrased question.

Question:
{request.question}
"""
        }
    ]

    try:
        prompt = tokenizer.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True
        )

        inputs = tokenizer(prompt, return_tensors="pt").to(model.device)

        outputs = model.generate(
            **inputs,
            max_new_tokens=300,
            temperature=0.7,
            do_sample=True
        )

        result = tokenizer.decode(outputs[0], skip_special_tokens=True)
        rephrased = result.split("assistant")[-1].strip()
        return {"rephrased": rephrased}
    except Exception as e:
        print(f"Generation error: {e}")
        return {"rephrased": request.question}

# Serve static files for the frontend
app.mount("/images", StaticFiles(directory="images"), name="images")

@app.get("/")
async def root():
    return FileResponse("index.html")

@app.get("/{filename}")
async def get_file(filename: str):
    import os
    if os.path.exists(filename):
        return FileResponse(filename)
    return FileResponse("index.html")
