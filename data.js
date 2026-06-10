const questionsData = [
    {
        id: 1,
        image: "images/placeholder_abscess.jpg",
        question: "A 42-year-old female presents with a chief complaint of a \"frequent abscess\" on the gums. Clinical examination confirms a localized swelling. The tooth has no response to cold or EPT. What is the final diagnosis?",
        options: [
            "Pulp Necrosis with Chronic Apical Abscess",
            "Previously Treated with Chronic Apical Abscess",
            "Pulp Necrosis with Symptomatic Apical Periodontitis",
            "Asymptomatic Irreversible Pulpitis with Normal Apical Tissues"
        ],
        correctAnswerIndex: 0,
        feedback: "No response to vitality tests indicates Pulp Necrosis. The presence of swelling and an abscess indicates a Chronic Apical Abscess."
    },
    {
        id: 2,
        image: "images/placeholder_nopain.jpg",
        question: "A 28-year-old male presents for a routine checkup with a chief complaint of \"no pain\". The tooth responds normally to cold (no lingering pain), the percussion test is negative, and radiographs show normal periapical tissues. What is the final diagnosis?",
        options: [
            "Previously Treated with Normal Apical Tissues",
            "Reversible Pulpitis with Normal Apical Tissues",
            "Normal Pulp with Normal Apical Tissues",
            "Asymptomatic Irreversible Pulpitis with Normal Apical Tissues"
        ],
        correctAnswerIndex: 2,
        feedback: "A normal cold response indicates Normal Pulp. Negative percussion and normal radiographs indicate Normal Apical Tissues."
    },
    {
        id: 3,
        image: "images/placeholder_esthetic.jpg",
        question: "A 19-year-old female presents with \"no pain, esthetic concern\" due to a discolored anterior tooth. There is no swelling. The tooth does not respond to cold testing. The percussion is negative, but the radiograph reveals a periapical radiolucency. What is the final diagnosis?",
        options: [
            "Previously Initiated with Normal Apical Tissues",
            "Pulp Necrosis with Asymptomatic Apical Periodontitis",
            "Pulp Necrosis with Symptomatic Apical Periodontitis",
            "Previously Treated with Asymptomatic Apical Periodontitis"
        ],
        correctAnswerIndex: 1,
        feedback: "No response to cold indicates Pulp Necrosis. A radiolucency with negative percussion and no swelling indicates Asymptomatic Apical Periodontitis."
    },
    {
        id: 4,
        image: "images/placeholder_pain.jpg",
        question: "A 55-year-old male presents with severe spontaneous \"pain\" localized to tooth 36. The pain lingers for minutes after a cold stimulus is removed. The percussion test is positive, and the radiograph shows a periapical radiolucency. What is the final diagnosis?",
        options: [
            "Symptomatic Irreversible Pulpitis with Symptomatic Apical Periodontitis",
            "Pulp Necrosis with Symptomatic Apical Periodontitis",
            "Reversible Pulpitis with Symptomatic Apical Periodontitis",
            "Symptomatic Irreversible Pulpitis with Normal Apical Tissues"
        ],
        correctAnswerIndex: 0,
        feedback: "Spontaneous, lingering pain to cold indicates Symptomatic Irreversible Pulpitis. Positive percussion with a radiolucency indicates Symptomatic Apical Periodontitis."
    },
    {
        id: 5,
        image: "images/placeholder_biting.jpg",
        question: "A 33-year-old female presents with \"pain on biting\" on tooth 45, which had a completed root canal 5 years ago. The tooth has a positive percussion test and a distinct periapical radiolucency. There is no swelling. What is the final diagnosis?",
        options: [
            "Pulp Necrosis with Symptomatic Apical Periodontitis",
            "Previously Treated with Symptomatic Apical Periodontitis",
            "Previously Treated with Chronic Apical Periodontitis",
            "Previously Initiated with Symptomatic Apical Periodontitis"
        ],
        correctAnswerIndex: 1,
        feedback: "A history of a completed root canal indicates Previously Treated. Pain on biting (positive percussion) with a radiolucency indicates Symptomatic Apical Periodontitis."
    },
    {
        id: 6,
        image: "images/placeholder_pressure.jpg",
        question: "A 47-year-old male presents with \"pain on pressure\" on tooth 24. A deep composite was placed a week ago. The tooth responds to cold, but the pain is short and sharp (not lingering). The percussion test is positive, and radiographic periapical findings show a radiolucency. What is the final diagnosis?",
        options: [
            "Symptomatic Irreversible Pulpitis with Symptomatic Apical Periodontitis",
            "Reversible Pulpitis with Symptomatic Apical Periodontitis",
            "Pulp Necrosis with Symptomatic Apical Periodontitis",
            "Reversible Pulpitis with Normal Apical Tissues"
        ],
        correctAnswerIndex: 1,
        feedback: "Short, non-lingering pain to cold suggests Reversible Pulpitis. Positive percussion with a radiolucency indicates Symptomatic Apical Periodontitis."
    },
    {
        id: 7,
        image: "images/placeholder_sinustract.jpg",
        question: "A 22-year-old female presents with a \"sinus tract\" on the buccal mucosa. The tooth had an emergency pulpotomy performed two months ago but was never finished. What is the final diagnosis?",
        options: [
            "Previously Treated with Chronic Apical Abscess",
            "Pulp Necrosis with Chronic Apical Periodontitis",
            "Previously Initiated with Chronic Apical Abscess",
            "Previously Initiated with Symptomatic Apical Periodontitis"
        ],
        correctAnswerIndex: 2,
        feedback: "An unfinished pulpotomy indicates Previously Initiated Therapy. The presence of a sinus tract indicates a Chronic Apical Abscess."
    },
    {
        id: 8,
        image: "images/placeholder_release.jpg",
        question: "A 61-year-old male presents with \"pain on release of biting\". The tooth had a root canal completed 3 years ago. The percussion test is positive, but the radiographic findings are completely normal. According to the formula fallback, what is the final diagnosis?",
        options: [
            "Previously Treated with Normal Apical Tissues",
            "Previously Treated with Asymptomatic Apical Periodontitis",
            "Pulp Necrosis with Asymptomatic Apical Periodontitis",
            "Symptomatic Irreversible Pulpitis with Symptomatic Apical Periodontitis"
        ],
        correctAnswerIndex: 1,
        feedback: "A completed root canal indicates Previously Treated. Positive percussion with normal radiographs defaults to Asymptomatic Apical Periodontitis (per the specific diagnostic formula rule fallback)."
    },
    {
        id: 9,
        image: "images/placeholder_swelling.jpg",
        question: "A 39-year-old female presents with facial \"swelling\" in the lower right quadrant. The tooth has a large carious lesion and no response to cold or EPT. What is the final diagnosis?",
        options: [
            "Pulp Necrosis with Chronic Apical Periodontitis",
            "Pulp Necrosis with Chronic Apical Abscess",
            "Symptomatic Irreversible Pulpitis with Chronic Apical Abscess",
            "Previously Treated with Chronic Apical Abscess"
        ],
        correctAnswerIndex: 1,
        feedback: "No response to thermal tests indicates Pulp Necrosis. Intraoral/facial swelling indicates a Chronic Apical Abscess."
    }
];
