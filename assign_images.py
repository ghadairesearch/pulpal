import json
import sqlite3
import random

def assign_images_from_db():
    print("Connecting to images.db...")
    conn = sqlite3.connect('images.db')
    cursor = conn.cursor()
    
    # Load all images with metadata
    cursor.execute("SELECT image_id, possible_pulpal_diagnosis, possible_periapical_diagnosis FROM image_metadata")
    db_images = cursor.fetchall()
    conn.close()

    if not db_images:
        print("Database is empty. Please run manage_images_db.py first.")
        return

    print("Loading cases database...")
    with open('cases.json', 'r', encoding='utf-8') as f:
        cases = json.load(f)
        
    match_count = 0
    random_count = 0

    for case in cases:
        correct_diagnosis = case['options'][case['correctAnswerIndex']].lower()
        
        valid_images = []
        
        # Try to find images that match both pulpal and periapical diagnosis
        for img in db_images:
            image_id, pulpal, periapical = img
            
            pulpal = pulpal.lower() if pulpal else ""
            periapical = periapical.lower() if periapical else ""
            
            # If the user hasn't filled out the metadata yet, skip strict matching for this image
            if not pulpal and not periapical:
                continue
                
            # Split by comma in case multiple valid diagnoses were provided
            pulpal_options = [p.strip().lower() for p in pulpal.split(',')] if pulpal else []
            periapical_options = [p.strip().lower() for p in periapical.split(',')] if periapical else []
            
            # Check if ANY of the possible diagnoses are mentioned in the correct answer
            pulpal_match = any(p in correct_diagnosis for p in pulpal_options) if pulpal_options else True
            periapical_match = any(p in correct_diagnosis for p in periapical_options) if periapical_options else True
            
            if pulpal_match and periapical_match:
                valid_images.append(image_id)
                
        if valid_images:
            # We found one or more images that perfectly match the diagnosis!
            chosen_image = random.choice(valid_images)
            case['image'] = f"images/{chosen_image}"
            match_count += 1
        else:
            # No matching image found (either no tags, or no image for this specific diagnosis)
            # Pick a random image from the entire database as a fallback
            random_image = random.choice(db_images)[0]
            case['image'] = f"images/{random_image}"
            random_count += 1

    # Save cases
    with open('cases.json', 'w', encoding='utf-8') as f:
        json.dump(cases, f, indent=4)

    print(f"Done! Smart-matched {match_count} cases based on exact Database tags.")
    if random_count > 0:
        print(f"Randomly assigned images to {random_count} cases (because no images had matching tags).")
    print("You can now commit and push the changes!")

if __name__ == "__main__":
    assign_images_from_db()
