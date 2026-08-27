from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Numeric, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Notification(Base):
    __tablename__ = "notification"

    notification_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("app_user.user_id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(String, nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class BsnSpec(Base):

    __tablename__ = "bsn_spec"

    bsn_spec_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)
    srt_code: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    cdate: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class BsnInter(Base):

    __tablename__ = "bsn_inter"

    bsn_inter_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    bsn_spec_id: Mapped[int] = mapped_column(ForeignKey("bsn_spec.bsn_spec_id"), nullable=False)
    # cust_id (cust.cust_id) değil, doğrudan app_user_id: olayı müşteri de satıcı da tetiklemiş olabilir,
    # ikisi de app_user satırı.
    app_user_id: Mapped[int] = mapped_column(ForeignKey("app_user.user_id"), nullable=False)
    # Aynı app_user hem müşteri hem satıcı olabildiği için app_user_id tek başına
    # "hangi şapkayla yapıldı" sorusunu cevaplamaz. Bu yüzden işlemi yapan endpoint
    # hangi rol bağlamında çalıştığını burada açıkça yazar (role tablosuna referans).
    actor_role_id: Mapped[int] = mapped_column(ForeignKey("role.role_id"), nullable=False)
    sale_cnl_id: Mapped[int | None] = mapped_column(ForeignKey("sale_cnl.sale_cnl_id"), nullable=True)
    cdate: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

class SchJob(Base):
    __tablename__ = "sch_job"

    sch_job_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    job_name: Mapped[str] = mapped_column(String(255), nullable=False)
    job_type: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False)
    last_run: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    next_run: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class UserPreference(Base):
    __tablename__ = "user_preference"

    preference_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("app_user.user_id", ondelete="CASCADE"), nullable=False)
    gnl_char_id: Mapped[int] = mapped_column(ForeignKey("gnl_char.gnl_char_id"), nullable=False)
    gnl_char_val_id: Mapped[int] = mapped_column(ForeignKey("gnl_char_val.gnl_char_val_id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CntcMedium(Base):
    """Kullanıcının iletişim kanalları — email için 1 satır, telefon için 1 satır.
    data_tp_id/verf_tp_id gnl_tp'den; st_id/verf_st_id gnl_st'den beslenir (bkz. phase5 migration)."""
    __tablename__ = "cntc_medium"

    cntc_medium_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("app_user.user_id", ondelete="CASCADE"), nullable=False)
    data_tp_id: Mapped[int] = mapped_column(ForeignKey("gnl_tp.gnl_tp_id"), nullable=False)  # verinin tipi: EMAIL/GSM
    cntc_data: Mapped[str] = mapped_column(String(255), nullable=False)  # asıl veri: email adresi / telefon no
    st_id: Mapped[int | None] = mapped_column(ForeignKey("gnl_st.gnl_st_id"), nullable=True)  # kaydın genel durumu (opsiyonel)
    verf_tp_id: Mapped[int | None] = mapped_column(ForeignKey("gnl_tp.gnl_tp_id"), nullable=True)  # seçilen doğrulama tipi
    verf_st_id: Mapped[int | None] = mapped_column(ForeignKey("gnl_st.gnl_st_id"), nullable=True)  # doğrulama durumu
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    srvc_logs: Mapped[list["SrvcLog"]] = relationship("SrvcLog", back_populates="cntc_medium", cascade="all, delete-orphan")


class SrvcLog(Base):
    """Paralı API çağrılarının kaydı — kopukluk/maliyet/denetim için."""
    __tablename__ = "srvc_log"

    srvc_log_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    srvc_name: Mapped[str] = mapped_column(String(50), nullable=False)  # 'RESEND_EMAIL' | 'TWILIO_SMS' vb.
    srvc_code: Mapped[str] = mapped_column(String(50), nullable=False)  # 'SEND_VERIFICATION_CODE' vb.
    user_id: Mapped[int | None] = mapped_column(ForeignKey("app_user.user_id", ondelete="CASCADE"), nullable=True)
    cntc_medium_id: Mapped[int | None] = mapped_column(ForeignKey("cntc_medium.cntc_medium_id", ondelete="CASCADE"), nullable=True)
    pl_in: Mapped[str | None] = mapped_column(String, nullable=True)  # gönderilen istek (JSON/text)
    pl_out: Mapped[str | None] = mapped_column(String, nullable=True) # dönen cevap (JSON/text)
    srvc_msg: Mapped[str | None] = mapped_column(String(255), nullable=True) # 'OK' | 'INVALID_NUMBER'
    http_status: Mapped[int | None] = mapped_column(Integer, nullable=True)
    cost: Mapped[float | None] = mapped_column(Numeric(10, 4), nullable=True) # çağrı ücreti
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    cntc_medium: Mapped["CntcMedium | None"] = relationship("CntcMedium", back_populates="srvc_logs")

