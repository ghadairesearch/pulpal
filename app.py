import os
import requests
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

app = FastAPI()

# Use the token from environment variables (Set this in Render)
HF_TOKEN = os.environ.get("HF_TOKEN")
API_URL = "https://api-inference.huggingface.co/models/Qwen/Qwen2.5-1.5B-Instruct"

class RephraseRequest(BaseModel):
    question: str

@app.post("/api/rephrase")
def api_rephrase(request: RephraseRequest):
    headers = {"Authorization": f"Bearer {HF_TOKEN}"}
    
    # Format the prompt exactly how Qwen expects it
    prompt = f"<|im_start|>system\nYou are a dental education expert.<|im_end|>\n<|im_start|>user\nRephrase the following question while preserving all clinical findings, diagnosis, meaning, and difficulty level.\n\nReturn only the rephrased question.\n\nQuestion:\n{request.question}<|im_end|>\n<|im_start|>assistant\n"
    
    payload = {
        "inputs": prompt,
        "parameters": {
            "max_new_tokens": 300,
            "temperature": 0.7,
            "return_full_text": False
        }
    }
    
    try:
        # Send the request to Hugging Face instead of processing locally
        response = requests.post(API_URL, headers=headers, json=payload, timeout=30)
        if response.status_code == 200:
            result = response.json()
            if isinstance(result, list) and len(result) > 0 and "generated_text" in result[0]:
                rephrased = result[0]["generated_text"].strip()
                return {"rephrased": rephrased}
        print(f"HF API Error: {response.text}")
    except Exception as e:
        print(f"Request error: {e}")
        
    return {"rephrased": request.question} # Fallback if API fails

# Serve static files for the frontend
import os
os.makedirs("images", exist_ok=True)
app.mount("/images", StaticFiles(directory="images"), name="images")

@app.get("/")
def root():
    return FileResponse("index.html")

@app.get("/{filename}")
def get_file(filename: str):
    if os.path.exists(filename):
        return FileResponse(filename)
    return FileResponse("index.html")
