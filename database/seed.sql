-- ============================================================
-- SEED DATA — Disease classes & treatment steps
-- ============================================================

-- Disease classes
INSERT INTO disease_classes (code, name_vi, name_en, scientific, severity, cause_vi, cause_en) VALUES
('Leaf_Algal',
 'Bệnh đốm tảo',
 'Algal Leaf Spot',
 'Cephaleuros virescens',
 'moderate',
 'Tảo ký sinh Cephaleuros virescens xâm nhập qua khí khổng, phát triển mạnh trong môi trường ẩm ướt và rậm rạp.',
 'Parasitic algae Cephaleuros virescens penetrates through stomata, thriving in humid and dense environments.'),

('Leaf_Blight',
 'Bệnh cháy lá',
 'Leaf Blight',
 'Phytophthora palmivora',
 'high',
 'Nấm Phytophthora palmivora gây thối nâu, lan nhanh trong điều kiện ẩm ướt, đặc biệt mùa mưa.',
 'Phytophthora palmivora fungus causing brown rot, spreading rapidly in wet conditions especially rainy season.'),

('Leaf_Colletotrichum',
 'Bệnh đốm lá Colletotrichum',
 'Colletotrichum Leaf Spot',
 'Colletotrichum gloeosporioides',
 'moderate',
 'Nấm Colletotrichum tạo vết đốm nâu có viền vàng, lây lan qua bào tử theo gió và nước.',
 'Colletotrichum fungus causing brown spots with yellow halos, spreading via wind-borne spores.'),

('Leaf_Healthy',
 'Lá khỏe mạnh',
 'Healthy Leaf',
 'Durio zibethinus (healthy)',
 'low',
 'Lá không có dấu hiệu bệnh. Cây đang phát triển tốt.',
 'No disease signs. Plant is growing well under current conditions.'),

('Leaf_Phomopsis',
 'Bệnh Phomopsis',
 'Phomopsis Stem-End Rot',
 'Phomopsis sp.',
 'moderate',
 'Nấm Phomopsis gây thối cuống và viền lá, thường xuất hiện sau giai đoạn mưa dài ngày.',
 'Phomopsis fungus causing stem-end and margin rot, common after prolonged rain.'),

('Leaf_Rhizoctonia',
 'Bệnh Rhizoctonia',
 'Rhizoctonia Leaf Blight',
 'Rhizoctonia solani',
 'high',
 'Nấm Rhizoctonia solani gây thối rễ và lá non, đặc biệt nguy hiểm với cây con.',
 'Rhizoctonia solani causes root and young leaf rot, especially dangerous for seedlings.');

-- Treatment steps — Algal
INSERT INTO treatment_steps (disease_id, step_order, step_vi, step_en, chemical) VALUES
((SELECT id FROM disease_classes WHERE code='Leaf_Algal'), 1,
 'Cắt bỏ và tiêu hủy lá bị bệnh nặng',
 'Remove and destroy severely infected leaves', NULL),
((SELECT id FROM disease_classes WHERE code='Leaf_Algal'), 2,
 'Phun thuốc gốc đồng Bordeaux 1% toàn tán',
 'Spray 1% Bordeaux mixture over entire canopy', 'Bordeaux mixture 1%'),
((SELECT id FROM disease_classes WHERE code='Leaf_Algal'), 3,
 'Tăng thông thoáng, giảm ẩm độ vườn',
 'Improve air circulation, reduce garden humidity', NULL),
((SELECT id FROM disease_classes WHERE code='Leaf_Algal'), 4,
 'Kiểm tra lại sau 2 tuần',
 'Re-inspect after 2 weeks', NULL);

-- Treatment steps — Blight
INSERT INTO treatment_steps (disease_id, step_order, step_vi, step_en, chemical) VALUES
((SELECT id FROM disease_classes WHERE code='Leaf_Blight'), 1,
 'Loại bỏ ngay các lá bị bệnh khỏi vườn',
 'Immediately remove diseased leaves from garden', NULL),
((SELECT id FROM disease_classes WHERE code='Leaf_Blight'), 2,
 'Phun Metalaxyl hoặc Phosphonate 3–4 ngày/lần',
 'Spray Metalaxyl or Phosphonate every 3–4 days', 'Metalaxyl / Phosphonate'),
((SELECT id FROM disease_classes WHERE code='Leaf_Blight'), 3,
 'Tránh tưới quá nhiều, để đất thoát nước tốt',
 'Avoid overwatering, ensure good soil drainage', NULL),
((SELECT id FROM disease_classes WHERE code='Leaf_Blight'), 4,
 'Bón vôi cải tạo pH đất',
 'Apply agricultural lime to improve soil pH', 'Agricultural lime');

-- Treatment steps — Colletotrichum
INSERT INTO treatment_steps (disease_id, step_order, step_vi, step_en, chemical) VALUES
((SELECT id FROM disease_classes WHERE code='Leaf_Colletotrichum'), 1,
 'Cắt tỉa cành và lá bệnh cẩn thận',
 'Carefully prune diseased branches and leaves', NULL),
((SELECT id FROM disease_classes WHERE code='Leaf_Colletotrichum'), 2,
 'Phun Mancozeb hoặc Carbendazim định kỳ',
 'Apply Mancozeb or Carbendazim periodically', 'Mancozeb / Carbendazim'),
((SELECT id FROM disease_classes WHERE code='Leaf_Colletotrichum'), 3,
 'Vệ sinh vườn, thu gom lá rụng',
 'Clean garden, collect and remove fallen leaves', NULL),
((SELECT id FROM disease_classes WHERE code='Leaf_Colletotrichum'), 4,
 'Bổ sung kali tăng sức đề kháng cây',
 'Apply potassium fertilizer to boost plant resistance', 'Potassium sulfate');

-- Treatment steps — Healthy
INSERT INTO treatment_steps (disease_id, step_order, step_vi, step_en) VALUES
((SELECT id FROM disease_classes WHERE code='Leaf_Healthy'), 1,
 'Tiếp tục theo dõi và chăm sóc định kỳ',
 'Continue regular monitoring and maintenance'),
((SELECT id FROM disease_classes WHERE code='Leaf_Healthy'), 2,
 'Bón phân cân đối NPK theo giai đoạn sinh trưởng',
 'Apply balanced NPK fertilizer according to growth stage'),
((SELECT id FROM disease_classes WHERE code='Leaf_Healthy'), 3,
 'Duy trì tưới nước đều đặn',
 'Maintain regular and consistent watering');

-- Treatment steps — Phomopsis
INSERT INTO treatment_steps (disease_id, step_order, step_vi, step_en, chemical) VALUES
((SELECT id FROM disease_classes WHERE code='Leaf_Phomopsis'), 1,
 'Xử lý vết thương cơ giới bằng thuốc trừ nấm',
 'Treat mechanical wounds with fungicide', NULL),
((SELECT id FROM disease_classes WHERE code='Leaf_Phomopsis'), 2,
 'Phun Thiophanate-methyl hoặc Iprodione',
 'Spray Thiophanate-methyl or Iprodione', 'Thiophanate-methyl / Iprodione'),
((SELECT id FROM disease_classes WHERE code='Leaf_Phomopsis'), 3,
 'Cải thiện hệ thống thoát nước vườn',
 'Improve garden drainage system', NULL),
((SELECT id FROM disease_classes WHERE code='Leaf_Phomopsis'), 4,
 'Không để lá ướt qua đêm',
 'Avoid leaving leaves wet overnight', NULL);

-- Treatment steps — Rhizoctonia
INSERT INTO treatment_steps (disease_id, step_order, step_vi, step_en, chemical) VALUES
((SELECT id FROM disease_classes WHERE code='Leaf_Rhizoctonia'), 1,
 'Nhổ và tiêu hủy cây bệnh nặng',
 'Uproot and destroy severely infected plants', NULL),
((SELECT id FROM disease_classes WHERE code='Leaf_Rhizoctonia'), 2,
 'Xử lý đất bằng Validamycin hoặc PCNB',
 'Treat soil with Validamycin or PCNB', 'Validamycin / PCNB'),
((SELECT id FROM disease_classes WHERE code='Leaf_Rhizoctonia'), 3,
 'Giảm độ ẩm đất, cải thiện thoát nước',
 'Reduce soil moisture, improve drainage', NULL),
((SELECT id FROM disease_classes WHERE code='Leaf_Rhizoctonia'), 4,
 'Luân canh cây trồng nếu có thể',
 'Rotate crops if possible', NULL);

-- Sample admin user (password: Admin@123)
INSERT INTO users (username, email, password_hash, full_name, role) VALUES
('admin', 'admin@hutech.edu.vn',
 crypt('Admin@123', gen_salt('bf')),
 'Quản trị viên HUTECH', 'admin');
