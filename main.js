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

    // DOM Elements for Stats
    const statCorrectEl = document.getElementById('stat-correct');
    const statIncorrectEl = document.getElementById('stat-incorrect');
    const statTimeEl = document.getElementById('stat-time');

    // State
    let currentQuestionIndex = 0;
    let score = 0;
    let hasAnswered = false;
    let currentQuestionData = null;

    // Stats State
    let correctCount = 0;
    let incorrectCount = 0;
    let questionStartTime = 0;
    let totalTimeElapsed = 0; // in seconds
    let totalQuestionsAnswered = 0;

    // Update Stats UI
    function updateStatsUI() {
        statCorrectEl.textContent = correctCount;
        statIncorrectEl.textContent = incorrectCount;
        if (totalQuestionsAnswered > 0) {
            const avgTime = Math.round(totalTimeElapsed / totalQuestionsAnswered);
            statTimeEl.textContent = avgTime + 's';
        } else {
            statTimeEl.textContent = '0s';
        }
    }

    // Fetch from Backend API
    async function generateQuestionData() {
        try {
            const response = await fetch('/api/case/random');
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return await response.json();
        } catch (err) {
            console.error("Failed to load case from backend API.", err);
            return {
                question: "Error: Could not load case from server. Please ensure the Python backend is running.",
                options: ["Error", "Error", "Error", "Error"],
                correctAnswerIndex: 0,
                feedback: "Ensure cases.json is present and the server is running.",
                image: ""
            };
        }
    }

    // Initialize Quiz
    async function initQuiz() {
        currentQuestionIndex = 0;
        score = 0;
        correctCount = 0;
        incorrectCount = 0;
        totalTimeElapsed = 0;
        totalQuestionsAnswered = 0;
        updateStatsUI();
        quizCardEl.classList.remove('hidden');
        completionScreenEl.classList.add('hidden');
        loadNextQuestion();
    }

    // Load Question
    async function loadNextQuestion() {
        hasAnswered = false;
        currentQuestionIndex++;
        questionStartTime = Date.now();
        
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

        // Update Stats
        const timeTaken = (Date.now() - questionStartTime) / 1000;
        totalTimeElapsed += timeTaken;
        totalQuestionsAnswered++;

        if (isCorrect) {
            score++;
            correctCount++;
            feedbackPanelEl.classList.add('correct-fb');
            feedbackTitleEl.textContent = 'Correct!';
        } else {
            incorrectCount++;
            feedbackPanelEl.classList.add('incorrect-fb');
            feedbackTitleEl.textContent = 'Incorrect';
        }
        updateStatsUI();

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
