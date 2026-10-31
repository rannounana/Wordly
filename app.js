(() => {
"use strict";
const $ = id => document.getElementById(id);
const STORE = "wordly_cards_v1";
const GROUP_STORE = "wordly_groups_v1";
const DEFAULT_GROUP = "مفرداتي";
let cards = [], groups = [], editingId = null, quizCards = [], quizIndex = 0, quizScore = 0, pendingImport = [], selectedIds = new Set();
let studyCards = [], studyIndex = 0, studyRevealed = false, deferredPrompt = null;

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const clean = value => String(value ?? "").trim();
const norm = value => clean(value).toLocaleLowerCase();
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[ch]));
}
function loadData() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORE) || "[]");
    cards = Array.isArray(parsed) ? parsed : [];
  } catch { cards = []; }
  cards = cards.filter(c => c && typeof c.word === "string").map(c => ({
    ...c,
    id: c.id || uid(),
    word: clean(c.word),
    meaning: clean(c.meaning),
    example: clean(c.example),
    deck: clean(c.deck) || DEFAULT_GROUP,
    known: !!c.known,
    translationFlag: !!c.translationFlag,
    translationVerified: !!c.translationVerified,
    translationHistory: Array.isArray(c.translationHistory) ? c.translationHistory : [],
    created: c.created || Date.now()
  }));
  try {
    const parsedGroups = JSON.parse(localStorage.getItem(GROUP_STORE) || "[]");
    groups = Array.isArray(parsedGroups) ? parsedGroups.map(clean).filter(Boolean) : [];
  } catch { groups = []; }
  groups = [...new Set([DEFAULT_GROUP, ...groups, ...cards.map(c => c.deck)])];
  persist();
}
function persist() {
  localStorage.setItem(STORE, JSON.stringify(cards));
  localStorage.setItem(GROUP_STORE, JSON.stringify(groups));
}
function save() {
  persist();
  renderStats();
  renderCards();
  renderGroupSelects();
  renderGroups();
  renderAudit();
}
function groupExists(name) { return groups.some(g => norm(g) === norm(name)); }
function addGroup(name) {
  name = clean(name);
  if (!name || groupExists(name)) return false;
  groups.push(name);
  persist();
  return true;
}
function groupOptions(includeAll = false, selected = DEFAULT_GROUP) {
  return (includeAll ? '<option value="all">كل المجموعات</option>' : "") +
    groups.map(g => `<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`).join("");
}
function fillSelect(id, includeAll = false, preserve = true) {
  const el = $(id);
  if (!el) return;
  const old = preserve ? el.value : "";
  el.innerHTML = groupOptions(includeAll);
  if (includeAll && old === "all") el.value = "all";
  else if (groups.includes(old)) el.value = old;
  else el.value = includeAll ? "all" : (groups.includes(DEFAULT_GROUP) ? DEFAULT_GROUP : groups[0]);
}
function renderGroupSelects() {
  ["deckName","deckFilter","studyDeck","quizDeckFilter","bulkMoveTarget","editDeck"].forEach(id => {
    if ($(id)) fillSelect(id, ["deckFilter","studyDeck","quizDeckFilter"].includes(id), true);
  });
}
function renderStats() {
  const total = cards.length;
  $("totalCount").textContent = total;
  $("knownCount").textContent = cards.filter(c => c.known).length;
  $("reviewCount").textContent = total - cards.filter(c => c.known).length;
  $("cardsTotal").textContent = `${total} بطاقة`;
  $("groupCount").textContent = groups.length;
  $("flaggedCountHome").textContent = cards.filter(c => c.translationFlag && !c.translationVerified).length;
  $("verifiedCountHome").textContent = cards.filter(c => c.translationVerified).length;
}
function parseLines(text, deck) {
  const rows = text.split(/\r?\n/).map(x => x.trim()).filter(Boolean), result = [];
  for (const line of rows) {
    const match = line.match(/^(.*?)\s*(?:—|–|\t|\||=|:|,|\s-\s)\s*(.*)$/);
    const word = clean(match ? match[1] : line);
    const rest = match ? clean(match[2]) : "";
    if (!word || /^(word|الكلمة)$/i.test(word)) continue;
    const pieces = rest.split(/\s*\|\s*/);
    result.push({
      id: uid(), word, meaning: clean(pieces[0]), example: clean(pieces.slice(1).join(" | ")),
      deck, known:false, translationFlag:false, translationVerified:false,
      translationHistory:[], created:Date.now()
    });
  }
  return result;
}
function prepareImport(text, deck) {
  const incoming = parseLines(text, deck);
  const existing = new Set(cards.filter(c => c.deck === deck).map(c => norm(c.word)));
  const seen = new Set(), accepted = [];
  let duplicate = 0, missing = 0;
  for (const card of incoming) {
    const key = norm(card.word);
    if (existing.has(key) || seen.has(key)) { duplicate++; continue; }
    seen.add(key); accepted.push(card);
    if (!card.meaning) missing++;
  }
  pendingImport = accepted;
  $("importSummary").textContent = `تم التعرف على ${incoming.length} سطراً: ${accepted.length} بطاقة جديدة، ${duplicate} مكرر داخل المجموعة، و${missing} كلمة بلا ترجمة.`;
  $("importPreview").innerHTML = accepted.slice(0,30).map(c =>
    `<div class="preview-row"><b>${escapeHtml(c.word)}</b><span>${escapeHtml(c.meaning || "⚠ بلا ترجمة")}</span></div>`
  ).join("") + (accepted.length > 30 ? `<p class="tiny">تُعرض أول 30 بطاقة فقط؛ سيتم حفظ ${accepted.length} بطاقة.</p>` : "");
  $("importDialog").showModal();
}
$("addBulk").addEventListener("click", () => {
  const text = $("bulkInput").value, deck = $("deckName").value;
  if (!clean(text)) { alert("ألصق الكلمات أولاً."); return; }
  prepareImport(text, deck || DEFAULT_GROUP);
});
$("newGroupImport").addEventListener("click", () => {
  const name = prompt("اكتب اسم المجموعة الجديدة:");
  if (name === null) return;
  if (!addGroup(name)) { alert("الاسم فارغ أو مستخدم بالفعل."); return; }
  renderGroupSelects(); renderGroups(); renderStats();
  $("deckName").value = clean(name);
});
$("confirmImport").addEventListener("click", e => {
  e.preventDefault();
  if (!pendingImport.length) { $("importDialog").close(); return; }
  cards.push(...pendingImport);
  const count = pendingImport.length;
  pendingImport = [];
  save();
  $("bulkInput").value = "";
  $("importDialog").close();
  showPage("cards");
  alert(`تم حفظ ${count} بطاقة بنجاح.`);
});

function filteredCards() {
  const query = norm($("searchCards").value);
  const deck = $("deckFilter").value;
  const review = $("reviewFilter").value;
  const known = $("knownFilter").value;
  return cards.filter(c =>
    (deck === "all" || c.deck === deck) &&
    (!query || norm(c.word).includes(query) || norm(c.meaning).includes(query) || norm(c.example).includes(query)) &&
    (review === "all" || (review === "flagged" ? c.translationFlag && !c.translationVerified :
      review === "verified" ? c.translationVerified : !c.translationVerified && !c.translationFlag)) &&
    (known === "all" || (known === "known" ? c.known : !c.known))
  );
}
function renderCards() {
  if (!$("cardsList")) return;
  const shown = filteredCards();
  $("cardsList").innerHTML = shown.map(c => `
    <article class="word-card">
      <label class="select-card"><input type="checkbox" data-select="${escapeHtml(c.id)}" ${selectedIds.has(c.id) ? "checked" : ""} aria-label="تحديد البطاقة"></label>
      <div class="word">${escapeHtml(c.word)}</div>
      <div class="meaning">${escapeHtml(c.meaning || "لم تضف المعنى بعد")}</div>
      ${c.example ? `<div class="example">${escapeHtml(c.example)}</div>` : ""}
      <div class="card-actions">
        <span class="${c.translationFlag ? "needs-check" : c.translationVerified ? "known" : (c.known ? "known" : "muted")}">
          ${c.translationFlag ? "⚠ ترجمة مشكوك فيها" : c.translationVerified ? "✓ ترجمة مدققة" : (c.known ? "✓ متقنة" : "تحتاج مراجعة")}
        </span>
        <small class="card-deck">${escapeHtml(c.deck)}</small>
      </div>
      <div class="mini-actions">
        <button class="mini" data-flag="${escapeHtml(c.id)}">${c.translationFlag ? "إلغاء التنبيه" : "الترجمة مشكوك فيها"}</button>
        <button class="mini" data-edit="${escapeHtml(c.id)}">تعديل</button>
        <button class="mini" data-known="${escapeHtml(c.id)}">${c.known ? "إلغاء الإتقان" : "أعرفها"}</button>
        <button class="mini" data-verify="${escapeHtml(c.id)}">${c.translationVerified ? "إلغاء التحقق" : "تم التحقق"}</button>
        <button class="mini" data-delete="${escapeHtml(c.id)}">حذف</button>
      </div>
    </article>`).join("");
  $("emptyCards").classList.toggle("hidden", shown.length > 0);
  updateSelectionBar();
}
function updateSelectionBar() {
  $("bulkMoveBar").classList.toggle("hidden", selectedIds.size === 0);
  $("selectedCount").textContent = `${selectedIds.size} محدد`;
}
function selectVisible(select) {
  filteredCards().forEach(c => select ? selectedIds.add(c.id) : selectedIds.delete(c.id));
  renderCards();
}
function moveSelected() {
  const target = $("bulkMoveTarget").value;
  if (!target || !selectedIds.size) return;
  let moved = 0, duplicates = 0;
  for (const c of cards) {
    if (!selectedIds.has(c.id) || c.deck === target) continue;
    const duplicate = cards.some(other => other.id !== c.id && other.deck === target && norm(other.word) === norm(c.word));
    if (duplicate) { duplicates++; continue; }
    c.deck = target; moved++;
  }
  selectedIds.clear(); save();
  alert(`تم نقل ${moved} بطاقة.${duplicates ? ` لم تُنقل ${duplicates} بطاقة لوجود الكلمة مسبقاً في المجموعة الهدف.` : ""}`);
}
$("cardsList").addEventListener("change", e => {
  const id = e.target.dataset.select;
  if (!id) return;
  if (e.target.checked) selectedIds.add(id); else selectedIds.delete(id);
  updateSelectionBar();
});
$("selectVisible").addEventListener("click", () => selectVisible(true));
$("deselectVisible").addEventListener("click", () => selectVisible(false));
$("clearSelection").addEventListener("click", () => { selectedIds.clear(); renderCards(); });
$("moveSelected").addEventListener("click", moveSelected);
$("deleteSelected").addEventListener("click", () => {
  if (!selectedIds.size || !confirm(`حذف ${selectedIds.size} بطاقة نهائياً؟`)) return;
  cards = cards.filter(c => !selectedIds.has(c.id));
  selectedIds.clear(); save();
});
$("cardsList").addEventListener("click", e => {
  const button = e.target.closest("button");
  if (!button) return;
  const {edit, known, del, flag, verify} = button.dataset;
  if (flag) { const c = cards.find(x => x.id === flag); if (c) { c.translationFlag = !c.translationFlag; if(c.translationFlag)c.translationVerified=false; save(); } }
  if (edit) openEdit(edit);
  if (known) { const c = cards.find(x => x.id === known); if (c) { c.known = !c.known; save(); } }
  if (verify) { const c = cards.find(x => x.id === verify); if (c) { c.translationVerified = !c.translationVerified; if(c.translationVerified)c.translationFlag=false; save(); } }
  if (del && confirm("هل تريد حذف هذه البطاقة؟")) { cards = cards.filter(x => x.id !== del); selectedIds.delete(del); save(); }
});
function openEdit(id) {
  const c = cards.find(x => x.id === id); if (!c) return;
  editingId = id;
  $("editWord").value = c.word;
  $("editMeaning").value = c.meaning || "";
  $("editExample").value = c.example || "";
  $("translationHistory").textContent = c.translationHistory.length ? `الترجمات السابقة: ${c.translationHistory.join(" ← ")}` : "لا توجد تعديلات سابقة على الترجمة.";
  $("editDeck").innerHTML = groupOptions(false, c.deck);
  $("editDeck").value = c.deck;
  $("editDialog").showModal();
}
$("editForm").addEventListener("submit", e => {
  e.preventDefault();
  const c = cards.find(x => x.id === editingId); if (!c) return;
  const word = clean($("editWord").value), meaning = clean($("editMeaning").value), deck = $("editDeck").value;
  if (!word) { alert("اكتب الكلمة أولاً."); return; }
  if (cards.some(x => x.id !== c.id && x.deck === deck && norm(x.word) === norm(word))) {
    alert("هذه الكلمة موجودة بالفعل في المجموعة المختارة."); return;
  }
  c.word = word;
  if (meaning !== c.meaning) {
    if (c.meaning) c.translationHistory.push(c.meaning);
    c.meaning = meaning; c.translationFlag = false; c.translationVerified = false;
  }
  c.example = clean($("editExample").value);
  c.deck = deck;
  $("editDialog").close(); save();
});
$("closeEdit").addEventListener("click", () => $("editDialog").close());
$("deleteEdit").addEventListener("click", () => {
  if (!editingId || !confirm("حذف هذه البطاقة؟")) return;
  cards = cards.filter(c => c.id !== editingId);
  selectedIds.delete(editingId); $("editDialog").close(); save();
});
["searchCards","deckFilter","reviewFilter","knownFilter"].forEach(id =>
  $(id).addEventListener(id === "searchCards" ? "input" : "change", renderCards)
);

function renderGroups() {
  $("groupsList").innerHTML = groups.map(g => {
    const count = cards.filter(c => c.deck === g).length;
    return `<article class="group-card">
      <div class="group-card-head"><h3>${escapeHtml(g)}</h3><span class="pill">${count} كلمة</span></div>
      <div class="group-actions">
        <button class="mini" data-open-group="${escapeHtml(g)}">عرض الكلمات</button>
        <button class="mini" data-rename-group="${escapeHtml(g)}">إعادة تسمية</button>
        ${g !== DEFAULT_GROUP ? `<button class="mini danger-text" data-delete-group="${escapeHtml(g)}">حذف المجموعة</button>` : ""}
      </div>
    </article>`;
  }).join("");
}
$("createGroupForm").addEventListener("submit", e => {
  e.preventDefault();
  const name = clean($("newGroupName").value);
  if (!addGroup(name)) { alert("اكتب اسماً جديداً غير مستخدم."); return; }
  $("newGroupName").value = "";
  save();
});
$("groupsList").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  const open = b.dataset.openGroup, rename = b.dataset.renameGroup, del = b.dataset.deleteGroup;
  if (open) { $("deckFilter").value = open; showPage("cards"); renderCards(); }
  if (rename) {
    const name = prompt("اكتب الاسم الجديد للمجموعة:", rename);
    if (name === null) return;
    const next = clean(name);
    if (!next || groups.some(g => norm(g) === norm(next) && g !== rename)) { alert("الاسم فارغ أو مستخدم بالفعل."); return; }
    groups = groups.map(g => g === rename ? next : g);
    cards.forEach(c => { if (c.deck === rename) c.deck = next; });
    save();
  }
  if (del) {
    if (!confirm(`سيتم نقل كلمات «${del}» إلى «${DEFAULT_GROUP}» ثم حذف المجموعة. هل تريد المتابعة؟`)) return;
    cards.forEach(c => { if (c.deck === del) c.deck = DEFAULT_GROUP; });
    groups = groups.filter(g => g !== del);
    save();
  }
});

function showPage(name) {
  document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
  $(name + "Page").classList.remove("hidden");
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.page === name));
  if (name === "cards") renderCards();
  if (name === "study") loadStudy();
  if (name === "audit") renderAudit();
}
document.querySelectorAll(".tab").forEach(t => t.addEventListener("click", () => showPage(t.dataset.page)));

$("startQuiz").addEventListener("click", startQuiz);
function startQuiz() {
  const deck = $("quizDeckFilter").value;
  const pool = cards.filter(c => (deck === "all" || c.deck === deck) && c.meaning);
  const lengthValue = $("quizLength").value;
  const amount = lengthValue === "all" ? pool.length : Math.min(Number(lengthValue), pool.length);
  quizCards = [...pool].sort(() => Math.random() - .5).slice(0, amount);
  quizIndex = 0; quizScore = 0;
  if (!quizCards.length) { $("quizArea").innerHTML = '<p class="center muted">لا توجد بطاقات ذات معانٍ في هذه المجموعة.</p>'; return; }
  showQuestion();
}
function showQuestion() {
  const c = quizCards[quizIndex];
  const setting = $("quizDirection").value;
  const direction = setting === "mixed" ? (Math.random() < .5 ? "en-ar" : "ar-en") : setting;
  const prompt = direction === "en-ar" ? c.word : c.meaning;
  const correctAnswer = direction === "en-ar" ? c.meaning : c.word;
  $("quizProgress").textContent = `${quizIndex+1} / ${quizCards.length}`;
  $("progressBar").style.width = `${quizIndex/quizCards.length*100}%`;
  $("quizDeck").textContent = c.deck;
  const sameDeckPool = quizCards.filter(x => x.id !== c.id);
  const distractorPool = sameDeckPool.length ? sameDeckPool : cards.filter(x => x.id !== c.id && x.meaning && x.deck === c.deck);
  const distractors = [...new Set(distractorPool.map(x => direction === "en-ar" ? x.meaning : x.word).filter(x => x && x !== correctAnswer))].sort(() => Math.random()-.5).slice(0,3);
  const options = [correctAnswer, ...distractors].sort(() => Math.random()-.5);
  $("quizArea").innerHTML = `<p class="muted center">${direction === "en-ar" ? "اختر الترجمة العربية" : "اختر الكلمة الإنجليزية"}</p>
    <div class="question ${direction === "ar-en" ? "arabic-question" : ""}">${escapeHtml(prompt)}</div>
    <div class="answers">${options.map((o,i) => `<button class="answer" data-answer="${i}">${escapeHtml(o)}</button>`).join("")}</div><div id="feedback" class="feedback"></div>`;
  $("quizArea").querySelectorAll("[data-answer]").forEach(button => button.addEventListener("click", () => {
    $("quizArea").querySelectorAll("[data-answer]").forEach(x => x.disabled = true);
    const correct = button.textContent === correctAnswer;
    button.classList.add(correct ? "correct" : "wrong");
    if (correct) { quizScore++; $("feedback").textContent = "إجابة صحيحة! أحسنت."; $("feedback").style.color = "var(--green)"; }
    else { $("feedback").textContent = `الإجابة الصحيحة: ${correctAnswer}`; $("feedback").style.color = "var(--red)"; }
    c.known = correct; save();
    const next = document.createElement("button");
    next.className = "primary quiz-next";
    next.textContent = quizIndex === quizCards.length-1 ? "عرض النتيجة" : "السؤال التالي";
    next.onclick = nextQuestion; $("quizArea").append(next);
  }));
}
function nextQuestion() {
  quizIndex++;
  if (quizIndex < quizCards.length) showQuestion();
  else {
    $("progressBar").style.width = "100%";
    $("quizProgress").textContent = `${quizCards.length} / ${quizCards.length}`;
    $("quizArea").innerHTML = `<h2 class="center">انتهى الاختبار!</h2><p class="center">نتيجتك: ${quizScore} من ${quizCards.length}</p><button class="primary wide" id="again">اختبار جديد</button>`;
    $("again").onclick = startQuiz;
  }
}

/* Flashcard review */
function renderStudyDecks() { /* select options are refreshed centrally */ }
function loadStudy() {
  const deck = $("studyDeck").value;
  studyCards = cards.filter(c => deck === "all" || c.deck === deck);
  studyIndex = 0; studyRevealed = false; showStudyCard();
}
function showStudyCard() {
  const c = studyCards[studyIndex];
  $("studyCount").textContent = `${studyCards.length} بطاقة`;
  if (!c) {
    $("flashFront").textContent = "أضف كلماتك للبدء";
    $("flashHint").textContent = "ستظهر البطاقات هنا";
    $("flashBack").classList.add("hidden");
    $("studyProgress").textContent = "0 / 0"; $("studyBar").style.width = "0%";
    return;
  }
  $("studyProgress").textContent = `${studyIndex+1} / ${studyCards.length}`;
  $("studyBar").style.width = `${(studyIndex+1)/studyCards.length*100}%`;
  $("flashFront").textContent = c.word;
  $("flashBack").textContent = c.meaning || "لم تضف الترجمة بعد";
  $("flashBack").classList.toggle("hidden", !studyRevealed);
  $("flashHint").classList.toggle("hidden", studyRevealed);
  $("studyFlip").textContent = studyRevealed ? "إخفاء الترجمة" : "إظهار الترجمة";
}
function flipStudy() { if (studyCards.length) { studyRevealed = !studyRevealed; showStudyCard(); } }
function moveStudy(n) { if (!studyCards.length) return; studyIndex = (studyIndex+n+studyCards.length)%studyCards.length; studyRevealed = false; showStudyCard(); }
$("flashcard").addEventListener("click", flipStudy);
$("studyFlip").addEventListener("click", flipStudy);
$("studyPrev").addEventListener("click", () => moveStudy(-1));
$("studyNext").addEventListener("click", () => moveStudy(1));
$("studyDeck").addEventListener("change", loadStudy);
$("studyKnown").addEventListener("click", () => { const c=studyCards[studyIndex]; if(c){c.known=true;save();moveStudy(1);} });
$("studyUnknown").addEventListener("click", () => { const c=studyCards[studyIndex]; if(c){c.known=false;save();moveStudy(1);} });

/* Translation audit */
function auditCandidates() {
  const scope = $("auditScope").value;
  return cards.filter(c => c.meaning && (scope === "all" || (scope === "flagged" ? c.translationFlag && !c.translationVerified : !c.translationVerified && !c.translationFlag)));
}
function updateAuditBatches() {
  const total = Math.max(1, Math.ceil(auditCandidates().length/30));
  const old = Number($("auditBatch").value) || 1;
  $("auditBatch").innerHTML = Array.from({length:total},(_,i)=>`<option value="${i+1}">الدفعة ${i+1}</option>`).join("");
  $("auditBatch").value = String(Math.min(old,total));
}
function renderAudit() {
  const unchecked = cards.filter(c => c.meaning && !c.translationVerified && !c.translationFlag).length;
  const flagged = cards.filter(c => c.meaning && c.translationFlag && !c.translationVerified).length;
  const verified = cards.filter(c => c.translationVerified).length;
  $("uncheckedCount").textContent = unchecked; $("flaggedCount").textContent = flagged; $("verifiedCount").textContent = verified;
  updateAuditBatches();
  const items = auditCandidates();
  $("auditList").innerHTML = items.slice(0,60).map(c => `<article class="audit-item">
    <div class="audit-state ${c.translationVerified ? "verified" : c.translationFlag ? "flagged" : "unchecked"}">${c.translationVerified ? "✓ تم التحقق" : c.translationFlag ? "⚑ تحتاج مراجعة" : "لم تُدقّق بعد"}</div>
    <div class="audit-word">${escapeHtml(c.word)}</div><div class="audit-meaning">${escapeHtml(c.meaning)}</div>
    <div class="audit-actions"><button class="mini" data-verify="${escapeHtml(c.id)}">${c.translationVerified ? "إلغاء التحقق" : "تم التحقق"}</button>
    <button class="mini" data-flag="${escapeHtml(c.id)}">${c.translationFlag ? "إزالة علامة الشك" : "ترجمة مشكوك فيها"}</button><button class="mini" data-edit="${escapeHtml(c.id)}">تعديل البطاقة</button></div></article>`).join("");
  $("auditEmpty").classList.toggle("hidden", items.length > 0);
}
function makeAuditPrompt() {
  const items = auditCandidates(), batch = (Number($("auditBatch").value)||1)-1, part = items.slice(batch*30,(batch+1)*30);
  if (!part.length) { $("auditPrompt").value = "لا توجد كلمات في هذه الدفعة."; return; }
  const lines = part.map((c,i)=>`${i+1}. ${c.word} — ${c.meaning}`).join("\n");
  $("auditPrompt").value = `أريد منك تدقيق الترجمات الإنجليزية إلى العربية التالية بدقة. تحقق من صحة المعنى وطبيعية الصياغة، ولا تعتبر اختلاف المرادفات خطأ إذا كان المعنى صحيحاً. احتفظ بالمعاني الصحيحة، واشرح الأخطاء أو النقص واقترح التصحيح. إذا غاب السياق فلا تخمّن. أعد النتائج مرقمة وبنفس الترتيب.\n\nالقائمة:\n${lines}`;
}
$("auditScope").addEventListener("change", () => { updateAuditBatches(); $("auditPrompt").value=""; renderAudit(); });
$("auditBatch").addEventListener("change", makeAuditPrompt);
$("makeAuditPrompt").addEventListener("click", makeAuditPrompt);
$("copyAuditPrompt").addEventListener("click", async () => {
  if (!$("auditPrompt").value) makeAuditPrompt();
  try { await navigator.clipboard.writeText($("auditPrompt").value); alert("تم نسخ طلب التدقيق."); }
  catch { $("auditPrompt").select(); alert("حدد النص وانسخه يدوياً."); }
});
$("auditList").addEventListener("click", e => {
  const b=e.target.closest("button"); if(!b)return;
  const c=cards.find(x=>x.id===(b.dataset.verify||b.dataset.flag||b.dataset.edit)); if(!c)return;
  if(b.dataset.verify){c.translationVerified=!c.translationVerified;if(c.translationVerified)c.translationFlag=false;save();}
  else if(b.dataset.flag){c.translationFlag=!c.translationFlag;if(c.translationFlag)c.translationVerified=false;save();}
  else if(b.dataset.edit)openEdit(c.id);
});

/* TXT / CSV / TSV / Excel / PDF import */
$("fileInput").addEventListener("change", async e => {
  const file=e.target.files[0]; if(!file)return;
  $("fileStatus").textContent="جارٍ قراءة الملف…";
  try {
    let text=""; const ext=file.name.split(".").pop().toLowerCase();
    if(["txt","csv","tsv"].includes(ext)) text=await file.text();
    else if(ext==="xlsx"||ext==="xls") {
      if(!window.XLSX)throw Error("تعذر تحميل قارئ Excel. تحقق من الإنترنت.");
      const wb=XLSX.read(await file.arrayBuffer()), ws=wb.Sheets[wb.SheetNames[0]];
      text=XLSX.utils.sheet_to_csv(ws,{FS:"\t"});
    } else if(ext==="pdf") {
      if(!window.pdfjsLib)throw Error("تعذر تحميل قارئ PDF. تحقق من الإنترنت.");
      pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      const pdf=await pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise, lines=[];
      for(let p=1;p<=pdf.numPages;p++){const page=await pdf.getPage(p),content=await page.getTextContent();lines.push(content.items.map(i=>i.str).join(" "));}
      text=lines.join("\n");
    } else throw Error("نوع الملف غير مدعوم.");
    $("bulkInput").value=text;
    $("fileStatus").textContent=`تمت قراءة ${file.name}. راجع النص ثم اضغط إنشاء البطاقات.`;
    showPage("home");
  } catch(err) { $("fileStatus").textContent=""; alert(err.message||"حدث خطأ أثناء قراءة الملف."); }
  e.target.value="";
});

/* Backup / restore. Existing backup format with {cards} remains supported. */
$("exportBackup").addEventListener("click", () => {
  const blob=new Blob([JSON.stringify({app:"Wordly",version:3,exportedAt:new Date().toISOString(),groups,cards},null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download=`wordly-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
});
$("backupInput").addEventListener("change", async e => {
  const file=e.target.files[0]; if(!file)return;
  try {
    const data=JSON.parse(await file.text()), incoming=Array.isArray(data)?data:data.cards;
    if(!Array.isArray(incoming))throw Error("ملف النسخة الاحتياطية غير صالح.");
    if(!confirm(`سيتم دمج ${incoming.length} بطاقة من النسخة مع كلماتك الحالية، دون حذف كلماتك. هل تريد المتابعة؟`))return;
    if(Array.isArray(data.groups)) data.groups.forEach(g=>{if(clean(g)&&!groupExists(g))groups.push(clean(g));});
    const keys=new Set(cards.map(c=>(c.deck||DEFAULT_GROUP)+"::"+norm(c.word)));
    let added=0;
    for(const raw of incoming) {
      if(!raw||typeof raw.word!=="string")continue;
      const deck=clean(raw.deck)||DEFAULT_GROUP,key=deck+"::"+norm(raw.word);
      if(keys.has(key))continue;
      if(!groupExists(deck))groups.push(deck);
      cards.push({...raw,id:raw.id||uid(),deck,word:clean(raw.word),meaning:clean(raw.meaning),example:clean(raw.example),known:!!raw.known,translationFlag:!!raw.translationFlag,translationVerified:!!raw.translationVerified,translationHistory:Array.isArray(raw.translationHistory)?raw.translationHistory:[],created:raw.created||Date.now()});
      keys.add(key);added++;
    }
    save();alert(`تمت استعادة ${added} بطاقة جديدة. تم تجاوز المكرر.`);
  } catch(err) { alert(err.message||"تعذر قراءة النسخة الاحتياطية."); }
  finally { e.target.value=""; }
});

/* PWA installation and initial render */
window.addEventListener("beforeinstallprompt", e => {e.preventDefault();deferredPrompt=e;$("installBtn").classList.remove("hidden");});
$("installBtn").addEventListener("click", async () => {
  if(!deferredPrompt)return;
  deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$("installBtn").classList.add("hidden");
});
loadData();
renderGroupSelects();
renderStats();
renderCards();
renderGroups();
renderStudyDecks();
loadStudy();
renderAudit();
if("serviceWorker" in navigator && location.protocol!=="file:") {
  window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
}
})();