const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const todayKey = () => new Date().toISOString().slice(0, 10);
const uid = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const defaultState = {
  theme: "light",
  accent: "#6d5dfc",
  onboarded: false,
  xp: 0,
  tasks: [],
  habits: [],
  notes: [],
  alarms: [],
  worldClocks: ["Asia/Kolkata", "America/New_York", "Europe/London"],
  laps: [],
  activity: [],
  focus: {
    todayMinutes: 0,
    sessions: 0,
    goal: 120,
    history: [],
    weekly: [35, 52, 20, 80, 45, 65, 30]
  }
};

let state = loadState();
let deferredInstallPrompt = null;
let ringingAlarmId = null;
let alarmPatternTimer = null;
let alarmPatternStep = 0;
let alarmVibrateTimer = null;
let testAlarmTimer = null;
let spinnerHoldTimer = null;
let spinnerHoldInterval = null;
let noteAutoSaveTimer = null;
let selectedHour = 7;
let selectedMinute = 0;
let selectedAmPm = "AM";

const timezones = [
  "local",
  "Asia/Kolkata",
  "America/New_York",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Asia/Tokyo",
  "Asia/Dubai",
  "Asia/Singapore",
  "Australia/Sydney",
  "Pacific/Auckland"
];

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem("timeMasterState") || "{}");
    return {
      ...defaultState,
      ...saved,
      focus: { ...defaultState.focus, ...(saved.focus || {}) }
    };
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState(message = "Saved local backup.") {
  localStorage.setItem("timeMasterState", JSON.stringify(state));
  localStorage.setItem("timeMasterBackup", JSON.stringify({ savedAt: new Date().toISOString(), state }));
  const status = $("#backup-status");
  if (status) status.textContent = `${message}\n${new Date().toLocaleString()}`;
}

function addActivity(text) {
  state.activity.unshift({ id: uid(), text, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) });
  state.activity = state.activity.slice(0, 8);
  state.xp += 8;
  saveState("Activity backed up.");
  renderAll();
}

function formatMs(ms) {
  const hours = String(Math.floor(ms / 3600000)).padStart(2, "0");
  const minutes = String(Math.floor(ms / 60000) % 60).padStart(2, "0");
  const seconds = String(Math.floor(ms / 1000) % 60).padStart(2, "0");
  const centiseconds = String(Math.floor((ms % 1000) / 10)).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}.${centiseconds}`;
}

function formatMinutes(minutes) {
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function setTheme(theme) {
  state.theme = theme;
  document.documentElement.dataset.theme = theme;
  $("#theme-toggle").textContent = theme === "dark" ? "Light" : "Dark";
  saveState("Theme saved.");
}

function setAccent(color) {
  state.accent = color;
  document.documentElement.style.setProperty("--accent", color);
  $("#accent-select").value = color;
  saveState("Accent color saved.");
}

function productivityScore() {
  const taskRate = state.tasks.length ? state.tasks.filter((task) => task.done).length / state.tasks.length : 0;
  const habitRate = getHabitPercent() / 100;
  const focusRate = clamp(state.focus.todayMinutes / state.focus.goal, 0, 1);
  return Math.round((taskRate * 35 + habitRate * 30 + focusRate * 35) || 0);
}

function getHabitPercent() {
  if (!state.habits.length) return 0;
  const done = state.habits.filter((habit) => habit.doneDates?.includes(todayKey())).length;
  return Math.round((done / state.habits.length) * 100);
}

function getLevel() {
  if (state.xp >= 700) return "Master";
  if (state.xp >= 350) return "Builder";
  if (state.xp >= 120) return "Rising";
  return "Starter";
}

function renderDashboard() {
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";
  const activeTasks = state.tasks.filter((task) => !task.done).length;
  const completedTasks = state.tasks.filter((task) => task.done).length;
  const taskPercent = state.tasks.length ? Math.round((completedTasks / state.tasks.length) * 100) : 0;
  const activeHabits = state.habits.length;
  const completedHabits = state.habits.filter((habit) => habit.doneDates?.includes(todayKey())).length;
  const habitPercent = getHabitPercent();
  const todayAlarms = state.alarms.filter((alarm) => alarm.days.includes(String(now.getDay()))).length;

  $("#greeting-text").textContent = greeting;
  $("#current-date").textContent = now.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric", year: "numeric" });
  $("#dashboard-time").textContent = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  $("#active-tasks").textContent = activeTasks;
  $("#task-summary").textContent = state.tasks.length ? `${completedTasks} completed today` : "Plan your first task";
  $("#active-habits").textContent = activeHabits;
  $("#habit-summary").textContent = state.habits.length ? `${completedHabits} done today` : "Create a daily rhythm";
  $("#active-alarms").textContent = todayAlarms;
  $("#active-notes").textContent = state.notes.length;
  $("#note-summary").textContent = state.notes.length ? `${state.notes.filter((note) => note.pinned).length} pinned` : "Capture a thought";
  $("#activity-list").innerHTML = state.activity.length
    ? state.activity.map((item) => `<div class="timeline-item"><strong>${item.text}</strong><span class="muted">${item.time}</span></div>`).join("")
    : emptyState("Your timeline is fresh", "Add a task, habit, alarm, or note to begin your day.");

  const dailyProgress = Math.round((taskPercent + habitPercent) / 2);
  $("#daily-progress-ring").style.setProperty("--value", dailyProgress);
  $("#daily-progress-text").textContent = `${dailyProgress}%`;
  $("#progress-habits").textContent = `${habitPercent}%`;
  $("#progress-tasks").textContent = `${taskPercent}%`;

  $("#level-label").textContent = getLevel();
  $("#xp-points").textContent = state.xp;
  $("#xp-bar").style.width = `${state.xp % 100}%`;
}

function emptyState(title, text) {
  return `<div class="empty-state"><span class="empty-icon">+</span><strong>${title}</strong><small>${text}</small></div>`;
}

function renderTasks() {
  const done = state.tasks.filter((task) => task.done).length;
  const progress = state.tasks.length ? Math.round((done / state.tasks.length) * 100) : 0;
  $("#task-progress-label").textContent = `${progress}%`;
  $("#task-progress").style.width = `${progress}%`;
  $("#task-list").innerHTML = state.tasks.length ? state.tasks.map((task) => `
    <div class="item priority-${task.priority} ${task.done ? "completed" : ""}">
      <div class="item-row">
        <label><input type="checkbox" data-task-toggle="${task.id}" ${task.done ? "checked" : ""}> <span class="item-title">${task.title}</span></label>
        <span class="muted">${task.priority}</span>
      </div>
      <div class="item-row">
        <small class="muted">Due: ${task.due || "No date"}</small>
        <span class="item-actions">
          <button class="btn small ghost" data-task-edit="${task.id}">Edit</button>
          <button class="btn small danger" data-task-delete="${task.id}">Delete</button>
        </span>
      </div>
    </div>
  `).join("") : emptyState("No tasks yet", "Add one clear next step and make the day lighter.");
}

function renderHabits() {
  const percent = getHabitPercent();
  $("#habit-percent").textContent = `${percent}%`;
  $("#habit-list").innerHTML = state.habits.length ? state.habits.map((habit) => {
    const done = habit.doneDates?.includes(todayKey());
    const completion = habit.doneDates?.length ? Math.min(100, Math.round((habit.doneDates.length / 30) * 100)) : 0;
    return `
      <div class="item ${done ? "completed" : ""}">
        <div class="item-row">
          <strong>${habit.title}</strong>
          <span>${done ? "Done today" : "Due today"}</span>
        </div>
        <div class="habit-meta">
          <span>Streak: <strong>${habit.streak || 0}</strong></span>
          <span>Best: <strong>${habit.bestStreak || habit.streak || 0}</strong></span>
          <span>Completion: <strong>${completion}%</strong></span>
          <span>Reminder: <strong>${formatAlarmTime(habit.reminderTime) || "Not set"}</strong></span>
        </div>
        <div class="item-row">
          <button class="btn small ${done ? "ghost" : "primary"}" data-habit-toggle="${habit.id}">${done ? "Completed" : "Mark Today"}</button>
          <button class="btn small danger" data-habit-delete="${habit.id}">Delete</button>
        </div>
      </div>
    `;
  }).join("") : emptyState("No habits yet", "Choose a small daily action and give it a reminder time.");

  const days = Array.from({ length: 35 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (34 - index));
    const key = date.toISOString().slice(0, 10);
    const done = state.habits.some((habit) => habit.doneDates?.includes(key));
    return `<span class="calendar-day ${done ? "done" : ""}">${date.getDate()}</span>`;
  });
  $("#habit-calendar").innerHTML = days.join("");
  $("#habit-weekly").textContent = countHabitCompletions(7);
  $("#habit-monthly").textContent = countHabitCompletions(30);
  $("#habit-best-streak").textContent = `${Math.max(0, ...state.habits.map((habit) => habit.bestStreak || habit.streak || 0))} days`;
}

function countHabitCompletions(daysBack) {
  const keys = new Set(Array.from({ length: daysBack }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - index);
    return date.toISOString().slice(0, 10);
  }));
  return state.habits.reduce((total, habit) => total + (habit.doneDates || []).filter((date) => keys.has(date)).length, 0);
}

function formatAlarmTime(time) {
  if (!time) return "";
  const [hours, minutes] = time.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const hour = hours % 12 || 12;
  return `${hour}:${String(minutes).padStart(2, "0")} ${period}`;
}

function renderNotes() {
  const query = $("#note-search")?.value?.toLowerCase() || "";
  const notes = state.notes
    .filter((note) => (note.title || "").toLowerCase().includes(query) || stripHtml(note.body || "").toLowerCase().includes(query))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned));
  $("#note-list").innerHTML = notes.length ? notes.map((note) => `
    <div class="item">
      <div class="item-row">
        <strong>${note.pinned ? "Pinned: " : ""}${note.title || "Untitled"}</strong>
        <small class="muted">${new Date(note.updatedAt).toLocaleDateString()}</small>
      </div>
      <div>${note.body}</div>
      <div class="item-actions">
        <button class="btn small ghost" data-note-pin="${note.id}">${note.pinned ? "Unpin" : "Pin"}</button>
        <button class="btn small ghost" data-note-edit="${note.id}">Edit</button>
        <button class="btn small danger" data-note-delete="${note.id}">Delete</button>
      </div>
    </div>
  `).join("") : emptyState("No notes found", "Capture ideas here and they will auto-save while you type.");
}

function stripHtml(html) {
  const temp = document.createElement("div");
  temp.innerHTML = html;
  return temp.textContent || "";
}

const Stopwatch = {
  running: false,
  startedAt: 0,
  elapsed: 0,
  timer: null,
  start() {
    if (this.running) {
      this.elapsed += Date.now() - this.startedAt;
      clearInterval(this.timer);
      this.running = false;
      $("#sw-start").textContent = "Start";
      addActivity("Paused stopwatch");
      return;
    }
    this.startedAt = Date.now();
    this.timer = setInterval(() => this.render(), 35);
    this.running = true;
    $("#sw-start").textContent = "Pause";
  },
  reset() {
    clearInterval(this.timer);
    this.running = false;
    this.elapsed = 0;
    this.startedAt = 0;
    state.laps = [];
    $("#sw-start").textContent = "Start";
    saveState("Stopwatch reset.");
    this.render();
    renderLaps(true);
  },
  current() {
    return this.elapsed + (this.running ? Date.now() - this.startedAt : 0);
  },
  lap() {
    const total = this.current();
    const previous = state.laps[0]?.total || 0;
    state.laps.unshift({ id: uid(), total, duration: total - previous, at: new Date().toLocaleTimeString() });
    addActivity("Recorded a stopwatch lap");
    renderLaps(true);
  },
  render() {
    const current = this.current();
    $("#stopwatch-display").textContent = formatMs(current);
    $("#stopwatch-ring").style.setProperty("--value", (current / 60000 * 100) % 100);
  }
};

function renderLaps(shouldSave = false) {
  const durations = state.laps.map((lap) => lap.duration);
  const fastest = durations.length ? Math.min(...durations) : 0;
  const slowest = durations.length ? Math.max(...durations) : 0;
  const average = durations.length ? durations.reduce((sum, value) => sum + value, 0) / durations.length : 0;
  $("#lap-fastest").textContent = fastest ? formatMs(fastest) : "--";
  $("#lap-slowest").textContent = slowest ? formatMs(slowest) : "--";
  $("#lap-average").textContent = average ? formatMs(average) : "--";
  $("#lap-count").textContent = state.laps.length;
  $("#lap-list").innerHTML = state.laps.length ? state.laps.map((lap, index) => `
    <div class="item ${lap.duration === fastest ? "priority-Low" : ""} ${lap.duration === slowest ? "priority-High" : ""}">
      <div class="item-row"><strong>Lap ${state.laps.length - index}</strong><span>${formatMs(lap.duration)}</span></div>
      <small class="muted">Total ${formatMs(lap.total)} at ${lap.at}</small>
    </div>
  `).join("") : `<div class="item">No laps recorded.</div>`;
  if (shouldSave) saveState("Lap history backed up.");
}

function renderClock() {
  const now = new Date();
  const seconds = now.getSeconds();
  const minutes = now.getMinutes() + seconds / 60;
  const hours = (now.getHours() % 12) + minutes / 60;
  $("#second-hand").style.transform = `translateX(-50%) rotate(${seconds * 6}deg)`;
  $("#minute-hand").style.transform = `translateX(-50%) rotate(${minutes * 6}deg)`;
  $("#hour-hand").style.transform = `translateX(-50%) rotate(${hours * 30}deg)`;
  $("#digital-clock").textContent = now.toLocaleTimeString();
  $("#clock-date").textContent = now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
  $("#day-night").textContent = now.getHours() >= 6 && now.getHours() < 18 ? "Daytime" : "Nighttime";
  $("#sunrise").textContent = "06:12";
  $("#sunset").textContent = "18:42";
  renderWorldClocks();
}

function renderTimezoneOptions() {
  const query = ($("#timezone-search")?.value || "").toLowerCase();
  $("#timezone-select").innerHTML = timezones
    .filter((zone) => zone.toLowerCase().includes(query))
    .map((zone) => `<option value="${zone}">${zone === "local" ? "Local Time" : zone}</option>`)
    .join("");
}

function renderWorldClocks() {
  $("#world-list").innerHTML = state.worldClocks.map((zone) => {
    const time = zone === "local"
      ? new Date().toLocaleTimeString()
      : new Date().toLocaleTimeString([], { timeZone: zone, hour: "2-digit", minute: "2-digit", second: "2-digit" });
    return `<div class="item"><div class="item-row"><strong>${zone}</strong><span>${time}</span></div><button class="btn small danger" data-clock-delete="${zone}">Delete</button></div>`;
  }).join("");
}

function renderAlarms() {
  const today = String(new Date().getDay());
  $("#alarm-list").innerHTML = state.alarms.length ? state.alarms.map((alarm) => {
    const isToday = alarm.days.includes(today);
    return `
    <article class="alarm-card ${isToday ? "active-alarm" : ""}">
      <div class="alarm-card-main">
        <span class="alarm-card-time">${formatAlarmTime(alarm.time)}</span>
        <span class="alarm-card-label">${alarm.category}</span>
      </div>
      <button class="btn small danger" data-alarm-delete="${alarm.id}">Delete</button>
    </article>
  `}).join("") : emptyState("No alarms set", "Create one with the time spinners.");
}

function playTone(type = "classic") {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const frequencies = { classic: 880, soft: 520, bright: 1100, rain: 180, forest: 260, ocean: 140, cafe: 330 };
  osc.frequency.value = frequencies[type] || 880;
  osc.type = type === "soft" ? "sine" : "triangle";
  osc.connect(gain);
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(0.25, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
  osc.start();
  osc.stop(ctx.currentTime + 0.8);
}

function playWakeAlarm(type = "classic") {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const master = ctx.createGain();
    const volume = clamp(0.55 + alarmPatternStep * 0.06, 0.55, 1);
    master.gain.setValueAtTime(volume, ctx.currentTime);
    master.connect(ctx.destination);
    const base = type === "soft" ? 720 : type === "bright" ? 1240 : 980;

    [0, 0.14, 0.28, 0.42, 0.58, 0.72].forEach((offset, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = index % 2 ? "square" : "sawtooth";
      osc.frequency.setValueAtTime(base + index * 140 + alarmPatternStep * 28, ctx.currentTime + offset);
      gain.gain.setValueAtTime(0.001, ctx.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.62, ctx.currentTime + offset + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.22);
      osc.connect(gain);
      gain.connect(master);
      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime + offset + 0.24);
    });
    alarmPatternStep += 1;
  } catch {
    playTone(type);
  }
}

function startAlarmVibration() {
  if (!navigator.vibrate) return;
  const pattern = [500, 180, 500, 180, 500, 280];
  navigator.vibrate(pattern);
  alarmVibrateTimer = setInterval(() => navigator.vibrate(pattern), 2200);
}

function stopAlarmVibration() {
  clearInterval(alarmVibrateTimer);
  alarmVibrateTimer = null;
  if (navigator.vibrate) navigator.vibrate(0);
}

function stopAlarmSound() {
  clearInterval(alarmPatternTimer);
  clearInterval(testAlarmTimer);
  alarmPatternTimer = null;
  testAlarmTimer = null;
  alarmPatternStep = 0;
  stopAlarmVibration();
}

function ringAlarm(alarm) {
  ringingAlarmId = alarm.id;
  $("#ringing-label").textContent = "Wake Up!";
  $("#alarm-current-time").textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  $("#alarm-modal").hidden = false;
  stopAlarmSound();
  playWakeAlarm(alarm.sound);
  alarmPatternTimer = setInterval(() => playWakeAlarm(alarm.sound), 1000);
  startAlarmVibration();
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("Time Master Alarm", { body: alarm.category });
  }
  addActivity(`Alarm rang: ${alarm.category}`);
}

function testAlarmSound() {
  stopAlarmSound();
  const sound = $("#alarm-sound")?.value || "classic";
  alarmPatternStep = 0;
  playWakeAlarm(sound);
  let count = 0;
  testAlarmTimer = setInterval(() => {
    playWakeAlarm(sound);
    count += 1;
    if (count >= 4) stopAlarmSound();
  }, 1000);
}

function checkAlarms() {
  const now = new Date();
  const currentTime = now.toTimeString().slice(0, 5);
  const day = String(now.getDay());
  state.alarms.forEach((alarm) => {
    const repeatMatches = !alarm.days.length || alarm.days.includes(day);
    const key = `${todayKey()}-${currentTime}`;
    if (alarm.time === currentTime && repeatMatches && alarm.lastRing !== key) {
      alarm.lastRing = key;
      saveState("Alarm state saved.");
      ringAlarm(alarm);
    }
  });
}

const Pomodoro = {
  running: false,
  timer: null,
  total: 25 * 60,
  left: 25 * 60,
  start() {
    if (this.running) {
      clearInterval(this.timer);
      this.running = false;
      $("#pomo-start").textContent = "Start";
      return;
    }
    this.total = Number($("#focus-minutes").value) * 60;
    if (this.left <= 0 || this.left > this.total) this.left = this.total;
    this.running = true;
    $("#pomo-start").textContent = "Pause";
    this.timer = setInterval(() => this.tick(), 1000);
    playAmbient();
  },
  tick() {
    this.left -= 1;
    this.render();
    if (this.left <= 0) this.complete();
  },
  reset() {
    clearInterval(this.timer);
    this.running = false;
    this.total = Number($("#focus-minutes").value) * 60;
    this.left = this.total;
    $("#pomo-start").textContent = "Start";
    this.render();
  },
  complete() {
    clearInterval(this.timer);
    this.running = false;
    const minutes = Number($("#focus-minutes").value);
    state.focus.todayMinutes += minutes;
    state.focus.sessions += 1;
    state.focus.weekly[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1] += minutes;
    state.focus.history.unshift({ id: uid(), minutes, at: new Date().toLocaleString() });
    state.focus.history = state.focus.history.slice(0, 10);
    this.left = Number($("#break-minutes").value) * 60;
    $("#pomo-start").textContent = "Start Break";
    playTone("bright");
    addActivity(`Completed ${minutes}m focus session`);
  },
  render() {
    const minutes = String(Math.floor(this.left / 60)).padStart(2, "0");
    const seconds = String(this.left % 60).padStart(2, "0");
    $("#pomo-display").textContent = `${minutes}:${seconds}`;
    $("#pomo-ring").style.setProperty("--value", Math.round((this.left / this.total) * 100));
  },
  updateFromInput() {
    this.total = Number($("#focus-minutes").value) * 60;
    this.left = this.total;
    this.render();
  }
};

function playAmbient() {
  const sound = $("#ambient-sound").value;
  if (sound !== "none") playTone(sound);
}

function renderPomodoro() {
  $("#daily-goal").value = state.focus.goal;
  $("#session-history").innerHTML = state.focus.history.length ? state.focus.history.map((session) => `
    <div class="timeline-item"><strong>${session.minutes}m focus</strong><span class="muted">${session.at}</span></div>
  `).join("") : `<div class="timeline-item">No sessions yet.</div>`;
}

function renderAll() {
  renderDashboard();
  renderTasks();
  renderHabits();
  renderNotes();
  renderLaps();
  renderTimezoneOptions();
  renderWorldClocks();
  renderAlarms();
  renderPomodoro();
}

function switchPage(pageId) {
  $$(".page").forEach((page) => page.classList.toggle("active", page.id === pageId));
  $$(".nav-btn").forEach((button) => button.classList.toggle("active", button.dataset.page === pageId));
  $("#page-title").textContent = pageId.charAt(0).toUpperCase() + pageId.slice(1);
  $(".sidebar").classList.remove("open");
  renderAll();
}

function download(filename, text, type = "text/plain") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function wireEvents() {
  $$(".nav-btn").forEach((button) => button.addEventListener("click", () => switchPage(button.dataset.page)));
  $("#mobile-menu").addEventListener("click", () => $(".sidebar").classList.toggle("open"));
  $("#theme-toggle").addEventListener("click", () => setTheme(state.theme === "dark" ? "light" : "dark"));
  $("#accent-select").addEventListener("change", (event) => setAccent(event.target.value));
  $("#start-onboarding").addEventListener("click", () => {
    state.onboarded = true;
    $("#onboarding").hidden = true;
    addActivity("Completed onboarding");
  });

  $("#task-form").addEventListener("submit", (event) => {
    event.preventDefault();
    state.tasks.unshift({ id: uid(), title: $("#task-title").value.trim(), priority: $("#task-priority").value, due: $("#task-due").value, done: false });
    event.target.reset();
    addActivity("Created a task");
  });

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (target.dataset.taskToggle) {
      const task = state.tasks.find((item) => item.id === target.dataset.taskToggle);
      task.done = target.checked;
      addActivity(task.done ? "Completed a task" : "Reopened a task");
    }
    if (target.dataset.taskDelete) {
      state.tasks = state.tasks.filter((task) => task.id !== target.dataset.taskDelete);
      addActivity("Deleted a task");
    }
    if (target.dataset.taskEdit) {
      const task = state.tasks.find((item) => item.id === target.dataset.taskEdit);
      const title = prompt("Edit task name", task.title);
      if (title) {
        task.title = title.trim();
        addActivity("Edited a task");
      }
    }
    if (target.dataset.habitToggle) toggleHabit(target.dataset.habitToggle);
    if (target.dataset.habitDelete) {
      state.alarms = state.alarms.filter((alarm) => alarm.habitId !== target.dataset.habitDelete);
      state.habits = state.habits.filter((habit) => habit.id !== target.dataset.habitDelete);
      addActivity("Deleted a habit");
    }
    if (target.dataset.noteDelete) {
      state.notes = state.notes.filter((note) => note.id !== target.dataset.noteDelete);
      addActivity("Deleted a note");
    }
    if (target.dataset.notePin) {
      const note = state.notes.find((item) => item.id === target.dataset.notePin);
      note.pinned = !note.pinned;
      addActivity(note.pinned ? "Pinned a note" : "Unpinned a note");
    }
    if (target.dataset.noteEdit) {
      const note = state.notes.find((item) => item.id === target.dataset.noteEdit);
      $("#note-title").value = note.title;
      $("#note-editor").innerHTML = note.body;
      $("#save-note").dataset.editing = note.id;
      switchPage("notes");
    }
    if (target.dataset.clockDelete) {
      state.worldClocks = state.worldClocks.filter((zone) => zone !== target.dataset.clockDelete);
      saveState("World clock removed.");
      renderWorldClocks();
    }
    if (target.dataset.alarmDelete) {
      state.alarms = state.alarms.filter((alarm) => alarm.id !== target.dataset.alarmDelete);
      addActivity("Deleted an alarm");
    }
    if (target.dataset.snooze) snoozeAlarm(Number(target.dataset.snooze));
    if (target.dataset.ampm) setAmPm(target.dataset.ampm);
  });

  $("#habit-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const title = $("#habit-title").value.trim();
    const reminderTime = $("#habit-reminder").value;
    const habit = { id: uid(), title, reminderTime, streak: 0, bestStreak: 0, doneDates: [] };
    state.habits.unshift(habit);
    state.alarms.push({
      id: uid(),
      time: reminderTime,
      category: title,
      sound: "bright",
      days: ["0", "1", "2", "3", "4", "5", "6"],
      habitId: habit.id
    });
    event.target.reset();
    addActivity("Created a habit reminder");
  });

  $$(".toolbar .btn").forEach((button) => button.addEventListener("click", () => {
    document.execCommand(button.dataset.command, false, null);
    $("#note-editor").focus();
  }));

  $("#save-note").addEventListener("click", () => {
    saveCurrentNote();
    addActivity("Saved a note");
  });
  $("#new-note").addEventListener("click", clearNoteEditor);
  $("#note-title").addEventListener("input", scheduleNoteAutoSave);
  $("#note-editor").addEventListener("input", scheduleNoteAutoSave);

  $("#note-search").addEventListener("input", renderNotes);
  $("#sw-start").addEventListener("click", () => Stopwatch.start());
  $("#sw-lap").addEventListener("click", () => Stopwatch.lap());
  $("#sw-reset").addEventListener("click", () => Stopwatch.reset());
  $("#export-csv").addEventListener("click", exportLapsCsv);
  $("#export-pdf").addEventListener("click", exportLapsPdf);
  $("#timezone-search").addEventListener("input", renderTimezoneOptions);
  $("#add-clock").addEventListener("click", () => {
    const zone = $("#timezone-select").value;
    if (zone && !state.worldClocks.includes(zone)) state.worldClocks.push(zone);
    saveState("World clock saved.");
    renderWorldClocks();
  });

  $("#alarm-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const hour24 = selectedHour % 12 + (selectedAmPm === "PM" ? 12 : 0);
    const time = `${String(hour24).padStart(2, "0")}:${String(selectedMinute).padStart(2, "0")}`;
    const today = String(new Date().getDay());
    state.alarms.push({
      id: uid(),
      time,
      category: "Alarm",
      sound: "classic",
      days: [today]
    });
    if ("Notification" in window && Notification.permission === "default") Notification.requestPermission();
    event.target.reset();
    selectedHour = 7;
    selectedMinute = 0;
    selectedAmPm = "AM";
    renderTimePicker();
    addActivity("Created an alarm");
  });

  $("#snooze-5").addEventListener("click", () => snoozeAlarm(5));
  $("#stop-alarm").addEventListener("click", () => {
    $("#alarm-modal").hidden = true;
    stopAlarmSound();
    ringingAlarmId = null;
  });

  $("#pomo-start").addEventListener("click", () => Pomodoro.start());
  $("#pomo-reset").addEventListener("click", () => Pomodoro.reset());
  $("#fullscreen-focus").addEventListener("click", () => $("#focus-card").classList.toggle("fullscreen"));
  $("#focus-minutes").addEventListener("input", () => {
    Pomodoro.updateFromInput();
    state.focus.goal = Number($("#focus-minutes").value);
    saveState("Focus time saved.");
  });
  $("#daily-goal").addEventListener("change", (event) => {
    state.focus.goal = Number(event.target.value);
    saveState("Daily goal saved.");
    renderAll();
  });

  $("#export-json").addEventListener("click", () => download("time-master-backup.json", JSON.stringify({ exportedAt: new Date().toISOString(), state }, null, 2), "application/json"));
  $("#import-json").addEventListener("change", importBackup);
  $("#reset-data").addEventListener("click", () => {
    if (!confirm("Reset all Time Master data?")) return;
    state = structuredClone(defaultState);
    saveState("Data reset.");
    renderAll();
  });
}

function toggleHabit(id) {
  const habit = state.habits.find((item) => item.id === id);
  if (!habit) return;
  habit.doneDates ||= [];
  const key = todayKey();
  if (habit.doneDates.includes(key)) {
    habit.doneDates = habit.doneDates.filter((date) => date !== key);
    habit.streak = Math.max(0, (habit.streak || 0) - 1);
  } else {
    habit.doneDates.push(key);
    habit.streak = (habit.streak || 0) + 1;
    habit.bestStreak = Math.max(habit.bestStreak || 0, habit.streak);
  }
  addActivity("Updated a habit");
}

function completeHabitFromAlarm() {
  const alarm = state.alarms.find((item) => item.id === ringingAlarmId);
  if (alarm?.habitId) toggleHabit(alarm.habitId);
  $("#alarm-modal").hidden = true;
  stopAlarmSound();
  ringingAlarmId = null;
}

function saveCurrentNote(isAutoSave = false) {
  const title = $("#note-title").value.trim();
  const body = $("#note-editor").innerHTML.trim();
  if (!title && !stripHtml(body)) return;

  const existingId = $("#save-note").dataset.editing;
  let note = existingId ? state.notes.find((item) => item.id === existingId) : null;
  if (!note) {
    note = { id: uid(), pinned: false };
    state.notes.unshift(note);
    $("#save-note").dataset.editing = note.id;
  }
  note.title = title || "Untitled";
  note.body = body || "<p>Empty note</p>";
  note.updatedAt = new Date().toISOString();
  saveState(isAutoSave ? "Note auto-saved." : "Note saved.");
  $("#note-save-status").textContent = isAutoSave ? "Auto-saved just now" : "Saved";
  renderNotes();
}

function scheduleNoteAutoSave() {
  clearTimeout(noteAutoSaveTimer);
  $("#note-save-status").textContent = "Saving...";
  noteAutoSaveTimer = setTimeout(() => saveCurrentNote(true), 500);
}

function clearNoteEditor() {
  delete $("#save-note").dataset.editing;
  $("#note-title").value = "";
  $("#note-editor").innerHTML = "";
  $("#note-save-status").textContent = "New note ready";
}

function bumpSpinner(part) {
  const el = part === "hour" ? $("#picker-hour") : $("#picker-minute");
  el.classList.remove("bump");
  void el.offsetWidth;
  el.classList.add("bump");
}

function adjustSpinner(part, delta) {
  if (part === "hour") {
    selectedHour = selectedHour + delta;
    if (selectedHour > 12) selectedHour = 1;
    if (selectedHour < 1) selectedHour = 12;
  } else {
    selectedMinute = selectedMinute + delta;
    if (selectedMinute > 59) selectedMinute = 0;
    if (selectedMinute < 0) selectedMinute = 59;
  }
  renderTimePicker();
  bumpSpinner(part);
}

function stopSpinnerHold() {
  clearTimeout(spinnerHoldTimer);
  clearInterval(spinnerHoldInterval);
  spinnerHoldTimer = null;
  spinnerHoldInterval = null;
}

function startSpinnerHold(part, delta) {
  stopSpinnerHold();
  adjustSpinner(part, delta);
  spinnerHoldTimer = setTimeout(() => {
    spinnerHoldInterval = setInterval(() => adjustSpinner(part, delta), 90);
  }, 380);
}

function renderTimePicker() {
  const hourEl = $("#picker-hour");
  const minuteEl = $("#picker-minute");
  hourEl.textContent = String(selectedHour);
  minuteEl.textContent = String(selectedMinute).padStart(2, "0");
  hourEl.setAttribute("aria-valuenow", selectedHour);
  minuteEl.setAttribute("aria-valuenow", selectedMinute);
  $$(".ampm-segmented button").forEach((button) => button.classList.toggle("active", button.dataset.ampm === selectedAmPm));
  syncAlarmTime();
}

function setAmPm(period) {
  selectedAmPm = period;
  renderTimePicker();
}

function syncAlarmTime() {
  let hour24 = selectedHour % 12;
  if (selectedAmPm === "PM") hour24 += 12;
  $("#alarm-time").value = `${String(hour24).padStart(2, "0")}:${String(selectedMinute).padStart(2, "0")}`;
}

function wireSpinnerPicker() {
  $$(".spinner-column").forEach((column) => {
    const part = column.dataset.spinner;
    column.querySelectorAll(".spinner-btn").forEach((button) => {
      const delta = button.dataset.spinnerDir === "up" ? 1 : -1;
      const start = (event) => {
        event.preventDefault();
        startSpinnerHold(part, delta);
      };
      button.addEventListener("mousedown", start);
      button.addEventListener("touchstart", start, { passive: false });
    });
  });

  ["mouseup", "mouseleave", "touchend", "touchcancel"].forEach((eventName) => {
    document.addEventListener(eventName, stopSpinnerHold);
  });

  const hourEl = $("#picker-hour");
  const minuteEl = $("#picker-minute");

  hourEl.addEventListener("keydown", (event) => {
    if (event.key === "ArrowUp") { event.preventDefault(); adjustSpinner("hour", 1); }
    if (event.key === "ArrowDown") { event.preventDefault(); adjustSpinner("hour", -1); }
    if (event.key === "ArrowRight") { event.preventDefault(); minuteEl.focus(); }
  });

  minuteEl.addEventListener("keydown", (event) => {
    if (event.key === "ArrowUp") { event.preventDefault(); adjustSpinner("minute", 1); }
    if (event.key === "ArrowDown") { event.preventDefault(); adjustSpinner("minute", -1); }
    if (event.key === "ArrowLeft") { event.preventDefault(); hourEl.focus(); }
    if (event.key === "ArrowRight") { event.preventDefault(); $(".ampm-segmented button.active")?.focus(); }
  });

  $$(".ampm-segmented button").forEach((button) => {
    button.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault();
        setAmPm("AM");
        $$(".ampm-segmented button")[0].focus();
      }
      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        event.preventDefault();
        setAmPm("PM");
        $$(".ampm-segmented button")[1].focus();
      }
    });
  });
}

function exportLapsCsv() {
  const rows = ["Lap,Duration,Total,Time", ...state.laps.map((lap, index) => `${state.laps.length - index},${formatMs(lap.duration)},${formatMs(lap.total)},${lap.at}`)];
  download("time-master-laps.csv", rows.join("\n"), "text/csv");
}

function exportLapsPdf() {
  const html = `<h1>Time Master Lap History</h1>${state.laps.map((lap, index) => `<p>Lap ${state.laps.length - index}: ${formatMs(lap.duration)} total ${formatMs(lap.total)}</p>`).join("")}`;
  const win = window.open("", "_blank");
  win.document.write(html);
  win.document.close();
  win.print();
}

function snoozeAlarm(minutes) {
  const alarm = state.alarms.find((item) => item.id === ringingAlarmId);
  $("#alarm-modal").hidden = true;
  stopAlarmSound();
  if (!alarm) return;
  const next = new Date(Date.now() + minutes * 60000);
  state.alarms.push({ ...alarm, id: uid(), time: next.toTimeString().slice(0, 5), days: [] });
  addActivity(`Snoozed alarm for ${minutes} minutes`);
}

function importBackup(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const backup = JSON.parse(reader.result);
      state = { ...defaultState, ...(backup.state || backup) };
      saveState("Imported backup.");
      applyPreferences();
      renderAll();
    } catch {
      alert("Backup file could not be imported.");
    }
  };
  reader.readAsText(file);
}

function applyPreferences() {
  document.documentElement.dataset.theme = state.theme;
  document.documentElement.style.setProperty("--accent", state.accent);
  $("#theme-toggle").textContent = state.theme === "dark" ? "Light" : "Dark";
  $("#accent-select").value = state.accent;
  $("#onboarding").hidden = state.onboarded;
}

function registerPwa() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    $("#install-app").hidden = false;
  });
  $("#install-app").addEventListener("click", async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    $("#install-app").hidden = true;
  });
}

function init() {
  applyPreferences();
  wireEvents();
  wireSpinnerPicker();
  renderTimePicker();

  Pomodoro.updateFromInput();

  const legacyClockPicker = document.getElementById("clock-picker");
  if (legacyClockPicker) legacyClockPicker.remove();

  const spinnerReady = document.getElementById("alarm-spinner-picker");
  if (!spinnerReady) console.error("Alarm spinner picker missing from DOM.");
  renderAll();
  setInterval(renderClock, 1000);
  setInterval(checkAlarms, 1000);
  renderClock();
  registerPwa();
  saveState("Automatic backup ready.");
}

init();
