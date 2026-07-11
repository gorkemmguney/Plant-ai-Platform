from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Srvc(Base):
    __tablename__ = "srvc"

    srvc_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    gnl_st_id: Mapped[int] = mapped_column(ForeignKey("gnl_st.gnl_st_id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class SrvcSpec(Base):
    __tablename__ = "srvc_spec"

    srvc_spec_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    srvc_id: Mapped[int] = mapped_column(ForeignKey("srvc.srvc_id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    value: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Rsrc(Base):
    __tablename__ = "rsrc"

    rsrc_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class RsrcSpec(Base):
    __tablename__ = "rsrc_spec"

    rsrc_spec_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    rsrc_id: Mapped[int] = mapped_column(ForeignKey("rsrc.rsrc_id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    value: Mapped[str] = mapped_column(String(255), nullable=False)
