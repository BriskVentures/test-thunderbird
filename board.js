// board.js
const API_LIMIT = 20;
let API_SKIP = 0;
const API_URL = `https://dummyjson.com/todos?limit=${API_LIMIT}&skip=${API_SKIP}`;

async function fetchTasks() {
  const response = await fetch(API_URL);
  const data = await response.json();
  return data.todos;
}

function addClickHandlerToCard(card) {
  card.addEventListener("click", (e) => {
    // Prevent click from interfering with drag operations
    if (!card.dragging) {
      browser.runtime.sendMessage({
        action: "openUrl",
        url: "https://briskventures.us",
      });
    }
  });

  // Add these handlers to manage drag vs click
  card.addEventListener("dragstart", () => {
    card.dragging = true;
  });

  card.addEventListener("dragend", () => {
    setTimeout(() => {
      card.dragging = false;
    }, 100);
  });
}

function createCard(task) {
  const card = document.createElement("div");
  card.classList.add("card");
  card.draggable = true;
  card.textContent = task.todo;
  card.dataset.id = task.id;

  card.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("text/plain", task.id);
  });

  addClickHandlerToCard(card);

  return card;
}

function initializeBoard() {
  const columns = document.querySelectorAll(".column");

  columns.forEach((column) => {
    column.addEventListener("dragover", (e) => {
      e.preventDefault();
    });

    column.addEventListener("drop", (e) => {
      e.preventDefault();
      const cardId = e.dataTransfer.getData("text");
      const card = document.querySelector(`[data-id="${cardId}"]`);
      column.querySelector(".cards-container").appendChild(card);
      saveBoardState();
    });
  });
}

async function loadTasks() {
  const { boardState, allTasks } = await browser.storage.local.get([
    "boardState",
    "allTasks",
  ]);

  if (boardState && allTasks && Object.keys(allTasks).length > 0) {
    restoreBoardState(boardState, allTasks);
  } else {
    const tasks = await fetchTasks();
    const todoColumn = document.querySelector("#todo .cards-container");

    tasks.forEach((task) => {
      const card = createCard(task);
      todoColumn.appendChild(card);
    });

    saveBoardState();
  }
}

async function saveBoardState() {
  const columns = document.querySelectorAll(".column");
  const boardState = {};
  const allTasks = {};

  columns.forEach((column) => {
    const columnId = column.id;
    const cards = Array.from(column.querySelectorAll(".card"));
    boardState[columnId] = cards.map((card) => card.dataset.id);

    cards.forEach((card) => {
      allTasks[card.dataset.id] = {
        id: card.dataset.id,
        todo: card.textContent,
      };
    });
  });

  await browser.storage.local.set({ boardState, allTasks });
}

async function restoreBoardState(boardState, allTasks) {
  Object.entries(boardState).forEach(([columnId, cardIds]) => {
    const column = document.querySelector(`#${columnId} .cards-container`);
    cardIds.forEach((cardId) => {
      const taskData = allTasks[cardId] || {
        id: cardId,
        todo: `Task ${cardId}`,
      };
      const card = createCard(taskData);
      column.appendChild(card);
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initializeBoard();
  loadTasks();
});
