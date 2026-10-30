const $ = id => document.getElementById(id);
const STORE = "wordly_cards_v1";
let cards = JSON.parse(localStorage.getItem(STORE) || "[]");
let editingId = null, quizCards = [], quizIndex = 0, quizScore = 0, pendingImport = [];
cards.forEach(c=>{if(typeof c.translationVerified!=="boolean")c.translationVerified=false;if(typeof c.translationFlag!=="boolean")c.translationFlag=false;if(!Array.isArray(c.translationHistory))c.translationHistory=[];});

function save(){ localStorage.setItem(STORE, JSON.stringify(cards)); renderStats(); renderCards(); renderStudyDecks(); renderAudit(); }
function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,7); }
function parseLines(text, deck){
  const rows = text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean), out=[];
  for(const line of rows){
    // يدعم الشرطة الطويلة، tab، |، =، : والشرطة العادية المحاطة بمسافات
    const match = line.match(/^(.*?)\s*(?:—|–|\t|\||=|:|,|\s-\s)\s*(.*)$/);
    let word=(match ? match[1] : line).trim(), meaning=match ? match[2].trim() : "";
    if(!word || /^(word|الكلمة)$/i.test(word)) continue;
    out.push({id:uid(),word,meaning,example:"",deck,known:false,translationFlag:false,translationVerified:false,translationHistory:[],created:Date.now()});
  }
  return out;
}
function prepareImport(text, deck){
  const incoming=parseLines(text,deck), existing=new Set(cards.map(c=>(c.deck||"")+"::"+c.word.toLocaleLowerCase()));
  const seen=new Set(), accepted=[]; let duplicate=0, missing=0;
  for(const c of incoming){const key=(c.deck||"")+"::"+c.word.toLocaleLowerCase();if(existing.has(key)||seen.has(key)){duplicate++;continue;}seen.add(key);accepted.push(c);if(!c.meaning)missing++;}
  pendingImport=accepted;
  $("importSummary").textContent=`تم التعرف على ${incoming.length} سطراً: ${accepted.length} بطاقة جديدة، ${duplicate} مكرر، و${missing} كلمة بلا ترجمة.`;
  $("importPreview").innerHTML=accepted.slice(0,30).map(c=>`<div class="preview-row"><b>${escapeHtml(c.word)}</b><span>${escapeHtml(c.meaning||"⚠ بلا ترجمة")}</span></div>`).join("")+(accepted.length>30?`<p class="tiny">تُعرض أول 30 بطاقة فقط في المعاينة، وسيتم حفظ ${accepted.length} بطاقة.</p>`:"");
  $("importDialog").showModal();
}
$("addBulk").addEventListener("click",()=>{
  const text=$("bulkInput").value, deck=$("deckName").value.trim()||"مفرداتي";
  if(!text.trim()){alert("ألصق الكلمات أولاً.");return;}
  prepareImport(text,deck);
});
$("confirmImport").addEventListener("click",e=>{
  e.preventDefault(); if(!pendingImport.length){$("importDialog").close();return;}
  cards.push(...pendingImport);const n=pendingImport.length;pendingImport=[];save();$("bulkInput").value="";$("importDialog").close();showPage("cards");alert(`تم حفظ ${n} بطاقة بنجاح.`);
});

function renderStats(){
  $("totalCount").textContent=cards.length;
  $("knownCount").textContent=cards.filter(c=>c.known).length;
  $("reviewCount").textContent=cards.filter(c=>!c.known).length;
  $("cardsTotal").textContent=`${cards.length} بطاقة`;
}
function escapeHtml(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function renderCards(){
  const decks=[...new Set(cards.map(c=>c.deck))], filter=$("deckFilter").value;
  $("deckFilter").innerHTML='<option value="all">كل المجموعات</option>'+decks.map(d=>`<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join("");
  $("deckFilter").value=decks.includes(filter)?filter:"all";
  const q=$("searchCards").value.toLowerCase(), review=$("reviewFilter").value;
  const shown=cards.filter(c=>( $("deckFilter").value==="all"||c.deck===$("deckFilter").value) && (review!=="flagged"||c.translationFlag) && (c.word.toLowerCase().includes(q)||(c.meaning||"").toLowerCase().includes(q)));
  $("cardsList").innerHTML=shown.map(c=>`<article class="word-card">
    <div class="word">${escapeHtml(c.word)}</div>
    <div class="meaning">${escapeHtml(c.meaning||"لم تضف المعنى بعد")}</div>
    ${c.example?`<div class="example">${escapeHtml(c.example)}</div>`:""}
    <div class="card-actions"><span class="${c.translationFlag?'needs-check':c.translationVerified?'known':(c.known?'known':'muted')}">${c.translationFlag?'⚠ ترجمة مشكوك فيها':c.translationVerified?'✓ ترجمة مدققة':(c.known?'✓ متقنة':'تحتاج مراجعة')}</span>
    <div class="mini-actions"><button class="mini" data-flag="${c.id}">${c.translationFlag?'إلغاء التنبيه':'الترجمة مشكوك فيها'}</button><button class="mini" data-edit="${c.id}">تعديل</button><button class="mini" data-known="${c.id}">${c.known?'إلغاء الإتقان':'أعرفها'}</button><button class="mini" data-verify="${c.id}">${c.translationVerified?'إلغاء التحقق':'تم التحقق'}</button><button class="mini" data-delete="${c.id}">حذف</button></div></div>
  </article>`).join("");
  $("emptyCards").classList.toggle("hidden",shown.length>0);
}
$("cardsList").addEventListener("click",e=>{
  const edit=e.target.dataset.edit, known=e.target.dataset.known, del=e.target.dataset.delete, flag=e.target.dataset.flag, verify=e.target.dataset.verify;
  if(flag){const c=cards.find(x=>x.id===flag);c.translationFlag=!c.translationFlag;save();}
  if(edit){const c=cards.find(x=>x.id===edit);editingId=edit;$("editWord").value=c.word;$("editMeaning").value=c.meaning;$("editExample").value=c.example;$("translationHistory").textContent=c.translationHistory?.length?`الترجمات السابقة: ${c.translationHistory.join(" ← ")}`:"لا توجد تعديلات سابقة على الترجمة.";$("editDialog").showModal();}
  if(known){const c=cards.find(x=>x.id===known);c.known=!c.known;save();}
  if(verify){const c=cards.find(x=>x.id===verify);if(c){c.translationVerified=!c.translationVerified;if(c.translationVerified)c.translationFlag=false;save();renderAudit();}}
  if(del&&confirm("هل تريد حذف هذه البطاقة؟")){cards=cards.filter(x=>x.id!==del);save();renderAudit();}
});
$("saveEdit").addEventListener("click",e=>{
  e.preventDefault();const c=cards.find(x=>x.id===editingId);if(!c)return;
  c.word=$("editWord").value.trim();const newMeaning=$("editMeaning").value.trim();if(newMeaning!==c.meaning){c.translationHistory=c.translationHistory||[];if(c.meaning)c.translationHistory.push(c.meaning);c.meaning=newMeaning;c.translationFlag=false;c.translationVerified=false;}c.example=$("editExample").value.trim();save();$("editDialog").close();
});
$("searchCards").addEventListener("input",renderCards);$("deckFilter").addEventListener("change",renderCards);$("reviewFilter").addEventListener("change",renderCards);

function showPage(name){
  document.querySelectorAll(".page").forEach(p=>p.classList.add("hidden"));
  $(name+"Page").classList.remove("hidden");
  document.querySelectorAll(".tab").forEach(t=>t.classList.toggle("active",t.dataset.page===name));
  if(name==="cards")renderCards();
  if(name==="study")loadStudy();
  if(name==="audit")renderAudit();
}
document.querySelectorAll(".tab").forEach(t=>t.addEventListener("click",()=>showPage(t.dataset.page)));

$("startQuiz").addEventListener("click",startQuiz);
function startQuiz(){
  const chosenDeck=$("quizDeckFilter").value;
  quizCards=cards.filter(c=>(chosenDeck==="all"||c.deck===chosenDeck)&&c.meaning).sort(()=>Math.random()-.5).slice(0,20);
  quizIndex=0;quizScore=0;
  if(!quizCards.length){$("quizArea").innerHTML='<p class="center muted">لا توجد بطاقات ذات معانٍ في هذه المجموعة.</p>';return;}
  showQuestion();
}
function showQuestion(){
  const c=quizCards[quizIndex];
  const setting=$("quizDirection").value;
  const direction=setting==="mixed"?(Math.random()<.5?"en-ar":"ar-en"):setting;
  const prompt=direction==="en-ar"?c.word:c.meaning;
  const correctAnswer=direction==="en-ar"?c.meaning:c.word;
  $("quizProgress").textContent=`${quizIndex+1} / ${quizCards.length}`;
  $("progressBar").style.width=`${quizIndex/quizCards.length*100}%`;
  $("quizDeck").textContent=c.deck;
  const pool=cards.filter(x=>x.id!==c.id&&x.meaning).sort(()=>Math.random()-.5).slice(0,3).map(x=>direction==="en-ar"?x.meaning:x.word);
  const options=[correctAnswer,...pool].sort(()=>Math.random()-.5);
  $("quizArea").innerHTML=`<p class="muted center">${direction==="en-ar"?"اختر الترجمة العربية":"اختر الكلمة الإنجليزية"}</p><div class="question ${direction==="ar-en"?"arabic-question":""}">${escapeHtml(prompt)}</div><div class="answers">${options.map((o,i)=>`<button class="answer" data-answer="${i}">${escapeHtml(o)}</button>`).join("")}</div><div id="feedback" class="feedback"></div>`;
  document.querySelectorAll("[data-answer]").forEach(b=>b.addEventListener("click",()=>{
    document.querySelectorAll("[data-answer]").forEach(x=>x.disabled=true);
    const correct=b.textContent===correctAnswer;b.classList.add(correct?"correct":"wrong");
    if(correct){quizScore++;$("feedback").textContent="إجابة صحيحة! أحسنت.";$("feedback").style.color="var(--green)";}
    else{$("feedback").textContent=`الإجابة الصحيحة: ${correctAnswer}`;$("feedback").style.color="var(--red)";}
    c.known=correct;save();
    const next=document.createElement("button");next.className="primary quiz-next";next.textContent=quizIndex===quizCards.length-1?"عرض النتيجة":"السؤال التالي";next.onclick=nextQuestion;$("quizArea").append(next);
  }));
}
function nextQuestion(){
  quizIndex++;
  if(quizIndex<quizCards.length)showQuestion();
  else{$("progressBar").style.width="100%";$("quizProgress").textContent=`${quizCards.length} / ${quizCards.length}`;$("quizArea").innerHTML=`<h2 class="center">انتهى الاختبار!</h2><p class="center">نتيجتك: ${quizScore} من ${quizCards.length}</p><button class="primary wide" id="again">اختبار جديد</button>`;$("again").onclick=startQuiz;}
}

/* Flashcard review */
let studyCards=[],studyIndex=0,studyRevealed=false;
function renderStudyDecks(){
  const decks=[...new Set(cards.map(c=>c.deck))], current=$("studyDeck").value;
  $("studyDeck").innerHTML='<option value="all">كل المجموعات</option>'+decks.map(d=>`<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join("");
  $("studyDeck").value=decks.includes(current)?current:"all";
  $("quizDeckFilter").innerHTML='<option value="all">كل المجموعات</option>'+decks.map(d=>`<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join("");
}
function loadStudy(){const deck=$("studyDeck").value;studyCards=cards.filter(c=>deck==="all"||c.deck===deck);studyIndex=0;studyRevealed=false;showStudyCard();}
function showStudyCard(){
  const c=studyCards[studyIndex];$("studyCount").textContent=`${studyCards.length} بطاقة`;
  if(!c){$("flashFront").textContent="أضف كلماتك للبدء";$("flashHint").textContent="ستظهر البطاقات هنا";$("flashBack").classList.add("hidden");$("studyProgress").textContent="0 / 0";$("studyBar").style.width="0%";return;}
  $("studyProgress").textContent=`${studyIndex+1} / ${studyCards.length}`;$("studyBar").style.width=`${(studyIndex+1)/studyCards.length*100}%`;
  $("flashFront").textContent=c.word;$("flashBack").textContent=c.meaning||"لم تضف الترجمة بعد";
  $("flashBack").classList.toggle("hidden",!studyRevealed);$("flashHint").classList.toggle("hidden",studyRevealed);
  $("studyFlip").textContent=studyRevealed?"إخفاء الترجمة":"إظهار الترجمة";
}
function flipStudy(){if(studyCards.length){studyRevealed=!studyRevealed;showStudyCard();}}
function moveStudy(n){if(!studyCards.length)return;studyIndex=(studyIndex+n+studyCards.length)%studyCards.length;studyRevealed=false;showStudyCard();}
$("flashcard").addEventListener("click",flipStudy);$("studyFlip").addEventListener("click",flipStudy);
$("studyPrev").addEventListener("click",()=>moveStudy(-1));$("studyNext").addEventListener("click",()=>moveStudy(1));
$("studyDeck").addEventListener("change",loadStudy);
$("studyKnown").addEventListener("click",()=>{const c=studyCards[studyIndex];if(c){c.known=true;save();moveStudy(1);}});
$("studyUnknown").addEventListener("click",()=>{const c=studyCards[studyIndex];if(c){c.known=false;save();moveStudy(1);}});
// Translation audit: local status tracking plus a ready-to-copy AI review prompt.
function auditCandidates(){const scope=$("auditScope").value;return cards.filter(c=>c.meaning&&(scope==="all"||(scope==="flagged"?c.translationFlag:(!c.translationVerified&&!c.translationFlag))));}
function updateAuditBatches(){const total=Math.max(1,Math.ceil(auditCandidates().length/30)),old=Number($("auditBatch").value)||1;$("auditBatch").innerHTML=Array.from({length:total},(_,i)=>`<option value="${i+1}">الدفعة ${i+1}</option>`).join("");$("auditBatch").value=String(Math.min(old,total));}
function renderAudit(){if(!$("auditList"))return;const unchecked=cards.filter(c=>c.meaning&&!c.translationVerified&&!c.translationFlag).length,flagged=cards.filter(c=>c.meaning&&c.translationFlag&&!c.translationVerified).length,verified=cards.filter(c=>c.translationVerified).length;$("uncheckedCount").textContent=unchecked;$("flaggedCount").textContent=flagged;$("verifiedCount").textContent=verified;$("auditCount").textContent=`${unchecked+flagged} غير مدققة`;updateAuditBatches();const items=auditCandidates();$("auditList").innerHTML=items.slice(0,60).map(c=>`<article class="audit-item"><div class="audit-state ${c.translationVerified?'verified':c.translationFlag?'flagged':'unchecked'}">${c.translationVerified?'✓ تم التحقق':c.translationFlag?'⚑ تحتاج مراجعة':'لم تُدقّق بعد'}</div><div class="audit-word">${escapeHtml(c.word)}</div><div class="audit-meaning">${escapeHtml(c.meaning)}</div><div class="audit-actions"><button class="mini" data-verify="${c.id}">${c.translationVerified?'إلغاء التحقق':'تم التحقق'}</button><button class="mini" data-flag="${c.id}">${c.translationFlag?'إزالة علامة الشك':'ترجمة مشكوك فيها'}</button><button class="mini" data-edit="${c.id}">تعديل البطاقة</button></div></article>`).join("");$("auditEmpty").classList.toggle("hidden",items.length>0);}
function makeAuditPrompt(){const items=auditCandidates(),batch=(Number($("auditBatch").value)||1)-1,part=items.slice(batch*30,(batch+1)*30);if(!part.length){$("auditPrompt").value="لا توجد كلمات في هذه الدفعة.";return;}const lines=part.map((c,i)=>`${i+1}. ${c.word} — ${c.meaning}`).join("\n");$("auditPrompt").value=`أريد منك تدقيق الترجمات الإنجليزية إلى العربية التالية بدقة. لكل كلمة: تحقق من أن المعاني العربية صحيحة وطبيعية، وأنها تغطي المعنى الشائع المقصود. لا تعتبر اختلاف الصياغة خطأ إذا كان المعنى صحيحاً. احتفظ بكل المعاني الصحيحة ولا تحذف المرادفات الصحيحة. إذا وجدت خطأ أو نقصاً، اشرح السبب باختصار واقترح التصحيح. إذا كانت الترجمة صحيحة فاكتب «صحيحة». انتبه إلى العبارات متعددة الكلمات وإلى اختلاف المعنى حسب السياق. لا تخمّن عند غياب السياق؛ اذكر ذلك. أعد النتائج مرقمة وبنفس الترتيب، مع فصل واضح بين الترجمة الأصلية والتصحيح المقترح.\n\nالقائمة:\n${lines}`;}
$("auditScope").addEventListener("change",()=>{updateAuditBatches();$("auditPrompt").value="";renderAudit();});
$("auditBatch").addEventListener("change",makeAuditPrompt);
$("makeAuditPrompt").addEventListener("click",makeAuditPrompt);
$("copyAuditPrompt").addEventListener("click",async()=>{if(!$("auditPrompt").value)makeAuditPrompt();try{await navigator.clipboard.writeText($("auditPrompt").value);alert("تم نسخ طلب التدقيق. الصقه في ChatGPT لمراجعة هذه الدفعة.");}catch(e){$("auditPrompt").select();alert("حدد النص وانسخه يدوياً.");}});
$("auditList").addEventListener("click",e=>{
  const verify=e.target.dataset.verify,flag=e.target.dataset.flag,edit=e.target.dataset.edit;
  if(verify||flag){
    const c=cards.find(x=>x.id===(verify||flag));if(!c)return;
    if(verify){c.translationVerified=!c.translationVerified;if(c.translationVerified)c.translationFlag=false;}
    if(flag){c.translationFlag=!c.translationFlag;if(c.translationFlag)c.translationVerified=false;}
    save();renderAudit();
  }else if(edit){
    const c=cards.find(x=>x.id===edit);if(!c)return;editingId=c.id;
    $("editWord").value=c.word;$("editMeaning").value=c.meaning;$("editExample").value=c.example||"";
    $("translationHistory").textContent=c.translationHistory?.length?`الترجمات السابقة: ${c.translationHistory.join(" ← ")}`:"لا توجد تعديلات سابقة على الترجمة.";
    $("editDialog").showModal();
  }
});

$("fileInput").addEventListener("change",async e=>{
  const f=e.target.files[0];if(!f)return;
  $("fileStatus").textContent="جارٍ قراءة الملف…";
  try{
    let text="";
    const ext=f.name.split(".").pop().toLowerCase();
    if(ext==="txt"||ext==="csv"||ext==="tsv") text=await f.text();
    else if(ext==="xlsx"||ext==="xls"){
      if(!window.XLSX)throw Error("تعذر تحميل قارئ Excel. تحقق من الإنترنت.");
      const data=await f.arrayBuffer(), wb=XLSX.read(data), ws=wb.Sheets[wb.SheetNames[0]];
      text=XLSX.utils.sheet_to_csv(ws,{FS:"\t"});
    }else if(ext==="pdf"){
      if(!window.pdfjsLib)throw Error("تعذر تحميل قارئ PDF. تحقق من الإنترنت.");
      pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      const pdf=await pdfjsLib.getDocument({data:await f.arrayBuffer()}).promise, lines=[];
      for(let p=1;p<=pdf.numPages;p++){const page=await pdf.getPage(p), content=await page.getTextContent();lines.push(content.items.map(i=>i.str).join(" "));}
      text=lines.join("\n");
    }else throw Error("نوع الملف غير مدعوم.");
    $("bulkInput").value=text;
    $("fileStatus").textContent=`تمت قراءة ${f.name}. راجع النص ثم اضغط إنشاء البطاقات.`;
    showPage("home");
  }catch(err){$("fileStatus").textContent="";alert(err.message||"حدث خطأ أثناء قراءة الملف.");}
  e.target.value="";
});


// Backup and restore for large vocabulary collections.
$("exportBackup").addEventListener("click",()=>{const blob=new Blob([JSON.stringify({app:"Wordly",version:2,exportedAt:new Date().toISOString(),cards},null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`wordly-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(url);});
$("backupInput").addEventListener("change",async e=>{const file=e.target.files[0];if(!file)return;try{const data=JSON.parse(await file.text());const incoming=Array.isArray(data)?data:data.cards;if(!Array.isArray(incoming))throw Error("ملف النسخة الاحتياطية غير صالح.");if(!confirm(`سيتم دمج ${incoming.length} بطاقة من النسخة مع كلماتك الحالية، دون حذف كلماتك. هل تريد المتابعة؟`))return;const keys=new Set(cards.map(c=>(c.deck||"")+"::"+(c.word||"").toLocaleLowerCase()));let added=0;for(const raw of incoming){if(!raw||typeof raw.word!=="string")continue;const key=(raw.deck||"مفرداتي")+"::"+raw.word.toLocaleLowerCase();if(keys.has(key))continue;const c={...raw,id:raw.id||uid(),deck:raw.deck||"مفرداتي",meaning:raw.meaning||"",known:!!raw.known,translationFlag:!!raw.translationFlag,translationVerified:!!raw.translationVerified,translationHistory:Array.isArray(raw.translationHistory)?raw.translationHistory:[]};cards.push(c);keys.add(key);added++;}save();renderAudit();alert(`تمت استعادة ${added} بطاقة جديدة. تم تجاوز المكرر.`);}catch(err){alert(err.message||"تعذر قراءة النسخة الاحتياطية.");}finally{e.target.value="";}});

let deferredPrompt;
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredPrompt=e;$("installBtn").classList.remove("hidden");});
$("installBtn").addEventListener("click",async()=>{if(deferredPrompt){deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$("installBtn").classList.add("hidden");}});
if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
renderStats();renderCards();renderStudyDecks();loadStudy();renderAudit();
