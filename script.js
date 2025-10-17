// --- Utils ---
const debounce = (func, delay) => { let timeout; return (...args) => { clearTimeout(timeout); timeout = setTimeout(() => func.apply(this, args), delay); }; };

// --- DOM element references ---
const jsonInput = document.getElementById('json-input');
const workoutContainer = document.getElementById('workout-container');
const footerDayIndicator = document.getElementById('footer-day-indicator');
const prevBtn = document.getElementById('prev-day-btn');
const nextBtn = document.getElementById('next-day-btn');
const modal = document.getElementById('json-modal'), modalContent = document.getElementById('modal-content'), editPlanBtn = document.getElementById('edit-plan-btn'), closeModalBtn = document.getElementById('close-modal-btn'), loadWorkoutBtn = document.getElementById('load-workout-btn'), feedbackMessageContainer = document.getElementById('feedback-message');
const historyModal = document.getElementById('history-modal'), historyModalContent = document.getElementById('history-modal-content'), closeHistoryModalBtn = document.getElementById('close-history-modal-btn'), chartContainer = document.getElementById('chart-container');
const aiGenerateBtn = document.getElementById('ai-generate-btn');

// --- App State ---
let currentDayIndex = 0;
const weekOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
let workoutHistory = {};
let progressChart = null;
const defaultWorkoutJSON = { "Monday": { "workout": "Push Day", "exercises": [ { "name": "Bench Press", "sets": 4, "reps": "8-12" } ] }, "Tuesday": { "workout": "Pull Day", "exercises": [ { "name": "Pull-Ups", "sets": 4, "reps": "AMRAP" } ] }, "Wednesday": { "workout": "Rest Day", "exercises": [] }, "Thursday": { "workout": "Leg Day", "exercises": [ { "name": "Squats", "sets": 4, "reps": "8-12" } ] }, "Friday": { "workout": "Full Body", "exercises": [ { "name": "Deadlifts", "sets": 3, "reps": "5-8" } ] }, "Saturday": { "workout": "Rest Day", "exercises": [] }, "Sunday": { "workout": "Rest Day", "exercises": [] } };

// --- Data Persistence ---
function loadPlan() { jsonInput.value = localStorage.getItem('workoutPlan') || JSON.stringify(defaultWorkoutJSON, null, 4); }
function savePlan() { localStorage.setItem('workoutPlan', jsonInput.value); }
function getTodayDateString() { const today = new Date(); return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`; }
function loadHistory() { workoutHistory = JSON.parse(localStorage.getItem('workoutHistory')) || {}; }
function saveHistory() { localStorage.setItem('workoutHistory', JSON.stringify(workoutHistory)); }

function getPreviousWeight(exerciseName) {
    const todayStr = getTodayDateString();
    const sortedDates = Object.keys(workoutHistory).sort().reverse();
    for (const date of sortedDates) {
        if (date < todayStr && workoutHistory[date][exerciseName]?.weight) {
            return workoutHistory[date][exerciseName].weight;
        }
    }
    return null;
}

function generateAndCopyPrompt() {
    feedbackMessageContainer.textContent = '';
    const goal = document.getElementById('goal').value, level = document.getElementById('level').value, days = document.getElementById('days').value, requests = document.getElementById('requests').value || 'None', gender = document.getElementById('gender').value, age = document.getElementById('age').value, height = document.getElementById('height').value, weight = document.getElementById('weight').value, workoutType = document.getElementById('workout_type').value, equipment = document.getElementById('equipment').value, timeAvailable = document.getElementById('time_available').value;
    const userPrompt = `You are an expert fitness coach. Create a highly detailed and personalized 7-day workout plan for a user with the following details:\n- Goal: ${goal}\n- Experience Level: ${level}\n- Gender: ${gender}\n- Age: ${age}\n- Weight: ${weight} kg\n- Height: ${height} cm\n- Preferred Workout Style: ${workoutType}\n- Equipment Access: ${equipment}\n- Training Days per Week: ${days}\n- Time Available per Session: ${timeAvailable} minutes\n- Special Requests: ${requests}\n\nYour response MUST be ONLY the raw JSON object, without any surrounding text, explanations, or markdown formatting. The JSON must follow this exact structure:\n{\n  "Monday": {"workout": "Workout Type", "exercises": [{"name": "Exercise Name", "sets": number, "reps": "rep range"}]},\n  "Tuesday": {"workout": "...", "exercises": [...]},\n  "Wednesday": {"workout": "...", "exercises": [...]},\n  "Thursday": {"workout": "...", "exercises": [...]},\n  "Friday": {"workout": "...", "exercises": [...]},\n  "Saturday": {"workout": "...", "exercises": [...]},\n  "Sunday": {"workout": "...", "exercises": [...]}\n}\n\nFor rest days, the "workout" should be "Rest Day" and the "exercises" array should be empty.`;
    navigator.clipboard.writeText(userPrompt).then(() => {
        feedbackMessageContainer.textContent = '✅ Prompt copied! Paste it into the new Gemini tab.';
        window.open('https://gemini.google.com', '_blank');
    }, () => {
        feedbackMessageContainer.textContent = 'Failed to copy prompt.';
    });
}

// --- UI Rendering & Logic ---
function renderWorkoutPlan() {
    workoutContainer.innerHTML = '';
    let workoutData;
    try { workoutData = JSON.parse(jsonInput.value); } catch (error) { workoutData = defaultWorkoutJSON; }
    const todayStr = getTodayDateString();
    const todaysProgress = workoutHistory[todayStr] || {};

    const checkIconDone = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5 text-[var(--m3-primary)]"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`;
    const checkIconNotDone = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5 text-[var(--m3-on-surface-variant)]"><path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`;

    weekOrder.forEach((day, index) => {
        const dayData = workoutData[day];
        const dayContainer = document.createElement('div');
        dayContainer.className = "day-page w-full h-full p-3 sm:p-4";
        dayContainer.dataset.dayIndex = index;

        if (dayData && dayData.exercises) {
            const isRestDay = dayData.workout.toLowerCase().includes('rest') || dayData.exercises.length === 0;
            const tagColor = isRestDay ? 'bg-[#3e4659] text-[#c8d9f0]' : 'bg-[#004885] text-[#d3e4ff]';
            let exercisesHtml = '<ul class="space-y-2 flex-grow">';
            if (dayData.exercises.length > 0) {
                dayData.exercises.forEach((ex) => {
                    const progress = todaysProgress[ex.name] || {};
                    const isDone = progress.done || false;
                    const currentWeight = progress.weight || '';
                    const prevWeight = getPreviousWeight(ex.name);
                    const completedClass = isDone ? 'exercise-completed' : '';

                    exercisesHtml += `
                        <li class="exercise-item flex flex-col gap-1.5 p-2 bg-[var(--m3-surface-variant)] rounded-lg transition-all ${completedClass}" data-name="${ex.name}">
                            <div class="flex justify-between items-start gap-3">
                                <h4 class="text-sm font-bold flex-grow pr-2">${ex.name}</h4>
                                <div class="flex items-center gap-1 text-[var(--m3-on-surface-variant)]">
                                    <button class="google-image-search-btn p-1.5 rounded-full hover:bg-[var(--m3-secondary-container)] transition-colors" title="Search for form"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg></button>
                                    <div class="w-px h-4 bg-[var(--m3-outline)]"></div>
                                    <button class="show-chart-btn p-1.5 rounded-full hover:bg-[var(--m3-secondary-container)] transition-colors" title="View history chart"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg></button>
                                </div>
                            </div>
                            <div class="flex items-center gap-4 text-xs text-[var(--m3-on-surface-variant)]">
                                <span>Sets x <strong class="text-[var(--m3-on-surface)]">${ex.sets}</strong></span>
                                <span>Reps <strong class="text-[var(--m3-on-surface)]">${ex.reps}</strong></span>
                            </div>
                            <div class="flex justify-between items-center gap-3 bg-[var(--m3-surface)] p-1.5 rounded-md">
                                <div class="flex items-center gap-2 flex-grow">
                                    <button class="complete-btn" title="Mark as complete">${isDone ? checkIconDone : checkIconNotDone}</button>
                                    <div class="flex items-center gap-1">
                                        <input type="number" value="${currentWeight}" placeholder="kg" class="weight-input bg-[var(--m3-surface)] text-center w-14 rounded-md p-1 border border-[var(--m3-outline)] focus:border-[var(--m3-primary)] focus:ring-2 focus:ring-[var(--m3-primary-container)] focus:outline-none transition text-sm" data-name="${ex.name}">
                                    </div>
                                </div>
                                <div class="text-xs text-center text-[var(--m3-on-surface-variant)]">
                                    Prev: <strong class="text-[var(--m3-on-surface)]">${prevWeight ? `${prevWeight} kg` : 'N/A'}</strong>
                                </div>
                            </div>
                        </li>`;
                });
            } else { exercisesHtml += `<li class="text-center text-[var(--m3-on-surface-variant)] p-4">Enjoy your rest!</li>`; }
            exercisesHtml += '</ul>';
            exercisesHtml += '<div class="h-32"></div>'; 

            dayContainer.innerHTML = `<div class="max-w-xl mx-auto"><div class="flex justify-between items-center mb-3"><h3 class="text-lg font-bold">${dayData.workout}</h3><span class="text-xs font-semibold px-2 py-0.5 rounded-full ${tagColor}">${day.toUpperCase()}</span></div>${exercisesHtml}</div>`;
        } else { dayContainer.innerHTML = `<div class="text-center text-gray-500 pt-20">No workout scheduled for ${day}.</div>`; }
        workoutContainer.appendChild(dayContainer);
    });
    addExerciseListeners();
    updateDayView();
}

const handleWeightInput = debounce((inputElement) => {
    const listItem = inputElement.closest('.exercise-item');
    const completeBtn = listItem.querySelector('.complete-btn');
    const exerciseName = inputElement.dataset.name;
    const weight = inputElement.value.trim();
    const todayStr = getTodayDateString();
    if (!workoutHistory[todayStr]) workoutHistory[todayStr] = {};
    const hasWeight = weight !== '';
    if (!workoutHistory[todayStr][exerciseName]) workoutHistory[todayStr][exerciseName] = { weight: '', done: false };
    workoutHistory[todayStr][exerciseName].weight = weight;
    workoutHistory[todayStr][exerciseName].done = hasWeight;
    saveHistory();

    const checkIconDone = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5 text-[var(--m3-primary)]"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`;
    const checkIconNotDone = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5 text-[var(--m3-on-surface-variant)]"><path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`;

    if (hasWeight) {
        listItem.classList.add('exercise-completed');
        completeBtn.innerHTML = checkIconDone;
    } else {
        listItem.classList.remove('exercise-completed');
        completeBtn.innerHTML = checkIconNotDone;
    }
}, 800);

function addExerciseListeners() {
    document.querySelectorAll('.google-image-search-btn').forEach(btn => { btn.addEventListener('click', (e) => { e.stopPropagation(); const exerciseName = btn.closest('.exercise-item').dataset.name; window.open(`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(exerciseName + " exercise form")}`, '_blank'); }); });
    document.querySelectorAll('.show-chart-btn').forEach(btn => { btn.addEventListener('click', (e) => { e.stopPropagation(); const exerciseName = btn.closest('.exercise-item').dataset.name; showExerciseChart(exerciseName); }); });
    document.querySelectorAll('.weight-input').forEach(input => { input.addEventListener('input', () => handleWeightInput(input)); });
    
    document.querySelectorAll('.complete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const listItem = btn.closest('.exercise-item');
            const exerciseName = listItem.dataset.name;
            const todayStr = getTodayDateString();
            if (!workoutHistory[todayStr]) workoutHistory[todayStr] = {};
            if (!workoutHistory[todayStr][exerciseName]) workoutHistory[todayStr][exerciseName] = { weight: '', done: false };
            
            const isCurrentlyDone = workoutHistory[todayStr][exerciseName].done;
            workoutHistory[todayStr][exerciseName].done = !isCurrentlyDone;
            saveHistory();

            const checkIconDone = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5 text-[var(--m3-primary)]"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`;
            const checkIconNotDone = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5 text-[var(--m3-on-surface-variant)]"><path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`;
            listItem.classList.toggle('exercise-completed');
            btn.innerHTML = !isCurrentlyDone ? checkIconDone : checkIconNotDone;
        });
    });
}

function updateDayView() { 
    document.querySelectorAll('.day-page').forEach(page => {
        if (parseInt(page.dataset.dayIndex) === currentDayIndex) {
            page.classList.add('active');
        } else {
            page.classList.remove('active');
        }
    });
    
    footerDayIndicator.textContent = weekOrder[currentDayIndex];
    prevBtn.disabled = currentDayIndex === 0; 
    nextBtn.disabled = currentDayIndex === weekOrder.length - 1; 
    prevBtn.classList.toggle('opacity-50', currentDayIndex === 0); 
    nextBtn.classList.toggle('opacity-50', currentDayIndex === weekOrder.length - 1); 
}

function showNextDay() { if (currentDayIndex < weekOrder.length - 1) { currentDayIndex++; updateDayView(); } }
function showPrevDay() { if (currentDayIndex > 0) { currentDayIndex--; updateDayView(); } }
function openModal(modalEl, contentEl) { modalEl.classList.remove('hidden'); setTimeout(() => contentEl.classList.remove('scale-95', 'opacity-0'), 10); }
function closeModal(modalEl, contentEl) { contentEl.classList.add('scale-95', 'opacity-0'); setTimeout(() => modalEl.classList.add('hidden'), 300); }

function showExerciseChart(exerciseName) {
    const historyData = { labels: [], weights: [] };
    const sortedDates = Object.keys(workoutHistory).sort();
    sortedDates.forEach(date => { if (workoutHistory[date]?.[exerciseName]?.weight) { historyData.labels.push(date); historyData.weights.push(parseFloat(workoutHistory[date][exerciseName].weight)); } });
    document.getElementById('history-modal-title').textContent = `${exerciseName} History`;
    openModal(historyModal, historyModalContent);
    if (progressChart) progressChart.destroy();
    const ctx = document.getElementById('progress-chart').getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(163, 199, 255, 0.4)'); // --m3-primary with alpha
    gradient.addColorStop(1, 'rgba(163, 199, 255, 0)');

    progressChart = new Chart(ctx, {
        type: 'line', 
        data: { 
            labels: historyData.labels, 
            datasets: [{ 
                label: `${exerciseName} Weight (kg)`, 
                data: historyData.weights, 
                borderColor: '#a3c7ff', // --m3-primary
                backgroundColor: gradient, 
                fill: true, 
                tension: 0.3, 
                pointBackgroundColor: '#a3c7ff', // --m3-primary
                pointBorderColor: '#1f2228', // --m3-surface-variant
                pointHoverBackgroundColor: '#fff', 
                pointHoverBorderColor: '#a3c7ff', // --m3-primary
                borderWidth: 2, 
                pointRadius: 4, 
                pointHoverRadius: 6 
            }] 
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            scales: { 
                y: { 
                    beginAtZero: false, 
                    grid: { color: 'rgba(255, 255, 255, 0.15)' }, 
                    ticks: { color: '#c4c6d0', font: { family: "'Inter', sans-serif" } } // --m3-on-surface-variant
                }, 
                x: { 
                    grid: { display: false }, 
                    ticks: { color: '#c4c6d0', font: { family: "'Inter', sans-serif" } } // --m3-on-surface-variant
                } 
            }, 
            plugins: { 
                legend: { display: false }, 
                tooltip: { 
                    backgroundColor: 'var(--m3-surface-variant)', 
                    titleColor: 'var(--m3-on-surface)', 
                    bodyColor: 'var(--m3-on-surface-variant)', 
                    padding: 12, 
                    cornerRadius: 12, 
                    displayColors: false, 
                    callbacks: { label: (context) => `${context.raw} kg` } 
                } 
            } 
        }
    });
}

function updateHistoryOnPlanChange(oldPlan, newPlan) {
    const dayMap = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const removedExercisesByDay = {};
    weekOrder.forEach(day => {
        const oldExercises = oldPlan[day]?.exercises.map(ex => ex.name) || [];
        const newExercises = newPlan[day]?.exercises.map(ex => ex.name) || [];
        const removed = oldExercises.filter(exName => !newExercises.includes(exName));
        if (removed.length > 0) removedExercisesByDay[day] = removed;
    });
    if (Object.keys(removedExercisesByDay).length === 0) return;
    Object.keys(workoutHistory).forEach(date => {
        const dayOfWeekName = dayMap[new Date(date + 'T00:00:00Z').getUTCDay()];
        if (removedExercisesByDay[dayOfWeekName]) {
            removedExercisesByDay[dayOfWeekName].forEach(exNameToRemove => {
                if (workoutHistory[date][exNameToRemove]) {
                    delete workoutHistory[date][exNameToRemove];
                }
            });
        }
    });
}

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    loadHistory();
    loadPlan();
    const today = new Date().getDay();
    currentDayIndex = (today === 0) ? 6 : today - 1;
    renderWorkoutPlan();
});

editPlanBtn.addEventListener('click', () => openModal(modal, modalContent));
closeModalBtn.addEventListener('click', () => { feedbackMessageContainer.textContent = ''; closeModal(modal, modalContent); });
loadWorkoutBtn.addEventListener('click', () => {
    feedbackMessageContainer.textContent = '';
    let oldPlan, newPlan;
    try { oldPlan = JSON.parse(localStorage.getItem('workoutPlan') || JSON.stringify(defaultWorkoutJSON)); } catch (e) { oldPlan = defaultWorkoutJSON; }
    try { newPlan = JSON.parse(jsonInput.value); } catch(e) { feedbackMessageContainer.textContent = 'Invalid JSON. Please fix before saving.'; feedbackMessageContainer.classList.add('text-red-400'); return; }
    updateHistoryOnPlanChange(oldPlan, newPlan);
    savePlan();
    saveHistory();
    renderWorkoutPlan();
    closeModal(modal, modalContent);
});
prevBtn.addEventListener('click', showPrevDay);
nextBtn.addEventListener('click', showNextDay);
aiGenerateBtn.addEventListener('click', generateAndCopyPrompt);
closeHistoryModalBtn.addEventListener('click', () => closeModal(historyModal, historyModalContent));
