/* =======================================================================
   MODERN TASK MANAGER — APPLICATION LOGIC
   Vanilla JS (ES6+). No dependencies, no frameworks.

   Structure:
     1. Constants & DOM references
     2. State
     3. Persistence (LocalStorage)
     4. Utilities
     5. Rendering
     6. Task operations (CRUD)
     7. Filtering / Sorting / Search
     8. Toast notifications
     9. Theme
     10. Confirm dialog
     11. Event bindings
     12. Init
   ======================================================================= */

(() => {
  "use strict";

  /* ---------------------------------------------------------------------
     1. CONSTANTS & DOM REFERENCES
     --------------------------------------------------------------------- */
  const STORAGE_KEY = "taskManager.tasks.v1";
  const THEME_KEY = "taskManager.theme.v1";

  const dom = {
    form: document.getElementById("taskForm"),
    input: document.getElementById("taskInput"),
    inputError: document.getElementById("inputError"),
    taskList: document.getElementById("taskList"),
    emptyState: document.getElementById("emptyState"),
    emptyStateTitle: document.getElementById("emptyStateTitle"),
    emptyStateText: document.getElementById("emptyStateText"),

    searchInput: document.getElementById("searchInput"),
    sortSelect: document.getElementById("sortSelect"),
    filterChips: Array.from(document.querySelectorAll(".chip")),

    statTotal: document.getElementById("statTotal"),
    statActive: document.getElementById("statActive"),
    statCompleted: document.getElementById("statCompleted"),
    statPercent: document.getElementById("statPercent"),
    progressFill: document.getElementById("progressFill"),

    taskCounter: document.getElementById("taskCounter"),
    clearCompletedBtn: document.getElementById("clearCompletedBtn"),
    deleteAllBtn: document.getElementById("deleteAllBtn"),

    themeToggle: document.getElementById("themeToggle"),
    todayDate: document.getElementById("todayDate"),

    dialogOverlay: document.getElementById("confirmDialog"),
    dialogConfirm: document.getElementById("dialogConfirm"),
    dialogCancel: document.getElementById("dialogCancel"),

    toastContainer: document.getElementById("toastContainer"),
  };

  /* ---------------------------------------------------------------------
     2. STATE
     --------------------------------------------------------------------- */
  const state = {
    tasks: [],           // { id, title, completed, createdAt }
    filter: "all",        // 'all' | 'active' | 'completed'
    sort: "newest",        // 'newest' | 'oldest' | 'alphabetical'
    search: "",
    editingId: null,
  };

  /* ---------------------------------------------------------------------
     3. PERSISTENCE
     --------------------------------------------------------------------- */
  const storage = {
    loadTasks() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
      } catch (err) {
        console.error("Failed to load tasks from storage:", err);
        return [];
      }
    },
    saveTasks(tasks) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
      } catch (err) {
        console.error("Failed to save tasks to storage:", err);
      }
    },
    loadTheme() {
      try {
        return localStorage.getItem(THEME_KEY);
      } catch {
        return null;
      }
    },
    saveTheme(theme) {
      try {
        localStorage.setItem(THEME_KEY, theme);
      } catch (err) {
        console.error("Failed to save theme:", err);
      }
    },
  };

  /* ---------------------------------------------------------------------
     4. UTILITIES
     --------------------------------------------------------------------- */
  const utils = {
    generateId: () => `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,

    escapeHtml: (str) =>
      str.replace(/[&<>"']/g, (ch) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[ch])),

    formatDate: (isoString) => {
      const date = new Date(isoString);
      return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    },

    formatToday: () =>
      new Date().toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      }),

    debounce: (fn, delay = 200) => {
      let timer;
      return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
      };
    },
  };

  /* ---------------------------------------------------------------------
     5. RENDERING
     --------------------------------------------------------------------- */
  const render = {
    /** Applies search, filter and sort to produce the visible task list. */
    getVisibleTasks() {
      let list = [...state.tasks];

      // Filter by status
      if (state.filter === "active") list = list.filter((t) => !t.completed);
      if (state.filter === "completed") list = list.filter((t) => t.completed);

      // Filter by search term
      if (state.search.trim()) {
        const q = state.search.trim().toLowerCase();
        list = list.filter((t) => t.title.toLowerCase().includes(q));
      }

      // Sort
      switch (state.sort) {
        case "oldest":
          list.sort((a, b) => a.createdAt - b.createdAt);
          break;
        case "alphabetical":
          list.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
          break;
        case "newest":
        default:
          list.sort((a, b) => b.createdAt - a.createdAt);
          break;
      }

      return list;
    },

    taskItem(task) {
      const li = document.createElement("li");
      li.className = `task-item${task.completed ? " is-completed" : ""}`;
      li.dataset.id = task.id;

      const isEditing = state.editingId === task.id;

      li.innerHTML = `
        <button
          class="task-item__check"
          type="button"
          role="checkbox"
          aria-checked="${task.completed}"
          aria-label="${task.completed ? "Mark task as active" : "Mark task as completed"}"
        >
          <svg viewBox="0 0 24 24"><path d="M5 12.5L9.5 17L19 7" /></svg>
        </button>

        <div class="task-item__body">
          ${
            isEditing
              ? `<input type="text" class="task-item__edit-input" value="${utils.escapeHtml(task.title)}" maxlength="140" aria-label="Edit task title" />`
              : `<span class="task-item__title">${utils.escapeHtml(task.title)}</span>
                 <span class="task-item__meta">Added ${utils.formatDate(task.createdAt)}</span>`
          }
        </div>

        <div class="task-item__actions">
          ${
            isEditing
              ? `<button class="task-item__btn task-item__btn--save" type="button" aria-label="Save task">
                   <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 12.5L9.5 17L19 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                 </button>`
              : `<button class="task-item__btn task-item__btn--edit" type="button" aria-label="Edit task">
                   <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 20l.9-3.6L16.4 5 19 7.6 7.6 19 4 20Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>
                 </button>`
          }
          <button class="task-item__btn task-item__btn--danger" type="button" aria-label="Delete task">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 6h14M9 6V4.5A1.5 1.5 0 0110.5 3h3A1.5 1.5 0 0115 4.5V6m2 0-.7 13.1A2 2 0 0114.3 21H9.7a2 2 0 01-2-1.9L7 6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>
      `;

      return li;
    },

    taskList() {
      const visible = render.getVisibleTasks();
      dom.taskList.innerHTML = "";

      if (visible.length === 0) {
        dom.taskList.hidden = true;
        dom.emptyState.hidden = false;
        render.emptyState();
      } else {
        dom.taskList.hidden = false;
        dom.emptyState.hidden = true;
        const fragment = document.createDocumentFragment();
        visible.forEach((task) => fragment.appendChild(render.taskItem(task)));
        dom.taskList.appendChild(fragment);

        // Autofocus the edit input if a task is being edited
        if (state.editingId) {
          const input = dom.taskList.querySelector(".task-item__edit-input");
          if (input) {
            input.focus();
            input.setSelectionRange(input.value.length, input.value.length);
          }
        }
      }
    },

    emptyState() {
      const hasTasks = state.tasks.length > 0;
      const hasSearch = state.search.trim().length > 0;

      if (!hasTasks) {
        dom.emptyStateTitle.textContent = "No tasks yet";
        dom.emptyStateText.textContent = "Add your first task above to get started.";
      } else if (hasSearch) {
        dom.emptyStateTitle.textContent = "No matches found";
        dom.emptyStateText.textContent = `Nothing matches "${state.search.trim()}".`;
      } else if (state.filter === "active") {
        dom.emptyStateTitle.textContent = "Nothing active";
        dom.emptyStateText.textContent = "Every task is completed. Nice work!";
      } else if (state.filter === "completed") {
        dom.emptyStateTitle.textContent = "Nothing completed yet";
        dom.emptyStateText.textContent = "Complete a task to see it here.";
      }
    },

    stats() {
      const total = state.tasks.length;
      const completed = state.tasks.filter((t) => t.completed).length;
      const active = total - completed;
      const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

      dom.statTotal.textContent = total;
      dom.statActive.textContent = active;
      dom.statCompleted.textContent = completed;
      dom.statPercent.textContent = `${percent}%`;

      dom.progressFill.style.width = `${percent}%`;
      dom.progressFill.setAttribute("aria-valuenow", String(percent));

      const itemWord = total === 1 ? "item" : "items";
      dom.taskCounter.textContent = `${active} ${active === 1 ? "item" : "items"} left of ${total} ${itemWord}`;

      dom.clearCompletedBtn.disabled = completed === 0;
      dom.deleteAllBtn.disabled = total === 0;
    },

    all() {
      render.taskList();
      render.stats();
      storage.saveTasks(state.tasks);
    },
  };

  /* ---------------------------------------------------------------------
     6. TASK OPERATIONS (CRUD)
     --------------------------------------------------------------------- */
  const taskOps = {
    add(rawTitle) {
      const title = rawTitle.trim().replace(/\s+/g, " ");

      if (!title) {
        taskOps.showInputError("Task can't be empty.");
        return false;
      }
      if (title.length > 140) {
        taskOps.showInputError("Task is too long (max 140 characters).");
        return false;
      }

      const task = {
        id: utils.generateId(),
        title,
        completed: false,
        createdAt: Date.now(),
      };

      state.tasks.push(task);
      render.all();
      toast.show("Task added", "success");
      return true;
    },

    showInputError(message) {
      dom.inputError.textContent = message;
      dom.form.classList.add("is-invalid");
      setTimeout(() => dom.form.classList.remove("is-invalid"), 350);
    },

    clearInputError() {
      dom.inputError.textContent = "";
    },

    toggleComplete(id) {
      const task = state.tasks.find((t) => t.id === id);
      if (!task) return;
      task.completed = !task.completed;
      render.all();
      toast.show(task.completed ? "Task completed" : "Task restored", task.completed ? "success" : "info");
    },

    startEdit(id) {
      state.editingId = id;
      render.taskList();
    },

    saveEdit(id, rawTitle) {
      const title = rawTitle.trim().replace(/\s+/g, " ");
      const task = state.tasks.find((t) => t.id === id);
      if (!task) return;

      if (!title) {
        // Treat an emptied edit as a cancel — don't allow blank tasks.
        state.editingId = null;
        render.all();
        return;
      }

      task.title = title.slice(0, 140);
      state.editingId = null;
      render.all();
      toast.show("Task updated", "info");
    },

    cancelEdit() {
      state.editingId = null;
      render.taskList();
    },

    remove(id) {
      const el = dom.taskList.querySelector(`[data-id="${id}"]`);
      const finish = () => {
        state.tasks = state.tasks.filter((t) => t.id !== id);
        render.all();
        toast.show("Task deleted", "danger");
      };

      if (el) {
        el.classList.add("is-removing");
        el.addEventListener("animationend", finish, { once: true });
      } else {
        finish();
      }
    },

    clearCompleted() {
      const count = state.tasks.filter((t) => t.completed).length;
      if (count === 0) return;
      state.tasks = state.tasks.filter((t) => !t.completed);
      render.all();
      toast.show(`Cleared ${count} completed ${count === 1 ? "task" : "tasks"}`, "danger");
    },

    deleteAll() {
      state.tasks = [];
      render.all();
      toast.show("All tasks deleted", "danger");
    },
  };

  /* ---------------------------------------------------------------------
     8. TOAST NOTIFICATIONS
     --------------------------------------------------------------------- */
  const toast = {
    show(message, type = "success", duration = 2600) {
      const el = document.createElement("div");
      el.className = `toast toast--${type}`;
      el.setAttribute("role", "status");
      el.innerHTML = `<span class="toast__dot"></span><span>${utils.escapeHtml(message)}</span>`;

      dom.toastContainer.appendChild(el);

      const remove = () => {
        el.classList.add("is-leaving");
        el.addEventListener("animationend", () => el.remove(), { once: true });
      };

      setTimeout(remove, duration);
    },
  };

  /* ---------------------------------------------------------------------
     9. THEME
     --------------------------------------------------------------------- */
  const theme = {
    apply(mode) {
      document.documentElement.setAttribute("data-theme", mode);
      dom.themeToggle.setAttribute("aria-pressed", String(mode === "dark"));
      dom.themeToggle.setAttribute("aria-label", mode === "dark" ? "Switch to light mode" : "Switch to dark mode");
      storage.saveTheme(mode);
    },

    toggle() {
      const current = document.documentElement.getAttribute("data-theme");
      theme.apply(current === "dark" ? "light" : "dark");
    },

    init() {
      const saved = storage.loadTheme();
      if (saved) {
        theme.apply(saved);
        return;
      }
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      theme.apply(prefersDark ? "dark" : "light");
    },
  };

  /* ---------------------------------------------------------------------
     10. CONFIRM DIALOG
     --------------------------------------------------------------------- */
  const dialog = {
    resolver: null,

    open() {
      dom.dialogOverlay.hidden = false;
      dom.dialogConfirm.focus();
      document.addEventListener("keydown", dialog.handleKeydown);
    },

    close() {
      dom.dialogOverlay.hidden = true;
      document.removeEventListener("keydown", dialog.handleKeydown);
    },

    handleKeydown(e) {
      if (e.key === "Escape") dialog.close();
    },
  };

  /* ---------------------------------------------------------------------
     11. EVENT BINDINGS
     --------------------------------------------------------------------- */
  function bindEvents() {
    // Add task
    dom.form.addEventListener("submit", (e) => {
      e.preventDefault();
      taskOps.clearInputError();
      const added = taskOps.add(dom.input.value);
      if (added) {
        dom.input.value = "";
        dom.input.focus();
      }
    });

    dom.input.addEventListener("input", taskOps.clearInputError);

    // Delegate clicks within the task list (checkbox, edit, save, delete)
    dom.taskList.addEventListener("click", (e) => {
      const item = e.target.closest(".task-item");
      if (!item) return;
      const id = item.dataset.id;

      if (e.target.closest(".task-item__check")) {
        taskOps.toggleComplete(id);
      } else if (e.target.closest(".task-item__btn--edit")) {
        taskOps.startEdit(id);
      } else if (e.target.closest(".task-item__btn--save")) {
        const input = item.querySelector(".task-item__edit-input");
        taskOps.saveEdit(id, input.value);
      } else if (e.target.closest(".task-item__btn--danger")) {
        taskOps.remove(id);
      }
    });

    // Handle Enter / Escape while editing inline
    dom.taskList.addEventListener("keydown", (e) => {
      if (!e.target.classList.contains("task-item__edit-input")) return;
      const item = e.target.closest(".task-item");
      const id = item?.dataset.id;

      if (e.key === "Enter") {
        e.preventDefault();
        taskOps.saveEdit(id, e.target.value);
      } else if (e.key === "Escape") {
        e.preventDefault();
        taskOps.cancelEdit();
      }
    });

    // Save edit on blur (keeps behavior consistent with pressing Enter)
    dom.taskList.addEventListener(
      "focusout",
      (e) => {
        if (!e.target.classList.contains("task-item__edit-input")) return;
        const item = e.target.closest(".task-item");
        const id = item?.dataset.id;
        if (state.editingId === id) taskOps.saveEdit(id, e.target.value);
      },
      true
    );

    // Search (debounced live search)
    const handleSearch = utils.debounce((value) => {
      state.search = value;
      render.taskList();
    }, 150);
    dom.searchInput.addEventListener("input", (e) => handleSearch(e.target.value));

    // Filter chips
    dom.filterChips.forEach((chip) => {
      chip.addEventListener("click", () => {
        dom.filterChips.forEach((c) => c.classList.remove("chip--active"));
        chip.classList.add("chip--active");
        state.filter = chip.dataset.filter;
        render.taskList();
      });
    });

    // Sort
    dom.sortSelect.addEventListener("change", (e) => {
      state.sort = e.target.value;
      render.taskList();
    });

    // Bulk actions
    dom.clearCompletedBtn.addEventListener("click", taskOps.clearCompleted);

    dom.deleteAllBtn.addEventListener("click", () => {
      if (state.tasks.length === 0) return;
      dialog.open();
    });

    dom.dialogConfirm.addEventListener("click", () => {
      taskOps.deleteAll();
      dialog.close();
    });
    dom.dialogCancel.addEventListener("click", () => dialog.close());
    dom.dialogOverlay.addEventListener("click", (e) => {
      if (e.target === dom.dialogOverlay) dialog.close();
    });

    // Theme toggle
    dom.themeToggle.addEventListener("click", theme.toggle);
  }

  /* ---------------------------------------------------------------------
     12. INIT
     --------------------------------------------------------------------- */
  function init() {
    theme.init();
    dom.todayDate.textContent = utils.formatToday();

    state.tasks = storage.loadTasks();

    bindEvents();
    render.all();

    dom.input.focus();
  }

  document.addEventListener("DOMContentLoaded", init);
})();