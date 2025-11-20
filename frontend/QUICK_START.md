# Hướng Dẫn Bắt Đầu Nhanh

Khởi động frontend Kiểm Tra Tương Tác Thuốc trong vài phút!

## Yêu Cầu Hệ Thống

- Node.js 18+ hoặc pnpm đã cài đặt
- Backend API đang chạy (xem thiết lập thư mục cha)

## 1. Cài Đặt Dependencies

```bash
pnpm install
```

## 2. Khởi Động Development Server

```bash
pnpm dev
```

Ứng dụng sẽ mở tại `http://localhost:5173`

## 3. Đảm Bảo Backend Đang Chạy

Trong terminal riêng biệt, từ thư mục cha:

```bash
# Đảm bảo bạn đã cấu hình .env với OPENAI_API_KEY
cd ..
python app/main.py
```

Backend sẽ chạy tại `http://localhost:8000`

## 4. Test Ứng Dụng

1. Mở `http://localhost:5173` trong trình duyệt
2. Tải lên hình ảnh nhãn thuốc (hoặc sử dụng hình ảnh mẫu)
3. Chờ xử lý OCR để phát hiện tên thuốc
4. Xem lại và xóa các phát hiện không chính xác
5. Nhấp "Kiểm Tra Tương Tác" để xem kết quả

## Test Mẫu

Bạn có thể test với hình ảnh văn bản đơn giản chứa tên thuốc như:
- Warfarin
- Aspirin
- Metformin

Hoặc sử dụng điện thoại để chụp ảnh nhãn thuốc thực tế.

## Vấn Đề Thường Gặp

### Port Đã Được Sử Dụng

Nếu port 5173 đang bận:
```bash
pnpm dev -- --port 3000
```

### Kết Nối Backend Thất Bại

Đảm bảo backend đang chạy trên `http://localhost:8000`:
```bash
curl http://localhost:8000/health
```

### OCR Không Hoạt Động

Kiểm tra browser console để tìm lỗi. OCR chạy trong trình duyệt sử dụng WebAssembly.

## Production Build

```bash
# Build cho production
pnpm build

# Xem trước production build
pnpm preview
```

## Thiết Lập Môi Trường

Không cần biến môi trường! Frontend tự động proxy đến backend.

Để thay đổi URL backend, sửa `vite.config.ts`:

```typescript
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:8000', // Thay đổi nếu cần
      ...
    }
  }
}
```

## Bước Tiếp Theo

- Đọc [README.md](README.md) đầy đủ để biết tài liệu chi tiết
- Tùy chỉnh UI components trong `src/components/`
- Sửa đổi logic phát hiện thuốc OCR trong `src/lib/ocr.ts`
- Thêm nhiều UI components từ shadcn/ui

## Công Nghệ Sử Dụng

- ⚡ Vite - Build tool siêu nhanh
- ⚛️ React 18 - UI framework
- 🎨 Tailwind CSS - Utility-first styling
- 🧩 shadcn/ui - Components đẹp
- 🔍 Tesseract.js - OCR trong trình duyệt
- 📊 TanStack Query - Data fetching
- 📤 React Dropzone - File uploads

Chúc bạn phát triển vui vẻ! 🚀
