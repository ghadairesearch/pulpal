document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const questionCounterEl = document.getElementById('question-counter');
    const questionImageEl = document.getElementById('question-image');
    const imageWrapperEl = document.querySelector('.image-wrapper');
    const questionTextEl = document.getElementById('question-text');
    const optionsContainerEl = document.getElementById('options-container');
    const feedbackPanelEl = document.getElementById('feedback-panel');
    const feedbackTitleEl = document.getElementById('feedback-title');
    const feedbackTextEl = document.getElementById('feedback-text');
    const nextBtnEl = document.getElementById('next-btn');
    const quizCardEl = document.getElementById('quiz-card');
    const completionScreenEl = document.getElementById('completion-screen');
    const finalScoreEl = document.getElementById('final-score');
    const totalQuestionsEl = document.getElementById('total-questions');
    const restartBtnEl = document.getElementById('restart-btn');

    // State
    let currentQuestionIndex = 0;
    let score = 0;
    let hasAnswered = false;
    let currentQuestionData = null;

    // Helper functions to get random elements
    function getRandomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    
    function getRandomElement(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    // Generator Logic
    async function generateQuestionData() {
        let possibleCombos = [...knowledgeBase.commonCombinations, ...knowledgeBase.conditionalCombinations];
        // Filter to only combinations that have a defined profile
        let validCombos = possibleCombos.filter(combo => knowledgeBase.clinicalProfiles[combo.final]);
        
        // 1. Pick a Correct Answer
        const correctCombo = getRandomElement(validCombos);
        
        // 2. Select Distractors (can be anything)
        let options = [correctCombo.final];
        while(options.length < 4) {
            let randomCombo = getRandomElement(possibleCombos);
            if (!options.includes(randomCombo.final)) {
                options.push(randomCombo.final);
            }
        }
        
        // Shuffle options and find correct index
        options = options.sort(() => Math.random() - 0.5);
        const correctAnswerIndex = options.indexOf(correctCombo.final);

        // 3. Map Clinical Signs from clinicalProfiles
        const age = getRandomInt(17, 75);
        const gender = getRandomElement(["male", "female"]);
        
        let profile = knowledgeBase.clinicalProfiles[correctCombo.final];

        // 4. Inject into Template
        let text = knowledgeBase.generationGuidelines.questionTemplate;
        text = text.replace("{Age}", age).replace("{Gender}", gender);
        
        for (let key in profile) {
            let selectedValue = getRandomElement(profile[key]);
            
            if (!selectedValue || selectedValue === "" || selectedValue === "blank") {
                // Remove the entire "Key: {Key}." from the template if it's empty
                let regex = new RegExp(`${key}: \\{${key}\\}\\.\\s*`, "gi");
                text = text.replace(regex, "");
            } else {
                text = text.replace(`{${key}}`, selectedValue);
            }
        }

        let finalQuestionText = text;
        
        // 5. LLM Rephrasing via Python Backend
        try {
            const response = await fetch("/api/rephrase", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    question: text
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.rephrased) {
                    finalQuestionText = data.rephrased;
                }
            } else {
                console.log("Backend error. Falling back to template.");
            }
        } catch (err) {
            console.log("Could not connect to backend server. Falling back to template.");
        }

        // 6. Generate Feedback
        let feedback = `A cold test of '${coldTest}' indicates ${correctCombo.pulp}. `;
        feedback += `Percussion: '${percussion}' and Radiograph: '${radiograph}' with Swelling: '${swelling}' indicates ${correctCombo.apical}.`;

        return {
            question: finalQuestionText,
            options: options,
            correctAnswerIndex: correctAnswerIndex,
            feedback: feedback,
            image: "images/placeholder_nopain.jpg" // We can use a generic placeholder or map it
        };
    }

    // Initialize Quiz
    function initQuiz() {
        currentQuestionIndex = 0;
        score = 0;
        quizCardEl.classList.remove('hidden');
        completionScreenEl.classList.add('hidden');
        loadNextQuestion();
    }

    // Load Question
    async function loadNextQuestion() {
        hasAnswered = false;
        currentQuestionIndex++;
        
        // Reset UI
        feedbackPanelEl.classList.add('hidden');
        feedbackPanelEl.classList.remove('correct-fb', 'incorrect-fb');
        nextBtnEl.classList.add('hidden');
        optionsContainerEl.innerHTML = '';
        
        // Update Counter (Infinite mode)
        questionCounterEl.textContent = `Question ${currentQuestionIndex}`;
        
        // Loading State
        questionTextEl.textContent = "Generating clinical scenario...";
        
        // Generate Data
        currentQuestionData = await generateQuestionData();
        
        // Update Content
        questionTextEl.textContent = currentQuestionData.question;
        
        // Handle Image Loading
        imageWrapperEl.classList.add('loading');
        questionImageEl.classList.add('loading');
        questionImageEl.onload = () => {
            imageWrapperEl.classList.remove('loading');
            questionImageEl.classList.remove('loading');
        };
        questionImageEl.onerror = () => {
            const placeholderSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="%23e2e8f0"/><text x="50%" y="50%" font-family="sans-serif" font-size="20" fill="%2364748b" text-anchor="middle" dominant-baseline="middle">Clinical Image</text></svg>`;
            questionImageEl.src = placeholderSvg;
        };
        questionImageEl.src = currentQuestionData.image;

        // Render Options
        currentQuestionData.options.forEach((optionText, index) => {
            const btn = document.createElement('button');
            btn.className = 'option-btn';
            btn.textContent = optionText;
            btn.onclick = () => handleOptionSelect(index, btn);
            optionsContainerEl.appendChild(btn);
        });
    }

    // Handle Selection
    function handleOptionSelect(selectedIndex, selectedBtn) {
        if (hasAnswered) return;
        hasAnswered = true;

        const isCorrect = selectedIndex === currentQuestionData.correctAnswerIndex;
        const allButtons = optionsContainerEl.querySelectorAll('.option-btn');

        // Disable all buttons
        allButtons.forEach((btn, idx) => {
            btn.disabled = true;
            if (idx === currentQuestionData.correctAnswerIndex) {
                btn.classList.add('correct');
            } else if (idx === selectedIndex && !isCorrect) {
                btn.classList.add('incorrect');
            }
        });

        // Show Feedback
        feedbackPanelEl.classList.remove('hidden');
        nextBtnEl.classList.remove('hidden');
        if (isCorrect) {
            score++;
            feedbackPanelEl.classList.add('correct-fb');
            feedbackTitleEl.textContent = 'Correct!';
        } else {
            feedbackPanelEl.classList.add('incorrect-fb');
            feedbackTitleEl.textContent = 'Incorrect';
        }
        feedbackTextEl.textContent = currentQuestionData.feedback;

        nextBtnEl.textContent = 'Next Case';
    }

    // Next Question event
    nextBtnEl.addEventListener('click', () => {
        loadNextQuestion();
    });

    // Start
    initQuiz();
});
