from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class CommInteraction(Base):
    """
    TM Forum SID Communication Interaction / Interaction Thread (TMF681)
    Represents a communication channel/thread between Customer and Seller.
    """
    __tablename__ = "comm_interaction"

    comm_interaction_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    interaction_type: Mapped[str] = mapped_column(String(50), default="SELLER_CHAT", nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="OPEN", nullable=False)
    channel_type: Mapped[str] = mapped_column(String(50), default="IN_APP_CHAT", nullable=False)
    subject: Mapped[str | None] = mapped_column(String(255), nullable=True)

    customer_id: Mapped[int] = mapped_column(ForeignKey("app_user.user_id", ondelete="CASCADE"), nullable=False)
    seller_id: Mapped[int] = mapped_column(ForeignKey("app_user.user_id", ondelete="CASCADE"), nullable=False)
    related_prod_id: Mapped[int | None] = mapped_column(ForeignKey("prod.prod_id", ondelete="SET NULL"), nullable=True)
    related_ord_id: Mapped[int | None] = mapped_column(ForeignKey("cust_ord.cust_ord_id", ondelete="SET NULL"), nullable=True)

    last_message_text: Mapped[str | None] = mapped_column(String(512), nullable=True)
    last_message_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    messages: Mapped[list["CommMessage"]] = relationship(
        "CommMessage", back_populates="interaction", cascade="all, delete-orphan", order_by="CommMessage.created_at"
    )
    customer: Mapped["AppUser"] = relationship("AppUser", foreign_keys=[customer_id])
    seller: Mapped["AppUser"] = relationship("AppUser", foreign_keys=[seller_id])
    related_prod: Mapped["Prod | None"] = relationship("Prod", foreign_keys=[related_prod_id])


class CommMessage(Base):
    """
    TM Forum SID Communication Message (TMF681)
    Represents an individual message in a communication interaction.
    """
    __tablename__ = "comm_message"

    comm_message_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    comm_interaction_id: Mapped[int] = mapped_column(ForeignKey("comm_interaction.comm_interaction_id", ondelete="CASCADE"), nullable=False)
    sender_id: Mapped[int] = mapped_column(ForeignKey("app_user.user_id", ondelete="CASCADE"), nullable=False)
    sender_role: Mapped[str] = mapped_column(String(30), nullable=False)  # CUSTOMER, SELLER, SYSTEM, ADMIN
    content: Mapped[str] = mapped_column(Text, nullable=False)
    message_state: Mapped[str] = mapped_column(String(30), default="SENT", nullable=False)  # SENT, DELIVERED, READ, FAILED
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    interaction: Mapped["CommInteraction"] = relationship("CommInteraction", back_populates="messages")
    sender: Mapped["AppUser"] = relationship("AppUser", foreign_keys=[sender_id])
    attachments: Mapped[list["CommAttachment"]] = relationship(
        "CommAttachment", back_populates="message", cascade="all, delete-orphan"
    )


class CommAttachment(Base):
    """
    TM Forum SID Communication Attachment
    Represents file/image attachments linked to a communication message.
    """
    __tablename__ = "comm_attachment"

    comm_attachment_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    comm_message_id: Mapped[int] = mapped_column(ForeignKey("comm_message.comm_message_id", ondelete="CASCADE"), nullable=False)
    attachment_type: Mapped[str] = mapped_column(String(50), default="IMAGE", nullable=False)  # IMAGE, DOCUMENT, AUDIO
    url: Mapped[str] = mapped_column(String(1024), nullable=False)
    mime_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    file_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    message: Mapped["CommMessage"] = relationship("CommMessage", back_populates="attachments")
