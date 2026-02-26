import csv
import io
import uuid
import xml.etree.ElementTree as ET
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from geoalchemy2.elements import WKTElement
from geoalchemy2 import Geometry
from app.models import Asset


async def create_asset(data, db: AsyncSession):
    asset = Asset(
        name=data.name,
        type=data.type,
        status=data.status,
        location=WKTElement(f"POINT({data.longitude} {data.latitude})", srid=4326),
    )
    db.add(asset)
    await db.commit()
    await db.refresh(asset)

    row = await db.execute(
        select(
            Asset.id,
            Asset.name,
            Asset.type,
            Asset.status,
            func.ST_Y(Asset.location.cast(Geometry)).label("latitude"),
            func.ST_X(Asset.location.cast(Geometry)).label("longitude"),
            Asset.created_at,
        ).where(Asset.id == asset.id)
    )
    return row.one()


async def list_assets(db: AsyncSession):
    result = await db.execute(
        select(
            Asset.id,
            Asset.name,
            Asset.type,
            Asset.status,
            func.ST_Y(Asset.location.cast(Geometry)).label("latitude"),
            func.ST_X(Asset.location.cast(Geometry)).label("longitude"),
            Asset.created_at,
        )
    )
    return result.all()


def export_assets_csv(rows):
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["id", "name", "type", "status", "latitude", "longitude", "created_at"])
    for row in rows:
        writer.writerow([row.id, row.name, row.type, row.status, row.latitude, row.longitude, row.created_at])
    return output.getvalue()


def export_assets_xml(rows):
    root = ET.Element("assets")
    for row in rows:
        asset_el = ET.SubElement(root, "asset")
        ET.SubElement(asset_el, "id").text = str(row.id)
        ET.SubElement(asset_el, "name").text = row.name or ""
        ET.SubElement(asset_el, "type").text = row.type or ""
        ET.SubElement(asset_el, "status").text = row.status or ""
        ET.SubElement(asset_el, "latitude").text = str(row.latitude)
        ET.SubElement(asset_el, "longitude").text = str(row.longitude)
        ET.SubElement(asset_el, "created_at").text = str(row.created_at)
    return ET.tostring(root, encoding="unicode")


async def import_assets_csv(content: str, db: AsyncSession):
    reader = csv.DictReader(io.StringIO(content))
    created = 0
    for row in reader:
        asset = Asset(
            id=uuid.uuid4(),
            name=row.get("name"),
            type=row.get("type"),
            status=row.get("status") or "ACTIVE",
            location=WKTElement(
                f"POINT({float(row['longitude'])} {float(row['latitude'])})",
                srid=4326,
            ),
        )
        db.add(asset)
        created += 1
    await db.commit()
    return {"imported": created}


async def import_assets_xml(content: str, db: AsyncSession):
    root = ET.fromstring(content)
    created = 0
    for node in root.findall("asset"):
        latitude = float(node.findtext("latitude"))
        longitude = float(node.findtext("longitude"))
        asset = Asset(
            id=uuid.uuid4(),
            name=node.findtext("name"),
            type=node.findtext("type"),
            status=node.findtext("status") or "ACTIVE",
            location=WKTElement(f"POINT({longitude} {latitude})", srid=4326),
        )
        db.add(asset)
        created += 1
    await db.commit()
    return {"imported": created}
