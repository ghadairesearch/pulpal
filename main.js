document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const questionCounterEl = document.getElementById('question-counter');
    const difficultyBadgeEl = document.getElementById('difficulty-badge');
    const questionImageEl = document.getElementById('question-image');
    const imageLoaderEl = document.getElementById('image-loader');
    const questionTextEl = document.getElementById('question-text');
    const optionsContainerEl = document.getElementById('options-container');
    const feedbackPanelEl = document.getElementById('feedback-panel');
    const feedbackTitleEl = document.getElementById('feedback-title');
    const feedbackTextEl = document.getElementById('feedback-text');
    const allExplanationsContainerEl = document.getElementById('all-explanations-container');
    const quizRatingSectionEl = document.getElementById('quiz-rating-section');
    const reviewFormContainerEl = document.getElementById('review-form-container');
    const reviewValidationMsgEl = document.getElementById('review-validation-msg');
    const nextBtnEl = document.getElementById('next-btn');
    const quizCardEl = document.getElementById('quiz-card');
    const completionScreenEl = document.getElementById('completion-screen');
    const restartBtnEl = document.getElementById('restart-btn');
    const exportReviewsBtnEl = document.getElementById('export-reviews-btn');
    const exportFinalBtnEl = document.getElementById('export-final-btn');

    // DOM Elements for Stats
    const statCorrectEl = document.getElementById('stat-correct');
    const statIncorrectEl = document.getElementById('stat-incorrect');
    const statTimeEl = document.getElementById('exam-timer');
    const progressLabelEl = document.getElementById('progress-text-label');
    const progressPercentEl = document.getElementById('progress-percentage');
    const progressBarFillEl = document.getElementById('progress-bar-fill');

    // State
    let currentQuestionIndex = 0;
    let score = 0;
    let hasAnswered = false;
    let currentQuestionData = null;
    let currentSelectedKey = null;
    let currentCorrectKey = null;
    let currentNormalizedOptions = [];
    let fallbackCasesCache = null;

    // Per-question Timing State
    let questionLoadedTime = null;
    let answerSelectedTime = null;
    let currentTimeToAnswerSec = 0;

    // Stats State
    let correctCount = 0;
    let incorrectCount = 0;
    let totalQuestionsAnswered = 0;
    let examStartTime = null;
    let timerInterval = null;

    // Local Storage Key for Reviews
    const STORAGE_KEY = 'pulpal_question_reviews_v1';

    function getStoredReviews() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            return [];
        }
    }

    function saveReviewLocally(reviewObj) {
        const list = getStoredReviews();
        const idx = list.findIndex(r => r.question_id === reviewObj.question_id);
        if (idx >= 0) {
            list[idx] = reviewObj;
        } else {
            list.push(reviewObj);
        }
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
        } catch (e) {
            console.warn('Could not save review to localStorage', e);
        }
    }

    async function exportReviewsJson() {
        let reviews = getStoredReviews();
        try {
            const res = await fetch('/api/reviews');
            if (res.ok) {
                const serverReviews = await res.json();
                if (Array.isArray(serverReviews) && serverReviews.length > 0) {
                    reviews = serverReviews;
                }
            }
        } catch (e) {
            // Use localStorage reviews if backend unavailable
        }
        const blob = new Blob([JSON.stringify(reviews, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pulpal_reviews_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    if (exportReviewsBtnEl) {
        exportReviewsBtnEl.addEventListener('click', exportReviewsJson);
    }
    if (exportFinalBtnEl) {
        exportFinalBtnEl.addEventListener('click', exportReviewsJson);
    }

    // Timer Logic
    function startTimer() {
        if (timerInterval) clearInterval(timerInterval);
        examStartTime = Date.now();
        timerInterval = setInterval(() => {
            const elapsedSecs = Math.floor((Date.now() - examStartTime) / 1000);
            const m = String(Math.floor(elapsedSecs / 60)).padStart(2, '0');
            const s = String(elapsedSecs % 60).padStart(2, '0');
            statTimeEl.textContent = `${m}:${s}`;
        }, 1000);
    }

    // Update Stats UI
    function updateStatsUI() {
        if (statCorrectEl) statCorrectEl.textContent = correctCount;
        if (statIncorrectEl) statIncorrectEl.textContent = incorrectCount;
    }

    // Update Progress UI
    function updateProgressUI(totalCases) {
        const total = totalCases || 30;
        const percent = Math.round(((currentQuestionIndex) / total) * 100);
        const clampedPercent = Math.min(100, Math.max(0, percent));
        progressLabelEl.textContent = `Question ${currentQuestionIndex} of ${total}`;
        progressPercentEl.textContent = `${clampedPercent}%`;
        progressBarFillEl.style.width = `${clampedPercent}%`;
    }

    // Fetch from Backend API or Fallback to cases.json
    async function generateQuestionData(index) {
        try {
            const response = await fetch(`/api/case/random?index=${index}`);
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return await response.json();
        } catch (err) {
            try {
                if (!fallbackCasesCache) {
                    const res = await fetch('cases.json');
                    fallbackCasesCache = await res.json();
                }
                const caseItem = fallbackCasesCache[index] || fallbackCasesCache[0];
                return {
                    ...caseItem,
                    total_cases_in_db: fallbackCasesCache.length
                };
            } catch (fallbackErr) {
                console.error("Failed to load case from backend API and fallback.", fallbackErr);
                return {
                    question: "Error: Could not load case from server. Please ensure the Python backend is running.",
                    options: { A: "Error", B: "Error", C: "Error", D: "Error" },
                    option_analysis: {},
                    total_cases_in_db: 30
                };
            }
        }
    }

    // Normalize options into [{ key: 'A', text: '...' }, ...]
    function getNormalizedOptions(questionData) {
        if (!questionData || !questionData.options) return [];
        if (Array.isArray(questionData.options)) {
            const keys = ['A', 'B', 'C', 'D'];
            return questionData.options.map((text, idx) => ({
                key: keys[idx] || String(idx + 1),
                text
            }));
        }
        return Object.entries(questionData.options).map(([key, text]) => ({
            key,
            text
        }));
    }

    // Find correct option key ('A', 'B', 'C', or 'D')
    function getCorrectOptionKey(questionData, normalizedOptions) {
        if (questionData.option_analysis) {
            for (const [key, analysis] of Object.entries(questionData.option_analysis)) {
                if (analysis && analysis.is_correct) {
                    return key;
                }
            }
        }
        if (typeof questionData.correctAnswerIndex === 'number' && normalizedOptions[questionData.correctAnswerIndex]) {
            return normalizedOptions[questionData.correctAnswerIndex].key;
        }
        return normalizedOptions[0] ? normalizedOptions[0].key : 'A';
    }

    // Initialize Quiz
    async function initQuiz() {
        currentQuestionIndex = 0;
        score = 0;
        correctCount = 0;
        incorrectCount = 0;
        totalQuestionsAnswered = 0;
        updateStatsUI();
        startTimer();
        document.querySelector('.exam-dashboard').classList.remove('hidden');
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
        feedbackTextEl.innerHTML = '';
        if (allExplanationsContainerEl) {
            allExplanationsContainerEl.innerHTML = '';
        }
        if (quizRatingSectionEl) {
            quizRatingSectionEl.classList.add('hidden');
        }
        if (reviewFormContainerEl) {
            reviewFormContainerEl.innerHTML = '';
        }
        if (reviewValidationMsgEl) {
            reviewValidationMsgEl.classList.add('hidden');
            reviewValidationMsgEl.textContent = '';
        }
        optionsContainerEl.innerHTML = '';

        // Keep image space empty
        if (questionImageEl) {
            questionImageEl.src = '';
            questionImageEl.classList.add('hidden');
        }
        if (imageLoaderEl) {
            imageLoaderEl.classList.add('hidden');
        }

        // Loading State
        questionCounterEl.textContent = `Question ${currentQuestionIndex}`;
        questionTextEl.textContent = 'Loading clinical scenario...';

        // Fetch Question Data (0-based index)
        currentQuestionData = await generateQuestionData(currentQuestionIndex - 1);
        updateProgressUI(currentQuestionData.total_cases_in_db);

        // Update Question Header (do not show original difficulty rating)
        const displayId = currentQuestionData.question_id || currentQuestionIndex;
        questionCounterEl.textContent = `Question ${displayId}`;

        // Update Question Text
        questionTextEl.textContent = currentQuestionData.question;

        // Render Options
        const normalizedOptions = getNormalizedOptions(currentQuestionData);
        currentNormalizedOptions = normalizedOptions;
        normalizedOptions.forEach(({ key, text }) => {
            const btn = document.createElement('button');
            btn.className = 'option-btn';
            btn.dataset.optionKey = key;

            const keySpan = document.createElement('span');
            keySpan.className = 'option-key';
            keySpan.textContent = key;

            const textSpan = document.createElement('span');
            textSpan.className = 'option-label-text';
            textSpan.textContent = text;

            btn.appendChild(keySpan);
            btn.appendChild(textSpan);
            btn.onclick = () => handleOptionSelect(key, btn, normalizedOptions);
            optionsContainerEl.appendChild(btn);
        });

        // Start timing for answering this question
        questionLoadedTime = performance.now();
        answerSelectedTime = null;
        currentTimeToAnswerSec = 0;
    }

    // Handle Selection
    function handleOptionSelect(selectedKey, selectedBtn, normalizedOptions) {
        if (hasAnswered) return;
        hasAnswered = true;

        // Record time to answer (seconds) and start timing for review
        answerSelectedTime = performance.now();
        currentTimeToAnswerSec = questionLoadedTime
            ? Number(((answerSelectedTime - questionLoadedTime) / 1000).toFixed(2))
            : 0;

        const correctKey = getCorrectOptionKey(currentQuestionData, normalizedOptions);
        currentSelectedKey = selectedKey;
        currentCorrectKey = correctKey;

        const isCorrect = selectedKey === correctKey;
        const allButtons = optionsContainerEl.querySelectorAll('.option-btn');

        // Disable all buttons and highlight correct/incorrect
        allButtons.forEach((btn) => {
            btn.disabled = true;
            const btnKey = btn.dataset.optionKey;
            if (btnKey === correctKey) {
                btn.classList.add('correct');
            } else if (btnKey === selectedKey && !isCorrect) {
                btn.classList.add('incorrect');
            }
        });

        // Show Feedback Panel & Separate Rating Box
        feedbackPanelEl.classList.remove('hidden');
        if (quizRatingSectionEl) {
            quizRatingSectionEl.classList.remove('hidden');
        }

        // Update Stats
        totalQuestionsAnswered++;

        const correctOptionObj = normalizedOptions.find(o => o.key === correctKey);
        const correctOptionTitle = correctOptionObj ? `${correctKey}. ${correctOptionObj.text}` : correctKey;

        if (isCorrect) {
            score++;
            correctCount++;
            feedbackPanelEl.classList.add('correct-fb');
            feedbackTitleEl.textContent = `Correct! (${correctOptionTitle})`;
        } else {
            incorrectCount++;
            feedbackPanelEl.classList.add('incorrect-fb');
            feedbackTitleEl.textContent = `Incorrect — Correct Answer: ${correctOptionTitle}`;
        }
        updateStatsUI();

        // Render explanations for ALL options (A, B, C, D)
        renderAllExplanations(selectedKey, correctKey, normalizedOptions);

        // Render the Reviewer Rating Form
        renderReviewForm(correctKey, normalizedOptions);

        nextBtnEl.textContent = currentQuestionIndex >= (currentQuestionData.total_cases_in_db || 30)
            ? 'Submit Rating & Finish Quiz'
            : 'Submit Rating & Next Question';
    }

    function renderAllExplanations(selectedKey, correctKey, normalizedOptions) {
        if (!allExplanationsContainerEl) return;
        allExplanationsContainerEl.innerHTML = '';

        const analysisMap = currentQuestionData.option_analysis;
        if (!analysisMap || Object.keys(analysisMap).length === 0) {
            feedbackTextEl.textContent = currentQuestionData.feedback || '';
            return;
        }

        feedbackTextEl.textContent = 'Detailed analysis for all diagnostic options:';

        normalizedOptions.forEach(({ key, text }) => {
            const analysis = analysisMap[key];
            if (!analysis) return;

            const isOptCorrect = Boolean(analysis.is_correct);
            const isUserChoice = key === selectedKey;

            const card = document.createElement('div');
            card.className = `option-explanation-card ${isOptCorrect ? 'explanation-correct' : 'explanation-incorrect'} ${isUserChoice ? 'user-selected-card' : ''}`;

            // Header with Option Key, Diagnosis Name, and Badges
            const header = document.createElement('div');
            header.className = 'option-explanation-header';

            const titleWrap = document.createElement('div');
            titleWrap.className = 'option-explanation-title';
            titleWrap.innerHTML = `<span class="exp-option-letter">${key}</span> <span>${text}</span>`;

            const badgesWrap = document.createElement('div');
            badgesWrap.className = 'option-explanation-badges';

            if (isUserChoice) {
                const userBadge = document.createElement('span');
                userBadge.className = 'exp-badge exp-badge-user';
                userBadge.textContent = 'Your Choice';
                badgesWrap.appendChild(userBadge);
            }

            const statusBadge = document.createElement('span');
            statusBadge.className = `exp-badge ${isOptCorrect ? 'exp-badge-correct' : 'exp-badge-incorrect'}`;
            statusBadge.textContent = isOptCorrect ? '✓ Correct (Key)' : '✕ Distractor';
            badgesWrap.appendChild(statusBadge);

            header.appendChild(titleWrap);
            header.appendChild(badgesWrap);
            card.appendChild(header);

            // Explanation Body (Pulpal, Apical, Overall)
            const body = document.createElement('div');
            body.className = 'option-explanation-body';

            if (analysis.pulpal_explanation) {
                const pItem = document.createElement('div');
                pItem.className = 'exp-row';
                pItem.innerHTML = `<strong>Pulpal Diagnosis:</strong> <span>${analysis.pulpal_explanation}</span>`;
                body.appendChild(pItem);
            }

            if (analysis.apical_explanation) {
                const aItem = document.createElement('div');
                aItem.className = 'exp-row';
                aItem.innerHTML = `<strong>Apical Diagnosis:</strong> <span>${analysis.apical_explanation}</span>`;
                body.appendChild(aItem);
            }

            if (analysis.overall_explanation) {
                const oItem = document.createElement('div');
                oItem.className = 'exp-row exp-overall';
                oItem.innerHTML = `<strong>Overall Summary:</strong> <span>${analysis.overall_explanation}</span>`;
                body.appendChild(oItem);
            }

            card.appendChild(body);
            allExplanationsContainerEl.appendChild(card);
        });
    }

    // Render Reviewer Evaluation Form
    function renderReviewForm(correctKey, normalizedOptions) {
        if (!reviewFormContainerEl) return;
        reviewFormContainerEl.innerHTML = '';

        const distractors = normalizedOptions.filter(opt => opt.key !== correctKey);

        const distractorsHtml = distractors.map(opt => `
            <div class="review-subitem" data-distractor-key="${opt.key}">
                <div class="review-subitem-title">
                    <span class="exp-option-letter">${opt.key}</span>
                    <span>${opt.text}</span>
                </div>
                <div class="review-radio-list">
                    <label class="review-radio-option">
                        <input type="radio" name="distractor_quality_${opt.key}" value="Not plausible">
                        <span><strong>Not plausible:</strong> will not be selected by any examinees.</span>
                    </label>
                    <label class="review-radio-option">
                        <input type="radio" name="distractor_quality_${opt.key}" value="Plausible, but easy to eliminate">
                        <span><strong>Plausible, but easy to eliminate:</strong> examinees with minimum amount of knowledge will be able to eliminate this distractor.</span>
                    </label>
                    <label class="review-radio-option">
                        <input type="radio" name="distractor_quality_${opt.key}" value="Difficult to eliminate">
                        <span><strong>Difficult to eliminate:</strong> Only examinees with sufficient amount of knowledge will be able to eliminate this distractor.</span>
                    </label>
                    <label class="review-radio-option">
                        <input type="radio" name="distractor_quality_${opt.key}" value="Cannot eliminate">
                        <span><strong>Cannot eliminate:</strong> The correctness of this distractor is equal to the correctness of the key.</span>
                    </label>
                </div>
            </div>
        `).join('');

        const analysisMap = currentQuestionData.option_analysis || {};
        const explanationsHtml = normalizedOptions.map(opt => {
            const isKey = opt.key === correctKey;
            const analysis = analysisMap[opt.key] || {};
            const expDetailsHtml = `
                <div class="review-exp-preview">
                    ${analysis.pulpal_explanation ? `<div class="exp-row"><strong>Pulpal Diagnosis:</strong> <span>${analysis.pulpal_explanation}</span></div>` : ''}
                    ${analysis.apical_explanation ? `<div class="exp-row"><strong>Apical Diagnosis:</strong> <span>${analysis.apical_explanation}</span></div>` : ''}
                    ${analysis.overall_explanation ? `<div class="exp-row exp-overall"><strong>Overall Summary:</strong> <span>${analysis.overall_explanation}</span></div>` : ''}
                </div>
            `;
            return `
            <div class="review-subitem" data-explanation-key="${opt.key}">
                <div class="review-subitem-title">
                    <span class="exp-option-letter ${isKey ? 'letter-key' : 'letter-distractor'}">${opt.key}</span>
                    <span>Explanation for Option ${opt.key}: ${opt.text} ${isKey ? '<em>(Key)</em>' : '<em>(Distractor)</em>'}</span>
                </div>
                ${expDetailsHtml}
                <div class="review-radio-list">
                    <label class="review-radio-option">
                        <input type="radio" name="explanation_accuracy_${opt.key}" value="Correct">
                        <span><strong>Correct:</strong> the explanation provided for the correctness or incorrectness of the option is accurate.</span>
                    </label>
                    <label class="review-radio-option">
                        <input type="radio" name="explanation_accuracy_${opt.key}" value="Incorrect">
                        <span><strong>Incorrect:</strong> the explanation provided for the correctness or incorrectness of the option is inaccurate.</span>
                    </label>
                </div>
            </div>
            `;
        }).join('');

        reviewFormContainerEl.innerHTML = `
            <div class="review-panel">
                <h3 class="review-panel-heading">Question & Explanation Evaluation</h3>

                <!-- 1. Usefulness -->
                <div class="review-block">
                    <p class="review-question-label">1. How would you rate the usefulness of the question?</p>
                    <div class="review-radio-inline">
                        <label class="review-radio-option">
                            <input type="radio" name="q_usefulness" value="Appropriate">
                            <span><strong>Appropriate</strong></span>
                        </label>
                        <label class="review-radio-option">
                            <input type="radio" name="q_usefulness" value="Inappropriate">
                            <span><strong>Inappropriate</strong></span>
                        </label>
                    </div>
                    <div class="inappropriate-reason-wrap hidden" id="inappropriate-reason-wrap">
                        <label for="inappropriate-reason-input" class="reason-label">Please explain why this question is inappropriate:</label>
                        <textarea id="inappropriate-reason-input" class="reason-textarea" rows="3" placeholder="Enter explanation for why the question is inappropriate..."></textarea>
                    </div>
                </div>

                <!-- 2. Difficulty -->
                <div class="review-block">
                    <p class="review-question-label">2. How would you rate the difficulty of the question?</p>
                    <div class="review-radio-list">
                        <label class="review-radio-option">
                            <input type="radio" name="q_difficulty" value="Easy">
                            <span><strong>Easy:</strong> More than 70% of examinees would be expected to answer the question correctly</span>
                        </label>
                        <label class="review-radio-option">
                            <input type="radio" name="q_difficulty" value="Medium">
                            <span><strong>Medium:</strong> 30% to 70% of examinees would be expected to answer the question correctly</span>
                        </label>
                        <label class="review-radio-option">
                            <input type="radio" name="q_difficulty" value="Difficult">
                            <span><strong>Difficult:</strong> Less than 30% of examinees would be expected to answer the question correctly</span>
                        </label>
                    </div>
                </div>

                <!-- 3. Quality of MCQ Distractors (each distractor) -->
                <div class="review-block">
                    <p class="review-question-label">3. How would you rate the quality of the MCQ distractors? <span class="review-subnote">(Answer for each distractor)</span></p>
                    <div class="review-subitems-group">
                        ${distractorsHtml}
                    </div>
                </div>

                <!-- 4. Medical Accuracy of Explanations (each explanation) -->
                <div class="review-block">
                    <p class="review-question-label">4. How would you rate the medical accuracy of the explanations? <span class="review-subnote">(Answer for each explanation)</span></p>
                    <div class="review-subitems-group">
                        ${explanationsHtml}
                    </div>
                </div>
            </div>
        `;

        // Toggle explanation textarea when Appropriate / Inappropriate is selected
        const usefulnessRadios = reviewFormContainerEl.querySelectorAll('input[name="q_usefulness"]');
        const reasonWrapEl = document.getElementById('inappropriate-reason-wrap');
        usefulnessRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                if (radio.value === 'Inappropriate' && radio.checked) {
                    reasonWrapEl.classList.remove('hidden');
                } else if (radio.value === 'Appropriate' && radio.checked) {
                    reasonWrapEl.classList.add('hidden');
                }
            });
        });
    }

    // Collect & Validate Review Form before advancing
    async function collectAndSubmitReview() {
        const usefulnessEl = reviewFormContainerEl.querySelector('input[name="q_usefulness"]:checked');
        const difficultyEl = reviewFormContainerEl.querySelector('input[name="q_difficulty"]:checked');
        const reasonInputEl = document.getElementById('inappropriate-reason-input');

        const missingFields = [];

        if (!usefulnessEl) {
            missingFields.push('Question usefulness (Appropriate / Inappropriate)');
        } else if (usefulnessEl.value === 'Inappropriate' && (!reasonInputEl || !reasonInputEl.value.trim())) {
            missingFields.push('Explanation for why the question is Inappropriate');
        }

        if (!difficultyEl) {
            missingFields.push('Question difficulty rating');
        }

        const distractors = currentNormalizedOptions.filter(opt => opt.key !== currentCorrectKey);
        const distractorRatings = {};
        distractors.forEach(opt => {
            const sel = reviewFormContainerEl.querySelector(`input[name="distractor_quality_${opt.key}"]:checked`);
            if (!sel) {
                missingFields.push(`Distractor quality for Option ${opt.key}`);
            } else {
                distractorRatings[opt.key] = sel.value;
            }
        });

        const explanationRatings = {};
        currentNormalizedOptions.forEach(opt => {
            const sel = reviewFormContainerEl.querySelector(`input[name="explanation_accuracy_${opt.key}"]:checked`);
            if (!sel) {
                missingFields.push(`Explanation medical accuracy for Option ${opt.key}`);
            } else {
                explanationRatings[opt.key] = sel.value;
            }
        });

        if (missingFields.length > 0) {
            if (reviewValidationMsgEl) {
                const itemsHtml = missingFields.map(field => `<li>${field}</li>`).join('');
                reviewValidationMsgEl.innerHTML = `
                    <div class="validation-msg-title">Please complete all rating fields before continuing:</div>
                    <ul class="validation-msg-list">${itemsHtml}</ul>
                `;
                reviewValidationMsgEl.classList.remove('hidden');
                reviewValidationMsgEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return false;
        }

        if (reviewValidationMsgEl) {
            reviewValidationMsgEl.classList.add('hidden');
        }

        const reviewSubmittedTime = performance.now();
        const timeToReviewSec = answerSelectedTime
            ? Number(((reviewSubmittedTime - answerSelectedTime) / 1000).toFixed(2))
            : 0;
        const totalQuestionTimeSec = questionLoadedTime
            ? Number(((reviewSubmittedTime - questionLoadedTime) / 1000).toFixed(2))
            : Number((currentTimeToAnswerSec + timeToReviewSec).toFixed(2));

        const payload = {
            question_id: currentQuestionData.question_id || currentQuestionIndex,
            question_difficulty_label: currentQuestionData.difficulty || null,
            selected_option: currentSelectedKey,
            correct_option: currentCorrectKey,
            answered_correctly: currentSelectedKey === currentCorrectKey,
            time_to_answer_seconds: currentTimeToAnswerSec,
            time_to_review_seconds: timeToReviewSec,
            total_question_time_seconds: totalQuestionTimeSec,
            usefulness: usefulnessEl.value,
            inappropriate_explanation: usefulnessEl.value === 'Inappropriate' ? reasonInputEl.value.trim() : '',
            rated_difficulty: difficultyEl.value,
            distractor_quality: distractorRatings,
            explanation_medical_accuracy: explanationRatings
        };

        // Save locally
        saveReviewLocally(payload);

        // Save to backend API
        try {
            const response = await fetch('/api/review', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) {
                throw new Error(`Review API returned ${response.status}`);
            }
        } catch (err) {
            console.warn('Could not post review to server, stored in localStorage.', err);
        }

        return true;
    }

    // Next Question event
    nextBtnEl.addEventListener('click', async () => {
        const valid = await collectAndSubmitReview();
        if (!valid) return;

        if (currentQuestionData && currentQuestionIndex >= currentQuestionData.total_cases_in_db) {
            document.querySelector('.exam-dashboard').classList.add('hidden');
            quizCardEl.classList.add('hidden');
            completionScreenEl.classList.remove('hidden');
            document.getElementById('final-score').textContent = score;
            document.getElementById('total-questions').textContent = `/ ${currentQuestionData.total_cases_in_db}`;
            clearInterval(timerInterval);
        } else {
            loadNextQuestion();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });

    // Restart event
    restartBtnEl.addEventListener('click', () => {
        initQuiz();
    });

    // Start
    initQuiz();
});
