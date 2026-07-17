// ---------- Almacenamiento ----------
const STORAGE_KEY = "fichero.data.v1";

const DEFAULT_CATEGORIES = ["General", "Lectura", "Herramientas"];

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn("No se pudo leer el almacenamiento local", e);
  }
  return { categories: [...DEFAULT_CATEGORIES], links: [] };
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadData();
let activeCategory = "__all__";
let editingLinkId = null;

// ---------- Utilidades ----------
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function getDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function faviconUrl(url) {
  const domain = getDomain(url);
  return `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(domain)}`;
}

function previewImageUrl(url) {
  return `https://api.microlink.io/?url=${encodeURIComponent(url)}&screenshot=true&meta=false&embed=screenshot.url`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

// ---------- Referencias DOM ----------
const categoryList = document.getElementById("categoryList");
const cardGrid = document.getElementById("cardGrid");
const emptyState = document.getElementById("emptyState");
const activeCategoryTitle = document.getElementById("activeCategoryTitle");
const countBadge = document.getElementById("countBadge");
const searchInput = document.getElementById("searchInput");

const linkModal = document.getElementById("linkModal");
const linkForm = document.getElementById("linkForm");
const modalTitle = document.getElementById("modalTitle");
const fieldUrl = document.getElementById("fieldUrl");
const fieldTitle = document.getElementById("fieldTitle");
const fieldCategory = document.getElementById("fieldCategory");
const fieldDescription = document.getElementById("fieldDescription");
const fieldImage = document.getElementById("fieldImage");
const deleteLinkBtn = document.getElementById("deleteLinkBtn");

const categoryModal = document.getElementById("categoryModal");
const categoryForm = document.getElementById("categoryForm");
const fieldCategoryName = document.getElementById("fieldCategoryName");

// ---------- Render: categorías ----------
function renderCategories() {
  categoryList.innerHTML = "";

  const allItem = makeCategoryItem("__all__", "Todos", state.links.length, false);
  categoryList.appendChild(allItem);

  state.categories.forEach((cat) => {
    const count = state.links.filter((l) => l.category === cat).length;
    categoryList.appendChild(makeCategoryItem(cat, cat, count, true));
  });

  // poblar select del formulario
  fieldCategory.innerHTML = state.categories
    .map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`)
    .join("");
}

function makeCategoryItem(key, label, count, deletable) {
  const li = document.createElement("li");
  const btn = document.createElement("button");
  btn.className = "cat-item" + (key === activeCategory ? " active" : "");
  btn.type = "button";
  btn.style.width = "100%";
  btn.style.border = "1px solid transparent";
  btn.innerHTML = `<span>${escapeHtml(label)}</span><span class="cat-count">${count}</span>`;
  btn.addEventListener("click", () => {
    activeCategory = key;
    renderAll();
  });

  if (deletable) {
    const del = document.createElement("button");
    del.className = "cat-del";
    del.type = "button";
    del.title = "Eliminar categoría";
    del.textContent = "✕";
    del.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteCategory(key);
    });
    btn.appendChild(del);
  }

  li.appendChild(btn);
  return li;
}

function deleteCategory(cat) {
  const count = state.links.filter((l) => l.category === cat).length;
  const msg = count > 0
    ? `"${cat}" tiene ${count} enlace(s). Se moverán a "General". ¿Eliminar la categoría?`
    : `¿Eliminar la categoría "${cat}"?`;
  if (!confirm(msg)) return;

  if (!state.categories.includes("General")) {
    state.categories.unshift("General");
  }
  state.links.forEach((l) => {
    if (l.category === cat) l.category = "General";
  });
  state.categories = state.categories.filter((c) => c !== cat);
  if (activeCategory === cat) activeCategory = "__all__";
  saveData();
  renderAll();
}

// ---------- Render: tarjetas ----------
function getFilteredLinks() {
  const q = searchInput.value.trim().toLowerCase();
  return state.links
    .filter((l) => activeCategory === "__all__" || l.category === activeCategory)
    .filter((l) => {
      if (!q) return true;
      const haystack = `${l.title} ${l.description} ${getDomain(l.url)}`.toLowerCase();
      return haystack.includes(q);
    })
    .sort((a, b) => b.createdAt - a.createdAt);
}

function renderCards() {
  const links = getFilteredLinks();

  activeCategoryTitle.textContent = activeCategory === "__all__" ? "Todos los enlaces" : activeCategory;
  countBadge.textContent = links.length;

  cardGrid.innerHTML = "";
  emptyState.hidden = links.length !== 0;

  links.forEach((link) => {
    cardGrid.appendChild(buildCard(link));
  });
}

function buildCard(link) {
  const card = document.createElement("article");
  card.className = "card";

  const imgWrap = document.createElement("div");
  imgWrap.className = "card-img-wrap";
  const img = document.createElement("img");
  img.loading = "lazy";
  img.alt = "";
  img.src = link.image || previewImageUrl(link.url);
  img.addEventListener("error", () => {
    img.src = faviconUrl(link.url);
    img.style.objectFit = "contain";
    img.style.padding = "24%";
    img.style.background = "#fff";
  });
  imgWrap.appendChild(img);

  const body = document.createElement("div");
  body.className = "card-body";
  body.innerHTML = `
    <div class="card-top">
      <img class="card-favicon" src="${faviconUrl(link.url)}" alt="" loading="lazy">
      <span class="card-domain">${escapeHtml(getDomain(link.url))}</span>
    </div>
    <a class="card-title" href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.title)}</a>
    ${link.description ? `<p class="card-desc">${escapeHtml(link.description)}</p>` : ""}
    <div class="card-footer">
      <span class="cat-pill">${escapeHtml(link.category)}</span>
      <div class="card-actions">
        <button type="button" data-action="edit" title="Editar">✎</button>
        <button type="button" data-action="delete" title="Eliminar">🗑</button>
      </div>
    </div>
  `;

  body.querySelector('[data-action="edit"]').addEventListener("click", () => openEditModal(link.id));
  body.querySelector('[data-action="delete"]').addEventListener("click", () => deleteLink(link.id));

  card.appendChild(imgWrap);
  card.appendChild(body);
  return card;
}

function deleteLink(id) {
  if (!confirm("¿Eliminar este enlace?")) return;
  state.links = state.links.filter((l) => l.id !== id);
  saveData();
  renderAll();
}

function renderAll() {
  renderCategories();
  renderCards();
}

// ---------- Modal: enlace ----------
function openAddModal() {
  editingLinkId = null;
  modalTitle.textContent = "Nuevo enlace";
  linkForm.reset();
  deleteLinkBtn.hidden = true;
  if (activeCategory !== "__all__") {
    fieldCategory.value = activeCategory;
  }
  linkModal.hidden = false;
  fieldUrl.focus();
}

function openEditModal(id) {
  const link = state.links.find((l) => l.id === id);
  if (!link) return;
  editingLinkId = id;
  modalTitle.textContent = "Editar enlace";
  fieldUrl.value = link.url;
  fieldTitle.value = link.title;
  fieldCategory.value = link.category;
  fieldDescription.value = link.description || "";
  fieldImage.value = link.image || "";
  deleteLinkBtn.hidden = false;
  linkModal.hidden = false;
  fieldUrl.focus();
}

function closeLinkModal() {
  linkModal.hidden = true;
  editingLinkId = null;
}

linkForm.addEventListener("submit", (e) => {
  e.preventDefault();
  let url = fieldUrl.value.trim();
  if (url && !/^https?:\/\//i.test(url)) url = "https://" + url;

  const payload = {
    url,
    title: fieldTitle.value.trim(),
    category: fieldCategory.value || state.categories[0] || "General",
    description: fieldDescription.value.trim(),
    image: fieldImage.value.trim(),
  };

  if (editingLinkId) {
    const link = state.links.find((l) => l.id === editingLinkId);
    Object.assign(link, payload);
  } else {
    state.links.push({ id: uid(), createdAt: Date.now(), ...payload });
  }

  saveData();
  closeLinkModal();
  renderAll();
});

deleteLinkBtn.addEventListener("click", () => {
  if (editingLinkId) deleteLink(editingLinkId);
  closeLinkModal();
});

document.getElementById("openAddBtn").addEventListener("click", openAddModal);
document.getElementById("closeModalBtn").addEventListener("click", closeLinkModal);
document.getElementById("cancelModalBtn").addEventListener("click", closeLinkModal);
linkModal.addEventListener("click", (e) => {
  if (e.target === linkModal) closeLinkModal();
});

// ---------- Modal: categoría ----------
function openCategoryModal() {
  categoryForm.reset();
  categoryModal.hidden = false;
  fieldCategoryName.focus();
}
function closeCategoryModal() {
  categoryModal.hidden = true;
}

categoryForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = fieldCategoryName.value.trim();
  if (!name) return;
  if (!state.categories.includes(name)) {
    state.categories.push(name);
    saveData();
  }
  closeCategoryModal();
  renderAll();
  // si veníamos del formulario de enlace, seleccionamos la nueva categoría
  if (!linkModal.hidden) fieldCategory.value = name;
});

document.getElementById("addCategoryBtn").addEventListener("click", openCategoryModal);
document.getElementById("newCatFromModal").addEventListener("click", openCategoryModal);
document.getElementById("closeCatModalBtn").addEventListener("click", closeCategoryModal);
document.getElementById("cancelCatModalBtn").addEventListener("click", closeCategoryModal);
categoryModal.addEventListener("click", (e) => {
  if (e.target === categoryModal) closeCategoryModal();
});

// Cerrar modales con Escape
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (!linkModal.hidden) closeLinkModal();
    if (!categoryModal.hidden) closeCategoryModal();
  }
});

searchInput.addEventListener("input", renderCards);

// ---------- Service worker (PWA) ----------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  });
}

// ---------- Inicio ----------
renderAll();
