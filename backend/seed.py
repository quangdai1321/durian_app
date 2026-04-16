"""
Auto-seed dữ liệu bệnh sầu riêng vào DB nếu chưa có.
Chạy tự động trong lifespan khi server khởi động.
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text


DISEASE_SEED = [
    {
        "code": "Leaf_Algal",
        "name_vi": "Bệnh đốm tảo",
        "name_en": "Algal Leaf Spot",
        "scientific": "Cephaleuros virescens",
        "severity": "low",
        "description_vi": "Bệnh do tảo ký sinh Cephaleuros virescens gây ra các đốm màu xanh xám hoặc cam gỉ sét trên bề mặt lá, thường gặp ở lá già trong vườn thiếu thông thoáng.",
        "description_en": "Disease caused by parasitic algae creating gray-green or rust-colored spots on leaves.",
        "cause_vi": "Do tảo ký sinh Cephaleuros virescens, phát triển mạnh trong điều kiện ẩm ướt và thiếu ánh sáng.",
        "cause_en": "Caused by the parasitic alga Cephaleuros virescens, thriving in humid conditions with poor sunlight.",
        "symptoms_vi": "Đốm tròn 3–10 mm màu xanh xám hoặc cam gỉ sét, có lớp nhung mịn trên bề mặt lá. Lá già bị nặng hơn lá non. Các đốm có thể liên kết thành mảng lớn khiến lá vàng và rụng sớm.",
        "season_vi": "Phát triển mạnh vào mùa mưa (tháng 5–11), đặc biệt trong vườn rậm rạp thiếu thông thoáng và độ ẩm không khí trên 80%.",
        "steps": [
            {"order": 1, "vi": "Cắt bỏ và tiêu hủy lá bị bệnh nặng.", "en": "Remove and destroy severely infected leaves."},
            {"order": 2, "vi": "Phun thuốc gốc đồng (Copper Oxychloride) 2-3 lần cách nhau 7-10 ngày.", "en": "Spray copper-based fungicide 2-3 times, 7-10 days apart."},
            {"order": 3, "vi": "Tỉa cành tạo thông thoáng, giảm ẩm độ vườn.", "en": "Prune branches to improve air circulation."},
        ],
    },
    {
        "code": "Leaf_Blight",
        "name_vi": "Bệnh cháy lá",
        "name_en": "Leaf Blight",
        "scientific": "Phytophthora palmivora",
        "severity": "high",
        "description_vi": "Bệnh nguy hiểm gây cháy lá nhanh chóng, vết bệnh màu nâu đen lan rộng từ mép lá vào trong, có thể gây rụng lá hàng loạt và chết cành nếu không xử lý kịp thời.",
        "description_en": "Disease causing rapid leaf blight with dark brown lesions spreading from leaf margins inward.",
        "cause_vi": "Do nấm Phytophthora palmivora, lây lan qua nước mưa và đất nhiễm bệnh.",
        "cause_en": "Caused by Phytophthora palmivora fungus, spread through rain splash and infected soil.",
        "symptoms_vi": "Vết bệnh bắt đầu ở mép hoặc chóp lá, màu xanh nhạt rồi nhanh chuyển nâu đen. Viền vàng xung quanh vết bệnh, lá héo và rụng chỉ sau 2–3 ngày. Bệnh nặng có thể lan sang cành và thân cây.",
        "season_vi": "Bùng phát mạnh đầu mùa mưa (tháng 4–6) và cuối mùa mưa (tháng 9–11), sau các đợt mưa lớn kéo dài ở nhiệt độ 25–30°C.",
        "steps": [
            {"order": 1, "vi": "Phun Metalaxyl hoặc Fosetyl-Al ngay khi phát hiện bệnh.", "en": "Spray Metalaxyl or Fosetyl-Al immediately upon detection."},
            {"order": 2, "vi": "Cắt tỉa và tiêu hủy toàn bộ lá, cành bị bệnh.", "en": "Prune and destroy all infected leaves and branches."},
            {"order": 3, "vi": "Tránh tưới nước lên lá, tưới gốc vào buổi sáng.", "en": "Avoid wetting leaves, water at the base in the morning."},
            {"order": 4, "vi": "Bón vôi xung quanh gốc để cải thiện pH đất.", "en": "Apply lime around the base to improve soil pH."},
        ],
    },
    {
        "code": "Leaf_Colletotrichum",
        "name_vi": "Bệnh thán thư",
        "name_en": "Anthracnose",
        "scientific": "Colletotrichum gloeosporioides",
        "severity": "moderate",
        "description_vi": "Bệnh thán thư gây các đốm nâu hình tròn hoặc bất định trên lá, thường có viền vàng đặc trưng. Phổ biến trong mùa mưa, lây lan nhanh qua bào tử phát tán theo gió và nước.",
        "description_en": "Circular to irregular brown lesions, often with yellow halos, causing leaf spots and tip dieback.",
        "cause_vi": "Do nấm Colletotrichum gloeosporioides, phổ biến trong mùa mưa và độ ẩm cao.",
        "cause_en": "Caused by Colletotrichum gloeosporioides, common during rainy seasons and high humidity.",
        "symptoms_vi": "Đốm nâu hình tròn đường kính 5–20 mm, viền vàng rõ ràng. Tâm đốm có chấm đen nhỏ li ti (bào tử nấm). Lá non bị nặng hơn lá già. Theo thời gian đốm khô, rách và lá rụng sớm.",
        "season_vi": "Phổ biến trong mùa mưa (tháng 5–10), đặc biệt sau các giai đoạn mưa nắng xen kẽ. Độ ẩm trên 85% và nhiệt độ 25–30°C là điều kiện thuận lợi nhất.",
        "steps": [
            {"order": 1, "vi": "Phun Carbendazim hoặc Thiophanate-methyl định kỳ 10-14 ngày/lần.", "en": "Spray Carbendazim or Thiophanate-methyl every 10-14 days."},
            {"order": 2, "vi": "Thu gom lá rụng và tiêu hủy để giảm nguồn bệnh.", "en": "Collect and destroy fallen leaves to reduce inoculum."},
            {"order": 3, "vi": "Bón phân cân đối, tăng cường kali để tăng sức đề kháng.", "en": "Apply balanced fertilizer, increase potassium to boost resistance."},
        ],
    },
    {
        "code": "Leaf_Healthy",
        "name_vi": "Lá khỏe mạnh",
        "name_en": "Healthy Leaf",
        "scientific": None,
        "severity": "none",
        "description_vi": "Lá sầu riêng khỏe mạnh, không có dấu hiệu bệnh. Màu xanh đồng đều, bề mặt láng bóng.",
        "description_en": "Healthy durian leaf with no disease signs. Uniform green color with glossy surface.",
        "cause_vi": None,
        "cause_en": None,
        "symptoms_vi": "Lá màu xanh đậm đồng đều, bề mặt láng bóng. Gân lá rõ ràng, phiến lá đầy đặn. Không có đốm, vết úa vàng hay mô chết bất thường.",
        "season_vi": None,
        "steps": [
            {"order": 1, "vi": "Tiếp tục chăm sóc định kỳ: tưới nước, bón phân, tỉa cành.", "en": "Continue regular care: watering, fertilizing, pruning."},
            {"order": 2, "vi": "Kiểm tra vườn định kỳ để phát hiện bệnh sớm.", "en": "Regularly inspect the garden for early disease detection."},
        ],
    },
    {
        "code": "Leaf_Phomopsis",
        "name_vi": "Bệnh khô đầu lá (Phomopsis)",
        "name_en": "Phomopsis Leaf Blight",
        "scientific": "Phomopsis durionis",
        "severity": "moderate",
        "description_vi": "Đầu và mép lá bị khô, chuyển màu nâu xám với ranh giới rõ ràng giữa mô bệnh và mô lành. Thường xuất hiện sau giai đoạn hạn hán khi cây bị stress thiếu nước.",
        "description_en": "Leaf tips and margins turn brown-gray with clear boundaries between infected and healthy tissue.",
        "cause_vi": "Do nấm Phomopsis durionis, thường xuất hiện sau giai đoạn khô hạn kéo dài.",
        "cause_en": "Caused by Phomopsis durionis fungus, often appearing after prolonged dry periods.",
        "symptoms_vi": "Đầu lá và mép lá khô nâu lan dần vào trong với ranh giới thẳng rõ ràng. Mô bệnh khô giòn dễ vỡ vụn. Thường bắt đầu từ chóp lá rồi lan xuống 2 bên mép. Lá bị nặng rụng sớm.",
        "season_vi": "Xuất hiện nhiều vào cuối mùa khô và đầu mùa mưa (tháng 3–5), sau các đợt hạn hán kéo dài khi cây bị stress thiếu nước.",
        "steps": [
            {"order": 1, "vi": "Phun Mancozeb hoặc Iprodione khi bệnh mới xuất hiện.", "en": "Spray Mancozeb or Iprodione at early infection stage."},
            {"order": 2, "vi": "Tưới nước đầy đủ, tránh để cây bị stress nước.", "en": "Ensure adequate irrigation, avoid water stress."},
            {"order": 3, "vi": "Bổ sung phân hữu cơ để cải thiện khả năng giữ ẩm đất.", "en": "Add organic matter to improve soil moisture retention."},
        ],
    },
    {
        "code": "Leaf_Rhizoctonia",
        "name_vi": "Bệnh lở cổ rễ / đốm lá Rhizoctonia",
        "name_en": "Rhizoctonia Leaf Spot",
        "scientific": "Rhizoctonia solani",
        "severity": "moderate",
        "description_vi": "Vết bệnh màu nâu đỏ, hình dạng bất định, thường xuất hiện ở phần lá tiếp xúc với đất hoặc lá già ở tầng dưới tán.",
        "description_en": "Reddish-brown irregular lesions, commonly on lower leaves or those in contact with soil.",
        "cause_vi": "Do nấm Rhizoctonia solani trong đất, lây lan qua tiếp xúc trực tiếp và nước tưới.",
        "cause_en": "Caused by soil-borne Rhizoctonia solani, spread through direct contact and irrigation water.",
        "symptoms_vi": "Vết nâu đỏ kích thước 10–30 mm, hình dạng không đều. Mô bệnh ban đầu ướt mềm sau đó khô lại. Buổi sáng sớm có thể thấy sợi nấm màu trắng trên vết bệnh. Thường xuất hiện ở lá gần mặt đất hoặc lá già tầng dưới.",
        "season_vi": "Phát sinh quanh năm nhưng nặng nhất vào mùa mưa (tháng 6–10) khi đất ẩm thường xuyên và vườn thoát nước kém.",
        "steps": [
            {"order": 1, "vi": "Phun Validamycin hoặc Hexaconazole vào vùng bị bệnh.", "en": "Spray Validamycin or Hexaconazole on affected areas."},
            {"order": 2, "vi": "Cải thiện thoát nước, tránh ngập úng.", "en": "Improve drainage to avoid waterlogging."},
            {"order": 3, "vi": "Không để lá chạm đất, tỉa lá già định kỳ.", "en": "Prevent leaves from touching soil, regularly remove old leaves."},
        ],
    },
]


async def seed_disease_classes(db: AsyncSession):
    """
    Chèn hoặc cập nhật dữ liệu bệnh và bước điều trị.
    Idempotent — chạy nhiều lần không bị lỗi.
    Các record đã có sẽ được UPDATE để sync nội dung mới nhất.
    """
    from .models.models import DiseaseClass, TreatmentStep

    for d in DISEASE_SEED:
        exists = (await db.execute(
            select(DiseaseClass).where(DiseaseClass.code == d["code"])
        )).scalar_one_or_none()

        if exists:
            # UPDATE các field mới (symptoms_vi, season_vi) và enrich description
            exists.description_vi = d["description_vi"]
            exists.cause_vi       = d["cause_vi"]
            exists.symptoms_vi    = d.get("symptoms_vi")
            exists.season_vi      = d.get("season_vi")
            db.add(exists)
            continue

        # INSERT mới
        disease = DiseaseClass(
            code=d["code"],
            name_vi=d["name_vi"],
            name_en=d["name_en"],
            scientific=d["scientific"],
            severity=d["severity"],
            description_vi=d["description_vi"],
            description_en=d["description_en"],
            cause_vi=d["cause_vi"],
            cause_en=d["cause_en"],
            symptoms_vi=d.get("symptoms_vi"),
            season_vi=d.get("season_vi"),
        )
        db.add(disease)
        await db.flush()

        for step in d["steps"]:
            db.add(TreatmentStep(
                disease_id=disease.id,
                step_order=step["order"],
                step_vi=step["vi"],
                step_en=step["en"],
            ))

    await db.commit()
    print("[Seed] Disease classes seeded/updated successfully.")
