(() => {
  "use strict";
  const CARD_KEY = "wordly_cards_v1";

  function readCards() {
    try {
      const data = JSON.parse(localStorage.getItem(CARD_KEY) || "[]");
      if (!Array.isArray(data)) throw new Error("بيانات الكلمات غير صالحة.");
      return data;
    } catch (error) {
      alert("تعذر قراءة الكلمات، لم يتم حذف أي شيء. " + error.message);
      return null;
    }
  }

  function addResetAllButton() {
    const panel = document.querySelector("#groupsPage .panel");
    if (!panel || document.getElementById("resetAllWords")) return;

    const wrap = document.createElement("div");
    wrap.style.cssText = "margin-top:16px;padding-top:14px;border-top:1px solid var(--line);display:flex;align-items:center;gap:10px;flex-wrap:wrap";

    const button = document.createElement("button");
    button.id = "resetAllWords";
    button.type = "button";
    button.className = "danger small";
    button.textContent = "مسح جميع الكلمات";

    const note = document.createElement("span");
    note.className = "tiny";
    note.textContent = "يمحو كلمات جميع المجموعات مع الإبقاء على أسماء المجموعات.";

    button.addEventListener("click", () => {
      const cards = readCards();
      if (!cards) return;
      if (!cards.length) {
        alert("لا توجد كلمات لحذفها.");
        return;
      }
      if (!confirm(`تحذير: سيتم حذف جميع الكلمات وعددها ${cards.length} من كل المجموعات نهائياً. ستبقى أسماء المجموعات كما هي. هل أنت متأكد؟`)) return;
      localStorage.setItem(CARD_KEY, "[]");
      alert(`تم حذف جميع الكلمات (${cards.length} كلمة). بقيت المجموعات فارغة.`);
      location.reload();
    });

    wrap.append(button, note);
    panel.appendChild(wrap);
  }

  function addGroupResetButtons() {
    const list = document.getElementById("groupsList");
    if (!list) return;

    list.querySelectorAll(".group-card").forEach(card => {
      const actions = card.querySelector(".group-actions");
      const heading = card.querySelector("h3");
      if (!actions || !heading || actions.querySelector("[data-reset-group]")) return;

      const groupName = heading.textContent.trim();
      const button = document.createElement("button");
      button.type = "button";
      button.className = "mini danger-text";
      button.dataset.resetGroup = groupName;
      button.textContent = "مسح كلمات المجموعة";

      button.addEventListener("click", () => {
        const cards = readCards();
        if (!cards) return;
        const count = cards.filter(item => (item.deck || "مفرداتي") === groupName).length;
        if (!count) {
          alert(`مجموعة «${groupName}» فارغة بالفعل.`);
          return;
        }
        if (!confirm(`تحذير: سيتم حذف كلمات مجموعة «${groupName}» وعددها ${count} نهائياً. لن تتأثر أي مجموعة أخرى. هل تريد المتابعة؟`)) return;

        const remaining = cards.filter(item => (item.deck || "مفرداتي") !== groupName);
        localStorage.setItem(CARD_KEY, JSON.stringify(remaining));
        alert(`تم حذف ${count} كلمة من مجموعة «${groupName}».`);
        location.reload();
      });

      actions.appendChild(button);
    });
  }

  function initialize() {
    addResetAllButton();
    addGroupResetButtons();

    const list = document.getElementById("groupsList");
    if (list) {
      new MutationObserver(addGroupResetButtons).observe(list, {
        childList: true,
        subtree: true
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})();