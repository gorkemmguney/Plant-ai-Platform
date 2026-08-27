import asyncio
from sqlalchemy import select
from app.db.session import AsyncSessionLocal
from app.models.user import AppUser
from app.models.complaint import Complaint

async def main():
    async with AsyncSessionLocal() as db:
        # Mevcut kullanıcıları kontrol edelim
        res = await db.execute(select(AppUser))
        users = res.scalars().all()
        if not users:
            print("Kullanıcı bulunamadı. Deneme kullanıcıları oluşturuluyor...")
            cust = AppUser(
                supabase_uid="dummy_customer_uid_123",
                first_name="Görkem",
                last_name="Müşteri",
                email="gorkem_customer@example.com",
                is_active=True
            )
            admin = AppUser(
                supabase_uid="dummy_admin_uid_456",
                first_name="Hakan",
                last_name="Yönetici",
                email="hakan_admin@example.com",
                is_active=True
            )

            db.add(cust)
            db.add(admin)
            await db.commit()
            await db.refresh(cust)
            await db.refresh(admin)
            users = [cust, admin]
        
        cust = users[0]
        
        # Temizle (eski deneme verilerini silip yeniden ekleyelim)
        await db.execute(select(Complaint))
        # Clear existing ones
        from sqlalchemy import delete
        await db.execute(delete(Complaint))
        await db.commit()
        
        # Deneme şikayetleri ekleyelim (AI alanları doldurulmuş olarak)
        complaints = [
            Complaint(
                user_id=cust.user_id,
                complaint_type="general",
                title="Mobil uygulamada yavaşlık sorunu",
                description="Market sayfasındaki ürünler yüklenirken bazen 10 saniyeden fazla bekletiyor. İnternet hızım iyi olmasına rağmen bu sorunu yaşıyorum.",
                status="pending",
                sentiment="neutral",
                urgency="medium",
                ai_summary="Müşteri market sayfasındaki ürün yükleme sürelerinin uzunluğundan ve yavaşlığından şikayetçi.",
                ai_tags="yavaşlık, mobil_uygulama, market"
            ),
            Complaint(
                user_id=cust.user_id,
                complaint_type="general",
                title="AI analiz hatası",
                description="Yüklediğim domates yaprağı fotoğrafını teşhis edemedi, hata verdi.",
                status="in_progress",
                admin_note="AI model güncellemelerini kontrol ediyoruz.",
                sentiment="sad",
                urgency="medium",
                ai_summary="Kullanıcı yüklediği domates yaprağı görselinin yapay zeka tarafından teşhis edilemediğini bildiriyor.",
                ai_tags="ai_analizi, teşhis_hatası, domates"
            ),
            Complaint(
                user_id=cust.user_id,
                complaint_type="seller",
                title="Satıcı kargoyu göndermedi",
                description="4 gün önce sipariş ettiğim bitki hala kargoya verilmedi. Satıcı mesajlara da cevap vermiyor. Paramın iade edilmesini istiyorum!",
                status="pending",
                sentiment="angry",
                urgency="high",
                ai_summary="Kullanıcı 4 gün önce sipariş ettiği bitkinin kargolanmadığını, satıcının mesajlara dönmediğini belirterek para iadesi talep ediyor.",
                ai_tags="kargo_gecikmesi, iade_talebi, satıcı_iletişimsizliği"
            ),
            Complaint(
                user_id=cust.user_id,
                complaint_type="product",
                title="Solmuş Çiçek Gönderimi",
                description="Satın aldığım orkide tamamen solmuş ve yaprakları dökülmüş olarak geldi.",
                status="resolved",
                admin_note="Kullanıcıya para iadesi yapıldı ve satıcı uyarıldı.",
                sentiment="sad",
                urgency="high",
                ai_summary="Müşteri satın aldığı orkidenin solmuş ve yaprakları dökülmüş olarak ulaştığını bildirmiş.",
                ai_tags="hasarlı_ürün, solmuş_çiçek, orkide"
            )
        ]
        db.add_all(complaints)
        await db.commit()
        print("Gelişmiş deneme şikayet verileri (AI alanları dahil) başarıyla yüklendi!")

if __name__ == "__main__":
    asyncio.run(main())
