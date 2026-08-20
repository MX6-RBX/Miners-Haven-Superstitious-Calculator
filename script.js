const ELEMENTS = ["Earth", "Aether", "Order", "Fire", "Entropy", "Water"];
const recipe = new Map();
let selectedCatalyst = null;

const items = (MH_DATA.ElementItems || []).filter(
  (x) => x && x.Name && x.Elements
);

const superstitious = (MH_DATA.SuperstitiousItems || []).filter(
  (x) => x && x.Name && x.Elements
);

const byId = new Map(
  [
    ...(MH_DATA.ElementItems || []),
    ...(MH_DATA.Catalysts || [])
  ]
    .filter((x) => x && x.Name)
    .map((x) => [String(x.Id), x])
);

const catalystById = new Map(
  (MH_DATA.Catalysts || []).map((x) => [String(x.Id), x])
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
  const value = String(assetId ?? "").trim();

  if (
    value.startsWith("http://") ||
    value.startsWith("https://")
  ) {
    return value;
  }

  return value.replace(/^rbxassetid:\/\//i, "");
}

const IMAGE_PLACEHOLDER =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="420" height="420">
      <rect width="100%" height="100%" fill="#0d0f12"/>
    </svg>
  `);

const imageCache = new Map();

function imageTag(assetId, className = "") {
  const value = cleanAssetId(assetId);

  let id = value;

  /*
   * If the stored value is a Roblox thumbnail URL,
   * extract the asset ID.
   */
  if (
    value.startsWith("http://") ||
    value.startsWith("https://")
  ) {
    const match = value.match(/assetIds=(\d+)/i);

    if (match) {
      id = match[1];
    }
  }

  const imageUrl =
    MH_IMAGES[id] ||
    imageCache.get(id) ||
    IMAGE_PLACEHOLDER;

  return `<img
    class="${escapeAttr(className)}"
    src="${escapeAttr(imageUrl)}"
    data-asset-id="${escapeAttr(id)}"
    alt=""
    loading="lazy"
  >`;
}

/* ============================================================
   RECIPE
   ============================================================ */

function selectSuperstitious(item) {
  selectedSuperstitious = item;
  recipe.clear();

  // Automatically add the required catalyst
  if (item.CatalystId !== undefined && item.CatalystId !== null) {
    const catalyst = catalystById.get(
      String(item.CatalystId)
    );

    if (catalyst) {
      recipe.set(
        String(catalyst.Id),
        1
      );
    } else {
      console.warn(
        "Catalyst not found:",
        item.CatalystId
      );
    }
  }

  render();

  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
}

function addNormalItem(item) {
  if (!selectedSuperstitious) return;

  const id = String(item.Id);

  recipe.set(
    id,
    (recipe.get(id) || 0) + 1
  );

  render();
}

function changeQty(id, amount) {
  id = String(id);

  const next =
    (recipe.get(id) || 0) + amount;

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
  selectedCatalyst = null;
  recipe.clear();

  render();

  renderItemGrid();

  targetPicker.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

/* ============================================================
   ELEMENT CALCULATIONS
   ============================================================ */

function calculateCurrentTotals() {
  const totals = Object.fromEntries(
    ELEMENTS.map((e) => [e, 0])
  );

  for (const [id, qty] of recipe) {
    const item = byId.get(id);

    if (!item) continue;

    for (const element of ELEMENTS) {
      totals[element] +=
        (Number(item.Elements[element]) || 0) * qty;
    }
  }

  return totals;
}

function calculateRequiredTotals() {
  if (!selectedSuperstitious) {
    return Object.fromEntries(
      ELEMENTS.map((e) => [e, 0])
    );
  }

  return Object.fromEntries(
    ELEMENTS.map((e) => [
      e,
      Number(
        selectedSuperstitious.Elements[e]
      ) || 0,
    ])
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
      })[c]
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
    String(selectedSuperstitious.Id) ===
      String(item.Id);

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
  const qty =
    recipe.get(String(item.Id)) || 0;

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
      ${
        qty
          ? `In recipe: ${qty}`
          : `ID ${escapeHtml(item.Id)}`
      }
    </div>
  </button>`;
}

/* ============================================================
   GRIDS
   ============================================================ */

function renderSuperstitiousGrid() {
  superstitiousGrid.innerHTML =
    superstitious
      .map(superstitiousCard)
      .join("");
}

function renderItemGrid() {
  const sorted = [...items].sort(
    (a, b) =>
      a.Name.localeCompare(b.Name)
  );

  catalogCount.textContent =
    `${sorted.length} items`;

  itemGrid.innerHTML =
    sorted.map(normalCard).join("");
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

        ${imageTag(
          selectedSuperstitious.Image,
          "target-image"
        )}

        <div class="target-info">

          <div class="target-name">
            ${escapeHtml(
              selectedSuperstitious.Name
            )}
          </div>

          <div class="target-catalyst">
            Catalyst ID
            ${escapeHtml(
              selectedSuperstitious.CatalystId
            )}
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
  const totalCount =
    [...recipe.values()].reduce(
      (a, b) => a + b,
      0
    );

  itemCount.textContent =
    `${totalCount} item${
      totalCount === 1 ? "" : "s"
    }`;

  if (!selectedSuperstitious) {
    recipeEl.className =
      "recipe empty";

    recipeEl.innerHTML =
      '<div class="empty-state">' +
      "Select a Superstitious Item above to begin." +
      "</div>";

    return;
  }

  if (!recipe.size) {
    recipeEl.className =
      "recipe empty";

    recipeEl.innerHTML =
      '<div class="empty-state">' +
      "Your recipe is empty. Click items below to add them." +
      "</div>";

    return;
  }

  recipeEl.className = "recipe";

  recipeEl.innerHTML =
    [...recipe.entries()]
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
  const current =
    calculateCurrentTotals();

  const required =
    calculateRequiredTotals();

  elementsEl.innerHTML =
    ELEMENTS.map((element) => {
      const value =
        current[element];

      const target =
        required[element];

      let ratio;

      if (target === 0) {
        // Keep the bar visible for elements that aren't required.
        // 0/0 = full bar, and any extra amount also keeps it visible.
        ratio = 1;
      } else {
        ratio = Math.max(
          0,
          Math.min(
            1,
            value / target
          )
        );
      }

      const complete =
        target === 0
          ? value === 0
          : value >= target;

      const over =
        target !== 0 &&
        value > target;

      const statusClass =
        complete
          ? "complete"
          : "incomplete";

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
            Required${
              over ? " • over" : ""
            }
          </span>

        </div>

      </div>`;
    })
    .join("");
}

/* ============================================================
   RENDER
   ============================================================ */

function render() {

  renderTarget();
  renderRecipe();
  renderElements();

  /*
   * IMPORTANT:
   * renderItemGrid() is intentionally NOT here.
   *
   * Rebuilding the entire item grid every time the recipe
   * changes causes all of the images to be destroyed and
   * recreated, which creates the flicker.
   */
}

/* ============================================================
   EVENT HANDLERS
   ============================================================ */

superstitiousGrid.addEventListener(
  "click",
  (e) => {
    const card =
      e.target.closest(
        "[data-super-id]"
      );

    if (!card) return;

    const item =
      superstitious.find(
        (x) =>
          String(x.Id) ===
          String(
            card.dataset.superId
          )
      );

    if (item) {
      selectSuperstitious(item);
    }
  }
);

itemGrid.addEventListener(
  "click",
  (e) => {
    const card =
      e.target.closest(
        "[data-item-id]"
      );

    if (
      !card ||
      !selectedSuperstitious
    ) {
      return;
    }

    const item =
      byId.get(
        String(
          card.dataset.itemId
        )
      );

    if (item) {
      addNormalItem(item);
    }
  }
);

recipeEl.addEventListener(
  "click",
  (e) => {
    const btn =
      e.target.closest(
        "[data-action]"
      );

    if (!btn) return;

    const id = btn.dataset.id;

    if (
      btn.dataset.action ===
      "plus"
    ) {
      changeQty(id, 1);
    }

    if (
      btn.dataset.action ===
      "minus"
    ) {
      changeQty(id, -1);
    }

    if (
      btn.dataset.action ===
      "remove"
    ) {
      removeItem(id);
    }
  }
);

recipeTargetEl.addEventListener(
  "click",
  (e) => {
    if (
      e.target.closest(
        "#removeTargetBtn"
      )
    ) {
      removeTarget();
    }
  }
);

document
  .getElementById("clearBtn")
  .addEventListener("click", () => {
    selectedSuperstitious = null;
    selectedCatalyst = null;
    recipe.clear();

    render();

    renderItemGrid();
  });

/* ============================================================
   INITIAL RENDER
   ============================================================ */

render();

/*
 * Render the item grid once when the page loads.
 */
renderItemGrid();
renderSuperstitiousGrid();
