const itemGrid = document.getElementById("itemGrid");
const searchBox = document.getElementById("searchBox");

const itemListPage = document.getElementById("itemListPage");
const craftingPage = document.getElementById("craftingPage");

const craftingContent =
    document.getElementById("craftingContent");

const backButton =
    document.getElementById("backButton");


/*
    Roblox thumbnail URL

    Example:

    Image = "139806034160713"

    becomes:

    https://thumbnails.roblox.com/v1/assets?
    assetIds=139806034160713&
    size=420x420&
    format=Png&
    isCircular=false
*/

function getThumbnail(id) {

    // Handle rbxassetid:// IDs
    id = String(id).replace("rbxassetid://", "");

    return `https://thumbnails.roblox.com/v1/assets?assetIds=${id}&size=420x420&format=Png&isCircular=false`;
}


/*
    Render all Superstitious items
*/

function renderItems(search = "") {

    itemGrid.innerHTML = "";

    const filtered =
        gameData.SuperstitiousItems.filter(item =>
            item.Name
                .toLowerCase()
                .includes(search.toLowerCase())
        );


    filtered.forEach(item => {

        const card =
            document.createElement("div");

        card.className = "item-card";


        const image =
            document.createElement("img");

        image.className = "item-image";

        image.src = getThumbnail(item.Image);

        image.alt = item.Name;


        const name =
            document.createElement("div");

        name.className = "item-name";

        name.textContent = item.Name;


        card.appendChild(image);

        card.appendChild(name);


        card.addEventListener(
            "click",
            () => openCrafting(item.Id)
        );


        itemGrid.appendChild(card);

    });
}


/*
    Open crafting page
*/

function openCrafting(itemId) {

    const item =
        gameData.SuperstitiousItems.find(
            x => x.Id === itemId
        );


    if (!item) {
        return;
    }


    itemListPage.classList.add("hidden");

    craftingPage.classList.remove("hidden");


    /*
        Find catalyst belonging to this item
    */

    const catalyst =
        gameData.Catalysts.find(
            x => x.Id === item.Id
        );


    craftingContent.innerHTML = `

        <div class="crafting-header">

            <img
                class="crafting-image"
                src="${getThumbnail(item.Image)}"
                alt="${item.Name}"
            >

            <div class="crafting-title">

                <h2>${item.Name}</h2>

                <p>
                    Superstitious Item
                </p>

            </div>

        </div>


        <div class="elements-panel">

            <h3>Required Elements</h3>

            <div class="element-grid">

                ${createElement("Earth", item.Elements.Earth)}

                ${createElement("Aether", item.Elements.Aether)}

                ${createElement("Order", item.Elements.Order)}

                ${createElement("Fire", item.Elements.Fire)}

                ${createElement("Entropy", item.Elements.Entropy)}

                ${createElement("Water", item.Elements.Water)}

            </div>

        </div>


        ${
            catalyst
            ?
            `
            <div class="catalyst-panel">

                <h3>Catalyst</h3>

                <div class="catalyst-name">
                    ${catalyst.Name}
                </div>

                <p>
                    Catalyst ID:
                    ${catalyst.CatalystId}
                </p>

            </div>
            `
            :
            ""
        }


        <div
            class="elements-panel"
            style="margin-top:20px"
        >

            <h3>Crafting Cost</h3>

            <p>
                The recipe calculation will go here.
            </p>

        </div>

    `;
}


/*
    Create an element display
*/

function createElement(name, value) {

    return `

        <div class="element">

            <div class="element-name">
                ${name}
            </div>

            <div class="element-value">
                ${value}
            </div>

        </div>

    `;
}


/*
    Search
*/

searchBox.addEventListener(
    "input",
    () => {

        renderItems(searchBox.value);

    }
);


/*
    Back button
*/

backButton.addEventListener(
    "click",
    () => {

        craftingPage.classList.add("hidden");

        itemListPage.classList.remove("hidden");

    }
);


/*
    Initial load
*/

renderItems();
