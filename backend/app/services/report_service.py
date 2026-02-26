from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import RFSignal


async def build_statistical_report(period_start, period_end, db: AsyncSession):
    base_query = select(RFSignal).where(
        RFSignal.detected_at >= period_start,
        RFSignal.detected_at <= period_end,
    )

    total_signals = await db.scalar(select(func.count()).select_from(base_query.subquery()))
    unique_modulations = await db.scalar(
        select(func.count(func.distinct(RFSignal.modulation))).where(
            RFSignal.detected_at >= period_start,
            RFSignal.detected_at <= period_end,
        )
    )
    avg_power = await db.scalar(
        select(func.avg(RFSignal.power_level)).where(
            RFSignal.detected_at >= period_start,
            RFSignal.detected_at <= period_end,
        )
    )
    max_frequency = await db.scalar(
        select(func.max(RFSignal.frequency)).where(
            RFSignal.detected_at >= period_start,
            RFSignal.detected_at <= period_end,
        )
    )

    return {
        "total_signals": total_signals or 0,
        "unique_modulations": unique_modulations or 0,
        "avg_power": float(avg_power) if avg_power is not None else None,
        "max_frequency": float(max_frequency) if max_frequency is not None else None,
    }


async def generate_eob(period_start, period_end, eob_type, db: AsyncSession):
    query = (
        select(
            RFSignal.modulation,
            func.avg(RFSignal.frequency).label("avg_frequency"),
            func.count(RFSignal.id).label("count_signals"),
            func.avg(RFSignal.confidence).label("avg_confidence"),
        )
        .where(RFSignal.detected_at >= period_start, RFSignal.detected_at <= period_end)
        .group_by(RFSignal.modulation)
        .order_by(func.count(RFSignal.id).desc())
    )
    rows = (await db.execute(query)).all()

    entries = []
    for idx, row in enumerate(rows, start=1):
        threat_level = "HIGH" if row.count_signals > 100 else "MEDIUM" if row.count_signals > 30 else "LOW"
        entries.append(
            {
                "emitter_designation": f"{eob_type}-EM-{idx:03d}",
                "assessed_capability": f"{row.modulation} / {round(row.avg_frequency, 2)} Hz",
                "threat_level": threat_level,
                "confidence": float(row.avg_confidence or 0.5),
            }
        )

    return entries
