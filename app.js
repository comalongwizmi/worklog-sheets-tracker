const STORAGE_KEY = "task-time-tracker-state";
const SHEET_HEADERS = ["Start", "End", "Person", "Task", "Type", "Rate", "Duration", "Status", "ID"];
const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive.metadata.readonly"
].join(" ");
const SHEETS_DISCOVERY_DOC = "https://sheets.googleapis.com/$discovery/rest?version=v4";
const DRIVE_DISCOVERY_DOC = "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest";
const APP_CONFIG = window.TASK_TRACKER_CONFIG || {};

const state = loadState();
let timerId = null;
let tokenClient = null;
let googleReady = false;
let accessTokenExpiresAt = 0;
let editingTaskId = "";
let bulkParsedTasks = [];
let pendingTaskType = "";
let pendingTaskName = "";
let pendingMode = "primary";

const els = {
  activeTask: document.querySelector("#activeTask"),
  addOtherButton: document.querySelector("#addOtherButton"),
  apiKeyInput: document.querySelector("#apiKeyInput"),
  bulkCancelButton: document.querySelector("#bulkCancelButton"),
  bulkIgnoreAllButton: document.querySelector("#bulkIgnoreAllButton"),
  bulkImportActions: document.querySelector("#bulkImportActions"),
  bulkImportButton: document.querySelector("#bulkImportButton"),
  bulkPreview: document.querySelector("#bulkPreview"),
  bulkTaskButton: document.querySelector("#bulkTaskButton"),
  bulkTaskDialog: document.querySelector("#bulkTaskDialog"),
  bulkTaskForm: document.querySelector("#bulkTaskForm"),
  bulkTextInput: document.querySelector("#bulkTextInput"),
  browseTablesButton: document.querySelector("#browseTablesButton"),
  clientIdInput: document.querySelector("#clientIdInput"),
  connectGoogleAccountButton: document.querySelector("#connectGoogleAccountButton"),
  connectButton: document.querySelector("#connectButton"),
  copyFirstHalfButton: document.querySelector("#copyFirstHalfButton"),
  copySecondHalfButton: document.querySelector("#copySecondHalfButton"),
  currentHalfMonthEarnings: document.querySelector("#currentHalfMonthEarnings"),
  currentHalfMonthHours: document.querySelector("#currentHalfMonthHours"),
  currentHalfMonthPeriod: document.querySelector("#currentHalfMonthPeriod"),
  defaultPerformerInput: document.querySelector("#defaultPerformerInput"),
  developerSettings: document.querySelector("#developerSettings"),
  editCancelButton: document.querySelector("#editCancelButton"),
  editDialog: document.querySelector("#editDialog"),
  editEndInput: document.querySelector("#editEndInput"),
  editForm: document.querySelector("#editForm"),
  editNameInput: document.querySelector("#editNameInput"),
  editRateInput: document.querySelector("#editRateInput"),
  editStartInput: document.querySelector("#editStartInput"),
  editTypeInput: document.querySelector("#editTypeInput"),
  emptyState: document.querySelector("#emptyState"),
  exportButton: document.querySelector("#exportButton"),
  exportDialog: document.querySelector("#exportDialog"),
  exportForm: document.querySelector("#exportForm"),
  exportFromInput: document.querySelector("#exportFromInput"),
  exportToInput: document.querySelector("#exportToInput"),
  halfMonthInput: document.querySelector("#halfMonthInput"),
  googleAccountStatus: document.querySelector("#googleAccountStatus"),
  laterButton: document.querySelector("#laterButton"),
  manualEndInput: document.querySelector("#manualEndInput"),
  manualNameInput: document.querySelector("#manualNameInput"),
  manualPerformerInput: document.querySelector("#manualPerformerInput"),
  manualRateInput: document.querySelector("#manualRateInput"),
  manualStartInput: document.querySelector("#manualStartInput"),
  manualTaskButton: document.querySelector("#manualTaskButton"),
  manualTaskDialog: document.querySelector("#manualTaskDialog"),
  manualTaskForm: document.querySelector("#manualTaskForm"),
  manualTypeInput: document.querySelector("#manualTypeInput"),
  noticeDialog: document.querySelector("#noticeDialog"),
  noticeText: document.querySelector("#noticeText"),
  paidTypeButton: document.querySelector("#paidTypeButton"),
  pasteApiKeyButton: document.querySelector("#pasteApiKeyButton"),
  pasteClientIdButton: document.querySelector("#pasteClientIdButton"),
  pasteGoogleCredentialsButton: document.querySelector("#pasteGoogleCredentialsButton"),
  performerInput: document.querySelector("#performerInput"),
  personalTypeButton: document.querySelector("#personalTypeButton"),
  privacyModeToggle: document.querySelector("#privacyModeToggle"),
  customRateInput: document.querySelector("#customRateInput"),
  rateDialog: document.querySelector("#rateDialog"),
  rateForm: document.querySelector("#rateForm"),
  savedTablesSelect: document.querySelector("#savedTablesSelect"),
  settingsButton: document.querySelector("#settingsButton"),
  setupDialog: document.querySelector("#setupDialog"),
  setupForm: document.querySelector("#setupForm"),
  sheetNameInput: document.querySelector("#sheetNameInput"),
  spreadsheetIdInput: document.querySelector("#spreadsheetIdInput"),
  startButton: document.querySelector("#startButton"),
  stopButton: document.querySelector("#stopButton"),
  stopwatch: document.querySelector("#stopwatch"),
  syncButton: document.querySelector("#syncButton"),
  syncStatus: document.querySelector("#syncStatus"),
  taskInput: document.querySelector("#taskInput"),
  taskRows: document.querySelector("#taskRows"),
  statsBreakdown: document.querySelector("#statsBreakdown"),
  statsChart: document.querySelector("#statsChart"),
  statsDetails: document.querySelector("#statsDetails"),
  statsHalfSelect: document.querySelector("#statsHalfSelect"),
  statsLastThreeToggle: document.querySelector("#statsLastThreeToggle"),
  statsMonthInput: document.querySelector("#statsMonthInput"),
  statsPeriodLabel: document.querySelector("#statsPeriodLabel"),
  themeButton: document.querySelector("#themeButton"),
  typeDialog: document.querySelector("#typeDialog"),
  useSavedTableButton: document.querySelector("#useSavedTableButton"),
  newTableButton: document.querySelector("#newTableButton"),
  renameTableButton: document.querySelector("#renameTableButton"),
  renameTableInput: document.querySelector("#renameTableInput"),
  newTaskButton: document.querySelector("#newTaskButton")
};

migrateState();
applyTheme();
hydrateSetupFields();
render();
if (!state.setupSeen) {
  showSetup();
} else {
  syncPendingTasks(false);
}

els.startButton.addEventListener("click", () => startRequested("primary"));
els.newTaskButton.addEventListener("click", () => startRequested("replace"));
els.addOtherButton.addEventListener("click", () => startRequested("background"));
els.bulkTaskButton.addEventListener("click", showBulkTaskDialog);
els.exportButton.addEventListener("click", showExportDialog);
els.copyFirstHalfButton.addEventListener("click", () => exportHalfMonth(1));
els.copySecondHalfButton.addEventListener("click", () => exportHalfMonth(2));
els.manualTaskButton.addEventListener("click", showManualTaskDialog);
els.syncButton.addEventListener("click", () => pullAndSync(true));
els.stopButton.addEventListener("click", stopCurrentTask);
els.settingsButton.addEventListener("click", showSetup);
els.themeButton.addEventListener("click", toggleTheme);
els.connectGoogleAccountButton.addEventListener("click", connectGoogleAccount);
els.browseTablesButton.addEventListener("click", () => browseGoogleTables(true));
els.newTableButton.addEventListener("click", createNewTableFromSetup);
els.renameTableButton.addEventListener("click", renameCurrentTableFromSetup);
els.savedTablesSelect.addEventListener("change", hydrateSelectedBrowseTable);
els.savedTablesSelect.addEventListener("dblclick", useSelectedSavedTable);
els.pasteGoogleCredentialsButton.addEventListener("click", pasteGoogleCredentials);
els.pasteClientIdButton.addEventListener("click", () => pasteClipboardToInput(els.clientIdInput, "OAuth Client ID"));
els.pasteApiKeyButton.addEventListener("click", () => pasteClipboardToInput(els.apiKeyInput, "API key"));
els.clientIdInput.addEventListener("paste", handleCredentialsFieldPaste);
els.apiKeyInput.addEventListener("paste", handleCredentialsFieldPaste);
els.statsMonthInput.addEventListener("change", updateStatsSettings);
els.statsHalfSelect.addEventListener("change", updateStatsSettings);
els.statsLastThreeToggle.addEventListener("change", updateStatsSettings);
els.privacyModeToggle.addEventListener("change", updateStatsSettings);
els.taskInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") startRequested(state.activeTask ? "replace" : "primary");
});

els.setupForm.addEventListener("submit", async (event) => {
  const action = event.submitter?.value;
  state.setupSeen = true;
  saveSetupInputs();

  if (action === "connect") {
    event.preventDefault();
    await connectExistingTableFromSetup();
    els.setupDialog.close();
  }
  render();
});

els.exportForm.addEventListener("submit", async (event) => {
  const action = event.submitter?.value;
  if (action !== "export") return;
  event.preventDefault();
  await exportTasks();
  els.exportDialog.close();
});

els.noticeDialog.addEventListener("click", () => els.noticeDialog.close());

els.editForm.addEventListener("submit", async (event) => {
  const action = event.submitter?.value;
  if (action !== "save") return;
  event.preventDefault();
  await saveEditedTask();
});

els.manualTaskForm.addEventListener("submit", async (event) => {
  const action = event.submitter?.value;
  if (action !== "save") return;
  event.preventDefault();
  await saveManualTask();
});

els.bulkTaskForm.addEventListener("submit", (event) => {
  const action = event.submitter?.value;
  if (action !== "parse") return;
  event.preventDefault();
  parseBulkTasks();
});

els.bulkIgnoreAllButton.addEventListener("click", () => {
  bulkParsedTasks.forEach((item) => {
    if (!item.ok) item.importAnyway = true;
  });
  renderBulkPreview();
});

els.bulkImportButton.addEventListener("click", importBulkTasks);

els.typeDialog.addEventListener("close", async () => {
  const type = els.typeDialog.returnValue;
  if (!pendingTaskName || !["paid", "personal"].includes(type)) {
    pendingTaskName = "";
    pendingMode = "primary";
    return;
  }
  pendingTaskType = type;
  els.customRateInput.value = "";
  els.rateDialog.returnValue = "";
  els.rateDialog.showModal();
});

els.rateDialog.addEventListener("close", async () => {
  const rate = parseRateFromDialog();
  if (!pendingTaskName || rate === null) {
    pendingTaskName = "";
    pendingTaskType = "";
    pendingMode = "primary";
    return;
  }
  const taskName = pendingTaskName;
  const mode = pendingMode;
  const type = pendingTaskType;
  pendingTaskName = "";
  pendingTaskType = "";
  pendingMode = "primary";

  if (mode === "replace" && state.activeTask) {
    await stopCurrentTask();
  }
  await startTask(taskName, type, getPerformer(), rate, mode !== "background");
});

async function startRequested(mode) {
  const taskName = els.taskInput.value.trim();
  if (!taskName) {
    els.taskInput.focus();
    return;
  }
  if (state.activeTask && mode === "primary") {
    return;
  }
  pendingTaskName = taskName;
  pendingMode = mode;
  els.typeDialog.returnValue = "";
  els.typeDialog.showModal();
}

async function startTask(name, type, performer, rateRubPerHour, makePrimary) {
  const task = {
    id: crypto.randomUUID(),
    startIso: new Date().toISOString(),
    endIso: "",
    performer,
    name,
    type,
    rateRubPerHour,
    durationMs: 0,
    sheetRow: null,
    synced: false
  };
  if (makePrimary) {
    state.activeTask = task;
  }
  state.tasks.unshift(task);
  els.taskInput.value = "";
  saveState();
  render();
  await syncTask(task);
}

async function stopCurrentTask() {
  if (!state.activeTask) return;
  const task = endTask(state.activeTask.id);
  if (!task) return;
  state.activeTask = null;
  saveState();
  render();
  await syncTask(task);
}

async function stopTaskById(taskId) {
  const task = endTask(taskId);
  if (!task) return;
  if (state.activeTask?.id === taskId) {
    state.activeTask = null;
  }
  saveState();
  render();
  await syncTask(task);
}

function endTask(taskId) {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task || task.endIso) return null;
  const end = new Date();
  task.endIso = end.toISOString();
  task.durationMs = end - new Date(task.startIso);
  task.synced = false;
  return task;
}

function render() {
  renderActiveTask();
  renderRows();
  renderStats();
  renderSyncStatus();
  els.startButton.disabled = Boolean(state.activeTask);
  els.stopButton.disabled = !state.activeTask;
  els.stopwatch.hidden = !state.activeTask;
  if (state.activeTask && !timerId) {
    timerId = window.setInterval(renderActiveTask, 1000);
  }
  if (!state.activeTask && timerId) {
    window.clearInterval(timerId);
    timerId = null;
  }
}

function renderStats() {
  hydrateStatsControls();
  const period = getSelectedStatsPeriod();
  const tasks = getFinishedTasksInRange(period.from, period.to);
  const paidTasks = tasks.filter((task) => task.type === "paid");
  const personalTasks = tasks.filter((task) => task.type === "personal");
  const earned = paidTasks.reduce((total, task) => total + calculateTaskEarnings(task), 0);
  const hours = paidTasks.reduce((total, task) => total + Number(task.durationMs || 0) / 3600000, 0);
  const totalHours = tasks.reduce((total, task) => total + Number(task.durationMs || 0) / 3600000, 0);
  const personalHours = personalTasks.reduce((total, task) => total + Number(task.durationMs || 0) / 3600000, 0);
  els.currentHalfMonthEarnings.textContent = formatPrivateMoney(earned);
  els.currentHalfMonthPeriod.textContent = `${formatDateOnly(period.from)} - ${formatDateOnly(period.to)}`;
  els.currentHalfMonthHours.textContent = `${formatMoney(hours)}h paid / ${formatMoney(totalHours)}h total`;
  els.statsPeriodLabel.textContent = period.label;
  renderStatsBreakdown(buildStatsReport(tasks, paidTasks, personalHours));
}

function renderStatsBreakdown(report) {
  els.statsChart.innerHTML = "";
  els.statsBreakdown.innerHTML = "";
  els.statsDetails.innerHTML = "";
  if (!report.totalCount) {
    els.statsChart.innerHTML = `<div class="bulk-preview-note">No finished tasks in this period.</div>`;
    return;
  }
  if (!report.work.length) {
    els.statsChart.innerHTML = `<div class="bulk-preview-note">No paid finished tasks in this period.</div>`;
  }
  const maxEarned = Math.max(...report.work.map((item) => item.earned), 0);
  for (const item of report.work.slice(0, 8)) {
    const chartRow = document.createElement("div");
    chartRow.className = "chart-row";
    chartRow.innerHTML = `
      <div class="chart-label">${escapeHtml(item.name)}</div>
      <div class="chart-track"><div class="chart-fill" style="width: ${maxEarned ? (item.earned / maxEarned) * 100 : 0}%"></div></div>
      <div class="chart-value">${formatPrivateMoney(item.earned)} / ${formatMoney(item.hours)}h</div>
    `;
    els.statsChart.append(chartRow);
  }
  els.statsBreakdown.innerHTML = `
    <div class="stat-pill"><span>Paid tasks</span><strong>${report.paidCount}</strong></div>
    <div class="stat-pill"><span>Paid hours</span><strong>${formatMoney(report.paidHours)}h</strong></div>
    <div class="stat-pill"><span>Personal hours</span><strong>${formatMoney(report.personalHours)}h</strong></div>
    <div class="stat-pill"><span>Average paid rate</span><strong>${formatMoney(report.averageRate)} RUB/h</strong></div>
    <div class="stat-pill"><span>Best work</span><strong>${escapeHtml(report.bestWork?.name || "-")}</strong></div>
    <div class="stat-pill"><span>Needs review</span><strong>${report.needsReview}</strong></div>
  `;
  els.statsDetails.innerHTML = [
    renderStatsTable("By work", ["Work", "Tasks", "Hours", "Earned", "Avg"], report.work),
    renderStatsTable("By person", ["Person", "Tasks", "Hours", "Earned", "Avg"], report.people),
    renderStatsTable("By rate", ["Rate", "Tasks", "Hours", "Earned", "Avg"], report.rates)
  ].join("");
}

function buildStatsReport(tasks, paidTasks, personalHours) {
  const work = aggregateStats(paidTasks, (task) => task.name || "Unnamed");
  const people = aggregateStats(paidTasks, (task) => task.performer || state.defaultPerformer || "Alex");
  const rates = aggregateStats(paidTasks, (task) => `${Number(task.rateRubPerHour || 0)} RUB/h`);
  const paidHours = paidTasks.reduce((total, task) => total + Number(task.durationMs || 0) / 3600000, 0);
  const earned = paidTasks.reduce((total, task) => total + calculateTaskEarnings(task), 0);
  return {
    work,
    people,
    rates,
    totalCount: tasks.length,
    paidCount: paidTasks.length,
    paidHours,
    personalHours,
    averageRate: paidHours ? earned / paidHours : 0,
    bestWork: work[0] || null,
    needsReview: tasks.filter((task) => task.reviewStatus === "needs_review").length
  };
}

function aggregateStats(tasks, getKey) {
  const byKey = new Map();
  for (const task of tasks) {
    const name = getKey(task);
    const current = byKey.get(name) || { name, count: 0, hours: 0, earned: 0, averageRate: 0 };
    const hours = Number(task.durationMs || 0) / 3600000;
    current.count += 1;
    current.hours += hours;
    current.earned += calculateTaskEarnings(task);
    current.averageRate = current.hours ? current.earned / current.hours : 0;
    byKey.set(name, current);
  }
  return [...byKey.values()].sort((a, b) => b.earned - a.earned || b.hours - a.hours);
}

function renderStatsTable(title, headers, rows) {
  if (!rows.length) return "";
  return `
    <section class="stats-table-section">
      <h3>${escapeHtml(title)}</h3>
      <table class="stats-table">
        <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              <td>${escapeHtml(row.name)}</td>
              <td>${row.count}</td>
              <td>${formatMoney(row.hours)}h</td>
              <td>${formatPrivateMoney(row.earned)}</td>
              <td>${formatMoney(row.averageRate)} RUB/h</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </section>
  `;
}

function renderActiveTask() {
  if (!state.activeTask) {
    els.activeTask.hidden = true;
    els.stopwatch.textContent = "00:00:00";
    return;
  }
  const start = new Date(state.activeTask.startIso);
  const elapsed = Date.now() - start.getTime();
  els.stopwatch.textContent = formatDuration(elapsed);
  els.activeTask.hidden = false;
  els.activeTask.textContent = `${formatDateTime(start)} ${state.activeTask.performer}: ${state.activeTask.name}`;
}

function renderRows() {
  els.taskRows.innerHTML = "";
  els.emptyState.hidden = state.tasks.length > 0;
  for (const task of state.tasks) {
    const row = document.createElement("tr");
    row.dataset.taskId = task.id;
    row.classList.toggle("review-row", task.reviewStatus === "needs_review");
    row.innerHTML = `
      <td>${formatDateTime(new Date(task.startIso))}</td>
      <td>${task.endIso ? formatDateTime(new Date(task.endIso)) : ""}</td>
      <td>${escapeHtml(task.performer || state.defaultPerformer)}</td>
      <td>${escapeHtml(task.name)}</td>
      <td><span class="badge ${task.type}">${task.type === "paid" ? "Paid" : "Personal"}</span></td>
      <td>${formatRate(task.rateRubPerHour)}</td>
      <td>${task.endIso ? formatDuration(task.durationMs) : `<button class="row-action" type="button" data-stop-id="${task.id}">End</button>`}</td>
      <td>${task.reviewStatus === "needs_review" ? "Needs review" : ""}</td>
    `;
    els.taskRows.append(row);
  }
  els.taskRows.querySelectorAll("tr[data-task-id]").forEach((row) => {
    row.addEventListener("click", () => openEditDialog(row.dataset.taskId));
  });
  els.taskRows.querySelectorAll("[data-stop-id]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      stopTaskById(button.dataset.stopId);
    });
  });
}

function renderSyncStatus() {
  if (state.google.lastError) {
    els.syncStatus.textContent = `Google sync error: ${state.google.lastError}`;
    return;
  }
  if (!state.google.connected) {
    els.syncStatus.textContent = "Stored locally";
    return;
  }
  const unsyncedCount = state.tasks.filter((task) => !task.synced).length;
  els.syncStatus.textContent = unsyncedCount
    ? `Google Sheets connected, ${unsyncedCount} pending sync`
    : `Synced with ${state.google.sheetName}`;
}

function showExportDialog() {
  const today = formatDateInput(new Date());
  els.exportFromInput.value ||= today;
  els.exportToInput.value ||= today;
  els.halfMonthInput.value ||= today.slice(0, 7);
  els.exportDialog.showModal();
}

function openEditDialog(taskId) {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) return;
  editingTaskId = taskId;
  els.editStartInput.value = formatDateTimeInput(new Date(task.startIso));
  els.editEndInput.value = task.endIso ? formatDateTimeInput(new Date(task.endIso)) : "";
  els.editNameInput.value = task.name;
  els.editTypeInput.value = task.type;
  els.editRateInput.value = Number(task.rateRubPerHour || 0);
  els.editDialog.showModal();
}

async function saveEditedTask() {
  const task = state.tasks.find((item) => item.id === editingTaskId);
  if (!task) return;
  const start = parseDateTimeInput(els.editStartInput.value);
  const end = els.editEndInput.value ? parseDateTimeInput(els.editEndInput.value) : null;
  const name = els.editNameInput.value.trim();
  if (!start || !name || (end && end < start)) {
    showNotice("Check the task dates and name.");
    return;
  }
  task.startIso = start.toISOString();
  task.endIso = end ? end.toISOString() : "";
  task.durationMs = end ? end - start : 0;
  task.name = name;
  task.type = els.editTypeInput.value;
  task.rateRubPerHour = parseRate(els.editRateInput.value);
  task.synced = false;
  if (state.activeTask?.id === task.id) {
    state.activeTask = task.endIso ? null : task;
  }
  editingTaskId = "";
  saveState();
  render();
  els.editDialog.close();
  await syncTask(task);
}

function showManualTaskDialog() {
  const now = new Date();
  els.manualStartInput.value = formatDateTimeInput(now);
  els.manualEndInput.value = formatDateTimeInput(now);
  els.manualNameInput.value = "";
  els.manualPerformerInput.value = getPerformer();
  els.manualTypeInput.value = "paid";
  els.manualRateInput.value = "0";
  els.manualTaskDialog.showModal();
}

function showBulkTaskDialog() {
  bulkParsedTasks = [];
  els.bulkPreview.hidden = true;
  els.bulkPreview.innerHTML = "";
  els.bulkImportActions.hidden = true;
  els.bulkTaskDialog.showModal();
}

async function saveManualTask() {
  const start = parseDateTimeInput(els.manualStartInput.value);
  const end = parseDateTimeInput(els.manualEndInput.value);
  const name = els.manualNameInput.value.trim();
  if (!start || !end || end < start || !name) {
    showNotice("Check the manual task details.");
    return;
  }
  const task = {
    id: crypto.randomUUID(),
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    performer: els.manualPerformerInput.value.trim() || state.defaultPerformer,
    name,
    type: els.manualTypeInput.value,
    rateRubPerHour: parseRate(els.manualRateInput.value),
    durationMs: end - start,
    sheetRow: null,
    synced: false
  };
  state.tasks.unshift(task);
  saveState();
  render();
  els.manualTaskDialog.close();
  await syncTask(task);
}

function parseBulkTasks() {
  bulkParsedTasks = parseBulkText(els.bulkTextInput.value);
  renderBulkPreview();
}

function renderBulkPreview() {
  els.bulkPreview.innerHTML = "";
  els.bulkPreview.hidden = bulkParsedTasks.length === 0;
  els.bulkImportActions.hidden = bulkParsedTasks.length === 0;
  if (!bulkParsedTasks.length) {
    showNotice("No task lines found.");
    return;
  }
  bulkParsedTasks.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = `bulk-preview-row ${item.ok ? "" : "issue"}`;
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = item.ok || item.importAnyway;
    checkbox.addEventListener("change", () => {
      item.importAnyway = checkbox.checked && !item.ok;
    });
    const body = document.createElement("div");
    body.innerHTML = `
      <div class="bulk-preview-main">${formatDateTime(new Date(item.task.startIso))} - ${formatDateTime(new Date(item.task.endIso))} | ${escapeHtml(item.task.name)} | ${formatRate(item.task.rateRubPerHour)}</div>
      <div class="bulk-preview-note">${item.ok ? "Ready" : `Needs review: ${escapeHtml(item.issues.join(", "))}`} | line ${item.lineNumber}</div>
    `;
    row.append(checkbox, body);
    els.bulkPreview.append(row);
  });
}

async function importBulkTasks() {
  const selected = bulkParsedTasks.filter((item) => item.ok || item.importAnyway);
  if (!selected.length) {
    showNotice("Select at least one parsed task.");
    return;
  }
  for (const item of selected) {
    item.task.reviewStatus = item.ok ? "" : "needs_review";
    state.tasks.unshift(item.task);
  }
  saveState();
  render();
  els.bulkTaskDialog.close();
  for (const item of selected) {
    await syncTask(item.task);
  }
  showNotice(`Imported ${selected.length} tasks.`);
}

async function exportTasks() {
  const from = parseDateInput(els.exportFromInput.value, false);
  const to = parseDateInput(els.exportToInput.value, true);
  if (!from || !to || from > to) {
    showNotice("Choose a valid date range.");
    return;
  }

  const selectedTasks = state.tasks
    .filter((task) => task.endIso)
    .filter((task) => {
      const start = new Date(task.startIso);
      return start >= from && start <= to;
    })
    .sort((a, b) => new Date(a.startIso) - new Date(b.startIso));

  const exportText = selectedTasks
    .map(formatExportLine)
    .join("\n");

  if (!exportText) {
    showNotice("No finished tasks in that date range.");
    return;
  }

  const totalEarned = selectedTasks.reduce((total, task) => total + calculateTaskEarnings(task), 0);
  const finalText = `${exportText}\n\nTotal earned: ${formatMoney(totalEarned)} RUB`;
  await copyToClipboard(finalText);
  showNotice("Export copied to your clipboard.");
}

async function exportHalfMonth(half) {
  const monthValue = els.halfMonthInput.value;
  if (!monthValue) {
    showNotice("Choose a month first.");
    return;
  }
  const [year, month] = monthValue.split("-").map(Number);
  const from = new Date(year, month - 1, half === 1 ? 1 : 16, 0, 0, 0, 0);
  const lastDay = new Date(year, month, 0).getDate();
  const to = new Date(year, month - 1, half === 1 ? 15 : lastDay, 23, 59, 59, 999);
  const selectedTasks = getFinishedTasksInRange(from, to);
  if (!selectedTasks.length) {
    showNotice("No finished tasks in that half-month.");
    return;
  }
  await copyToClipboard(formatHalfMonthExport(selectedTasks));
  els.exportDialog.close();
  showNotice("Half-month export copied to your clipboard.");
}

function getFinishedTasksInRange(from, to) {
  return state.tasks
    .filter((task) => task.endIso)
    .filter((task) => {
      const start = new Date(task.startIso);
      return start >= from && start <= to;
    })
    .sort((a, b) => new Date(a.startIso) - new Date(b.startIso));
}

function getCurrentHalfMonthPeriod() {
  const now = new Date();
  const day = now.getDate();
  const fromDay = day <= 15 ? 1 : 16;
  const toDay = day <= 15 ? 15 : new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return {
    from: new Date(now.getFullYear(), now.getMonth(), fromDay, 0, 0, 0, 0),
    to: new Date(now.getFullYear(), now.getMonth(), toDay, 23, 59, 59, 999)
  };
}

function getSelectedStatsPeriod() {
  const monthValue = state.stats.month || formatDateInput(new Date()).slice(0, 7);
  const [year, month] = monthValue.split("-").map(Number);
  if (state.stats.lastThreeMonths) {
    return {
      from: new Date(year, month - 3, 1, 0, 0, 0, 0),
      to: new Date(year, month, 0, 23, 59, 59, 999),
      label: "Last 3 months"
    };
  }
  const lastDay = new Date(year, month, 0).getDate();
  if (state.stats.half === "full") {
    return {
      from: new Date(year, month - 1, 1, 0, 0, 0, 0),
      to: new Date(year, month - 1, lastDay, 23, 59, 59, 999),
      label: "Full month"
    };
  }
  const firstHalf = state.stats.half !== "second";
  return {
    from: new Date(year, month - 1, firstHalf ? 1 : 16, 0, 0, 0, 0),
    to: new Date(year, month - 1, firstHalf ? 15 : lastDay, 23, 59, 59, 999),
    label: firstHalf ? "1-15" : "16-end"
  };
}

function hydrateStatsControls() {
  const currentMonth = formatDateInput(new Date()).slice(0, 7);
  state.stats ||= {};
  state.stats.month ||= currentMonth;
  state.stats.half ||= new Date().getDate() <= 15 ? "first" : "second";
  state.stats.lastThreeMonths ||= false;
  state.stats.privacyMode ||= false;
  if (els.statsMonthInput.value !== state.stats.month) {
    els.statsMonthInput.value = state.stats.month;
  }
  if (els.statsHalfSelect.value !== state.stats.half) {
    els.statsHalfSelect.value = state.stats.half;
  }
  els.statsLastThreeToggle.checked = Boolean(state.stats.lastThreeMonths);
  els.privacyModeToggle.checked = Boolean(state.stats.privacyMode);
  els.statsHalfSelect.disabled = Boolean(state.stats.lastThreeMonths);
}

function updateStatsSettings() {
  state.stats.month = els.statsMonthInput.value || formatDateInput(new Date()).slice(0, 7);
  state.stats.half = els.statsHalfSelect.value || "first";
  state.stats.lastThreeMonths = els.statsLastThreeToggle.checked;
  state.stats.privacyMode = els.privacyModeToggle.checked;
  saveState();
  renderStats();
}

function formatHalfMonthExport(tasks) {
  const performer = tasks[0]?.performer || state.defaultPerformer || "Alex";
  const lines = tasks.map((task) => {
    const start = new Date(task.startIso);
    const end = new Date(task.endIso);
    return `${formatDateOnly(start)} ${formatTimeOnly(start)} - ${formatTimeOnly(end)} ${Number(task.rateRubPerHour || 0)} \u0440/\u0447 ${task.name}`;
  });
  return `${performer}\n\n${lines.join("\n")}`;
}

function formatExportLine(task) {
  const start = new Date(task.startIso);
  const end = new Date(task.endIso);
  const prefix = shouldUseCompactExportRange(start, end)
    ? `${formatDateOnly(start)} ${formatTimeOnly(start)}-${formatTimeOnly(end)}`
    : `${formatDateOnly(start)} ${formatTimeOnly(start)}-${formatDateOnly(end)} ${formatTimeOnly(end)}`;
  return `${prefix} ${task.name}`;
}

function shouldUseCompactExportRange(start, end) {
  if (isSameDate(start, end)) return true;
  const nextDay = new Date(start);
  nextDay.setDate(nextDay.getDate() + 1);
  return isSameDate(nextDay, end) && minutesSinceMidnight(end) <= minutesSinceMidnight(start);
}

async function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function showNotice(message) {
  els.noticeText.textContent = message;
  if (!els.noticeDialog.open) {
    els.noticeDialog.showModal();
  }
  window.clearTimeout(showNotice.timeoutId);
  showNotice.timeoutId = window.setTimeout(() => {
    if (els.noticeDialog.open) {
      els.noticeDialog.close();
    }
  }, 3000);
}

async function connectGoogle() {
  await connectExistingTableFromSetup();
}

async function connectGoogleAccount() {
  saveSetupInputs();
  if (!(await ensureGoogleAccountConnected(true))) return false;
  await browseGoogleTables(false);
  showNotice("Google account connected.");
  return true;
}

async function connectExistingTableFromSetup() {
  saveSetupInputs();
  if (!(await ensureGoogleAccountConnected(true))) return;
  const selected = getSelectedBrowseTable();
  const spreadsheetId = parseSpreadsheetId(els.spreadsheetIdInput.value.trim()) || selected?.id || "";
  if (!spreadsheetId) {
    showNotice("Paste a Sheet link/ID or choose a table from the list.");
    return;
  }
  const sheetName = selected?.name || await getSpreadsheetTitle(spreadsheetId).catch(() => spreadsheetId);
  persistCurrentTableTasks();
  state.google.spreadsheetId = spreadsheetId;
  state.google.sheetName = sheetName;
  state.google.connected = true;
  state.google.lastError = "";
  rememberCurrentTable();
  loadCurrentTableTasks();
  saveState();
  hydrateSetupFields();
  await ensureHeaders();
  await pullAndSync(false);
  showNotice("Table connected.");
}

async function createNewTableFromSetup() {
  saveSetupInputs();
  if (!(await ensureGoogleAccountConnected(true))) return;
  const title = els.sheetNameInput.value.trim() || "Task Time Tracker";
  setSyncStatus("Creating Google Sheet...");
  try {
    persistCurrentTableTasks();
    state.google.spreadsheetId = await createSpreadsheet(title);
    state.google.sheetName = title;
    state.google.connected = true;
    state.google.lastError = "";
    state.activeTask = null;
    state.tasks = [];
    rememberCurrentTable();
    saveState();
    hydrateSetupFields();
    await ensureHeaders();
    await pullAndSync(false);
    showNotice("New table created.");
  } catch (error) {
    state.google.lastError = error.message || String(error);
    saveState();
    setSyncStatus(`Create table failed: ${state.google.lastError}`);
    console.error(error);
  }
}

async function renameCurrentTableFromSetup() {
  saveSetupInputs();
  const title = els.renameTableInput.value.trim();
  if (!state.google.spreadsheetId) {
    showNotice("Connect a table before renaming.");
    return;
  }
  if (!title) {
    showNotice("Enter the new table name first.");
    return;
  }
  if (!(await ensureGoogleAccountConnected(true))) return;
  try {
    await renameSpreadsheet(state.google.spreadsheetId, title);
    state.google.sheetName = title;
    rememberCurrentTable();
    saveState();
    hydrateSetupFields();
    showNotice("Table renamed.");
  } catch (error) {
    state.google.lastError = error.message || String(error);
    saveState();
    setSyncStatus(`Rename failed: ${state.google.lastError}`);
    console.error(error);
  }
}

async function ensureGoogleAccountConnected(interactive) {
  if (!getGoogleClientId() || !getGoogleApiKey()) {
    els.developerSettings.open = true;
    alert("Paste your Google OAuth Client ID and API key in Google credentials, then connect again.");
    return false;
  }
  setSyncStatus("Preparing Google login...");
  try {
    await initializeGoogle();
    setSyncStatus(interactive ? "Waiting for Google login..." : "Refreshing Google login...");
    const token = await requestToken(interactive);
    if (!token) {
      setSyncStatus("Google login was cancelled");
      return false;
    }
    state.google.hasGrantedAccess = true;
    state.google.lastError = "";
    saveState();
    hydrateSetupFields();
    return true;
  } catch (error) {
    state.google.lastError = error.message || String(error);
    saveState();
    setSyncStatus(`Google login failed: ${state.google.lastError}`);
    console.error(error);
    return false;
  }
}

async function syncAllTasks() {
  for (const task of [...state.tasks].reverse()) {
    await syncTask(task);
  }
  renderSyncStatus();
}

async function pullAndSync(interactive) {
  if (!state.google.connected || !state.google.spreadsheetId) {
    if (interactive) showNotice("Connect Google Sheets first.");
    return;
  }
  const authorized = await ensureGoogleAuthorized(interactive);
  if (!authorized) {
    if (interactive) showNotice("Google login is needed before syncing.");
    return;
  }
  setSyncStatus("Syncing with Google Sheets...");
  await ensureHeaders();
  await pullTasksFromSheet();
  await syncAllTasks();
  saveState();
  render();
  if (interactive) showNotice("Sync complete.");
}

async function syncTask(task) {
  if (!state.google.connected || !state.google.spreadsheetId) return;
  const authorized = await ensureGoogleAuthorized(false);
  if (!authorized) {
    task.synced = false;
    saveState();
    renderSyncStatus();
    return;
  }
  try {
    task.sheetRow = await resolveTaskSheetRow(task);
    if (!task.sheetRow) {
      const response = await gapi.client.sheets.spreadsheets.values.append({
        spreadsheetId: state.google.spreadsheetId,
        range: "A:I",
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        resource: { values: [taskToSheetRow(task)] }
      });
      task.sheetRow = Number(response.result.updates.updatedRange.match(/\d+/)?.[0] || 0);
    } else {
      await gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId: state.google.spreadsheetId,
        range: `A${task.sheetRow}:I${task.sheetRow}`,
        valueInputOption: "USER_ENTERED",
        resource: { values: [taskToSheetRow(task)] }
      });
    }
    task.synced = true;
    state.google.lastError = "";
    await applySheetRowReviewStyle(task);
  } catch (error) {
    task.synced = false;
    state.google.lastError = error.message || String(error);
    console.error(error);
  }
  saveState();
  renderSyncStatus();
}

async function syncPendingTasks(interactive) {
  if (!state.google.connected || !state.google.spreadsheetId) return;
  const pending = state.tasks.filter((task) => !task.synced);
  if (!pending.length) return;
  const authorized = await ensureGoogleAuthorized(interactive);
  if (!authorized) {
    renderSyncStatus();
    return;
  }
  for (const task of [...pending].reverse()) {
    await syncTask(task);
  }
}

async function ensureGoogleAuthorized(interactive) {
  if (!state.google.connected || !state.google.spreadsheetId) return false;
  if (!getGoogleClientId() || !getGoogleApiKey()) return false;
  try {
    await initializeGoogle();
    if (Date.now() < accessTokenExpiresAt - 60000 && gapi.client.getToken()) {
      return true;
    }
    const token = await requestToken(interactive);
    return Boolean(token);
  } catch (error) {
    if (interactive) {
      state.google.lastError = error.message || String(error);
      setSyncStatus(`Google setup failed: ${state.google.lastError}`);
    }
    saveState();
    console.error(error);
    return false;
  }
}

async function ensureHeaders() {
  await gapi.client.sheets.spreadsheets.values.update({
    spreadsheetId: state.google.spreadsheetId,
    range: "A1:I1",
    valueInputOption: "USER_ENTERED",
    resource: { values: [SHEET_HEADERS] }
  });
  await ensureStatsSheet();
}

async function ensureStatsSheet() {
  const sheets = await getSpreadsheetSheets();
  const hasStats = sheets.some((sheet) => sheet.properties.title === "Stats");
  if (!hasStats) {
    await gapi.client.sheets.spreadsheets.batchUpdate({
      spreadsheetId: state.google.spreadsheetId,
      resource: {
        requests: [{
          addSheet: {
            properties: { title: "Stats" }
          }
        }]
      }
    });
  }
  await updateStatsSheet();
}

async function updateStatsSheet() {
  const period = getSelectedStatsPeriod();
  const taskDateExpression = "IFERROR(DATE(VALUE(MID(Tasks!A2:A,7,4)),VALUE(MID(Tasks!A2:A,4,2)),VALUE(LEFT(Tasks!A2:A,2))),0)";
  const durationHoursExpression = "IFERROR((VALUE(LEFT(Tasks!G2:G,FIND(\":\",Tasks!G2:G)-1))+VALUE(MID(Tasks!G2:G,FIND(\":\",Tasks!G2:G)+1,2))/60+VALUE(RIGHT(Tasks!G2:G,2))/3600),0)";
  await gapi.client.sheets.spreadsheets.values.update({
    spreadsheetId: state.google.spreadsheetId,
    range: "Stats!A1:B13",
    valueInputOption: "USER_ENTERED",
    resource: {
      values: [
        ["Statistic", "Value"],
        ["Selected period", period.label],
        ["Period start", `=DATE(${period.from.getFullYear()},${period.from.getMonth() + 1},${period.from.getDate()})`],
        ["Period end", `=DATE(${period.to.getFullYear()},${period.to.getMonth() + 1},${period.to.getDate()})`],
        ["Finished rows", `=SUMPRODUCT((Tasks!B2:B<>"")*(${taskDateExpression}>=B3)*(${taskDateExpression}<=B4))`],
        ["Paid rows", `=SUMPRODUCT((Tasks!E2:E="Paid")*(${taskDateExpression}>=B3)*(${taskDateExpression}<=B4))`],
        ["Paid hours", `=SUMPRODUCT((Tasks!E2:E="Paid")*(${taskDateExpression}>=B3)*(${taskDateExpression}<=B4)*${durationHoursExpression})`],
        ["Personal hours", `=SUMPRODUCT((Tasks!E2:E="Personal")*(${taskDateExpression}>=B3)*(${taskDateExpression}<=B4)*${durationHoursExpression})`],
        ["Total hours", `=SUMPRODUCT((Tasks!B2:B<>"")*(${taskDateExpression}>=B3)*(${taskDateExpression}<=B4)*${durationHoursExpression})`],
        ["Earned RUB", `=SUMPRODUCT((Tasks!E2:E="Paid")*(${taskDateExpression}>=B3)*(${taskDateExpression}<=B4)*Tasks!F2:F*${durationHoursExpression})`],
        ["Average paid rate", "=IFERROR(B10/B7,0)"],
        ["Needs review", "=COUNTIF(Tasks!H2:H,\"Needs review\")"],
        ["Last updated", "=NOW()"]
      ]
    }
  });
}

async function pullTasksFromSheet() {
  const response = await gapi.client.sheets.spreadsheets.values.get({
    spreadsheetId: state.google.spreadsheetId,
    range: "A2:I"
  });
  const rows = response.result.values || [];
  rows.forEach((row, index) => {
    const task = sheetRowToTask(row, index + 2);
    if (!task) return;
    const needsIdBackfill = !getSheetRowId(row);
    const existing = state.tasks.find((item) => item.id === task.id)
      || state.tasks.find((item) => item.sheetRow === task.sheetRow && item.sheetRow);
    if (existing) {
      Object.assign(existing, task, { synced: true });
      if (needsIdBackfill) existing.synced = false;
      return;
    }
    state.tasks.unshift({ ...task, synced: !needsIdBackfill });
  });
}

async function resolveTaskSheetRow(task) {
  if (!task.id) return task.sheetRow || 0;
  const response = await gapi.client.sheets.spreadsheets.values.get({
    spreadsheetId: state.google.spreadsheetId,
    range: "I2:I"
  });
  const ids = response.result.values || [];
  const index = ids.findIndex((row) => row[0] === task.id);
  if (index >= 0) return index + 2;
  return task.sheetRow || 0;
}

async function applySheetRowReviewStyle(task) {
  if (!task.sheetRow || !state.google.spreadsheetId || !window.gapi?.client?.sheets) return;
  const sheet = getPrimaryTaskSheet(await getSpreadsheetSheets());
  if (!sheet) return;
  const isReview = task.reviewStatus === "needs_review";
  await gapi.client.sheets.spreadsheets.batchUpdate({
    spreadsheetId: state.google.spreadsheetId,
    resource: {
      requests: [{
        repeatCell: {
          range: {
            sheetId: sheet.properties.sheetId,
            startRowIndex: task.sheetRow - 1,
            endRowIndex: task.sheetRow,
            startColumnIndex: 0,
            endColumnIndex: SHEET_HEADERS.length
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: isReview
                ? { red: 0.95, green: 0.82, blue: 0.80 }
                : { red: 1, green: 1, blue: 1 }
            }
          },
          fields: "userEnteredFormat.backgroundColor"
        }
      }]
    }
  });
}

async function getSpreadsheetSheets() {
  const spreadsheet = await gapi.client.sheets.spreadsheets.get({
    spreadsheetId: state.google.spreadsheetId,
    fields: "sheets(properties(sheetId,title,index))"
  });
  return spreadsheet.result.sheets || [];
}

async function getSpreadsheetTitle(spreadsheetId) {
  const spreadsheet = await gapi.client.sheets.spreadsheets.get({
    spreadsheetId,
    fields: "properties(title)"
  });
  return spreadsheet.result.properties?.title || spreadsheetId;
}

function getPrimaryTaskSheet(sheets) {
  return sheets.find((sheet) => sheet.properties.title === "Tasks")
    || [...sheets].sort((a, b) => a.properties.index - b.properties.index)[0];
}

async function createSpreadsheet(title) {
  const response = await gapi.client.sheets.spreadsheets.create({
    properties: { title },
    sheets: [{ properties: { title: "Tasks" } }]
  });
  return response.result.spreadsheetId;
}

async function renameSpreadsheet(spreadsheetId, title) {
  await gapi.client.sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    resource: {
      requests: [{ updateSpreadsheetProperties: { properties: { title }, fields: "title" } }]
    }
  });
}

async function initializeGoogle() {
  if (googleReady && window.gapi?.client?.sheets && window.gapi?.client?.drive && tokenClient) return;
  await loadScript("https://apis.google.com/js/api.js");
  await loadScript("https://accounts.google.com/gsi/client");
  await new Promise((resolve) => gapi.load("client", resolve));
  await gapi.client.init({
    apiKey: getGoogleApiKey(),
    discoveryDocs: [SHEETS_DISCOVERY_DOC, DRIVE_DISCOVERY_DOC]
  });
  initTokenClient();
  googleReady = true;
}

function initTokenClient() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: getGoogleClientId(),
    scope: GOOGLE_SCOPES,
    callback: () => {}
  });
}

function requestToken(interactive) {
  return new Promise((resolve) => {
    tokenClient.callback = (response) => {
      if (response.error) {
        resolve(null);
        return;
      }
      if (response.access_token) {
        accessTokenExpiresAt = Date.now() + Number(response.expires_in || 3600) * 1000;
      }
      resolve(response.access_token || null);
    };
    const prompt = interactive
      ? (state.google.hasGrantedAccess ? "" : "consent")
      : "";
    tokenClient.requestAccessToken({ prompt });
  });
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.append(script);
  });
}

function taskToSheetRow(task) {
  return [
    formatDateTime(new Date(task.startIso)),
    task.endIso ? formatDateTime(new Date(task.endIso)) : "",
    task.performer || state.defaultPerformer,
    task.name,
    task.type === "paid" ? "Paid" : "Personal",
    Number(task.rateRubPerHour || 0),
    task.endIso ? formatDuration(task.durationMs) : "",
    task.reviewStatus === "needs_review" ? "Needs review" : "",
    task.id
  ];
}

function parseBulkText(text) {
  const results = [];
  let currentPerformer = state.defaultPerformer || "Alex";
  const lines = text.split(/\r?\n/);
  lines.forEach((rawLine, lineIndex) => {
    const line = rawLine.trim();
    if (!line) return;
    if (!/^\d{1,2}\.\d{1,2}/.test(line)) {
      if (!/\d/.test(line) && line.length <= 40) currentPerformer = line;
      return;
    }
    const parsed = parseBulkLine(line, currentPerformer, lineIndex + 1);
    results.push(...parsed);
  });
  return results;
}

function parseBulkLine(line, performer, lineNumber) {
  const dateMatch = line.match(/^(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?\s+(.+)$/);
  if (!dateMatch) return [];
  const [, dayRaw, monthRaw, yearRaw, rest] = dateMatch;
  const year = Number(yearRaw || new Date().getFullYear());
  const day = Number(dayRaw);
  const month = Number(monthRaw);
  const segmentRegex = /(\d{1,2}:\d{2})\s*[-â€“â€”]\s*(\d{1,2}:\d{2})\s*(?:(\d+(?:[.,]\d+)?)\s*(?:Ñ€|Ñ€ÑƒÐ±)?\s*\/?\s*Ñ‡|\((\d+(?:[.,]\d+)?)\s*\/?\s*Ñ‡\))?/gi;
  const segments = [...rest.matchAll(segmentRegex)];
  if (!segments.length) return [];
  const taskText = deriveBulkTaskName(rest, segments);
  return segments.map((segment) => {
    const issues = [];
    const start = parseBulkDateTime(year, month, day, segment[1]);
    let end = parseBulkDateTime(year, month, day, segment[2]);
    if (end <= start) end.setDate(end.getDate() + 1);
    let rate = parseRate(segment[3] || segment[4]);
    if (!rate) {
      rate = inferBulkRate(rest);
      if (!rate) issues.push("missing rate");
    }
    const name = taskText || inferBulkName(rest);
    if (!name) issues.push("missing task name");
    if (rest.includes("Ð·Ð°Ð±Ñ‹Ð»") || rest.includes("ÐºÐ°Ðº ÑÑ‡Ð¸Ñ‚Ð°ÐµÑˆÑŒ") || rest.includes("Ñ…ÑƒÐ¹ Ð·Ð½Ð°ÐµÑ‚") || rest.includes("Ð½Ð°Ð²ÐµÑ€Ð½Ð¾Ðµ")) {
      issues.push("uncertain note");
    }
    return {
      ok: issues.length === 0,
      importAnyway: false,
      lineNumber,
      issues,
      task: {
        id: crypto.randomUUID(),
        startIso: start.toISOString(),
        endIso: end.toISOString(),
        performer,
        name: name || "Bulk task",
        type: "paid",
        rateRubPerHour: rate,
        durationMs: end - start,
        sheetRow: null,
        reviewStatus: "",
        synced: false
      }
    };
  });
}

function parseBulkDateTime(year, month, day, time) {
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

function deriveBulkTaskName(rest, segments) {
  const inferredName = inferBulkName(rest);
  if (inferredName) return inferredName;
  let cleaned = rest;
  for (const segment of segments) {
    cleaned = cleaned.replace(segment[0], " ");
  }
  cleaned = cleaned
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b\d+(?:[.,]\d+)?\s*(?:Ñ€|Ñ€ÑƒÐ±)?\s*\/?\s*Ñ‡\b/gi, " ")
    .replace(/[;,]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || inferBulkName(rest);
}

function inferBulkName(text) {
  const lower = text.toLowerCase();
  if (isHighAltitudeWorkText(lower)) return "High-altitude work";
  if (lower.includes("client a")) return "Client A";
  if (lower.includes("shift") || lower.includes("смен")) return "Shift";
  if (lower.includes("tech") || lower.includes("тех") || lower.includes("монтаж")) return "Technical work";
  return "";
}

function inferBulkRate(text) {
  const lower = text.toLowerCase();
  if (isHighAltitudeWorkText(lower)) return 600;
  if (lower.includes("shift") || lower.includes("смен")) return 800;
  if (lower.includes("tech") || lower.includes("тех") || lower.includes("монтаж")) return 400;
  return 0;
}

function isHighAltitudeWorkText(lowerText) {
  return /\bвыс(?:отн(?:ые|ая|ых)?)?\s*\.?\s*(?:р|раб|работ[аы])?\b/i.test(lowerText)
    || lowerText.includes("высотные работы")
    || lowerText.includes("выс р")
    || lowerText.includes("high-altitude")
    || lowerText.includes("high altitude");
}

function sheetRowToTask(row, sheetRow) {
  const [startValue, endValue, performerValue, nameValue, typeValue] = row;
  const start = parseSheetDateTime(startValue);
  if (!start || !nameValue) return null;
  const end = parseSheetDateTime(endValue);
  const id = getSheetRowId(row) || crypto.randomUUID();
  const rate = getSheetRowRate(row);
  return {
    id,
    startIso: start.toISOString(),
    endIso: end ? end.toISOString() : "",
    performer: performerValue || state.defaultPerformer,
    name: nameValue,
    type: String(typeValue || "personal").toLowerCase() === "paid" ? "paid" : "personal",
    rateRubPerHour: rate,
    durationMs: end ? end - start : 0,
    sheetRow,
    reviewStatus: getSheetRowStatus(row),
    synced: true
  };
}

function formatDateTime(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseSheetDateTime(value) {
  if (!value) return null;
  const match = String(value).trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const [, day, month, year, hours, minutes] = match.map(Number);
  const date = new Date(year, month - 1, day, hours, minutes, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateTimeInput(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseDateTimeInput(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateOnly(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
}

function formatTimeOnly(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDateInput(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseDateInput(value, endOfDay) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return endOfDay
    ? new Date(year, month - 1, day, 23, 59, 59, 999)
    : new Date(year, month - 1, day, 0, 0, 0, 0);
}

function parseRate(value) {
  const rate = Number(value);
  return Number.isFinite(rate) && rate > 0 ? rate : 0;
}

function parseRateFromDialog() {
  const value = els.rateDialog.returnValue;
  if (value === "cancel" || !value) return null;
  return value === "custom" ? parseRate(els.customRateInput.value) : parseRate(value);
}

function formatRate(rate) {
  const value = Number(rate || 0);
  return value ? `${formatMoney(value)}/h` : "";
}

function calculateTaskEarnings(task) {
  if (task.type !== "paid" || !task.endIso) return 0;
  return (Number(task.durationMs || 0) / 3600000) * Number(task.rateRubPerHour || 0);
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("ru-RU", {
    maximumFractionDigits: 2
  });
}

function formatPrivateMoney(value) {
  const amount = Number(value || 0);
  if (state.stats?.privacyMode && amount > 40000) return "Hidden";
  return `${formatMoney(amount)} RUB`;
}

function getSheetRowId(row) {
  return row[8] || row[7] || (looksLikeTaskId(row[6]) ? row[6] : "");
}

function getSheetRowRate(row) {
  return looksLikeTaskId(row[6]) ? 0 : parseRate(row[5]);
}

function getSheetRowStatus(row) {
  const value = String(row[7] || "").toLowerCase();
  return value.includes("review") || value.includes("ignore") ? "needs_review" : "";
}

function looksLikeTaskId(value) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(value);
}

function isSameDate(first, second) {
  return first.getFullYear() === second.getFullYear()
    && first.getMonth() === second.getMonth()
    && first.getDate() === second.getDate();
}

function minutesSinceMidnight(date) {
  return date.getHours() * 60 + date.getMinutes();
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

function parseSpreadsheetId(value) {
  if (!value) return "";
  const match = value.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : value;
}

function showSetup() {
  hydrateSetupFields();
  els.setupDialog.showModal();
}

async function browseGoogleTables(interactive) {
  saveSetupInputs();
  if (!(await ensureGoogleAccountConnected(interactive))) return;
  setSyncStatus("Loading Google Sheets...");
  try {
    const response = await gapi.client.drive.files.list({
      q: "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
      fields: "files(id,name,modifiedTime)",
      orderBy: "modifiedTime desc",
      pageSize: 50
    });
    const tables = response.result.files || [];
    mergeKnownTables(tables);
    saveState();
    renderSavedTables();
    setSyncStatus(`Loaded ${tables.length} Google Sheets.`);
  } catch (error) {
    state.google.lastError = error.message || String(error);
    saveState();
    setSyncStatus(`Browse failed: ${state.google.lastError}`);
    console.error(error);
  }
}

function useSelectedSavedTable() {
  const table = getSelectedBrowseTable();
  if (!table) {
    showNotice("No saved table selected.");
    return;
  }
  state.google.spreadsheetId = table.id;
  state.google.sheetName = table.name;
  state.google.lastError = "";
  saveState();
  hydrateSetupFields();
  connectExistingTableFromSetup();
}

function hydrateSelectedBrowseTable() {
  const table = getSelectedBrowseTable();
  if (!table) return;
  els.spreadsheetIdInput.value = table.id;
  if (!els.renameTableInput.value.trim()) els.renameTableInput.value = table.name;
}

function getSelectedBrowseTable() {
  const tableId = els.savedTablesSelect.value;
  return (state.google.tables || []).find((item) => item.id === tableId) || null;
}

function saveSetupInputs() {
  state.google.clientId = els.clientIdInput.value.trim();
  state.google.apiKey = els.apiKeyInput.value.trim();
  state.defaultPerformer = els.defaultPerformerInput.value.trim() || state.defaultPerformer || "Alex";
  const pastedId = parseSpreadsheetId(els.spreadsheetIdInput.value.trim());
  if (pastedId) state.google.spreadsheetId = pastedId;
}

function rememberCurrentTable() {
  if (!state.google.spreadsheetId) return;
  state.google.tables ||= [];
  const existing = state.google.tables.find((item) => item.id === state.google.spreadsheetId);
  if (existing) {
    existing.name = state.google.sheetName || existing.name;
    return;
  }
  state.google.tables.push({
    id: state.google.spreadsheetId,
    name: state.google.sheetName || state.google.spreadsheetId
  });
}

function mergeKnownTables(tables) {
  state.google.tables ||= [];
  for (const table of tables) {
    const existing = state.google.tables.find((item) => item.id === table.id);
    if (existing) {
      existing.name = table.name || existing.name;
      existing.modifiedTime = table.modifiedTime || existing.modifiedTime;
      continue;
    }
    state.google.tables.push({
      id: table.id,
      name: table.name || table.id,
      modifiedTime: table.modifiedTime || ""
    });
  }
  state.google.tables.sort((a, b) => String(b.modifiedTime || "").localeCompare(String(a.modifiedTime || "")));
}

function persistCurrentTableTasks() {
  if (!state.google.spreadsheetId) return;
  state.google.tableTasks ||= {};
  state.google.tableTasks[state.google.spreadsheetId] = {
    activeTask: state.activeTask,
    tasks: state.tasks
  };
}

function loadCurrentTableTasks() {
  const saved = state.google.tableTasks?.[state.google.spreadsheetId];
  state.activeTask = saved?.activeTask || null;
  state.tasks = saved?.tasks || [];
}

function hydrateSetupFields() {
  els.clientIdInput.value = state.google.clientId || "";
  els.apiKeyInput.value = state.google.apiKey || "";
  els.developerSettings.hidden = Boolean(APP_CONFIG.googleClientId && APP_CONFIG.googleApiKey);
  els.sheetNameInput.value = state.google.sheetName || "Task Time Tracker";
  els.renameTableInput.value = state.google.spreadsheetId ? state.google.sheetName || "" : "";
  els.spreadsheetIdInput.value = state.google.spreadsheetId || "";
  renderSavedTables();
  els.defaultPerformerInput.value = state.defaultPerformer || "Alex";
  els.performerInput.placeholder = state.defaultPerformer || "Alex";
  els.googleAccountStatus.textContent = state.google.hasGrantedAccess
    ? `Google account connected${state.google.spreadsheetId ? `, table: ${state.google.sheetName || state.google.spreadsheetId}` : ""}.`
    : "Google account is not connected yet.";
}

function renderSavedTables() {
  els.savedTablesSelect.innerHTML = "";
  const tables = state.google.tables || [];
  if (!tables.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No saved tables yet";
    els.savedTablesSelect.append(option);
    return;
  }
  for (const table of tables) {
    const option = document.createElement("option");
    option.value = table.id;
    option.textContent = table.name;
    option.selected = table.id === state.google.spreadsheetId;
    els.savedTablesSelect.append(option);
  }
}

function loadState() {
  const fallback = {
    setupSeen: false,
    activeTask: null,
      defaultPerformer: "Alex",
    stats: {
      month: formatDateInput(new Date()).slice(0, 7),
      half: new Date().getDate() <= 15 ? "first" : "second",
      lastThreeMonths: false,
      privacyMode: false
    },
    theme: "light",
    tasks: [],
    google: {
      connected: false,
      clientId: "",
      apiKey: "",
      spreadsheetId: "",
      sheetName: "Task Time Tracker",
      tables: [],
      tableTasks: {},
      hasGrantedAccess: false,
      lastError: ""
    }
  };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return {
      ...fallback,
      ...saved,
      stats: { ...fallback.stats, ...(saved.stats || {}) },
      google: { ...fallback.google, ...(saved.google || {}) }
    };
  } catch {
    return fallback;
  }
}

function saveState() {
  persistCurrentTableTasks();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getPerformer() {
  return els.performerInput.value.trim() || state.defaultPerformer || "Alex";
}

async function pasteClipboardToInput(input, label) {
  try {
    const text = await navigator.clipboard.readText();
    input.value = text.trim();
    input.focus();
    showNotice(`${label} pasted.`);
  } catch (error) {
    console.error(error);
    showNotice("Clipboard paste was blocked. Use Ctrl+V in the field.");
  }
}

async function pasteGoogleCredentials() {
  try {
    const text = await navigator.clipboard.readText();
    if (!fillGoogleCredentials(text)) return;
    els.apiKeyInput.focus();
    showNotice("Google credentials pasted.");
  } catch (error) {
    console.error(error);
    showNotice("Clipboard paste was blocked. Use Ctrl+V in the fields.");
  }
}

function handleCredentialsFieldPaste(event) {
  const text = event.clipboardData?.getData("text") || "";
  if (!parseGoogleCredentials(text).clientId || !parseGoogleCredentials(text).apiKey) return;
  event.preventDefault();
  fillGoogleCredentials(text);
  showNotice("Google credentials pasted.");
}

function fillGoogleCredentials(text) {
  const { clientId, apiKey } = parseGoogleCredentials(text);
  if (!clientId || !apiKey) {
    showNotice("Copy Client ID and API key together, then press Paste both credentials.");
    return false;
  }
  els.clientIdInput.value = clientId;
  els.apiKeyInput.value = apiKey;
  return true;
}

function parseGoogleCredentials(text) {
  const clientDomain = ".apps" + ".googleusercontent.com";
  const apiKeyPrefix = "AI" + "za";
  const tokens = text
    .split(/\s+/)
    .map((token) => token.trim().replace(/^[<"'`]+|[>"'`,;]+$/g, ""))
    .filter(Boolean);
  return {
    clientId: tokens.find((token) => token.includes(clientDomain)) || "",
    apiKey: tokens.find((token) => token.startsWith(apiKeyPrefix)) || ""
  };
}

function toggleTheme() {
  state.theme = state.theme === "dark" ? "light" : "dark";
  saveState();
  applyTheme();
}

function applyTheme() {
  document.body.classList.toggle("dark", state.theme === "dark");
  els.themeButton.textContent = state.theme === "dark" ? "L" : "D";
  els.themeButton.title = state.theme === "dark" ? "Switch to light theme" : "Switch to dark theme";
}

function setSyncStatus(message) {
  els.syncStatus.textContent = message;
}

function getGoogleClientId() {
  return APP_CONFIG.googleClientId || state.google.clientId || "";
}

function getGoogleApiKey() {
  return APP_CONFIG.googleApiKey || state.google.apiKey || "";
}

function migrateState() {
  if (!state.defaultPerformer || state.defaultPerformer === "Me") state.defaultPerformer = "Alex";
  state.theme ||= "light";
  state.stats ||= {};
  state.stats.month ||= formatDateInput(new Date()).slice(0, 7);
  state.stats.half ||= new Date().getDate() <= 15 ? "first" : "second";
  state.stats.lastThreeMonths ||= false;
  for (const task of state.tasks) {
    task.performer ||= state.defaultPerformer;
    task.rateRubPerHour = Number(task.rateRubPerHour || 0);
    task.reviewStatus ||= "";
  }
  if (state.activeTask) {
    state.activeTask.performer ||= state.defaultPerformer;
    state.activeTask.rateRubPerHour = Number(state.activeTask.rateRubPerHour || 0);
    state.activeTask.reviewStatus ||= "";
  }
  saveState();
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

