import sqlite3
import os

def init_db():
    print("Connecting to images.db...")
    conn = sqlite3.connect('images.db')
    cursor = conn.cursor()
    
    # Create the schema requested by the user
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS image_metadata (
        image_id TEXT PRIMARY KEY,
        tooth_region TEXT,
        image_type TEXT,
        possible_pulpal_diagnosis TEXT,
        possible_periapical_diagnosis TEXT
    )
    ''')
    
    # Get all 31 images from the images directory
    if not os.path.exists("images"):
        os.makedirs("images")
        
    image_files = [f for f in os.listdir('images') if f.lower().endswith(('.png', '.jpg', '.jpeg', '.gif'))]
    image_files = [f for f in image_files if "placeholder" not in f.lower()]
    
    inserted = 0
    for img in image_files:
        # Check if image already exists in the database
        cursor.execute("SELECT image_id FROM image_metadata WHERE image_id = ?", (img,))
        if not cursor.fetchone():
            # Insert the new image with empty metadata fields
            cursor.execute('''
            INSERT INTO image_metadata 
            (image_id, tooth_region, image_type, possible_pulpal_diagnosis, possible_periapical_diagnosis)
            VALUES (?, '', '', '', '')
            ''', (img,))
            inserted += 1
            
    conn.commit()
    conn.close()
    
    print(f"Database initialized successfully!")
    print(f"Inserted {inserted} new images into the database. You can now use an SQLite editor to add their diagnoses.")

if __name__ == "__main__":
    init_db()
