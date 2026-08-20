const ELEMENTS = ["Earth", "Aether", "Order", "Fire", "Entropy", "Water"];
const recipe = new Map();

const items = Object.values(MH_DATA).filter((x) => x && x.Name && x.Elements);
const superstitious = SUPERSTITIOUS_ITEMS.filter(
  (x) => x && x.Name && x.Elements,
);
const byId = new Map(items.map((x) => [String(x.Id), x]));
const catalystById = new Map(
  superstitious.map((x) => [String(x.CatalystId), x]),
);

let selectedSuperstitious = null;

const superstitiousGrid = document.getElementById("superstitiousGrid");
const itemGrid = document.getElementById("itemGrid");
const recipeEl = document.getElementById("recipe");
const recipeTargetEl = document.getElementById("recipeTarget");
const elementsEl = document.getElementById("elements");
const itemCount = document.getElementById("itemCount");
const catalogCount = document.getElementById("catalogCount");
const targetPicker = document.getElementById("targetPicker");

/* ============================================================
   IMAGE SYSTEM
   ============================================================ */

function cleanAssetId(assetId) {
  const value = String(assetId ?? '').trim();

  // If this is already an image URL, leave it alone.
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }

  return value.replace(/^rbxassetid:\/\//i, '');
}


/*
 * Placeholder shown before Roblox returns the real image URL.
 */
const IMAGE_PLACEHOLDER =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="420" height="420">
      <rect width="100%" height="100%" fill="#0d0f12"/>
    </svg>
  `);

/*
 * Cache:
 *
 * Asset ID -> actual Roblox CDN image URL
 */
const imageCache = new Map();

/*
 * Asset IDs currently being requested.
 *
 * This prevents the same asset from being requested multiple
 * times at once.
 */
const imageLoading = new Set();

/*
 * Create an image element.
 *
 * IMPORTANT:
 * This does NOT make an API request.
 */
function imageTag(assetId, className = '') {
  const value = cleanAssetId(assetId);

  let imageUrl = value;

  // If it's an asset ID, look up the cached Roblox image.
  if (!value.startsWith('http://') && !value.startsWith('https://')) {
    imageUrl = MH_IMAGES[value] || '';
  }

  return `<img
    class="${escapeAttr(className)}"
    src="${escapeAttr(imageUrl)}"
    alt=""
    loading="lazy"
  >`;
}

/*
 * Ask Roblox for the actual image URLs for the supplied
 * asset IDs.
 */
async function loadRobloxImages(assetIds) {
  const ids = [...new Set(assetIds.map(cleanAssetId).filter(Boolean))];

  if (!ids.length) return;

  // Roblox limits how many IDs can be requested at once.
  // 20 is safely below the limit.
  const BATCH_SIZE = 20;

  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batch = ids.slice(i, i + BATCH_SIZE);

    const idsToLoad = batch.filter(
      (id) => !imageCache.has(id) && !imageLoading.has(id),
    );

    if (!idsToLoad.length) continue;

    idsToLoad.forEach((id) => imageLoading.add(id));

    try {
      const url =
        "https://thumbnails.roblox.com/v1/assets" +
        "?assetIds=" +
        idsToLoad.join(",") +
        "&size=420x420" +
        "&format=png" +
        "&isCircular=false";

      console.log(
        `Loading image batch ${Math.floor(i / BATCH_SIZE) + 1}:`,
        idsToLoad,
      );

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();

      if (!result || !Array.isArray(result.data)) {
        throw new Error("Roblox returned an invalid response");
      }

      for (const entry of result.data) {
        const id = cleanAssetId(entry.targetId);

        if (id && entry.imageUrl) {
          imageCache.set(id, entry.imageUrl);
        }
      }
    } catch (error) {
      console.error("Failed to load image batch:", error);
    } finally {
      idsToLoad.forEach((id) => imageLoading.delete(id));
    }

    // Update images after each batch.
    updateImageElements();

    // Small delay between requests.
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  // Final update.
  updateImageElements();
}

/*
 * Find all rendered images and replace their placeholder
 * with the actual Roblox CDN URL.
 */
function updateImageElements() {
  const imageElements = document.querySelectorAll("[data-asset-id]");

  for (const image of imageElements) {
    const id = cleanAssetId(image.dataset.assetId);

    const imageUrl = imageCache.get(id);

    if (!imageUrl) continue;

    if (image.src !== imageUrl) {
      image.src = imageUrl;
    }
  }
}

/*
 * Look at the images currently on the page and load any
 * that haven't been retrieved yet.
 */
function loadCurrentImages() {
  const imageElements = document.querySelectorAll("[data-asset-id]");

  const assetIds = [
    ...new Set(
      [...imageElements]
        .map((image) => cleanAssetId(image.dataset.assetId))
        .filter(Boolean),
    ),
  ];

  if (!assetIds.length) return;

  loadRobloxImages(assetIds);
}

/* ============================================================
   RECIPE
   ============================================================ */

function selectSuperstitious(item) {
  selectedSuperstitious = item;
  recipe.clear();

  render();

  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
}

function addNormalItem(item) {
  if (!selectedSuperstitious) return;

  const id = String(item.Id);

  recipe.set(id, (recipe.get(id) || 0) + 1);

  render();
}

function changeQty(id, amount) {
  id = String(id);

  const next = (recipe.get(id) || 0) + amount;

  if (next <= 0) {
    recipe.delete(id);
  } else {
    recipe.set(id, next);
  }

  render();
}

function removeItem(id) {
  recipe.delete(String(id));

  render();
}

function removeTarget() {
  selectedSuperstitious = null;
  recipe.clear();

  render();

  targetPicker.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

/* ============================================================
   ELEMENT CALCULATIONS
   ============================================================ */

function calculateCurrentTotals() {
  const totals = Object.fromEntries(ELEMENTS.map((e) => [e, 0]));

  for (const [id, qty] of recipe) {
    const item = byId.get(id);

    if (!item) continue;

    for (const element of ELEMENTS) {
      totals[element] += (Number(item.Elements[element]) || 0) * qty;
    }
  }

  return totals;
}

function calculateRequiredTotals() {
  if (!selectedSuperstitious) {
    return Object.fromEntries(ELEMENTS.map((e) => [e, 0]));
  }

  return Object.fromEntries(
    ELEMENTS.map((e) => [e, Number(selectedSuperstitious.Elements[e]) || 0]),
  );
}

function formatNumber(n) {
  return Number.isInteger(n)
    ? n.toLocaleString()
    : n.toLocaleString(undefined, {
        maximumFractionDigits: 2,
      });
}

/* ============================================================
   HTML SAFETY
   ============================================================ */

function escapeHtml(v) {
  return String(v).replace(
    /[&<>'"]/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[c],
  );
}

function escapeAttr(v) {
  return escapeHtml(v);
}

/* ============================================================
   CARDS
   ============================================================ */

function superstitiousCard(item) {
  const selected =
    selectedSuperstitious &&
    String(selectedSuperstitious.Id) === String(item.Id);

  return `<button
    class="item-card ${selected ? "selected" : ""}"
    data-super-id="${escapeAttr(item.Id)}"
  >
    ${imageTag(item.Image, "card-image")}

    <div class="card-name">
      ${escapeHtml(item.Name)}
    </div>

    <div class="card-meta">
      Catalyst ${escapeHtml(item.CatalystId)}
    </div>
  </button>`;
}

function normalCard(item) {
  const qty = recipe.get(String(item.Id)) || 0;

  return `<button
    class="item-card ${qty ? "in-recipe" : ""}"
    data-item-id="${escapeAttr(item.Id)}"
    ${selectedSuperstitious ? "" : "disabled"}
  >
    ${imageTag(item.Image, "card-image")}

    <div class="card-name">
      ${escapeHtml(item.Name)}
    </div>

    <div class="card-meta">
      ${qty ? `In recipe: ${qty}` : `ID ${escapeHtml(item.Id)}`}
    </div>
  </button>`;
}

/* ============================================================
   GRIDS
   ============================================================ */

function renderSuperstitiousGrid() {
  superstitiousGrid.innerHTML = superstitious.map(superstitiousCard).join("");
}

function renderItemGrid() {
  const sorted = [...items].sort((a, b) => a.Name.localeCompare(b.Name));

  catalogCount.textContent = `${sorted.length} items`;

  itemGrid.innerHTML = sorted.map(normalCard).join("");
}

/* ============================================================
   TARGET
   ============================================================ */

function renderTarget() {
  if (!selectedSuperstitious) {
    recipeTargetEl.classList.add("hidden");
    recipeTargetEl.innerHTML = "";

    return;
  }

  recipeTargetEl.classList.remove("hidden");

  recipeTargetEl.innerHTML = `
    <div class="target-card">

      <div class="target-label">
        RECIPE TARGET
      </div>

      <div class="target-main">

        ${imageTag(selectedSuperstitious.Image, "target-image")}

        <div class="target-info">

          <div class="target-name">
            ${escapeHtml(selectedSuperstitious.Name)}
          </div>

          <div class="target-catalyst">
            Catalyst ID
            ${escapeHtml(selectedSuperstitious.CatalystId)}
          </div>

        </div>

        <button
          id="removeTargetBtn"
          class="remove target-remove"
        >
          Remove
        </button>

      </div>

    </div>`;
}

/* ============================================================
   RECIPE
   ============================================================ */

function renderRecipe() {
  const totalCount = [...recipe.values()].reduce((a, b) => a + b, 0);

  itemCount.textContent = `${totalCount} item${totalCount === 1 ? "" : "s"}`;

  if (!selectedSuperstitious) {
    recipeEl.className = "recipe empty";

    recipeEl.innerHTML =
      '<div class="empty-state">' +
      "Select a Superstitious Item above to begin." +
      "</div>";

    return;
  }

  if (!recipe.size) {
    recipeEl.className = "recipe empty";

    recipeEl.innerHTML =
      '<div class="empty-state">' +
      "Your recipe is empty. Click items below to add them." +
      "</div>";

    return;
  }

  recipeEl.className = "recipe";

  recipeEl.innerHTML = [...recipe.entries()]
    .map(([id, qty]) => {
      const item = byId.get(id);

      if (!item) return "";

      return `<div class="recipe-item">

          ${imageTag(item.Image)}

          <div class="recipe-info">

            <div class="name">
              ${escapeHtml(item.Name)}
            </div>

            <div class="meta">
              ID ${escapeHtml(item.Id)}
            </div>

          </div>

          <div class="qty">

            <button
              data-action="minus"
              data-id="${escapeAttr(id)}"
            >
              −
            </button>

            <span>
              ${qty}
            </span>

            <button
              data-action="plus"
              data-id="${escapeAttr(id)}"
            >
              +
            </button>

          </div>

          <button
            class="remove"
            data-action="remove"
            data-id="${escapeAttr(id)}"
          >
            Remove
          </button>

        </div>`;
    })
    .join("");
}

/* ============================================================
   ELEMENT BARS
   ============================================================ */

function renderElements() {
  const current = calculateCurrentTotals();

  const required = calculateRequiredTotals();

  elementsEl.innerHTML = ELEMENTS.map((element) => {
    const value = current[element];

    const target = required[element];

    const ratio =
      target === 0
        ? value === 0
          ? 1
          : 0
        : Math.max(0, Math.min(1, value / target));

    const complete = target === 0 ? value === 0 : value >= target;

    const over = target !== 0 && value > target;

    const statusClass = complete ? "complete" : "incomplete";

    return `<div class="element ${statusClass}">

        <div class="element-head">

          <span class="element-name">
            ${element}
          </span>

          <span class="element-values">

            <b>
              ${formatNumber(value)}
            </b>

            <span>/</span>

            <strong>
              ${formatNumber(target)}
            </strong>

          </span>

        </div>

        <div class="bar">

          <div
            class="fill"
            style="width:${ratio * 100}%"
          ></div>

        </div>

        <div class="bar-caption">

          <span>
            Current
          </span>

          <span>
            Required${over ? " • over" : ""}
          </span>

        </div>

      </div>`;
  }).join("");
}

/* ============================================================
   RENDER
   ============================================================ */

function render() {
  renderSuperstitiousGrid();
  renderTarget();
  renderRecipe();
  renderItemGrid();
  renderElements();

  /*
   * The HTML has now been rendered.
   *
   * Start loading any images currently displayed.
   */
  loadCurrentImages();
}

/* ============================================================
   EVENT HANDLERS
   ============================================================ */

superstitiousGrid.addEventListener("click", (e) => {
  const card = e.target.closest("[data-super-id]");

  if (!card) return;

  const item = superstitious.find(
    (x) => String(x.Id) === String(card.dataset.superId),
  );

  if (item) {
    selectSuperstitious(item);
  }
});

itemGrid.addEventListener("click", (e) => {
  const card = e.target.closest("[data-item-id]");

  if (!card || !selectedSuperstitious) {
    return;
  }

  const item = byId.get(String(card.dataset.itemId));

  if (item) {
    addNormalItem(item);
  }
});

recipeEl.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");

  if (!btn) return;

  const id = btn.dataset.id;

  if (btn.dataset.action === "plus") {
    changeQty(id, 1);
  }

  if (btn.dataset.action === "minus") {
    changeQty(id, -1);
  }

  if (btn.dataset.action === "remove") {
    removeItem(id);
  }
});

recipeTargetEl.addEventListener("click", (e) => {
  if (e.target.closest("#removeTargetBtn")) {
    removeTarget();
  }
});

document.getElementById("clearBtn").addEventListener("click", () => {
  selectedSuperstitious = null;
  recipe.clear();

  render();
});

/* ============================================================
   INITIAL RENDER
   ============================================================ */

render();
