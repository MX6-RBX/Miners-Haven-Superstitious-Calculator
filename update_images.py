import json
import re
import time
from pathlib import Path

import requests


DATA_FILE = Path("data.js")
OUTPUT_FILE = Path("Images.js")

BATCH_SIZE = 20

MAX_RETRIES = 4
RETRY_DELAY = 2

REQUEST_DELAY = 0.25


# ============================================================
# ASSET ID EXTRACTION
# ============================================================

def extract_asset_id(value):
    if not value:
        return None

    value = str(value).strip()

    # Plain asset ID
    if value.isdigit():
        return value

    # rbxassetid://123456
    match = re.search(
        r"rbxassetid://(\d+)",
        value,
        re.IGNORECASE
    )

    if match:
        return match.group(1)

    # thumbnails.roblox.com/v1/assets?assetIds=123456
    match = re.search(
        r"assetIds=(\d+)",
        value,
        re.IGNORECASE
    )

    if match:
        return match.group(1)

    return None


# ============================================================
# READ DATA.JS
# ============================================================

def read_data_js():
    print("Reading Data.js...")

    text = DATA_FILE.read_text(
        encoding="utf-8"
    )

    match = re.search(
        r"const\s+MH_DATA\s*=\s*(\{.*\})\s*;?\s*$",
        text,
        re.DOTALL
    )

    if not match:
        raise RuntimeError(
            "Could not find MH_DATA in data.js"
        )

    object_text = match.group(1)

    try:
        return json.loads(object_text)

    except json.JSONDecodeError as error:
        raise RuntimeError(
            f"Data.js contains invalid JSON: {error}"
        )


# ============================================================
# FIND ALL IMAGE IDS
# ============================================================

def get_asset_ids(data):

    ids = set()

    def process_item(item):

        if isinstance(item, dict):

            image_value = item.get("Image")

            asset_id = extract_asset_id(
                image_value
            )

            if asset_id:
                ids.add(asset_id)

            # Search nested dictionaries/lists
            for value in item.values():

                if isinstance(
                    value,
                    (dict, list)
                ):
                    process_item(value)

        elif isinstance(item, list):

            for value in item:
                process_item(value)

    process_item(data)

    return sorted(
        ids,
        key=lambda x: int(x)
    )


# ============================================================
# LOAD EXISTING IMAGES.JS
# ============================================================

def read_existing_images():

    if not OUTPUT_FILE.exists():
        print(
            "Images.js does not exist yet."
        )

        return {}

    print(
        "Reading existing Images.js..."
    )

    text = OUTPUT_FILE.read_text(
        encoding="utf-8"
    )

    match = re.search(
        r"const\s+MH_IMAGES\s*=\s*(\{.*\})\s*;",
        text,
        re.DOTALL
    )

    if not match:
        print(
            "Could not parse existing Images.js."
        )

        return {}

    try:

        return json.loads(
            match.group(1)
        )

    except json.JSONDecodeError:

        print(
            "Existing Images.js contains invalid JSON."
        )

        return {}


# ============================================================
# REQUEST ROBLOX
# ============================================================

def fetch_batch(ids):

    url = (
        "https://thumbnails.roblox.com/v1/assets"
    )

    params = {
        "assetIds": ",".join(ids),
        "size": "420x420",
        "format": "png",
        "isCircular": "false"
    }

    response = requests.get(
        url,
        params=params,
        timeout=30
    )

    response.raise_for_status()

    result = response.json()

    if not isinstance(result, dict):

        raise RuntimeError(
            "Roblox returned an invalid response."
        )

    images = {}

    entries = result.get(
        "data",
        []
    )

    for entry in entries:

        target_id = str(
            entry.get(
                "targetId",
                ""
            )
        )

        state = entry.get(
            "state"
        )

        image_url = entry.get(
            "imageUrl"
        )

        if (
            target_id
            and image_url
        ):

            images[target_id] = image_url

        else:

            print(
                f"  Missing image: "
                f"ID={target_id} "
                f"State={state}"
            )

    return images


# ============================================================
# FETCH WITH RETRIES
# ============================================================

def fetch_batch_with_retries(ids):

    for attempt in range(
        1,
        MAX_RETRIES + 1
    ):

        try:

            print(
                f"  Attempt "
                f"{attempt}/{MAX_RETRIES}"
            )

            result = fetch_batch(ids)

            return result

        except Exception as error:

            print(
                f"  Request failed: "
                f"{error}"
            )

            if attempt < MAX_RETRIES:

                print(
                    f"  Retrying in "
                    f"{RETRY_DELAY}s..."
                )

                time.sleep(
                    RETRY_DELAY
                )

    print(
        "  All retries failed."
    )

    return {}


# ============================================================
# MAIN
# ============================================================

def main():

    data = read_data_js()

    asset_ids = get_asset_ids(
        data
    )

    print(
        f"Found {len(asset_ids)} "
        f"unique Roblox asset IDs."
    )

    if not asset_ids:

        raise RuntimeError(
            "No Roblox asset IDs were found."
        )

    # --------------------------------------------------------
    # Existing images
    # --------------------------------------------------------

    existing_images = (
        read_existing_images()
    )

    print(
        f"Existing image URLs: "
        f"{len(existing_images)}"
    )

    # Start with existing images.
    #
    # This means a temporary Roblox failure
    # won't delete a previously working image.
    images = dict(
        existing_images
    )

    successful = set()

    failed = set()

    # --------------------------------------------------------
    # Request batches
    # --------------------------------------------------------

    total_batches = (
        (
            len(asset_ids)
            + BATCH_SIZE
            - 1
        )
        // BATCH_SIZE
    )

    for batch_number, start in enumerate(
        range(
            0,
            len(asset_ids),
            BATCH_SIZE
        ),
        start=1
    ):

        batch = asset_ids[
            start:
            start + BATCH_SIZE
        ]

        print(
            ""
        )

        print(
            f"Batch "
            f"{batch_number}/"
            f"{total_batches} "
            f"("
            f"{len(batch)} IDs"
            f")"
        )

        result = fetch_batch_with_retries(
            batch
        )

        images.update(
            result
        )

        successful.update(
            result.keys()
        )

        # Anything not returned by Roblox
        # is considered failed for this run.
        for asset_id in batch:

            if asset_id not in result:

                failed.add(
                    asset_id
                )

        print(
            f"  Received "
            f"{len(result)} images."
        )

        time.sleep(
            REQUEST_DELAY
        )

    # --------------------------------------------------------
    # Remove images that are no longer
    # present in Data.js
    # --------------------------------------------------------

    valid_ids = set(
        asset_ids
    )

    images = {
        asset_id: url
        for asset_id, url in images.items()
        if asset_id in valid_ids
    }

    # --------------------------------------------------------
    # Write Images.js
    # --------------------------------------------------------

    output = (
        "const MH_IMAGES = "
        + json.dumps(
            images,
            indent=2,
            ensure_ascii=False
        )
        + ";"
        + "\n"
    )

    OUTPUT_FILE.write_text(
        output,
        encoding="utf-8"
    )

    # --------------------------------------------------------
    # Summary
    # --------------------------------------------------------

    missing = [
        asset_id
        for asset_id in asset_ids
        if asset_id not in images
    ]

    print("")
    print("=" * 60)
    print("IMAGE UPDATE COMPLETE")
    print("=" * 60)

    print(
        f"Total asset IDs: "
        f"{len(asset_ids)}"
    )

    print(
        f"Images available: "
        f"{len(images)}"
    )

    print(
        f"Missing images: "
        f"{len(missing)}"
    )

    if missing:

        print("")
        print(
            "The following asset IDs "
            "could not be resolved:"
        )

        for asset_id in missing:

            print(
                f"  {asset_id}"
            )

    print("")
    print(
        f"Wrote {OUTPUT_FILE}"
    )


# ============================================================
# RUN
# ============================================================

if __name__ == "__main__":
    main()
