#!/usr/bin/env python3
"""
Script đơn giản để xóa toàn bộ dữ liệu và khởi tạo lại mô hình nhận diện khuôn mặt
"""

import os
import shutil
import sys
import glob
from datetime import datetime

# Tạo backup
backup_dir = f"backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
os.makedirs(backup_dir, exist_ok=True)
print(f"Đã tạo thư mục backup: {backup_dir}")

# Backup các file mô hình trước khi xóa
model_files = ["face_recognition_model.pkl", "face_recognizer_model.xml"]
for file in model_files:
    if os.path.exists(file):
        try:
            shutil.copy2(file, os.path.join(backup_dir, file))
            print(f"Đã backup file {file}")
        except Exception as e:
            print(f"Lỗi khi backup file {file}: {e}")

# Backup thư mục known_faces
if os.path.exists("known_faces"):
    try:
        shutil.copytree("known_faces", os.path.join(backup_dir, "known_faces"))
        print("Đã backup thư mục known_faces")
    except Exception as e:
        print(f"Lỗi khi backup thư mục known_faces: {e}")

# Backup file database.db nếu tồn tại
db_files = ["app.db", "database.db", "instance/app.db", "instance/database.db"]
for db_file in db_files:
    if os.path.exists(db_file):
        try:
            shutil.copy2(db_file, os.path.join(backup_dir, os.path.basename(db_file)))
            print(f"Đã backup file database: {db_file}")
        except Exception as e:
            print(f"Lỗi khi backup file database {db_file}: {e}")

# Xóa các file mô hình
for file in model_files:
    if os.path.exists(file):
        try:
            os.remove(file)
            print(f"Đã xóa file {file}")
        except Exception as e:
            print(f"Lỗi khi xóa file {file}: {e}")
            sys.exit(1)

# Xóa tất cả các thư mục và file trong known_faces
if os.path.exists("known_faces"):
    # Tạo danh sách các mục để xóa
    items_to_remove = glob.glob("known_faces/*")
    
    for item in items_to_remove:
        try:
            if os.path.isdir(item):
                shutil.rmtree(item)
                print(f"Đã xóa thư mục: {item}")
            else:
                os.remove(item)
                print(f"Đã xóa file: {item}")
        except Exception as e:
            print(f"Lỗi khi xóa {item}: {e}")
else:
    # Tạo thư mục known_faces nếu không tồn tại
    os.makedirs("known_faces", exist_ok=True)
    print("Đã tạo thư mục known_faces mới")

# Tạo mô hình mới trống
from face_recognition_model import FaceRecognitionSystem
face_system = FaceRecognitionSystem()
face_system.save_model()
print("Đã tạo mô hình nhận dạng khuôn mặt mới")

# Xóa và tạo lại database
try:
    from flask import Flask
    from database import db, init_db, User, Attendance
    
    # Tạo ứng dụng Flask mới để tránh xung đột
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///app.db'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    db.init_app(app)
    
    # Xóa file database nếu tồn tại để tạo lại từ đầu
    db_path = 'app.db'
    if os.path.exists(db_path):
        os.remove(db_path)
        print(f"Đã xóa file database: {db_path}")
    
    # Tạo lại database và các bảng
    with app.app_context():
        db.create_all()
        db.session.commit()
        print("Đã tạo mới database và các bảng")
        
        # Kiểm tra bảng đã được tạo chưa
        from sqlalchemy import inspect
        inspector = inspect(db.engine)
        tables = inspector.get_table_names()
        print(f"Các bảng đã được tạo: {tables}")
        
except Exception as e:
    print(f"Lỗi khi reset database: {e}")
    print("CẢNH BÁO: Đã xóa các file mô hình nhưng quá trình tạo lại database gặp lỗi.")
    print("Bạn có thể thử lại bằng cách chạy lệnh: flask init-db")

print("\nĐã reset toàn bộ hệ thống. Hệ thống đã trở về trạng thái ban đầu và các bảng đã được tạo lại.")