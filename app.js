const STORE_KEY = 'english-grammar-plan-v2';
const arabicDigits = n => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
const completed = new Set();
let bestScores = {};
let openWeeks = new Set([0]);
let toastTimer;
try {
  const saved = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
  (saved.completed || []).forEach(id => completed.add(id));
  bestScores = saved.bestScores || {};
} catch { /* start with clean progress if saved data is unavailable */ }

const weeksRoot = document.getElementById('weeks');
const searchInput = document.getElementById('search');
const checkSvg = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.4"><path d="m4 10 4 4 8-9"/></svg>';
const lessonById = id => {
  const [weekIndex, dayIndex] = id.split('-').map(Number);
  return curriculum[weekIndex]?.lessons[dayIndex];
};
const isReview = title => title.includes('مراجعة') || title.includes('Review') || title.includes('Final');
const escapeHtml = value => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

function saveProgress() {
  localStorage.setItem(STORE_KEY, JSON.stringify({completed:[...completed], bestScores}));
}

function renderWeeks(query = '') {
  const needle = query.trim().toLocaleLowerCase();
  const visibleWeeks = curriculum.map((week, wi) => ({week, wi, lessons:week.lessons.map((lesson, di) => ({lesson, di})).filter(({lesson}) => !needle || `${lesson.title} ${lesson.explanation} ${week.ar} ${week.title}`.toLocaleLowerCase().includes(needle))})).filter(item => item.lessons.length);
  if (!visibleWeeks.length) {
    weeksRoot.innerHTML = '<div class="empty-state">لم أجد درسًا بهذا الاسم. جرّب كلمة أخرى.</div>';
    return;
  }
  weeksRoot.innerHTML = visibleWeeks.map(({week, wi, lessons}) => {
    const count = week.lessons.filter((_, di) => completed.has(`${wi}-${di}`)).length;
    const open = needle || openWeeks.has(wi);
    const lessonCards = lessons.map(({lesson, di}) => {
      const id = `${wi}-${di}`;
      const done = completed.has(id);
      const score = bestScores[id];
      return `<div class="lesson-row-wrap">
        <div class="lesson ${done?'done':''}" data-id="${id}">
          <span class="check" aria-hidden="true">${checkSvg}</span>
          <span class="lesson-info"><span class="lesson-day">اليوم ${arabicDigits(di+1)}</span><span class="lesson-name" lang="en" dir="auto">${escapeHtml(lesson.title)}</span></span>
          ${score !== undefined ? `<span class="lesson-tag">أفضل نتيجة ${arabicDigits(score)}/${arabicDigits(lesson.questions.length)}</span>` : ''}
          ${isReview(lesson.title) ? '<span class="lesson-tag">مراجعة</span>' : ''}
          <button class="lesson-open" type="button" data-action="open" data-id="${id}">${done?'مراجعة':'ابدأ الدرس'}</button>
        </div>
        <section class="lesson-panel" id="panel-${id}" aria-label="شرح ${escapeHtml(lesson.title)}"></section>
      </div>`;
    }).join('');
    return `<article class="week ${open?'open':''}" data-week="${wi}">
      <button class="week-head" type="button" data-action="week" aria-expanded="${open}">
        <span class="week-num">${String(wi+1).padStart(2,'0')}</span>
        <span class="week-title"><strong>${escapeHtml(week.ar)}</strong><span>${escapeHtml(week.title)}</span></span>
        <span class="week-meter"><b>${arabicDigits(count)} / ٦</b><span class="progress-track"><span class="progress-fill week-fill" style="width:${count/6*100}%"></span></span></span>
        <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
      </button>
      <div class="week-content"><div class="week-intro">${escapeHtml(week.desc)}</div><div class="lesson-list">${lessonCards}</div></div>
    </article>`;
  }).join('');
}

function openLesson(id) {
  const lesson = lessonById(id);
  const panel = document.getElementById(`panel-${id}`);
  if (!lesson || !panel) return;
  const wasOpen = panel.classList.contains('visible');
  document.querySelectorAll('.lesson-panel.visible').forEach(item => {
    item.classList.remove('visible');
    item.closest('.lesson-row-wrap')?.querySelector('.lesson')?.classList.remove('active');
  });
  if (wasOpen) return;
  const examples = lesson.examples.map(([english, arabic]) => `<div class="example"><b lang="en">${escapeHtml(english)}</b><span>${escapeHtml(arabic)}</span></div>`).join('');
  const questions = lesson.questions.map((question, qi) => `<div class="question" data-question="${qi}">
    <div class="question-prompt"><span class="question-num">${arabicDigits(qi+1)}.</span> ${escapeHtml(question.prompt)}</div>
    <div class="question-options">${question.choices.map((choice, ci) => `<button type="button" class="option" data-action="answer" data-id="${id}" data-q="${qi}" data-choice="${ci}">${escapeHtml(choice)}</button>`).join('')}</div>
    <div class="answer-feedback" aria-live="polite"></div>
  </div>`).join('');
  const done = completed.has(id);
  const best = bestScores[id];
  panel.innerHTML = `<div class="panel-top"><div><div class="panel-label">شرح الدرس · اليوم ${arabicDigits(Number(id.split('-')[1])+1)}</div><h3 class="panel-title" lang="en" dir="auto">${escapeHtml(lesson.title)}</h3></div><button class="close-panel" type="button" data-action="close" data-id="${id}">إغلاق</button></div>
    <p class="lesson-explanation">${escapeHtml(lesson.explanation)}</p>
    <div class="rule-box"><strong>القاعدة المختصرة</strong><code>${escapeHtml(lesson.rule)}</code></div>
    <h4 class="subhead">أمثلة</h4><div class="examples">${examples}</div>
    <h4 class="subhead">جرّب بنفسك</h4><div class="question-list">${questions}</div>
    <div class="lesson-actions"><span class="quiz-result">${done?'أكملت هذا الدرس. يمكنك مراجعة الشرح والتدريب.':best!==undefined?`أفضل نتيجة سابقة: ${arabicDigits(best)}/${arabicDigits(lesson.questions.length)}`:'أجب عن الأسئلة كلها بشكل صحيح لفتح إكمال الدرس.'}</span><button class="complete-btn ${done?'completed':''}" type="button" data-action="complete" data-id="${id}" ${done?'disabled':''}>${done?'تم الدرس ✓':'أكمل الأسئلة أولًا'}</button></div>`;
  panel.classList.add('visible');
  panel.closest('.lesson-row-wrap')?.querySelector('.lesson')?.classList.add('active');
  panel.scrollIntoView({behavior:'smooth', block:'nearest'});
}

function onAnswer(button) {
  const {id, q:questionIndex, choice} = button.dataset;
  const lesson = lessonById(id);
  const question = lesson?.questions[Number(questionIndex)];
  const questionEl = button.closest('.question');
  if (!question || !questionEl || button.disabled) return;
  const correct = Number(choice) === question.answer;
  questionEl.querySelectorAll('.option').forEach((option, index) => {
    option.disabled = true;
    if (index === question.answer) option.classList.add('correct');
    if (index === Number(choice) && !correct) option.classList.add('wrong');
    if (index === Number(choice)) option.classList.add('selected');
  });
  const feedback = questionEl.querySelector('.answer-feedback');
  feedback.className = `answer-feedback ${correct?'good':'bad'}`;
  feedback.textContent = `${correct?'إجابة صحيحة.':'الإجابة الصحيحة: '+question.choices[question.answer]+'.'} ${question.feedback}`;
  const panel = button.closest('.lesson-panel');
  const answered = [...panel.querySelectorAll('.question')].every(item => item.querySelector('.option:disabled'));
  if (!answered) return;
  const score = [...panel.querySelectorAll('.question')].filter(item => item.querySelector('.option.selected')?.dataset.choice === String(lesson.questions[Number(item.dataset.question)].answer)).length;
  const result = panel.querySelector('.quiz-result');
  const complete = panel.querySelector('.complete-btn');
  if (score === lesson.questions.length) {
    result.textContent = `ممتاز! نتيجتك ${arabicDigits(score)} من ${arabicDigits(lesson.questions.length)}. أتمم الدرس لتسجيل تقدمك.`;
    complete.disabled = false;
    complete.textContent = completed.has(id)?'تم الدرس ✓':'تسجيل الدرس مكتملًا';
  } else {
    result.textContent = `نتيجتك ${arabicDigits(score)} من ${arabicDigits(lesson.questions.length)}. راجع الشرح ثم أعد المحاولة.`;
    complete.disabled = true;
    complete.textContent = 'أعد حل الأسئلة';
    complete.dataset.action = 'retry';
  }
  bestScores[id] = Math.max(bestScores[id] || 0, score);
  saveProgress();
}

function retryLesson(id) {
  openLesson(id);
  const panel = document.getElementById(`panel-${id}`);
  // If the panel was already open, openLesson toggles it closed; render it directly again.
  if (!panel?.classList.contains('visible')) openLesson(id);
}

weeksRoot.addEventListener('click', event => {
  const actionEl = event.target.closest('[data-action]');
  if (!actionEl) return;
  const {action, id} = actionEl.dataset;
  if (action === 'week') {
    const week = actionEl.closest('.week');
    const wi = Number(week.dataset.week);
    week.classList.toggle('open');
    if (week.classList.contains('open')) openWeeks.add(wi); else openWeeks.delete(wi);
    actionEl.setAttribute('aria-expanded', String(week.classList.contains('open')));
  }
  if (action === 'open') openLesson(id);
  if (action === 'close') {
    const panel = document.getElementById(`panel-${id}`);
    panel?.classList.remove('visible');
    panel?.closest('.lesson-row-wrap')?.querySelector('.lesson')?.classList.remove('active');
  }
  if (action === 'answer') onAnswer(actionEl);
  if (action === 'retry') {
    document.getElementById(`panel-${id}`)?.classList.remove('visible');
    openLesson(id);
  }
  if (action === 'complete' && !actionEl.disabled) {
    completed.add(id);
    saveProgress();
    renderWeeks(searchInput.value);
    renderStats();
    const wi = Number(id.split('-')[0]);
    openWeeks.add(wi);
    renderWeeks(searchInput.value);
    openLesson(id);
    const panel = document.getElementById(`panel-${id}`);
    panel.querySelector('.complete-btn').textContent = 'تم الدرس ✓';
    panel.querySelector('.complete-btn').classList.add('completed');
    panel.querySelector('.quiz-result').textContent = 'أكملت هذا الدرس. أحسنت!';
    showToast('تم تسجيل الدرس ضمن تقدمك.');
  }
});

function renderStats() {
  const total = curriculum.reduce((sum, week) => sum + week.lessons.length, 0);
  const done = completed.size;
  const pct = Math.round(done / total * 100);
  document.getElementById('bigPercent').textContent = arabicDigits(pct);
  document.getElementById('bigCount').textContent = `${arabicDigits(done)} من ${arabicDigits(total)} درسًا`;
  document.getElementById('completedStat').textContent = `${arabicDigits(done)} / ${arabicDigits(total)}`;
  document.getElementById('remainingStat').textContent = `${arabicDigits(total-done)} درسًا`;
  document.getElementById('mainProgress').style.width = `${pct}%`;
  const current = done === total ? null : Math.min(curriculum.length, Math.floor(done/6)+1);
  document.getElementById('currentWeek').textContent = current ? `الأسبوع ${arabicDigits(current)}` : 'اكتملت الخطة';
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}

searchInput.addEventListener('input', () => renderWeeks(searchInput.value));
document.getElementById('today').textContent = new Intl.DateTimeFormat('ar-EG',{weekday:'long',day:'numeric',month:'long'}).format(new Date());
document.getElementById('resetBtn').addEventListener('click', () => {
  if (!completed.size && !Object.keys(bestScores).length) { showToast('مافيش تقدم محفوظ لإعادة ضبطه.'); return; }
  if (confirm('هل تريد مسح الدروس المكتملة ونتائج التدريب؟')) {
    completed.clear(); bestScores = {}; localStorage.removeItem(STORE_KEY);
    renderWeeks(searchInput.value); renderStats(); showToast('تمت إعادة ضبط تقدمك ونتائجك.');
  }
});

renderWeeks();
renderStats();
