# Kiểm Tra Tương Tác Thuốc - Frontend

Ứng dụng web React hiện đại để phát hiện tương tác thuốc từ hình ảnh nhãn thuốc sử dụng OCR và AI.

## Tính Năng

- 📸 **Tải Lên Hình Ảnh**: Kéo thả hoặc nhấp để tải lên hình ảnh nhãn thuốc
- 🔍 **Xử Lý OCR**: Tự động trích xuất tên thuốc từ hình ảnh bằng Tesseract.js
- 💊 **Phát Hiện Thuốc**: Trích xuất thông minh tên thuốc từ văn bản OCR
- ⚠️ **Phân Tích Tương Tác**: Kiểm tra tương tác thuốc bằng backend AI
- 🎨 **Giao Diện Hiện Đại**: Giao diện đẹp, phản hồi được xây dựng với Tailwind CSS và shadcn/ui
- ⚡ **Phản Hồi Thời Gian Thực**: Chỉ báo tiến trình và trạng thái tải

## Công Nghệ Sử Dụng

- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **State Management**: TanStack Query (React Query)
- **OCR**: Tesseract.js
- **HTTP Client**: Axios
- **File Upload**: React Dropzone

## Yêu Cầu Hệ Thống

- Node.js 18+ hoặc pnpm
- Backend API đang chạy trên `http://localhost:8000` (xem thư mục cha)

## Cài Đặt

```bash
# Cài đặt dependencies
pnpm install

# hoặc với npm
npm install
```

## Phát Triển

```bash
# Khởi động development server
pnpm dev

# hoặc với npm
npm run dev
```

Ứng dụng sẽ có sẵn tại `http://localhost:5173`

## Build Cho Production

```bash
# Build ứng dụng
pnpm build

# Xem trước production build
pnpm preview
```

## Cấu Trúc Dự Án

```
src/
├── components/          # React components
│   ├── ui/             # shadcn/ui components
│   ├── ImageUpload.tsx # Tải lên hình ảnh với drag-and-drop
│   ├── DrugList.tsx    # Danh sách thuốc đã phát hiện
│   └── InteractionResults.tsx # Hiển thị kết quả
├── lib/                # Utilities và services
│   ├── api.ts         # API client
│   ├── ocr.ts         # Xử lý OCR với Tesseract.js
│   └── utils.ts       # Utility functions
├── App.tsx            # Component ứng dụng chính
├── main.tsx           # Entry point của ứng dụng
└── index.css          # Global styles
```

## Cách Hoạt Động

1. **Tải Lên Hình Ảnh**: Người dùng tải lên ảnh nhãn thuốc
2. **Xử Lý OCR**: Tesseract.js trích xuất văn bản từ hình ảnh
3. **Phát Hiện Thuốc**: Thuật toán thông minh xác định tên thuốc từ văn bản
4. **Xem Lại & Chỉnh Sửa**: Người dùng có thể xóa các thuốc được phát hiện không chính xác
5. **Kiểm Tra Tương Tác**: Truy vấn backend AI agent để kiểm tra tương tác thuốc
6. **Xem Kết Quả**: Hiển thị cảnh báo tương tác với chỉ báo mức độ nghiêm trọng

## Tích Hợp API

Frontend giao tiếp với backend FastAPI server thông qua proxy được cấu hình trong `vite.config.ts`:

```typescript
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:8000',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api/, '')
    }
  }
}
```

### API Endpoints Được Sử Dụng

- `POST /api/query` - Truy vấn tương tác thuốc
- `GET /api/stats` - Lấy thống kê cơ sở dữ liệu
- `GET /api/health` - Kiểm tra sức khỏe

## Biến Môi Trường

Không cần biến môi trường nào cho frontend. URL backend được proxy thông qua Vite.

## Tùy Chỉnh

### Thêm UI Components Mới

Sử dụng shadcn/ui CLI để thêm components:

```bash
npx shadcn@latest add [component-name]
```

### Styling

- Sửa đổi `tailwind.config.js` để tùy chỉnh theme
- Cập nhật CSS variables trong `src/index.css` cho color schemes
- Components sử dụng `cn()` utility cho conditional classes

## Độ Chính Xác OCR

Độ chính xác OCR phụ thuộc vào:
- Chất lượng hình ảnh (độ phân giải cao hơn tốt hơn)
- Độ rõ nét và tương phản của văn bản
- Ánh sáng phù hợp trong ảnh
- Định dạng tên thuốc (tên viết hoa hoạt động tốt nhất)

**Mẹo để có kết quả tốt hơn:**
- Chụp ảnh trong ánh sáng tốt
- Đảm bảo văn bản rõ ràng và tập trung
- Tránh ánh sáng chói hoặc bóng tối
- Cắt để chỉ hiển thị nhãn thuốc

## Hạn Chế Đã Biết

- OCR có thể không phát hiện đúng tất cả tên thuốc
- Người dùng nên xem lại các thuốc đã phát hiện trước khi kiểm tra tương tác
- Cần backend server đang chạy
- Hình ảnh lớn có thể mất nhiều thời gian xử lý hơn

## Khắc Phục Sự Cố

### OCR không hoạt động
- Kiểm tra browser console để tìm lỗi
- Đảm bảo định dạng hình ảnh được hỗ trợ (PNG, JPG, JPEG, GIF, BMP)
- Thử hình ảnh rõ ràng, chất lượng cao hơn

### Lỗi API
- Đảm bảo backend server đang chạy trên `http://localhost:8000`
- Kiểm tra backend logs để tìm lỗi
- Xác minh CORS được cấu hình đúng

### Lỗi Build
- Xóa `node_modules` và cài đặt lại: `pnpm install --force`
- Kiểm tra phiên bản Node.js (cần 18+)
- Cập nhật dependencies: `pnpm update`

## Đóng Góp

Khi thêm tính năng mới:
1. Tuân theo cấu trúc code hiện có
2. Sử dụng TypeScript để đảm bảo type safety
3. Thêm xử lý lỗi phù hợp
4. Test với các loại hình ảnh khác nhau
5. Cập nhật README này

## Giấy Phép

MIT License - xem thư mục cha để biết chi tiết
