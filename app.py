from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import json
import random
import os

app = FastAPI()

cases_db = []

def load_database():
    global cases_db
    if os.path.exists("cases.json"):
        with open("cases.json", "r", encoding="utf-8") as f:
            cases_db = json.load(f)

# Load database into memory at startup
load_database()

@app.get("/api/case/random")
def get_random_case():
    if not cases_db:
        # Reload just in case it was generated after startup
        load_database()
                
        if not cases_db:
            return {
                "question": "Error: Database is empty. Please generate cases first.",
                "options": ["Error", "Error", "Error", "Error"],
                "correctAnswerIndex": 0,
                "feedback": "No cases found in cases.json. Run python generate_cases.py to build the database.",
                "image": "images/placeholder_nopain.jpg"
            }
            
    case = random.choice(cases_db)
    case_with_meta = dict(case)
    case_with_meta["total_cases_in_db"] = len(cases_db)
    return case_with_meta

# Mount static files for images specifically
os.makedirs("images", exist_ok=True)
app.mount("/images", StaticFiles(directory="images"), name="images")

# Serve root index.html
@app.get("/")
def read_index():
    return FileResponse("index.html")

# Serve other static files like main.js and style.css
@app.get("/{filename}")
def read_static(filename: str):
    if os.path.exists(filename):
        return FileResponse(filename)
    raise HTTPException(status_code=404, detail="File not found")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
