"""
Restore original catalog: ~239 products + 43 bundles (pre-expansion state).
"""
import asyncio
import random
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))

import asyncpg
from app.core.config import get_settings

settings = get_settings()

SELLERS = [
    {"user_id": 22, "name": "Görkem Botanik & Sukulent"},
    {"user_id": 23, "name": "Burcu Çiçekçilik & Bahçe"},
]

# ---------------------------------------------------------------------------
# IMAGE POOLS
# ---------------------------------------------------------------------------
PLANT_IMAGES = [
    "https://images.unsplash.com/photo-1614594975525-e45190c55d0b?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1598880940371-c756e015fea1?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1632207691143-65f242566ec4?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1600411833196-7c1f6b1a8b90?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1525310072745-f49212b5ac6d?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1566630449174-8b65675f654b?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1520302638574-8957c555b6c0?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1459411621453-7b03977f4bfc?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1592150621744-aca64f48394a?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1512428559087-560fa5ceab42?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1599598425947-0382346747b0?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1593482892290-f54927ae1bf6?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1545241047-6083a3684587?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1588880331179-bc9b93a8cb5e?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1509423350716-97f9360b4e09?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1617173944883-6ffbd35d584d?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1618160702438-9b02ab6515c9?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1596547609652-9cf5d8d76921?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1534067783941-51c9c23ecefd?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1508610048659-a06b669e3321?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1519331379826-f10be5486c6f?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1508020963102-c6c723be9d37?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1563241527-3004b7be0ffd?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1591886960571-74d43a9d4166?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1509223197845-458d87318791?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1516205651411-aef33a44f7c2?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1572688484438-313a6e50c333?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1587334206596-a0586e3f4a9b?auto=format&fit=crop&w=800&q=80",
]

SUPPLY_IMAGES = [
    "https://images.unsplash.com/photo-1485955900006-10f4d324d411?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1449247709967-d4461a6a6103?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1584473457406-624048518851?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1533038590840-1cde6e668a91?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1593691509543-c55fb32e7355?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1616880991104-a690e72e12a1?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1565011523534-747a8601f10a?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1500651230702-0e2d8a49d4ad?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1528183429752-a97d0bf99b5a?auto=format&fit=crop&w=800&q=80",
]

# ---------------------------------------------------------------------------
# PLANTS (~100 species × 2 sellers = 200 products)
# ---------------------------------------------------------------------------
PLANTS = [
    # Yaprak Bitkiler (spec_id=1)
    ("Monstera Deliciosa (Devetabanı)", 1, 180, 650, 12, 15, 26),
    ("Monstera Adansonii (Maymun Maskesi)", 1, 110, 310, 12, 15, 26),
    ("Monstera Thai Constellation (Alacalı)", 1, 790, 2200, 11, 18, 26),
    ("ZZ Bitkisi (Zamioculcas Zamiifolia)", 1, 140, 460, 13, 17, 26),
    ("ZZ Raven (Siyah Yapraklı)", 1, 320, 720, 13, 17, 26),
    ("Philodendron Pink Princess", 1, 420, 1050, 12, 15, 26),
    ("Philodendron Birkin (Beyaz Çizgili)", 1, 160, 400, 12, 15, 26),
    ("Philodendron Brasil (Alacalı Sarmaşık)", 1, 110, 280, 12, 15, 26),
    ("Philodendron Micans (Kadife)", 1, 120, 300, 12, 15, 26),
    ("Golden Pothos (Altın Sarmaşık)", 1, 75, 230, 12, 15, 26),
    ("Marble Queen Pothos", 1, 100, 270, 12, 15, 26),
    ("Neon Pothos (Fosforlu Sarı Yeşil)", 1, 90, 250, 12, 15, 26),
    ("Calathea Medallion (Dua Çiçeği)", 1, 150, 380, 12, 16, 25),
    ("Calathea Orbifolia", 1, 220, 530, 12, 16, 25),
    ("Calathea Lancifolia", 1, 140, 350, 12, 16, 25),
    ("Maranta Leuconeura (Kırmızı Damarlı)", 1, 130, 325, 12, 16, 25),
    ("Aglaonema Silver Bay", 1, 170, 410, 13, 15, 26),
    ("Aglaonema Red Valentine", 1, 210, 495, 12, 15, 26),
    ("Dieffenbachia Camilla", 1, 110, 300, 12, 15, 26),
    ("Syngonium Neon Robusta (Pembe Kelebek)", 1, 100, 260, 12, 15, 26),
    ("Alocasia Polly (Fil Kulağı)", 1, 175, 435, 12, 16, 26),
    ("Alocasia Zebrina", 1, 270, 660, 12, 16, 26),
    ("Sansevieria Trifasciata Paşa Kılıcı", 1, 120, 375, 13, 17, 26),
    ("Sansevieria Laurentii Sarı Kenarlı", 1, 140, 410, 13, 17, 26),
    ("Sansevieria Moonshine Gümüş Ay Işığı", 1, 195, 475, 12, 17, 26),
    ("Sansevieria Cylindrica Silindir", 1, 165, 425, 13, 17, 26),
    ("Ficus Lyrata (Keman Yapraklı)", 1, 270, 1050, 11, 15, 26),
    ("Ficus Elastica Robusta (Kauçuk Ağacı)", 1, 160, 600, 12, 15, 26),
    ("Ficus Elastica Tineke (Alacalı Pembe)", 1, 200, 660, 11, 15, 26),
    ("Ficus Benjamina Exotica", 1, 175, 525, 11, 15, 26),
    # Çiçekli Bitkiler (spec_id=2)
    ("Phalaenopsis Beyaz Çift Dal Orkide", 2, 260, 630, 12, 15, 25),
    ("Phalaenopsis Mor Ebruli Orkide", 2, 270, 660, 12, 15, 25),
    ("Phalaenopsis Sarı Güneş Orkide", 2, 300, 700, 12, 15, 25),
    ("Mini Phalaenopsis Masaüstü Orkide", 2, 165, 375, 12, 15, 25),
    ("Spathiphyllum Barış Zambağı", 2, 135, 405, 13, 16, 26),
    ("Anthurium Kırmızı Flamingo Çiçeği", 2, 200, 520, 12, 16, 26),
    ("Anthurium Pembe Aşk Masalı", 2, 230, 560, 12, 16, 26),
    ("Gardenia Jasminoides Mis Kokulu", 2, 190, 475, 11, 16, 26),
    ("Ortanca Mavi Mor Açan", 2, 175, 435, 12, 16, 26),
    ("Afrika Menekşesi (Saintpaulia) Mor", 2, 65, 175, 12, 15, 25),
    ("Kalanchoe Blossfeldiana Kırmızı", 2, 55, 155, 11, 18, 26),
    ("Begonia Maculata (Puantiyeli Melek)", 2, 150, 370, 12, 15, 26),
    ("Kamelya Japonica Katmerli Kırmızı", 2, 260, 675, 12, 16, 26),
    # Kaktüsler (spec_id=3)
    ("Echinocactus Grusonii Altın Fıçı Kaktüs", 3, 80, 465, 11, 18, 25),
    ("Mammillaria Elongata Parmak Kaktüs", 3, 45, 155, 11, 18, 25),
    ("Gymnocalycium Mihanovichii Renkli Aşılı", 3, 65, 185, 11, 18, 25),
    ("Opuntia Microdasys Tavşan Kulağı", 3, 55, 175, 11, 18, 25),
    ("Euphorbia Trigona Kovboy Kaktüsü", 3, 160, 565, 11, 18, 26),
    ("Schlumbergera Yılbaşı Kaktüsü Kırmızı", 3, 75, 205, 12, 16, 25),
    # Sukulentler (spec_id=4)
    ("Echeveria Elegans Rozet Sukulent", 4, 40, 115, 11, 18, 25),
    ("Echeveria Lola Pastel Pembe", 4, 50, 135, 11, 18, 25),
    ("Echeveria Black Prince Siyah", 4, 60, 155, 11, 18, 25),
    ("Haworthia Fasciata Zebra", 4, 45, 125, 12, 18, 25),
    ("Haworthia Cooperi Şeffaf Pencereli", 4, 85, 235, 12, 18, 25),
    ("Crassula Ovata Yeşim Taşı", 4, 65, 250, 11, 18, 26),
    ("Aloe Vera Şifalı", 4, 70, 285, 11, 17, 26),
    ("Sedum Morganianum Eşek Kuyruğu", 4, 100, 285, 11, 18, 25),
    ("Senecio Rowleyanus İnci Tanesi", 4, 110, 315, 12, 18, 26),
    ("Ceropegia Woodii Kalp Kalbe Karşı", 4, 120, 330, 12, 18, 25),
    # Palmiyeler (spec_id=5)
    ("Areka Palmiyesi (Dypsis Lutescens)", 5, 265, 875, 12, 16, 25),
    ("Chamaedorea Elegans (Dağ Palmiyesi)", 5, 110, 335, 13, 15, 25),
    ("Howea Forsteriana (Kentia Palmiyesi)", 5, 625, 1875, 12, 15, 25),
    ("Dracaena Marginata 3 Gövdeli Dragon", 5, 175, 545, 12, 15, 26),
    ("Dracaena Fragrans Massangeana Şans", 5, 225, 665, 12, 15, 26),
    ("Pachira Aquatica Örgülü Para Ağacı", 5, 275, 835, 12, 15, 25),
    ("Ginseng Bonsai Ficus Microcarpa", 5, 225, 665, 11, 15, 26),
    # Dış Mekan & Fidanlar (spec_id=6)
    ("Fransız Lavantası (Lavandula Stoechas)", 6, 55, 165, 11, 17, 25),
    ("Taze Fesleğen Saksı Bitkisi", 6, 40, 105, 11, 16, 25),
    ("Kıvırcık Nane Saksı Bitkisi", 6, 35, 90, 11, 16, 25),
    ("Doğal Dağ Kekiği Saksı Bitkisi", 6, 40, 110, 11, 17, 25),
    ("Biberiye (Rosmarinus Officinalis)", 6, 50, 135, 11, 17, 25),
    ("Begonvil Pembe Çiçekli Sarmaşık", 6, 130, 410, 11, 16, 25),
    ("Sardunya Kırmızı Balkon Güzeli", 6, 45, 125, 11, 16, 26),
    ("Bodur Kumkuat Meyveli Ağaç", 6, 330, 875, 11, 16, 25),
    ("Mayer Limon Fidanı Meyveli", 6, 275, 765, 11, 16, 25),
    ("Masaüstü Bodur Zeytin Ağacı", 6, 245, 635, 11, 17, 25),
    # Ek bitkiler karışık
    ("Philodendron White Wizard Alacalı", 1, 395, 960, 12, 15, 26),
    ("Syngonium Albo Variegata Beyaz", 1, 260, 570, 12, 15, 26),
    ("Alocasia Black Velvet Siyah Kadife", 1, 225, 545, 12, 16, 26),
    ("Sansevieria Hahnii Kuş Yuvası", 1, 85, 225, 13, 17, 26),
    ("Crassula Ovata Gollum Shrek Kulağı", 4, 75, 275, 11, 18, 26),
    ("Aloe Aristata Dantelli Aloe", 4, 60, 185, 11, 17, 26),
    ("Dendrobium Nobile Kokulu Bahar Orkide", 2, 315, 760, 11, 15, 25),
    ("Cattleya Kraliyet Lüks Kokulu Orkide", 2, 465, 1175, 11, 15, 25),
    ("Spathiphyllum Sensation Dev Boy", 2, 340, 870, 12, 16, 26),
    ("Anthurium Clarinervium Kadife Beyaz", 2, 460, 1125, 12, 15, 26),
    ("Yucca Elephantipes Dev Avize", 5, 205, 705, 11, 17, 26),
    ("Cycas Revoluta Sago Paşa", 5, 360, 1175, 11, 17, 26),
    ("Zelkova Japon Bonsai", 5, 370, 930, 11, 15, 25),
    ("Carmona Fukien Tea Çiçekli Bonsai", 5, 345, 865, 11, 15, 25),
    ("Bodur Nar Ağacı Meyveli Fidan", 6, 225, 605, 11, 16, 25),
    ("Hanımeli Lonicera Nostaljik Sarmaşık", 6, 120, 355, 11, 16, 25),
    ("Açelya Rhododendron Pembe Çiçekli", 2, 160, 380, 12, 16, 26),
    ("Ortanca Pembe Gül Buketi Formlu", 2, 175, 440, 12, 16, 26),
    ("Yıldız Yasemin Trachelospermum Parfüm", 6, 150, 440, 11, 16, 25),
]

# ---------------------------------------------------------------------------
# SUPPLIES (~100 products × 1 seller each = 100 products)
# ---------------------------------------------------------------------------
SUPPLIES = [
    # Saksılar
    ("Doğal Terakota Sukulent Saksısı 12cm", 45, 120),
    ("Doğal Terakota Sukulent Saksısı 20cm", 85, 195),
    ("Doğal Terakota Bahçe Saksısı 30cm", 130, 370),
    ("Mat Siyah Silindir Seramik Saksı 14cm", 105, 285),
    ("Mat Siyah Silindir Seramik Saksı 22cm", 155, 355),
    ("Pastel Adaçayı Yeşili Çizgili Seramik 16cm", 115, 305),
    ("Mermer Desenli Altın Yaldızlı Seramik 20cm", 155, 385),
    ("Kendinden Fitilli Akıllı Sulama Saksısı 2L", 135, 355),
    ("Kendinden Fitilli Akıllı Sulama Saksısı 5L", 195, 445),
    ("Hasır Örgü Doğal Jüt Saksı Kılıfı 18cm", 70, 185),
    ("Hasır Örgü Doğal Jüt Saksı Kılıfı 25cm", 100, 235),
    ("Tavana Asılan Metal Çember Saksılık Siyah", 175, 415),
    ("Tavana Asılan Metal Çember Saksılık Altın", 195, 445),
    ("Hindistan Cevizi Lifli Balkon Askı 25cm", 90, 225),
    ("Masif Ahşap Ayarlanabilir Saksı Sehpası", 155, 375),
    ("Bambu 3 Katlı Dikey Merdiven Çiçeklik", 370, 875),
    ("Sırlı Oval Bonsai Saksısı 18cm", 165, 405),
    ("Şeffaf Orkide Saksısı ve Tabağı 13cm", 30, 80),
    ("Şeffaf Orkide Saksısı ve Tabağı 18cm", 50, 115),
    ("Akıllı Kumaş Dikim Torbası 10 Litre", 50, 135),
    ("Tekerlekli Ağır Saksı Taşıma Tablası 30cm", 125, 315),
    ("Tekerlekli Ağır Saksı Taşıma Tablası 40cm", 145, 345),
    # Toprak & Mineraller
    ("İthal Baltık Sphagnum Torfu 10L", 80, 255),
    ("İthal Baltık Sphagnum Torfu 20L", 140, 415),
    ("Sıkıştırılmış Cocopeat Hindistan Cevizi 10L", 55, 155),
    ("Sıkıştırılmış Cocopeat Hindistan Cevizi 25L", 95, 225),
    ("İri Taneli Steril Tarım Perliti 10L", 45, 135),
    ("İri Taneli Steril Tarım Perliti 20L", 75, 195),
    ("Altın Vermikülit Minerali 5L", 65, 175),
    ("Doğal Volkanik Ponza Taşı 5L", 60, 165),
    ("Kızıl Lav Taşı Kırığı 5L", 70, 185),
    ("Canlı Kurutulmuş Sphagnum Orkide Yosunu 200g", 90, 245),
    ("Steril Aktif Karbon Granülleri 300g", 75, 185),
    ("Kaktüs ve Sukulent Özel Toprak Karışımı 10L", 60, 155),
    ("Çam Kabuklu Doğal Orkide Harcı 5L", 50, 145),
    ("Tropikal Salon Bitkileri Premium Toprak 20L", 85, 225),
    # Gübreler & Sıvı Besinler
    ("Organik Sıvı Yeşil Yaprak Bitki Besini 500ml", 60, 175),
    ("Organik Sıvı Yeşil Yaprak Bitki Besini 1L", 95, 235),
    ("Çiçek Açtıran Sıvı Bitki Besini 500ml", 65, 185),
    ("Damlalıklı Konsantre Orkide Vitamini 300ml", 55, 155),
    ("Sıvı Kaktüs & Sukulent Besini 500ml", 50, 145),
    ("Doğal Sıvı Deniz Yosunu Ekstraktı 500ml", 90, 255),
    ("Şelatlı Sıvı Demir Gübresi Sararma Önleyici 250ml", 60, 170),
    ("Saf Soğuk Sıkım Organik Neem Yağı 250ml", 85, 235),
    ("Organik Sıvı Solucan Gübresi 1L", 70, 190),
    ("Yavaş Salınımlı Akıllı Gübre Tabletleri 30 Adet", 55, 145),
    # Aletler & Ekipmanlar
    ("Japon Karbon Çelik Hassas Budama Makası 18cm", 135, 355),
    ("Japon Karbon Çelik Budama Makası 21cm Büyük", 175, 415),
    ("Klasik Pirinç Ağızlıklı Metal Sulama İbiği 1.5L", 215, 535),
    ("Vintage Cam Bitki Nem Fısfısı 350ml", 90, 225),
    ("Toprak Nem Işık pH 3lü Ölçüm Cihazı", 125, 305),
    ("Bitki Gelişim LED Lambası Full Spectrum", 270, 715),
    ("Doğal Hindistan Cevizi Lifli Yosun Direği 60cm", 55, 155),
    ("Doğal Hindistan Cevizi Lifli Yosun Direği 90cm", 80, 195),
    ("Ahşap Standlı Cam Deney Tüpü Köklendirme İstasyonu 3lü", 115, 285),
    ("Mantar Kapaklı Geometrik Cam Terrarium 20cm", 185, 475),
    ("Diken Geçirmez Uzun Kollu Bahçe Eldiveni", 105, 255),
    ("Dairesel Metal Tırmanma Kafesi Trellis 30cm", 60, 165),
    ("Doğal Ahşap Bambu Bitki İsim Etiketleri 20 Adet", 35, 90),
    ("Dijital Ortam Nem & Sıcaklık Ölçer Higrometre", 90, 235),
    ("Katlanabilir Bahçe Maraşalı Set 3 Parça", 95, 235),
    ("Mini Bahçe El Küreği 22cm Ahşap Saplı", 45, 115),
    ("Mini Bahçe Çatalı 20cm Ahşap Saplı", 40, 105),
    ("Bambu El Bağlama İpi 50m Doğal", 25, 65),
    ("Bitki Tutturma Klibi Plastik 20 Adet", 20, 50),
    ("Çift Taraflı Yapıştırıcı Sarı Böcek Tuzağı 20 Adet", 35, 85),
]

# ---------------------------------------------------------------------------
# BUNDLES
# ---------------------------------------------------------------------------
BUNDLES = [
    ("🌱 Yeni Başlayanlar için Kolay Bakım Başlangıç Seti", "Kuraklığa ve gölgeye dayanıklı 3 bitki, özel toprak ve gübre seti. Bitki bakımına yeni başlayanlar için ideal.", "https://images.unsplash.com/photo-1545241047-6083a3684587?auto=format&fit=crop&w=800&q=80"),
    ("🏠 Salon Yeşillendirme Büyük Boy Ağaç Paketi", "Salon için Monstera, Areka Palmiyesi ve Ficus ile ortamınızı ormana çevirin. Kapsamlı bakım seti dahil.", "https://images.unsplash.com/photo-1520302638574-8957c555b6c0?auto=format&fit=crop&w=800&q=80"),
    ("🌺 Orkide Bakım ve Canlandırma Kiti", "Phalaenopsis orkide, çam kabuğu harcı, şeffaf saksı ve damlalıklı vitamin seti.", "https://images.unsplash.com/photo-1525310072745-f49212b5ac6d?auto=format&fit=crop&w=800&q=80"),
    ("🏜️ Sukulent ve Kaktüs Koleksiyon Sandığı", "5 farklı türde sukulent ve kaktüs, özel toprak ve terakota saksı seti.", "https://images.unsplash.com/photo-1614594975525-e45190c55d0b?auto=format&fit=crop&w=800&q=80"),
    ("🍳 Mutfak Şefi Aromatik Baharatlık Seti", "Pencere önü için canlı fesleğen, biberiye, nane ve taze kekik ile bahçe el aletleri.", "https://images.unsplash.com/photo-1632207691143-65f242566ec4?auto=format&fit=crop&w=800&q=80"),
    ("🎁 Yeni Ev Tebrik Yeşillendirme Sandığı", "Yeni eve taşınanlar için dev Monstera, terakota saksı ve özel toprak paketi.", "https://images.unsplash.com/photo-1512428559087-560fa5ceab42?auto=format&fit=crop&w=800&q=80"),
    ("🎂 Doğum Günü Özel Lüks Orkide Hediye Sandığı", "Zarif çift dal beyaz orkide, mermer saksı ve orkide vitamini ile VIP hediye kutusu.", "https://images.unsplash.com/photo-1509423350716-97f9360b4e09?auto=format&fit=crop&w=800&q=80"),
    ("🌙 Yatak Odası Hava Temizleyici Sağlık Paketi", "Gece oksijen üreten Paşa Kılıcı, Barış Zambağı ve Dağ Palmiyesi paketi.", "https://images.unsplash.com/photo-1592150621744-aca64f48394a?auto=format&fit=crop&w=800&q=80"),
    ("🧘 Zen Meditasyon ve Bonsai Huzur Köşesi", "Japon bonsai, hassas budama makası ve organik sıvı besin seti.", "https://images.unsplash.com/photo-1459411621453-7b03977f4bfc?auto=format&fit=crop&w=800&q=80"),
    ("🌿 Bohem Asma Bitkiler ve Makrome Köşesi", "Kalp kalbe karşı, inci tanesi, fosforlu sarmaşık ve el örgüsü jüt askılar.", "https://images.unsplash.com/photo-1508610048659-a06b669e3321?auto=format&fit=crop&w=800&q=80"),
    ("🌸 Anneler Günü Bahar Esintisi Paketi", "Fransız lavantası, mavi ortanca ve çiçek coşturan besin seti.", "https://images.unsplash.com/photo-1618160702438-9b02ab6515c9?auto=format&fit=crop&w=800&q=80"),
    ("💼 Yeni İş Terfi Masabaşı Prestij Kutusu", "Ofis masası için canlı Japon Bonsai, budama makası ve özel besin seti.", "https://images.unsplash.com/photo-1596547609652-9cf5d8d76921?auto=format&fit=crop&w=800&q=80"),
    ("🌴 Lüks Tropikal Salon Paketi", "Büyük boy tropikal bitkiler, dekoratif saksılar ve premium bakım ürünleri.", "https://images.unsplash.com/photo-1545241047-6083a3684587?auto=format&fit=crop&w=800&q=80"),
    ("🌞 Güneşsever Akdeniz Teras Paketi", "Bodur limon, zeytin fidanı ve kokulu lavanta ile balkon bahçesi.", "https://images.unsplash.com/photo-1520302638574-8957c555b6c0?auto=format&fit=crop&w=800&q=80"),
    ("🧪 Bitki Çoğaltma Propagasyon Laboratuvarı", "Deney tüpü köklendirme istasyonu, köklendirme hormonu ve makas seti.", "https://images.unsplash.com/photo-1525310072745-f49212b5ac6d?auto=format&fit=crop&w=800&q=80"),
    ("💡 Karanlık Odalar Grow Light & Bitki Kiti", "Full spectrum bitki LED lambası ve gölgeye dayanıklı salon bitkileri.", "https://images.unsplash.com/photo-1614594975525-e45190c55d0b?auto=format&fit=crop&w=800&q=80"),
    ("🪴 Akıllı Sulama Kendi Kendine Yeten Bahçe", "2 akıllı sulama saksısı ve su tutucu vermikülit torf harcı seti.", "https://images.unsplash.com/photo-1632207691143-65f242566ec4?auto=format&fit=crop&w=800&q=80"),
    ("🏺 Rustik Terakota ve Çöl Bitkileri Köşesi", "Doğal terakota saksılar, altın fıçı kaktüs ve volkanik mineraller.", "https://images.unsplash.com/photo-1512428559087-560fa5ceab42?auto=format&fit=crop&w=800&q=80"),
    ("🩺 Bitki Doktoru Kurtarma Canlandırma Çantası", "Sıvı demir, neem yağı, deniz yosunu ve 3lü toprak ölçüm cihazı.", "https://images.unsplash.com/photo-1509423350716-97f9360b4e09?auto=format&fit=crop&w=800&q=80"),
    ("🌧️ Tropikal Yağmur Ormanı Nemi Sarmaşık Paketi", "Monstera, Calathea, yosun direği ve vintage cam fısfıs seti.", "https://images.unsplash.com/photo-1592150621744-aca64f48394a?auto=format&fit=crop&w=800&q=80"),
    ("🏢 Ofis Masası Sevimli Mini Yeşillik Paketi", "Bilgisayar yanı için kaktüs, zebra sukulent ve dekoratif seramik saksı.", "https://images.unsplash.com/photo-1459411621453-7b03977f4bfc?auto=format&fit=crop&w=800&q=80"),
    ("👑 VIP Nadir Türler Koleksiyoncu Sandığı", "Thai Constellation, özel aroid toprak karışımı ve yosun direği.", "https://images.unsplash.com/photo-1508610048659-a06b669e3321?auto=format&fit=crop&w=800&q=80"),
    ("🎀 Pembe ve Alacalı Renkler Koleksiyonu", "Pink Princess, Pembe Syngonium ve Alacalı Kauçuk ağacı seti.", "https://images.unsplash.com/photo-1618160702438-9b02ab6515c9?auto=format&fit=crop&w=800&q=80"),
    ("🍊 Akdeniz Narenciye Balkon Meyve Bahçesi", "Bodur kumkuat, Mayer limon ve organik narenciye besini seti.", "https://images.unsplash.com/photo-1596547609652-9cf5d8d76921?auto=format&fit=crop&w=800&q=80"),
    # Evcil Hayvan Dostu
    ("🐾 Pati Dostu Güvenli Salon Yeşillendirme Paketi", "Kedi ve köpekler için %100 zehirsiz hava temizleyici bitki seti.", "https://images.unsplash.com/photo-1545241047-6083a3684587?auto=format&fit=crop&w=800&q=80"),
    ("🐱 Kedi Dostu Masabaşı Mini Bahçe Seti", "Evcil hayvanlar için güvenli taze nane, zebra sukulent ve şık saksı.", "https://images.unsplash.com/photo-1520302638574-8957c555b6c0?auto=format&fit=crop&w=800&q=80"),
    ("🐕 Pati Güvenli Hava Temizleyici Yatak Odası Paketi", "Toksik madde içermeyen hava temizleyici salon bitkileri kombinasyonu.", "https://images.unsplash.com/photo-1525310072745-f49212b5ac6d?auto=format&fit=crop&w=800&q=80"),
    ("🌿 Kedi Çimi & Canlı Aromatik Şifa Kutusu", "Sindirim destekleyen taze aromatik canlı bitki ve saksı seti.", "https://images.unsplash.com/photo-1614594975525-e45190c55d0b?auto=format&fit=crop&w=800&q=80"),
    # Ek özel paketler
    ("☕ Pazar Kahvesi Balkon Bahçesi Hediye Kutusu", "Mutfak fesleğeni, biberiye, dağ kekiği ve mini bahçe el aletleri.", "https://images.unsplash.com/photo-1632207691143-65f242566ec4?auto=format&fit=crop&w=800&q=80"),
    ("🎓 Öğretmenler Günü Teşekkür Yeşil Hediye Seti", "Dayanıklı ZZ bitkisi, dekoratif ayaklı saksı ve bakım ürünleri.", "https://images.unsplash.com/photo-1512428559087-560fa5ceab42?auto=format&fit=crop&w=800&q=80"),
    ("🌟 VIP Bitki Koleksiyoneri Doğum Günü Sandığı", "Nadir Philodendron, deney tüpü köklendirme istasyonu ve deniz yosunu.", "https://images.unsplash.com/photo-1509423350716-97f9360b4e09?auto=format&fit=crop&w=800&q=80"),
    ("💖 Yıldönümüne Özel Romantik Çiçek Sepeti", "Pembe orkide, kırmızı flamingo çiçeği ve vintage cam fısfıs seti.", "https://images.unsplash.com/photo-1592150621744-aca64f48394a?auto=format&fit=crop&w=800&q=80"),
    ("🎀 Doğum Günü Sürpriz Mini Bitki Koleksiyonu", "5 farklı cins mini sukulent, terakota saksılar ve el yapımı kutuda.", "https://images.unsplash.com/photo-1459411621453-7b03977f4bfc?auto=format&fit=crop&w=800&q=80"),
    ("🌸 Dört Mevsim Çiçek Açan Salon Bahçesi", "Orkide, Flamingo Çiçeği, Açelya ve çiçek coşturan besin seti.", "https://images.unsplash.com/photo-1508610048659-a06b669e3321?auto=format&fit=crop&w=800&q=80"),
    ("🏡 Balkon Dönüşüm Paketi Komple Set", "Balkon için sarmaşık, asma saksı, hanımeli ve teras fidanı seti.", "https://images.unsplash.com/photo-1618160702438-9b02ab6515c9?auto=format&fit=crop&w=800&q=80"),
    ("🌱 Eksiksiz Topraksız Hidroponik Başlangıç", "Su kültürü deney seti, köklendirme istasyonu ve bitki besini.", "https://images.unsplash.com/photo-1596547609652-9cf5d8d76921?auto=format&fit=crop&w=800&q=80"),
    ("🌵 Çöl Esintisi Kaktüs Bahçesi Seti", "Farklı boyutlarda 4 kaktüs, kaktüs toprağı ve ponza taşı seti.", "https://images.unsplash.com/photo-1545241047-6083a3684587?auto=format&fit=crop&w=800&q=80"),
    ("💚 Nefes Alan Yaşayan Duvar Dikey Bahçe Seti", "Dikey bahçe çerçevesi, 6 mini bitki ve özel toprak paketi.", "https://images.unsplash.com/photo-1520302638574-8957c555b6c0?auto=format&fit=crop&w=800&q=80"),
    ("🦋 Kelebek Bahçesi Aromatik Çiçek Seti", "Lavanta, kelebek çiçeği ve sardunya ile balkon ekosistemleri.", "https://images.unsplash.com/photo-1525310072745-f49212b5ac6d?auto=format&fit=crop&w=800&q=80"),
    ("🧪 DNA Çoğaltma Bitki Laboratuvarı Kiti", "Şeffaf cam köklendirme, vermikülit minerali ve makas seti.", "https://images.unsplash.com/photo-1614594975525-e45190c55d0b?auto=format&fit=crop&w=800&q=80"),
    ("🌴 Palm & Tropikal Otel Lobi Büyük Set", "Büyük kentia palmiyesi, areka ve dracaena lobi bitkisi paketi.", "https://images.unsplash.com/photo-1632207691143-65f242566ec4?auto=format&fit=crop&w=800&q=80"),
    ("🍋 Turunçgiller Mutfak Penceresi Seti", "Mini limon, kumkuat ve portakal bitkisi ile taze aroma seti.", "https://images.unsplash.com/photo-1512428559087-560fa5ceab42?auto=format&fit=crop&w=800&q=80"),
    ("🌺 Tropikal Çiçek Açan Bitkiler Koleksiyonu", "Anthurium, Gardenia ve Ortanca üçlüsü, besin ve saksı seti.", "https://images.unsplash.com/photo-1509423350716-97f9360b4e09?auto=format&fit=crop&w=800&q=80"),
]


async def main():
    conn = await asyncpg.connect(
        host=settings.DB_HOST, port=settings.DB_PORT, database=settings.DB_NAME,
        user=settings.DB_USERNAME, password=settings.DB_PASSWORD,
        ssl="require" if "supabase.co" in settings.DB_HOST else None
    )

    try:
        print("=== ORİJİNAL KATALOG GERİ YÜKLEME BAŞLATILIYOR ===")

        # 1. Temizle
        await conn.execute("DELETE FROM bundle_item")
        await conn.execute("DELETE FROM bundle")
        await conn.execute("DELETE FROM prod_char_val")
        await conn.execute("DELETE FROM review")
        await conn.execute("DELETE FROM complaint")
        await conn.execute("DELETE FROM prod")
        print("[OK] Eski kayıtlar temizlendi.")

        # 2. BİTKİLER — her tür 2 satıcıya ekleniyor
        created_plants = []
        for idx, (name, spec_id, min_p, max_p, light, water, pet) in enumerate(PLANTS):
            for s_idx, seller in enumerate(SELLERS):
                price = round(random.uniform(min_p, max_p) * (0.97 if s_idx == 0 else 1.03), 2)
                stock = random.randint(15, 90)
                img = PLANT_IMAGES[(idx * 2 + s_idx) % len(PLANT_IMAGES)]
                desc = f"Özenle yetiştirilmiş {name}. {seller['name']} güvencesiyle sağlıklı kök yapısıyla gönderilir."

                row = await conn.fetchrow(
                    """
                    INSERT INTO prod (name, description, price, stock, gnl_st_id, seller_id, prod_spec_id, category, image_url, is_active)
                    VALUES ($1, $2, $3, $4, 1, $5, $6, 'plant', $7, true)
                    RETURNING prod_id
                    """,
                    name, desc, price, stock, seller["user_id"], spec_id, img
                )
                prod_id = row["prod_id"]
                created_plants.append({"prod_id": prod_id, "name": name, "price": price, "img": img})

                # Karakteristikler
                color_val = 4 if "Pembe" in name or "Mor" in name else (5 if "Alacalı" in name or "Variegat" in name else 1)
                size_val = 9 if "Dev" in name or "Büyük" in name else (7 if "Mini" in name or "Masaüstü" in name else 8)

                for (char_id, val_id) in [
                    (1, color_val),
                    (2, size_val),
                    (3, light),
                    (4, water),
                    (5, 20 if spec_id == 6 else 19),
                    (6, 22 if pet == 25 or "Sansevieria" in name or "ZZ" in name or "Pothos" in name else 23),
                    (7, pet),
                ]:
                    await conn.execute(
                        "INSERT INTO prod_char_val (prod_id, prod_spec_id, gnl_char_id, gnl_char_val_id) VALUES ($1, $2, $3, $4)",
                        prod_id, spec_id, char_id, val_id
                    )

        print(f"[OK] {len(created_plants)} adet Bitki & Çiçek oluşturuldu.")

        # 3. MALZEMELER — her ürün rastgele 1 satıcıya (sırayla)
        created_supplies = []
        for idx, (name, min_p, max_p) in enumerate(SUPPLIES):
            seller = SELLERS[idx % len(SELLERS)]
            price = round(random.uniform(min_p, max_p), 2)
            stock = random.randint(25, 120)
            img = SUPPLY_IMAGES[idx % len(SUPPLY_IMAGES)]
            desc = f"Bitkileriniz için yüksek kaliteli {name}. {seller['name']} garantili orijinal ürün."

            row = await conn.fetchrow(
                """
                INSERT INTO prod (name, description, price, stock, gnl_st_id, seller_id, prod_spec_id, category, image_url, is_active)
                VALUES ($1, $2, $3, $4, 1, $5, 7, 'supply', $6, true)
                RETURNING prod_id
                """,
                name, desc, price, stock, seller["user_id"], img
            )
            created_supplies.append({"prod_id": row["prod_id"], "name": name, "price": price, "img": img})

        print(f"[OK] {len(created_supplies)} adet Malzeme & Ekipman oluşturuldu.")

        # 4. PAKETLER
        all_prods = created_plants + created_supplies
        for b_idx, (title, desc, cover) in enumerate(BUNDLES):
            b_row = await conn.fetchrow(
                "INSERT INTO bundle (title, description, image_url, is_active) VALUES ($1, $2, $3, true) RETURNING bundle_id",
                title, desc, cover
            )
            bundle_id = b_row["bundle_id"]
            # 3-4 ürün ekle
            picked = random.sample(all_prods, min(4, len(all_prods)))
            seen = set()
            for p in picked:
                if p["prod_id"] in seen:
                    continue
                seen.add(p["prod_id"])
                qty = random.choice([1, 1, 1, 2])
                await conn.execute(
                    "INSERT INTO bundle_item (bundle_id, prod_id, quantity) VALUES ($1, $2, $3)",
                    bundle_id, p["prod_id"], qty
                )

        print(f"[OK] {len(BUNDLES)} adet Hazır Paket oluşturuldu.")

        # Sonuç
        total = await conn.fetchval("SELECT COUNT(*) FROM prod")
        plants = await conn.fetchval("SELECT COUNT(*) FROM prod WHERE category = 'plant'")
        supplies = await conn.fetchval("SELECT COUNT(*) FROM prod WHERE category = 'supply'")
        bundles = await conn.fetchval("SELECT COUNT(*) FROM bundle")

        print("\n==========================================")
        print(" ORİJİNAL KATALOG BAŞARIYLA GERİ YÜKLENDİ")
        print("==========================================")
        print(f"Toplam Ürün   : {total}")
        print(f"  Çiçek/Bitki : {plants}")
        print(f"  Malzeme     : {supplies}")
        print(f"Paket         : {bundles}")
        print("==========================================")

    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
