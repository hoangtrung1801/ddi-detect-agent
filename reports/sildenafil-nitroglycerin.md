# Report: Sildenafil (Viagra) + Nitroglycerin

Test trên https://ddi-detect-agent.pages.dev/ (DRUG-GUARD AI), ngày 2026-11-23.
Đầu vào: "Viagra" và "Nitroglycerin". Screenshot: `sildenafil-nitroglycerin.png`

## Kết quả app
- Mức độ: **Nghiêm trọng**, "Nguy cơ cao – Không nên dùng chung".
- App tự đổi tên biệt dược Viagra thành Sildenafil (khớp chính xác); Nitroglycerin khớp chính xác.
- Nguồn: DDInter 2.0 #165822, nhãn FDA (DailyMed) của sildenafil citrate và nitroglycerin. 18 ý có dẫn nguồn.

## Cơ chế
Nitroglycerin giải phóng nitric oxide, làm tăng cGMP và giãn mạch. Sildenafil ức chế PDE5 nên cGMP không bị phân hủy. Dùng chung khiến cGMP tăng quá mạnh, gây giãn mạch quá mức.

## Hậu quả
- Tụt huyết áp nặng, ngất.
- Thiếu máu cơ tim.
- Đau ngực sau khi dùng sildenafil cần được trợ giúp y tế ngay (gọi 115).

## Xử trí theo nguồn
- Chống chỉ định, kể cả khi nitrate chỉ dùng thỉnh thoảng.
- Chưa xác định khoảng chờ an toàn để dùng nitroglycerin sau sildenafil, không tự suy ra.
- Nếu đau ngực sau khi dùng sildenafil: đi cấp cứu và báo rõ thời điểm đã dùng.

## Nhận xét về app
- Nhận diện tên biệt dược hoạt động tốt.
- Lỗi nhỏ: phần "Thông tin dược học" có chữ Nga "тип 5" lẫn trong câu tiếng Việt ("Thuốc ức chế phosphodiesterase тип 5"), đúng ra là "type 5" hoặc "typ 5".
- Thông tin chỉ mang tính tham khảo.
