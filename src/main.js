const ICONS = {
  prev: `
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="m15 18-6-6 6-6"/>
    </svg>
  `,
  
  next: `
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="m9 18 6-6-6-6"/>
    </svg>
  `,
  
  calendar: `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M8 2v4"/><path d="M16 2v4"/>
      <rect width="18" height="18" x="3" y="4" rx="2"/>
      <path d="M3 10h18"/>
    </svg>
  `,
  
  plus: `
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M5 12h14"/><path d="M12 5v14"/>
    </svg>
  `,
  
  drag: `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="9" cy="12" r="1"/>
      <circle cx="9" cy="5" r="1"/>
      <circle cx="9" cy="19" r="1"/>
      <circle cx="15" cy="12" r="1"/>
      <circle cx="15" cy="5" r="1"/>
      <circle cx="15" cy="19" r="1"/>
    </svg>
  `,
  
  edit: `
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 20h9"/>
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
    </svg>
  `,
  
  delete: `
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
    </svg>
  `,
  
  // Custom circular status icons
  statusPending: `
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"/>
    </svg>
  `,
  
  statusPartial: `
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2a10 10 0 0 0 0 20Z" fill="currentColor" opacity="0.3"/>
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 2v20a10 10 0 0 0 0-20Z"/>
    </svg>
  `,
  
  statusDone: `
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.1"/>
      <circle cx="12" cy="12" r="10"/>
      <path d="m9 12 2 2 4-4"/>
    </svg>
  `,

  chevronDown: `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="m6 9 6 6 6-6"/>
    </svg>
  `,

  arrowUp: `
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
      <path d="m18 15-6-6-6 6"/>
    </svg>
  `,

  arrowDown: `
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
      <path d="m6 9 6 6 6-6"/>
    </svg>
  `
};

// ==========================================================================
// 1. GLOBAL STATE & CONFIGURATION
// ==========================================================================
let tasks = [];
let selectedDate = ''; // YYYY-MM-DD
let activeView = 'tasks'; // 'tasks' | 'archive'
let recentlyDeletedTask = null; // Store for undo functionality
let deleteToastTimeout = null;

// ==========================================================================
// 2. HELPER FUNCTIONS (Date formatting, LocalStorage)
// ==========================================================================

// Get YYYY-MM-DD string for local timezone
function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Convert YYYY-MM-DD to a beautiful display date
function getFriendlyDateString(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
  const todayStr = getLocalDateString();
  
  // Calculate relative differences safely
  const todayParts = todayStr.split('-');
  const todayObj = new Date(todayParts[0], todayParts[1] - 1, todayParts[2]);
  
  const diffTime = dateObj.getTime() - todayObj.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays === 1) return 'Tomorrow';
  
  const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
  return dateObj.toLocaleDateString('en-US', options);
}

// Format date subtitle (e.g. "June 14, 2026")
function getSubtitleDateString(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
  const options = { month: 'long', day: 'numeric', year: 'numeric' };
  return dateObj.toLocaleDateString('en-US', options);
}

// Save tasks to local storage
function saveTasks() {
  localStorage.setItem('void_tasks', JSON.stringify(tasks));
}

// Load tasks from local storage
function loadTasks() {
  const stored = localStorage.getItem('void_tasks');
  if (stored) {
    try {
      tasks = JSON.parse(stored);
    } catch (e) {
      tasks = [];
    }
  } else {
    tasks = [];
  }
}

// Normalizes priorities for a specific date so they are sequential: 1, 2, 3...
function normalizePriorities(dateStr) {
  const dayTasks = tasks.filter(t => t.date === dateStr).sort((a, b) => a.priority - b.priority);
  dayTasks.forEach((task, index) => {
    task.priority = index + 1;
  });
  saveTasks();
}

// Clean up tasks older than 7 days
function cleanupOldTasks() {
  const now = Date.now();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const initialLength = tasks.length;
  
  tasks = tasks.filter(task => {
    const created = task.createdTime || now;
    return (now - created) < sevenDaysMs;
  });
  
  if (tasks.length < initialLength) {
    saveTasks();
    showToast(`Cleaned up ${initialLength - tasks.length} tasks older than 7 days.`);
  }
}

// Generate unique ID
function generateId() {
  return 'task_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
}

// ==========================================================================
// 3. TOAST NOTIFICATION SYSTEM
// ==========================================================================
function showToast(message, actionText = null, actionCallback = null) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  // Clear previous toast if existing
  container.innerHTML = '';
  if (deleteToastTimeout) {
    clearTimeout(deleteToastTimeout);
  }

  const toast = document.createElement('div');
  toast.className = 'toast';
  
  const msgEl = document.createElement('span');
  msgEl.className = 'toast-message';
  msgEl.textContent = message;
  toast.appendChild(msgEl);

  if (actionText && actionCallback) {
    const actionBtn = document.createElement('button');
    actionBtn.className = 'toast-action';
    actionBtn.textContent = actionText;
    actionBtn.addEventListener('click', () => {
      actionCallback();
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 200);
    });
    toast.appendChild(actionBtn);
  }

  container.appendChild(toast);

  // Auto remove after 5 seconds
  deleteToastTimeout = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 200);
  }, 5000);
}

// ==========================================================================
// 4. RENDERING VIEWS & DATA
// ==========================================================================

// Pre-populate SVG icons into standard HTML buttons/containers
function injectIcons() {
  document.getElementById('icon-prev').innerHTML = ICONS.prev;
  document.getElementById('icon-next').innerHTML = ICONS.next;
  document.getElementById('icon-calendar').innerHTML = ICONS.calendar;
  document.getElementById('icon-plus').innerHTML = ICONS.plus;
}

// Main Render Function
function render() {
  // 1. Sync header date displays
  document.getElementById('current-date-title').textContent = getFriendlyDateString(selectedDate);
  document.getElementById('current-date-subtitle').textContent = getSubtitleDateString(selectedDate);
  document.getElementById('date-picker-input').value = selectedDate;

  // Update tabs activation styling
  const todayBtn = document.getElementById('quick-today-btn');
  const archiveBtn = document.getElementById('quick-archive-btn');
  const tasksView = document.getElementById('tasks-view-container');
  const archiveView = document.getElementById('archive-view-container');

  if (activeView === 'tasks') {
    todayBtn.classList.add('active');
    archiveBtn.classList.remove('active');
    tasksView.classList.remove('hidden');
    archiveView.classList.add('hidden');
    
    // Render current active tasks and carry-over manager
    renderTaskList();
    renderCarryOverSection();
  } else {
    todayBtn.classList.remove('active');
    archiveBtn.classList.add('active');
    tasksView.classList.add('hidden');
    archiveView.classList.remove('hidden');
    
    // Render archive list
    renderArchiveList();
  }
}

// Render the carry-over notification panel
function renderCarryOverSection() {
  const section = document.getElementById('carry-over-section');
  const listContainer = document.getElementById('carry-over-list');
  const countBadge = document.getElementById('carry-over-count-badge');

  // Filter tasks before selectedDate that are undone (pending or partially-done) and carryState is 'none'
  const unresolvedTasks = tasks.filter(t => 
    t.date < selectedDate && 
    t.status !== 'done' && 
    t.carryState !== 'carried' &&
    t.carryState !== 'ignored'
  );

  if (unresolvedTasks.length === 0) {
    section.classList.add('hidden');
    return;
  }

  section.classList.remove('hidden');
  countBadge.textContent = `${unresolvedTasks.length} task${unresolvedTasks.length > 1 ? 's' : ''}`;
  listContainer.innerHTML = '';

  unresolvedTasks.forEach(task => {
    const item = document.createElement('div');
    item.className = 'carry-task-item';
    item.setAttribute('tabindex', '0');

    // Info panel
    const info = document.createElement('div');
    info.className = 'carry-task-info';
    
    const text = document.createElement('span');
    text.className = 'carry-task-text';
    text.textContent = task.text;
    info.appendChild(text);

    const meta = document.createElement('span');
    meta.className = 'carry-task-meta';
    meta.textContent = `${getFriendlyDateString(task.date)} • Priority #${task.priority} • ${task.status.replace('-', ' ')}`;
    info.appendChild(meta);

    item.appendChild(info);

    // Actions panel
    const actions = document.createElement('div');
    actions.className = 'carry-task-actions';

    // Carry Button
    const carryBtn = document.createElement('button');
    carryBtn.className = 'carry-action-btn';
    carryBtn.textContent = 'Carry to Today';
    carryBtn.addEventListener('click', () => handleCarryTask(task.id));
    actions.appendChild(carryBtn);

    // Ignore Button (Keep Undone)
    const ignoreBtn = document.createElement('button');
    ignoreBtn.className = 'carry-action-btn';
    ignoreBtn.textContent = 'Keep Undone';
    ignoreBtn.addEventListener('click', () => handleIgnoreCarry(task.id));
    actions.appendChild(ignoreBtn);

    // Delete Button
    const delBtn = document.createElement('button');
    delBtn.className = 'carry-action-btn btn-delete';
    delBtn.textContent = 'Delete';
    delBtn.addEventListener('click', () => handleDeleteCarry(task.id));
    actions.appendChild(delBtn);

    item.appendChild(actions);
    listContainer.appendChild(item);
  });
}

// Render active daily task list
function renderTaskList() {
  const container = document.getElementById('task-list');
  const emptyState = document.getElementById('tasks-empty-state');
  const summaryBadge = document.getElementById('task-count-summary');
  const nextPriorityBadge = document.getElementById('next-priority-number');

  // Filter tasks for selectedDate that are not completed (status is pending or partially-done)
  // Wait! The user says: "mark as done and partially done kr sake ... jo task complete ho gye hai vo archieve me save ho date wise"
  // This means active tasks show both 'pending' and 'partially-done' tasks, but NOT 'done' tasks (which go to archive).
  const dayTasks = tasks.filter(t => t.date === selectedDate && t.status !== 'done')
                        .sort((a, b) => a.priority - b.priority);

  // Set priority serial indicator for next input
  const nextIdx = dayTasks.length + 1;
  nextPriorityBadge.textContent = String(nextIdx).padStart(2, '0');

  if (dayTasks.length === 0) {
    container.innerHTML = '';
    container.appendChild(emptyState);
    emptyState.classList.remove('hidden');
    summaryBadge.textContent = '0 pending';
    return;
  }

  emptyState.classList.add('hidden');
  container.innerHTML = '';
  summaryBadge.textContent = `${dayTasks.length} pending`;

  dayTasks.forEach((task, index) => {
    const item = document.createElement('div');
    item.className = `task-item status-${task.status}`;
    item.setAttribute('draggable', 'true');
    item.setAttribute('data-id', task.id);
    item.setAttribute('data-index', index);

    // 1. Drag Handle
    const handle = document.createElement('div');
    handle.className = 'drag-handle';
    handle.innerHTML = ICONS.drag;
    item.appendChild(handle);

    // 2. Micro priority shift buttons (Up/Down)
    const microBox = document.createElement('div');
    microBox.className = 'priority-micro-triggers';
    
    const upBtn = document.createElement('button');
    upBtn.className = 'micro-trigger-btn';
    upBtn.innerHTML = ICONS.arrowUp;
    upBtn.title = 'Increase Priority';
    upBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      shiftPriority(task.id, -1);
    });
    
    const downBtn = document.createElement('button');
    downBtn.className = 'micro-trigger-btn';
    downBtn.innerHTML = ICONS.arrowDown;
    downBtn.title = 'Decrease Priority';
    downBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      shiftPriority(task.id, 1);
    });
    
    microBox.appendChild(upBtn);
    microBox.appendChild(downBtn);
    item.appendChild(microBox);

    // 3. Serial Number
    const serial = document.createElement('span');
    serial.className = 'task-serial';
    serial.textContent = String(index + 1).padStart(2, '0');
    item.appendChild(serial);

    // 4. Custom status checkbox (Cycles Pending -> Partially Done -> Done)
    const statusBtn = document.createElement('button');
    statusBtn.className = 'task-status-btn';
    
    if (task.status === 'pending') statusBtn.innerHTML = ICONS.statusPending;
    else if (task.status === 'partially-done') statusBtn.innerHTML = ICONS.statusPartial;
    else statusBtn.innerHTML = ICONS.statusDone;
    
    statusBtn.title = `Status: ${task.status.replace('-', ' ')}. Click to toggle.`;
    statusBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      cycleTaskStatus(task.id);
    });
    item.appendChild(statusBtn);

    // 5. Task text container
    const textContainer = document.createElement('div');
    textContainer.className = 'task-text-container';
    
    const textEl = document.createElement('span');
    textEl.className = 'task-text';
    textEl.textContent = task.text;
    
    // Double-click text to inline edit
    textEl.addEventListener('dblclick', () => startInlineEdit(task.id, textEl, textContainer));
    
    textContainer.appendChild(textEl);
    item.appendChild(textContainer);

    // 6. Action buttons (Edit & Delete)
    const actions = document.createElement('div');
    actions.className = 'task-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'action-icon-btn';
    editBtn.innerHTML = ICONS.edit;
    editBtn.title = 'Edit Task';
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      startInlineEdit(task.id, textEl, textContainer);
    });
    actions.appendChild(editBtn);

    const delBtn = document.createElement('button');
    delBtn.className = 'action-icon-btn btn-delete';
    delBtn.innerHTML = ICONS.delete;
    delBtn.title = 'Delete Task';
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteTask(task.id);
    });
    actions.appendChild(delBtn);

    item.appendChild(actions);

    // Add Drag & Drop Listeners
    setupDragAndDropEvents(item);

    container.appendChild(item);
  });
}

// Render the completed archive list
function renderArchiveList() {
  const container = document.getElementById('archive-accordion');
  const emptyState = document.getElementById('archive-empty-state');
  const summaryBadge = document.getElementById('archive-count-summary');

  // Filter for completed tasks (status === 'done')
  const completedTasks = tasks.filter(t => t.status === 'done');

  summaryBadge.textContent = `${completedTasks.length} completed`;

  if (completedTasks.length === 0) {
    container.innerHTML = '';
    container.appendChild(emptyState);
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  container.innerHTML = '';

  // Group completed tasks by date descending
  const groups = {};
  completedTasks.forEach(task => {
    if (!groups[task.date]) {
      groups[task.date] = [];
    }
    groups[task.date].push(task);
  });

  // Sort dates descending
  const sortedDates = Object.keys(groups).sort((a, b) => b.localeCompare(a));

  sortedDates.forEach((dateStr, grpIdx) => {
    const groupTasks = groups[dateStr];
    
    const card = document.createElement('div');
    card.className = `archive-group-card ${grpIdx === 0 ? 'expanded' : ''}`; // expand the first one by default

    // Header
    const header = document.createElement('div');
    header.className = 'archive-group-header';
    header.addEventListener('click', () => {
      card.classList.toggle('expanded');
    });

    const title = document.createElement('div');
    title.className = 'archive-group-title';
    title.innerHTML = `${getFriendlyDateString(dateStr)} <span class="archive-group-count">${groupTasks.length}</span>`;
    header.appendChild(title);

    const arrow = document.createElement('span');
    arrow.className = 'archive-arrow-icon';
    arrow.innerHTML = ICONS.chevronDown;
    header.appendChild(arrow);
    card.appendChild(header);

    // Content container
    const content = document.createElement('div');
    content.className = 'archive-group-content';

    groupTasks.forEach(task => {
      const item = document.createElement('div');
      item.className = 'archive-item';

      // Cycle Status Button (Un-archive)
      const statusBtn = document.createElement('button');
      statusBtn.className = 'task-status-btn';
      statusBtn.innerHTML = ICONS.statusDone;
      statusBtn.title = 'Mark as Pending (Restore)';
      statusBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        cycleTaskStatus(task.id);
      });
      item.appendChild(statusBtn);

      const text = document.createElement('span');
      text.className = 'archive-item-text';
      text.textContent = task.text;
      item.appendChild(text);

      const timeSpan = document.createElement('span');
      timeSpan.className = 'archive-item-time';
      // Format dynamic display of completion time if available
      const timeVal = task.completedTime || task.createdTime;
      const formattedTime = new Date(timeVal).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      timeSpan.textContent = formattedTime;
      item.appendChild(timeSpan);

      content.appendChild(item);
    });

    card.appendChild(content);
    container.appendChild(card);
  });
}

// ==========================================================================
// 5. TASK MUTATION HANDLERS & OPERATIONS
// ==========================================================================

// Add task
function addTask(text) {
  const cleanText = text.trim();
  if (!cleanText) return;

  const dayTasks = tasks.filter(t => t.date === selectedDate && t.status !== 'done');
  const nextPriority = dayTasks.length + 1;

  const newTask = {
    id: generateId(),
    text: cleanText,
    date: selectedDate,
    priority: nextPriority,
    status: 'pending',
    createdTime: Date.now(),
    carryState: 'none'
  };

  tasks.push(newTask);
  saveTasks();
  normalizePriorities(selectedDate);
  render();
  showToast('Task added successfully.');
}

// Cycles task status: pending -> partially-done -> done -> pending
function cycleTaskStatus(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  const oldStatus = task.status;
  let newStatus = 'pending';

  if (oldStatus === 'pending') {
    newStatus = 'partially-done';
  } else if (oldStatus === 'partially-done') {
    newStatus = 'done';
    task.completedTime = Date.now();
  }

  task.status = newStatus;
  saveTasks();
  normalizePriorities(task.date);
  render();

  if (newStatus === 'done') {
    showToast('Task completed and archived.', 'Undo', () => {
      task.status = oldStatus;
      delete task.completedTime;
      saveTasks();
      normalizePriorities(task.date);
      render();
    });
  } else if (oldStatus === 'done' && newStatus === 'pending') {
    showToast('Task restored to active list.');
  }
}

// Delete task with Undo option
function deleteTask(id) {
  const index = tasks.findIndex(t => t.id === id);
  if (index === -1) return;

  const deleted = tasks[index];
  recentlyDeletedTask = { ...deleted };

  tasks.splice(index, 1);
  saveTasks();
  normalizePriorities(deleted.date);
  render();

  showToast(`Deleted task: "${deleted.text.substring(0, 20)}${deleted.text.length > 20 ? '...' : ''}"`, 'Undo', () => {
    if (recentlyDeletedTask) {
      tasks.push(recentlyDeletedTask);
      saveTasks();
      normalizePriorities(recentlyDeletedTask.date);
      recentlyDeletedTask = null;
      render();
      showToast('Task restored.');
    }
  });
}

// Shift priority manually via arrows
function shiftPriority(id, offset) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  const dayTasks = tasks.filter(t => t.date === task.date && t.status !== 'done')
                        .sort((a, b) => a.priority - b.priority);
  
  const currentIdx = dayTasks.findIndex(t => t.id === id);
  const targetIdx = currentIdx + offset;

  if (targetIdx < 0 || targetIdx >= dayTasks.length) return;

  // Swap priorities
  const targetTask = dayTasks[targetIdx];
  const temp = task.priority;
  task.priority = targetTask.priority;
  targetTask.priority = temp;

  saveTasks();
  render();
}

// Inline edit handler
function startInlineEdit(id, textEl, container) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  const currentText = task.text;
  container.innerHTML = '';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'task-edit-input';
  input.value = currentText;
  input.maxLength = 120;
  container.appendChild(input);
  input.focus();

  // Save changes helper
  const saveChange = () => {
    const updatedVal = input.value.trim();
    if (updatedVal && updatedVal !== currentText) {
      task.text = updatedVal;
      saveTasks();
      showToast('Task edited.');
    }
    render();
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      saveChange();
    } else if (e.key === 'Escape') {
      render();
    }
  });

  input.addEventListener('blur', saveChange);
}

// ==========================================================================
// 6. CARRY-OVER MANAGER ACTIONS
// ==========================================================================

// Carry task to current day
function handleCarryTask(id) {
  const oldTask = tasks.find(t => t.id === id);
  if (!oldTask) return;

  // Mark old task as carried
  oldTask.carryState = 'carried';

  // Create new task on selectedDate
  const dayTasks = tasks.filter(t => t.date === selectedDate && t.status !== 'done');
  const nextPriority = dayTasks.length + 1;

  const newTask = {
    id: generateId(),
    text: oldTask.text,
    date: selectedDate,
    priority: nextPriority,
    status: oldTask.status, // Preserve 'partially-done' status if appropriate
    createdTime: Date.now(),
    carryState: 'none',
    carriedFromDate: oldTask.date
  };

  tasks.push(newTask);
  saveTasks();
  normalizePriorities(oldTask.date);
  normalizePriorities(selectedDate);
  render();

  showToast('Task carried over to today.');
}

// Keep Undone (Mark carryState as ignored so it remains on original date as undone)
function handleIgnoreCarry(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  task.carryState = 'ignored';
  saveTasks();
  render();
  showToast('Marked as undone on previous day.');
}

// Delete old carry task
function handleDeleteCarry(id) {
  const index = tasks.findIndex(t => t.id === id);
  if (index === -1) return;

  const deleted = tasks[index];
  tasks.splice(index, 1);
  saveTasks();
  normalizePriorities(deleted.date);
  render();
  showToast('Previous task deleted.');
}

// ==========================================================================
// 7. DRAG AND DROP CONTROLLER (Vanilla HTML5)
// ==========================================================================
let draggedId = null;

function setupDragAndDropEvents(element) {
  element.addEventListener('dragstart', (e) => {
    draggedId = element.getAttribute('data-id');
    element.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });

  element.addEventListener('dragend', () => {
    element.classList.remove('dragging');
    document.querySelectorAll('.task-item').forEach(el => {
      el.classList.remove('drag-over-indicator', 'drag-over-indicator-top', 'drag-over-indicator-bottom');
    });
    draggedId = null;
  });

  element.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    const activeDragging = document.querySelector('.task-item.dragging');
    if (!activeDragging || element === activeDragging) return;

    // Determine target location (above or below card)
    const rect = element.getBoundingClientRect();
    const midPoint = rect.top + rect.height / 2;
    
    if (e.clientY < midPoint) {
      element.classList.add('drag-over-indicator-top');
      element.classList.remove('drag-over-indicator-bottom');
    } else {
      element.classList.add('drag-over-indicator-bottom');
      element.classList.remove('drag-over-indicator-top');
    }
  });

  element.addEventListener('dragleave', () => {
    element.classList.remove('drag-over-indicator-top', 'drag-over-indicator-bottom');
  });

  element.addEventListener('drop', (e) => {
    e.preventDefault();
    element.classList.remove('drag-over-indicator-top', 'drag-over-indicator-bottom');

    if (!draggedId || draggedId === element.getAttribute('data-id')) return;

    const draggedTask = tasks.find(t => t.id === draggedId);
    if (!draggedTask) return;

    const dayTasks = tasks.filter(t => t.date === selectedDate && t.status !== 'done')
                          .sort((a, b) => a.priority - b.priority);

    const draggedIndex = dayTasks.findIndex(t => t.id === draggedId);
    const dropIndex = dayTasks.findIndex(t => t.id === element.getAttribute('data-id'));

    if (draggedIndex === -1 || dropIndex === -1) return;

    // Check if drop is on the bottom half of the target element
    const rect = element.getBoundingClientRect();
    const midPoint = rect.top + rect.height / 2;
    const isAfter = e.clientY > midPoint;

    // Remove dragged item
    dayTasks.splice(draggedIndex, 1);

    // Calculate final insertion index
    let targetIndex = dayTasks.findIndex(t => t.id === element.getAttribute('data-id'));
    if (isAfter) {
      targetIndex += 1;
    }

    // Insert dragged item
    dayTasks.splice(targetIndex, 0, draggedTask);

    // Recalculate priorities: 1 to N
    dayTasks.forEach((task, index) => {
      task.priority = index + 1;
    });

    saveTasks();
    render();
  });
}

// ==========================================================================
// 8. EVENT REGISTRATION & MAIN BOOTSTRAP
// ==========================================================================
function bootstrap() {
  // Set selected date to today initially
  selectedDate = getLocalDateString();
  
  // Load tasks & run 7-day clean
  loadTasks();
  cleanupOldTasks();
  
  // Inject visual icons
  injectIcons();

  // A. Navigation Event Listeners
  document.getElementById('prev-day-btn').addEventListener('click', () => {
    const parts = selectedDate.split('-');
    const current = new Date(parts[0], parts[1] - 1, parts[2]);
    current.setDate(current.getDate() - 1);
    selectedDate = getLocalDateString(current);
    render();
  });

  document.getElementById('next-day-btn').addEventListener('click', () => {
    const parts = selectedDate.split('-');
    const current = new Date(parts[0], parts[1] - 1, parts[2]);
    current.setDate(current.getDate() + 1);
    selectedDate = getLocalDateString(current);
    render();
  });

  // Calendar Trigger
  const dateInput = document.getElementById('date-picker-input');
  document.getElementById('calendar-trigger-btn').addEventListener('click', () => {
    dateInput.showPicker(); // modern browser API to trigger browser calendar picker
  });

  dateInput.addEventListener('change', (e) => {
    if (e.target.value) {
      selectedDate = e.target.value;
      render();
    }
  });

  // B. Tab Nav Pills Event Listeners
  document.getElementById('quick-today-btn').addEventListener('click', () => {
    activeView = 'tasks';
    selectedDate = getLocalDateString(); // Always reset to today's date when clicking Today pill
    render();
  });

  document.getElementById('quick-archive-btn').addEventListener('click', () => {
    activeView = 'archive';
    render();
  });

  // C. Add Task Form Submit
  const addForm = document.getElementById('add-task-form');
  const taskInput = document.getElementById('task-input');
  
  addForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = taskInput.value;
    if (text.trim()) {
      addTask(text);
      taskInput.value = '';
    }
  });

  // Render initial view
  render();
}

// Bypasses browser DOMContentLoaded race condition when running in modern module script bundlers
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
