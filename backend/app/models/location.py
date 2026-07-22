from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Il(Base):
    """İl (şehir) — referans veri, admin dışında kimse yazmaz."""
    __tablename__ = "il"

    il_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)


class Ilce(Base):
    __tablename__ = "ilce"

    ilce_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    il_id: Mapped[int] = mapped_column(ForeignKey("il.il_id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)


class Mahalle(Base):
    __tablename__ = "mahalle"

    mahalle_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ilce_id: Mapped[int] = mapped_column(ForeignKey("ilce.ilce_id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
