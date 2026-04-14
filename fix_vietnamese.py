import pyodbc

conn = pyodbc.connect(
    "DRIVER={ODBC Driver 17 for SQL Server};"
    "SERVER=W00153656\\SQLEXPRESS;"
    "DATABASE=Durian;"
    "Trusted_Connection=yes;"
    "TrustServerCertificate=yes;"
)
cur = conn.cursor()

# ── disease_classes ─────────────────────────────────────────────────────────
diseases = [
    ("Leaf_Algal",
     "Bệnh đốm tảo", "Algal Leaf Spot", "Cephaleuros virescens",
     "Do tảo ký sinh Cephaleuros virescens gây ra, phát triển mạnh trong điều kiện ẩm ướt và thiếu ánh sáng.",
     "Caused by the parasitic alga Cephaleuros virescens, thrives in humid conditions with poor sunlight.",
     "low"),

    ("Leaf_Blight",
     "Bệnh cháy lá", "Leaf Blight", "Phytophthora palmivora",
     "Do nấm Phytophthora palmivora gây ra, lây lan nhanh trong mùa mưa, gây thối và cháy lá hàng loạt.",
     "Caused by Phytophthora palmivora, spreads rapidly during rainy season causing widespread leaf rot and blight.",
     "high"),

    ("Leaf_Colletotrichum",
     "Bệnh đốm Colletotrichum", "Colletotrichum Leaf Spot", "Colletotrichum gloeosporioides",
     "Do nấm Colletotrichum gloeosporioides gây ra, tấn công lá non, tạo vết đốm nâu viền vàng, lây lan qua bào tử.",
     "Caused by Colletotrichum gloeosporioides, attacks young leaves forming brown spots with yellow halos, spreads via spores.",
     "moderate"),

    ("Leaf_Healthy",
     "Lá khỏe mạnh", "Healthy Leaf", "Durio zibethinus",
     None, None, "low"),

    ("Leaf_Phomopsis",
     "Bệnh Phomopsis", "Phomopsis Blight", "Phomopsis durionis",
     "Do nấm Phomopsis durionis gây ra, xâm nhiễm qua vết thương hoặc khí khổng, tạo vết đốm tròn có viền sẫm màu.",
     "Caused by Phomopsis durionis, infects through wounds or stomata, forming circular spots with dark borders.",
     "moderate"),

    ("Leaf_Rhizoctonia",
     "Bệnh Rhizoctonia", "Rhizoctonia Blight", "Rhizoctonia solani",
     "Do nấm Rhizoctonia solani trong đất gây ra, tấn công cổ rễ và phần gốc cây, gây thối rễ và héo lá đột ngột.",
     "Caused by soil-borne Rhizoctonia solani, attacks root crown and stem base, causing root rot and sudden wilting.",
     "high"),
]

for (code, name_vi, name_en, sci, cause_vi, cause_en, sev) in diseases:
    cur.execute("""
        UPDATE disease_classes
        SET name_vi=?, name_en=?, scientific=?, cause_vi=?, cause_en=?, severity=?
        WHERE code=?
    """, name_vi, name_en, sci, cause_vi, cause_en, sev, code)
    print(f"  Updated {code}: {name_vi}")

# ── treatment_steps ──────────────────────────────────────────────────────────
steps = [
    # Leaf_Algal (id=1)
    (1, 1, "Cắt bỏ và tiêu hủy các lá bị nhiễm bệnh nặng",
           "Remove and destroy severely infected leaves", None),
    (1, 2, "Phun thuốc gốc đồng (Bordeaux 1%) định kỳ 2 tuần/lần",
           "Spray copper-based fungicide (1% Bordeaux) every 2 weeks",
           "Bordeaux mixture 1%, Copper oxychloride"),
    (1, 3, "Cải thiện thông gió vườn, tỉa cành tạo tán thưa",
           "Improve ventilation, prune to open canopy", None),
    (1, 4, "Bón phân cân đối, tránh bón quá nhiều đạm",
           "Apply balanced fertilizer, avoid excess nitrogen", None),

    # Leaf_Blight (id=2)
    (2, 1, "Cắt bỏ ngay các cành và lá bị bệnh, đốt tiêu hủy",
           "Immediately remove and burn infected branches and leaves", None),
    (2, 2, "Phun Metalaxyl + Mancozeb theo liều khuyến cáo",
           "Apply Metalaxyl + Mancozeb at recommended doses",
           "Metalaxyl + Mancozeb (Ridomil Gold MZ)"),
    (2, 3, "Thoát nước tốt xung quanh gốc cây, không để đọng nước",
           "Ensure good drainage, prevent waterlogging", None),
    (2, 4, "Phun phòng định kỳ vào đầu mùa mưa",
           "Apply preventive spray at start of rainy season",
           "Phosphorous acid, Dimethomorph"),

    # Leaf_Colletotrichum (id=3)
    (3, 1, "Cắt tỉa lá bệnh và tiêu hủy đúng cách",
           "Prune and properly dispose of infected leaves", None),
    (3, 2, "Phun Thiophanate-methyl hoặc Azoxystrobin 2 lần cách 7 ngày",
           "Apply Thiophanate-methyl or Azoxystrobin twice, 7 days apart",
           "Thiophanate-methyl, Azoxystrobin"),
    (3, 3, "Tăng cường thoát nước, tránh tưới nước lên tán lá",
           "Improve drainage, avoid overhead irrigation", None),
    (3, 4, "Bón vôi để cân bằng pH đất, tăng sức đề kháng cây",
           "Apply lime to balance soil pH and boost plant resistance", None),

    # Leaf_Phomopsis (id=5)
    (5, 1, "Thu gom và đốt lá rụng, cành khô bị nhiễm bệnh",
           "Collect and burn fallen leaves and infected dry branches", None),
    (5, 2, "Phun Iprodione hoặc Procymidone theo hướng dẫn",
           "Apply Iprodione or Procymidone as directed",
           "Iprodione (Rovral), Procymidone"),
    (5, 3, "Vệ sinh vườn sạch sẽ sau thu hoạch, dọn tàn dư thực vật",
           "Clean orchard after harvest, remove plant debris", None),
    (5, 4, "Bổ sung kali và canxi để tăng sức đề kháng",
           "Supplement potassium and calcium to increase resistance", "KCl, CaCO3"),

    # Leaf_Rhizoctonia (id=6)
    (6, 1, "Nhổ bỏ và tiêu hủy cây con bị chết, không để lây lan",
           "Remove and destroy dead seedlings to prevent spread", None),
    (6, 2, "Xử lý đất bằng Validamycin hoặc PCNB trước khi trồng",
           "Treat soil with Validamycin or PCNB before planting",
           "Validamycin (Validacin), PCNB"),
    (6, 3, "Tưới nước vừa phải, tránh đất quá ẩm và úng nước",
           "Water moderately, avoid waterlogged or overly moist soil", None),
    (6, 4, "Sử dụng giống kháng bệnh, khử trùng dụng cụ làm vườn",
           "Use disease-resistant varieties, sterilize gardening tools", None),
]

for (did, sorder, step_vi, step_en, chemical) in steps:
    cur.execute("""
        UPDATE treatment_steps
        SET step_vi=?, step_en=?, chemical=?
        WHERE disease_id=? AND step_order=?
    """, step_vi, step_en, chemical, did, sorder)
    print(f"  Step disease={did} order={sorder}: {step_vi[:30]}...")

conn.commit()
cur.close()
conn.close()
print("\nAll Vietnamese text updated successfully!")
