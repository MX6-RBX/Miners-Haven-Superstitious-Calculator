const ELEMENTS = [
  "Earth",
  "Aether",
  "Order",
  "Fire",
  "Entropy",
  "Water"
];

const recipe = new Map();

/* ============================================================
   DATA
   ============================================================ */

const items = (MH_DATA.ElementItems || []).filter(
  (x) => x && x.Name && x.Elements
);

const superstitious = (MH_DATA.SuperstitiousItems || []).filter(
  (x) => x && x.Name && x.Elements
);

const catalysts = (MH_DATA.Catalysts || []).filter(
  (x) => x && x.Name
);

const byId = new Map(
  items.map((x) => [String(x.Id), x])
);

const catalystById = new Map(
  catalysts.map((x) => [String(x.Id), x])
);

let selectedSuperstitious = null;

/* ============================================================
   DOM
   ============================================================ */

const superstitiousGrid =
  document.getElementById("superstitiousGrid");

const itemGrid =
  document.getElementById("itemGrid");

const recipeEl =
  document.getElementById("recipe");

const recipeTargetEl =
  document.getElementById("recipeTarget");

const elementsEl =
  document.getElementById("elements");

const itemCount =
  document.getElementById("itemCount");

const catalogCount =
  document.getElementById("catalogCount");

const targetPicker =
  document.getElementById("targetPicker");

/* ============================================================
   IMAGE SYSTEM
   ============================================================ */

/*
 * Converts an image value into an asset ID.
 */
function cleanAssetId(assetId) {
  const value = String(assetId ?? "").trim();

  if (!value) {
    return "";
  }

  /*
   * If this is already a URL, try to extract
   * the Roblox asset ID.
   */
  if (
    value.startsWith("http://") ||
    value.startsWith("https://")
  ) {
    const match = value.match(/assetIds=(\d+)/i);

    if (match) {
      return match[1];
    }

    return value;
  }

  /*
   * rbxassetid://123456
   */
  return value.replace(
    /^rbxassetid:\/\//i,
    ""
  );
}

/*
 * Placeholder used when an image isn't found.
 */
const IMAGE_PLACEHOLDER =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="420" height="420">
      <rect width="100%" height="100%" fill="#0d0f12"/>
    </svg>
  `);

/*
 * Creates an image element using the URLs
 * already generated in Images.js.
 */
function imageTag(assetId, className = "") {
  const value = cleanAssetId(assetId);

  let id = value;

  /*
   * If the value is a Roblox thumbnail API URL,
   * extract the asset ID.
   */
  if (
    value.startsWith("http://") ||
    value.startsWith("https://")
  ) {
    const match = value.match(
      /assetIds=(\d+)/i
    );

    if (match) {
      id = match[1];
    }
  }

  /*
   * Images.js contains:
   *
   * const MH_IMAGES = {
   *   "123456": "https://tr.rbxcdn.com/..."
   * }
   */
  const imageUrl =
    MH_IMAGES[id] || IMAGE_PLACEHOLDER;

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

  render();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function addNormalItem(item) {
  if (!selectedSuperstitious) {
    return;
  }

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

  recipe.clear();

  render();

  targetPicker.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

/* ============================================================
   ELEMENT CALCULATIONS
   ============================================================ */

function calculateCurrentTotals() {
  const totals = Object.fromEntries(
    ELEMENTS.map((element) => [
      element,
      0
    ])
  );

  for (const [id, qty] of recipe) {
    const item = byId.get(id);

    if (!item) {
      continue;
    }

    for (const element of ELEMENTS) {
      totals[element] +=
        (Number(item.Elements[element]) || 0) *
        qty;
    }
  }

  return totals;
}

function calculateRequiredTotals() {
  if (!selectedSuperstitious) {
    return Object.fromEntries(
      ELEMENTS.map((element) => [
        element,
        0
      ])
    );
  }

  return Object.fromEntries(
    ELEMENTS.map((element) => [
      element,
      Number(
        selectedSuperstitious.Elements[element]
      ) || 0
    ])
  );
}

function formatNumber(n) {
  return Number.isInteger(n)
    ? n.toLocaleString()
    : n.toLocaleString(undefined, {
        maximumFractionDigits: 2
      });
}

/* ============================================================
   HTML SAFETY
   ============================================================ */

function escapeHtml(value) {
  return String(value).replace(
    /[&<>'"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;"
      })[character]
  );
}

function escapeAttr(value) {
  return escapeHtml(value);
}

/* ============================================================
   CARDS
   ============================================================ */

function superstitiousCard(item) {
  const selected =
    selectedSuperstitious &&
    String(selectedSuperstitious.Id) ===
      String(item.Id);

  /*
   * Find the catalyst belonging to this
   * superstitious item.
   */
  const catalyst =
    item.CatalystId != null
      ? catalystById.get(
          String(item.CatalystId)
        )
      : null;

  const catalystName =
    catalyst?.Name ||
    `Catalyst ${item.CatalystId ?? "Unknown"}`;

  return `
    <button
      class="item-card ${selected ? "selected" : ""}"
      data-super-id="${escapeAttr(item.Id)}"
    >

      ${imageTag(
        item.Image,
        "card-image"
      )}

      <div class="card-name">
        ${escapeHtml(item.Name)}
      </div>

      <div class="card-meta">
        ${escapeHtml(catalystName)}
      </div>

    </button>
  `;
}

function normalCard(item) {
  const qty =
    recipe.get(String(item.Id)) || 0;

  return `
    <button
      class="item-card ${qty ? "in-recipe" : ""}"
      data-item-id="${escapeAttr(item.Id)}"
      ${selectedSuperstitious ? "" : "disabled"}
    >

      ${imageTag(
        item.Image,
        "card-image"
      )}

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

    </button>
  `;
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
    sorted
      .map(normalCard)
      .join("");
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

  recipeTargetEl.classList.remove(
    "hidden"
  );

  const catalyst =
    selectedSuperstitious.CatalystId != null
      ? catalystById.get(
          String(
            selectedSuperstitious.CatalystId
          )
        )
      : null;

  const catalystName =
    catalyst?.Name ||
    `Catalyst ${selectedSuperstitious.CatalystId ?? "Unknown"}`;

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
            Catalyst:
            ${escapeHtml(catalystName)}
          </div>

        </div>

        <button
          id="removeTargetBtn"
          class="remove target-remove"
        >
          Remove
        </button>

      </div>

    </div>
  `;
}

/* ============================================================
   RECIPE
   ============================================================ */

function renderRecipe() {
  const totalCount =
    [...recipe.values()].reduce(
      (total, quantity) =>
        total + quantity,
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

        if (!item) {
          return "";
        }

        return `
          <div class="recipe-item">

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

          </div>
        `;
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

      const ratio =
        target === 0
          ? value === 0
            ? 1
            : 0
          : Math.max(
              0,
              Math.min(
                1,
                value / target
              )
            );

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

      return `
        <div
          class="element ${statusClass}"
        >

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
                over
                  ? " • over"
                  : ""
              }
            </span>

          </div>

        </div>
      `;
    })
    .join("");
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
}

/* ============================================================
   EVENT HANDLERS
   ============================================================ */

superstitiousGrid.addEventListener(
  "click",
  (event) => {
    const card =
      event.target.closest(
        "[data-super-id]"
      );

    if (!card) {
      return;
    }

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
  (event) => {
    const card =
      event.target.closest(
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
        String(card.dataset.itemId)
      );

    if (item) {
      addNormalItem(item);
    }
  }
);

recipeEl.addEventListener(
  "click",
  (event) => {
    const button =
      event.target.closest(
        "[data-action]"
      );

    if (!button) {
      return;
    }

    const id =
      button.dataset.id;

    if (
      button.dataset.action ===
      "plus"
    ) {
      changeQty(id, 1);
    }

    if (
      button.dataset.action ===
      "minus"
    ) {
      changeQty(id, -1);
    }

    if (
      button.dataset.action ===
      "remove"
    ) {
      removeItem(id);
    }
  }
);

recipeTargetEl.addEventListener(
  "click",
  (event) => {
    if (
      event.target.closest(
        "#removeTargetBtn"
      )
    ) {
      removeTarget();
    }
  }
);

document
  .getElementById("clearBtn")
  .addEventListener(
    "click",
    () => {
      selectedSuperstitious = null;

      recipe.clear();

      render();
    }
  );

/* ============================================================
   INITIAL RENDER
   ============================================================ */

render();
