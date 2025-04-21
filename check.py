from flask import Flask
from database import db, User, Attendance
import os
from datetime import datetime


app = Flask(__name__)
# Cấu hình đường dẫn database - điều chỉnh cho phù hợp với cấu hình của bạn
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///attendance.db"
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)


def check_system():
    with app.app_context():
        print("=== KIỂM TRA HỆ THỐNG ===")
        
        # Kiểm tra bảng User
        users = User.query.all()
        print(f"\n1. THÔNG TIN NGƯỜI DÙNG (Tổng số: {len(users)})")
        if users:
            for user in users:
                print(f"ID: {user.id}, Tên: {user.name}, User ID: {user.user_id}")
                print(f"   Ảnh khuôn mặt: {user.face_image_path}")
                print(f"   Ngày tạo: {user.created_at}")
                
                # Kiểm tra file ảnh có tồn tại không
                if os.path.exists(user.face_image_path):
                    file_size = os.path.getsize(user.face_image_path)
                    print(f"   Trạng thái file: Tồn tại (Kích thước: {file_size} bytes)")
                else:
                    print(f"   Trạng thái file: KHÔNG TỒN TẠI")
                print("-" * 50)
        else:
            print("Chưa có người dùng nào trong hệ thống.")
            
        # Kiểm tra bảng Attendance
        attendances = Attendance.query.all()
        print(f"\n2. THÔNG TIN ĐIỂM DANH (Tổng số: {len(attendances)})")
        if attendances:
            for attendance in attendances:
                user = User.query.get(attendance.user_id)
                user_name = user.name if user else "Không xác định"
                print(f"ID: {attendance.id}, Người dùng: {user_name} (ID: {attendance.user_id})")
                print(f"   Ngày: {attendance.date}, Giờ: {attendance.time}")
                print("-" * 50)
        else:
            print("Chưa có dữ liệu điểm danh nào trong hệ thống.")
            
        # Thống kê tổng quan
        print("\n3. THỐNG KÊ TỔNG QUAN")
        print(f"Tổng số người dùng: {len(users)}")
        print(f"Tổng số bản ghi điểm danh: {len(attendances)}")
        
        # Thống kê điểm danh theo ngày
        today = datetime.now().date()
        today_attendance = Attendance.query.filter(Attendance.date == today).count()
        print(f"Số lượng điểm danh hôm nay ({today}): {today_attendance}")

if __name__ == "__main__":
    check_system()