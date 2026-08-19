// Render Superstitious Grid on Load
const grid = document.getElementById("superstitious-grid");

MH_DATA.SuperstitiousItems.forEach(item => {
  const card = document.createElement("div");
  card.className = "card";
  card.onclick = () => openCraftingMenu(item);
  card.innerHTML = `
    <img src="${item.Image}" alt="${item.Name}">
    <p>${item.Name}</p>
  `;
  grid.appendChild(card);
});

function openCraftingMenu(item) {
  document.getElementById("selection-view").style.display = "none";
  document.getElementById("crafting-view").style.display = "block";

  // Load Target Info
  const targetDetails = document.getElementById("target-details");
  let elementRequirementsHtml = "";
  for (const [elem, val] of Object.entries(item.Elements)) {
    if (val > 0) elementRequirementsHtml += `<li><strong>${elem}:</strong> ${val}</li>`;
  }

  targetDetails.innerHTML = `
    <img src="${item.Image}" style="width: 100%; border-radius: 8px;">
    <h2>${item.Name}</h2>
    <h3>Required Elements:</h3>
    <ul>${elementRequirementsHtml}</ul>
  `;

  // Load Sacrifice Items List
  const sacrificeList = document.getElementById("sacrifice-items-list");
  sacrificeList.innerHTML = "";

  MH_DATA.ElementItems.forEach(elItem => {
    let elementsHtml = [];
    for (const [elem, val] of Object.entries(elItem.Elements)) {
      if (val !== 0) elementsHtml.push(`${elem}: ${val > 0 ? '+' + val : val}`);
    }

    const row = document.createElement("div");
    row.className = "item-row";
    row.innerHTML = `
      <div class="item-detail">
        <img src="${elItem.Image}">
        <span>${elItem.Name}</span>
      </div>
      <div class="badges">${elementsHtml.join(" | ")}</div>
    `;
    sacrificeList.appendChild(row);
  });
}

function showSelection() {
  document.getElementById("selection-view").style.display = "block";
  document.getElementById("crafting-view").style.display = "none";
}
