-- Fix Vietnamese encoding in disease_classes
UPDATE disease_classes SET
  name_vi    = N'Bệnh đốm tảo',
  name_en    = N'Algal Leaf Spot',
  scientific = N'Cephaleuros virescens',
  cause_vi   = N'Do tảo ký sinh Cephaleuros virescens gây ra, phát triển mạnh trong điều kiện ẩm ướt và thiếu ánh sáng.',
  cause_en   = N'Caused by the parasitic alga Cephaleuros virescens, thrives in humid conditions with poor sunlight.',
  severity   = N'low'
WHERE code = N'Leaf_Algal';

UPDATE disease_classes SET
  name_vi    = N'Bệnh cháy lá',
  name_en    = N'Leaf Blight',
  scientific = N'Phytophthora palmivora',
  cause_vi   = N'Do nấm Phytophthora palmivora gây ra, lây lan nhanh trong mùa mưa, gây thối và cháy lá hàng loạt.',
  cause_en   = N'Caused by Phytophthora palmivora, spreads rapidly during rainy season causing widespread leaf rot and blight.',
  severity   = N'high'
WHERE code = N'Leaf_Blight';

UPDATE disease_classes SET
  name_vi    = N'Bệnh đốm Colletotrichum',
  name_en    = N'Colletotrichum Leaf Spot',
  scientific = N'Colletotrichum gloeosporioides',
  cause_vi   = N'Do nấm Colletotrichum gloeosporioides gây ra, tấn công lá non, tạo vết đốm nâu viền vàng, lây lan qua bào tử.',
  cause_en   = N'Caused by Colletotrichum gloeosporioides, attacks young leaves forming brown spots with yellow halos, spreads via spores.',
  severity   = N'moderate'
WHERE code = N'Leaf_Colletotrichum';

UPDATE disease_classes SET
  name_vi    = N'Lá khỏe mạnh',
  name_en    = N'Healthy Leaf',
  scientific = N'Durio zibethinus',
  cause_vi   = NULL,
  cause_en   = NULL,
  severity   = N'low'
WHERE code = N'Leaf_Healthy';

UPDATE disease_classes SET
  name_vi    = N'Bệnh Phomopsis',
  name_en    = N'Phomopsis Blight',
  scientific = N'Phomopsis durionis',
  cause_vi   = N'Do nấm Phomopsis durionis gây ra, xâm nhiễm qua vết thương hoặc khí khổng, tạo vết đốm tròn có viền sẫm màu.',
  cause_en   = N'Caused by Phomopsis durionis, infects through wounds or stomata, forming circular spots with dark borders.',
  severity   = N'moderate'
WHERE code = N'Leaf_Phomopsis';

UPDATE disease_classes SET
  name_vi    = N'Bệnh Rhizoctonia',
  name_en    = N'Rhizoctonia Blight',
  scientific = N'Rhizoctonia solani',
  cause_vi   = N'Do nấm Rhizoctonia solani trong đất gây ra, tấn công cổ rễ và phần gốc cây, gây thối rễ và héo lá đột ngột.',
  cause_en   = N'Caused by soil-borne Rhizoctonia solani, attacks root crown and stem base, causing root rot and sudden wilting.',
  severity   = N'high'
WHERE code = N'Leaf_Rhizoctonia';

-- Fix Vietnamese in treatment_steps
-- Leaf_Algal (disease_id = 1)
UPDATE treatment_steps SET
  step_vi = N'Cắt bỏ và tiêu hủy các lá bị nhiễm bệnh nặng',
  step_en = N'Remove and destroy severely infected leaves'
WHERE disease_id = 1 AND step_order = 1;

UPDATE treatment_steps SET
  step_vi  = N'Phun thuốc gốc đồng (Bordeaux 1%) định kỳ 2 tuần/lần',
  step_en  = N'Spray copper-based fungicide (1% Bordeaux) every 2 weeks',
  chemical = N'Bordeaux mixture 1%, Copper oxychloride'
WHERE disease_id = 1 AND step_order = 2;

UPDATE treatment_steps SET
  step_vi = N'Cải thiện thông gió vườn, tỉa cành tạo tán thưa',
  step_en = N'Improve ventilation, prune to open canopy'
WHERE disease_id = 1 AND step_order = 3;

UPDATE treatment_steps SET
  step_vi = N'Bón phân cân đối, tránh bón quá nhiều đạm',
  step_en = N'Apply balanced fertilizer, avoid excess nitrogen'
WHERE disease_id = 1 AND step_order = 4;

-- Leaf_Blight (disease_id = 2)
UPDATE treatment_steps SET
  step_vi = N'Cắt bỏ ngay các cành và lá bị bệnh, đốt tiêu hủy',
  step_en = N'Immediately remove and burn infected branches and leaves'
WHERE disease_id = 2 AND step_order = 1;

UPDATE treatment_steps SET
  step_vi  = N'Phun Metalaxyl + Mancozeb theo liều khuyến cáo',
  step_en  = N'Apply Metalaxyl + Mancozeb at recommended doses',
  chemical = N'Metalaxyl + Mancozeb (Ridomil Gold MZ)'
WHERE disease_id = 2 AND step_order = 2;

UPDATE treatment_steps SET
  step_vi = N'Thoát nước tốt xung quanh gốc cây, không để đọng nước',
  step_en = N'Ensure good drainage, prevent waterlogging'
WHERE disease_id = 2 AND step_order = 3;

UPDATE treatment_steps SET
  step_vi  = N'Phun phòng định kỳ vào đầu mùa mưa',
  step_en  = N'Apply preventive spray at start of rainy season',
  chemical = N'Phosphorous acid, Dimethomorph'
WHERE disease_id = 2 AND step_order = 4;

-- Leaf_Colletotrichum (disease_id = 3)
UPDATE treatment_steps SET
  step_vi = N'Cắt tỉa lá bệnh và tiêu hủy đúng cách',
  step_en = N'Prune and properly dispose of infected leaves'
WHERE disease_id = 3 AND step_order = 1;

UPDATE treatment_steps SET
  step_vi  = N'Phun Thiophanate-methyl hoặc Azoxystrobin 2 lần cách 7 ngày',
  step_en  = N'Apply Thiophanate-methyl or Azoxystrobin twice, 7 days apart',
  chemical = N'Thiophanate-methyl, Azoxystrobin'
WHERE disease_id = 3 AND step_order = 2;

UPDATE treatment_steps SET
  step_vi = N'Tăng cường thoát nước, tránh tưới nước lên tán lá',
  step_en = N'Improve drainage, avoid overhead irrigation'
WHERE disease_id = 3 AND step_order = 3;

UPDATE treatment_steps SET
  step_vi = N'Bón vôi để cân bằng pH đất, tăng sức đề kháng cây',
  step_en = N'Apply lime to balance soil pH and boost plant resistance'
WHERE disease_id = 3 AND step_order = 4;

-- Leaf_Phomopsis (disease_id = 5)
UPDATE treatment_steps SET
  step_vi = N'Thu gom và đốt lá rụng, cành khô bị nhiễm bệnh',
  step_en = N'Collect and burn fallen leaves and infected dry branches'
WHERE disease_id = 5 AND step_order = 1;

UPDATE treatment_steps SET
  step_vi  = N'Phun Iprodione hoặc Procymidone theo hướng dẫn',
  step_en  = N'Apply Iprodione or Procymidone as directed',
  chemical = N'Iprodione (Rovral), Procymidone'
WHERE disease_id = 5 AND step_order = 2;

UPDATE treatment_steps SET
  step_vi = N'Vệ sinh vườn sạch sẽ sau thu hoạch, dọn tàn dư thực vật',
  step_en = N'Clean orchard after harvest, remove plant debris'
WHERE disease_id = 5 AND step_order = 3;

UPDATE treatment_steps SET
  step_vi  = N'Bổ sung kali và canxi để tăng sức đề kháng',
  step_en  = N'Supplement potassium and calcium to increase resistance',
  chemical = N'KCl, CaCO3'
WHERE disease_id = 5 AND step_order = 4;

-- Leaf_Rhizoctonia (disease_id = 6)
UPDATE treatment_steps SET
  step_vi = N'Nhổ bỏ và tiêu hủy cây con bị chết, không để lây lan',
  step_en = N'Remove and destroy dead seedlings to prevent spread'
WHERE disease_id = 6 AND step_order = 1;

UPDATE treatment_steps SET
  step_vi  = N'Xử lý đất bằng Validamycin hoặc PCNB trước khi trồng',
  step_en  = N'Treat soil with Validamycin or PCNB before planting',
  chemical = N'Validamycin (Validacin), PCNB'
WHERE disease_id = 6 AND step_order = 2;

UPDATE treatment_steps SET
  step_vi = N'Tưới nước vừa phải, tránh đất quá ẩm và úng nước',
  step_en = N'Water moderately, avoid waterlogged or overly moist soil'
WHERE disease_id = 6 AND step_order = 3;

UPDATE treatment_steps SET
  step_vi = N'Sử dụng giống kháng bệnh, khử trùng dụng cụ làm vườn',
  step_en = N'Use disease-resistant varieties, sterilize gardening tools'
WHERE disease_id = 6 AND step_order = 4;

PRINT 'Done. Vietnamese text fixed.';
