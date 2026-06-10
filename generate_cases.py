import json
import random
import requests
import sys
import re

# Load Knowledge Base
try:
    with open('knowledge.json', 'r', encoding='utf-8') as f:
        kb = json.load(f)
except FileNotFoundError:
    print("Error: knowledge.json not found. Please ensure it exists.")
    sys.exit(1)

possible_combos = kb['commonCombinations'] + kb.get('conditionalCombinations', [])
clinical_profiles = kb.get('clinicalProfiles', {})

valid_combos = [c for c in possible_combos if c['final'] in clinical_profiles]

template = kb['generationGuidelines']['questionTemplate']

OLLAMA_URL = "http://localhost:11434/api/chat"

cases = []
NUM_CASES = 50 # You can change this to 500 or whatever you want

print(f"Generating {NUM_CASES} cases using local Ollama (this might take a few minutes)...", flush=True)

for i in range(NUM_CASES):
    correct_combo = random.choice(valid_combos)
    final_diagnosis = correct_combo['final']
    
    # Select distractors
    options = [final_diagnosis]
    while len(options) < 4:
        random_combo = random.choice(possible_combos)['final']
        if random_combo not in options:
            options.append(random_combo)
            
    random.shuffle(options)
    correct_index = options.index(final_diagnosis)
    
    age = random.randint(17, 75)
    gender = random.choice(["male", "female"])
    
    profile = clinical_profiles[final_diagnosis]
    
    # Store selected values for feedback
    selected_values = {}
    
    text = template.replace("{Age}", str(age)).replace("{Gender}", gender)
    
    for key, values in profile.items():
        selected_value = random.choice(values)
        selected_values[key] = selected_value
        if not selected_value or selected_value == "blank":
            regex = re.compile(rf"{re.escape(key)}:\s*\{{{re.escape(key)}\}}\.\s*", re.IGNORECASE)
            text = regex.sub("", text)
        else:
            text = text.replace(f"{{{key}}}", selected_value)
            
    # Send to local Ollama
    payload = {
        "model": "llama3",
        "messages": [
            { "role": "system", "content": "You are an expert Endodontist. Rewrite the provided clinical scenario to improve the language and flow so it reads naturally like a concise, professional dental case study. CRITICAL RULES: 1. Do NOT add any extra information, descriptive fluff, or explanations/interpretations of the test results. Just report the clinical facts exactly as provided. 2. Do NOT attempt to diagnose the patient or include the actual diagnosis in your output. 3. Your output MUST end exactly with the question 'What is the final diagnosis?'. Only output the rewritten paragraph." },
            { "role": "user", "content": "A 42-year-old female presents with a chief complaint of 'pain'. The tooth responds Lingering to cold. The percussion test is Positive and palpation is Negative. Radiographs reveal Radiolucency. Swelling/sinus tracts are Absent. What is the final diagnosis?" },
            { "role": "assistant", "content": "A 42-year-old female patient presents to the clinic with a chief complaint of pain. Clinical examination reveals a lingering response to cold testing. The tooth is tender to percussion, but palpation is negative. Radiographic evaluation shows a periapical radiolucency, and there is no evidence of swelling or sinus tracts. What is the final diagnosis?" },
            { "role": "user", "content": text }
        ],
        "stream": False
    }
    
    final_question_text = text
    try:
        response = requests.post(OLLAMA_URL, json=payload, timeout=60)
        if response.status_code == 200:
            data = response.json()
            final_question_text = data.get("message", {}).get("content", text).strip()
    except Exception as e:
        print(f"Ollama error on case {i+1}: {e} - Falling back to template.", flush=True)
        
    cold = selected_values.get("Cold Test Response", "N/A")
    perc = selected_values.get("Percussion Test", "N/A")
    radio = selected_values.get("Radiographic Findings", "N/A")
    swell = selected_values.get("Swelling / Sinus Tract", "N/A")
    
    feedback = f"A cold test of '{cold}' indicates {correct_combo['pulp']}. Percussion: '{perc}' and Radiograph: '{radio}' with Swelling: '{swell}' indicates {correct_combo['apical']}."
    
    case_obj = {
        "id": i + 1,
        "question": final_question_text,
        "options": options,
        "correctAnswerIndex": correct_index,
        "feedback": feedback,
        "image": "images/placeholder_nopain.jpg"
    }
    cases.append(case_obj)
    print(f"Generated case {i+1}/{NUM_CASES}", flush=True)
    with open('cases.json', 'w', encoding='utf-8') as f:
        json.dump(cases, f, indent=4)

print("Successfully saved all cases to cases.json!", flush=True)
