import json
import re
import time
from pathlib import Path

import requests


DATA_FILE = Path("data.js")
OUTPUT_FILE = Path("Images.js")

BATCH_SIZE = 20


def extract_asset_id(value):
    if not value:
        return None

    value = str(value).strip()

    # Already a plain asset ID
    if value.isdigit():
        return value

    # rbxassetid://123456
    match = re.search(r"rbxassetid://(\d+)", value, re.IGNORECASE)

    if match:
        return match.group(1)

    # thumbnails.roblox.com/v1/assets?assetIds=123456
    match = re.search(r"assetIds=(\d+)", value, re.IGNORECASE)

    if match:
        return match.group(1)

    return None


def read_data_js():
    text = DATA_FILE.read_text(encoding="utf-8")

    # Find the object after const MH_DATA =
    match = re.search(
        r"const\s+MH_DATA\s*=\s*(\{.*\})\s*;?\s*$",
        text,
        re.DOTALL
    )

    if not match:
        raise RuntimeError("Could not find MH_DATA in Data.js")

    object_text = match.group(1)

    # Your Data.js is valid JSON once the JS declaration is removed.
    return json.loads(object_text)


def get_asset_ids(data):
    ids = set()

    for item in data.values():
        asset_id = extract_asset_id(
            item.get("Image")
        )

        if asset_id:
            ids.add(asset_id)

    return sorted(ids)


def fetch_batch(ids):
    url = "https://thumbnails.roblox.com/v1/assets"

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

    images = {}

    for entry in result.get("data", []):
        target_id = str(
            entry.get("targetId", "")
        )

        image_url = entry.get("imageUrl")

        if target_id and image_url:
            images[target_id] = image_url

    return images


def main():
    print("Reading Data.js...")

    data = read_data_js()

    asset_ids = get_asset_ids(data)

    print(
        f"Found {len(asset_ids)} unique Roblox asset IDs."
    )

    images = {}

    for start in range(
        0,
        len(asset_ids),
        BATCH_SIZE
    ):
        batch = asset_ids[
            start:start + BATCH_SIZE
        ]

        print(
            f"Requesting {start + 1}-"
            f"{start + len(batch)}..."
        )

        try:
            result = fetch_batch(batch)

            images.update(result)

            print(
                f"Received {len(result)} images."
            )

        except Exception as error:
            print(
                f"Request failed: {error}"
            )

        # Don't hammer the API.
        time.sleep(0.25)

    print(
        f"Successfully found {len(images)} image URLs."
    )

    output = [
        "const MH_IMAGES = "
        + json.dumps(
            images,
            indent=2,
            ensure_ascii=False
        )
        + ";",
        ""
    ]

    OUTPUT_FILE.write_text(
        "\n".join(output),
        encoding="utf-8"
    )

    print(
        f"Wrote {OUTPUT_FILE}"
    )


if __name__ == "__main__":
    main()
