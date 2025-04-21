import cv2
import numpy as np
import os
import pickle
import logging
from datetime import datetime

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class FaceRecognitionSystem:
    def __init__(self):
        # Khởi tạo face detector
        self.face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        )

        # Khởi tạo face recognizer
        self.face_recognizer = cv2.face.LBPHFaceRecognizer_create()

        # Các biến để lưu trữ thông tin khuôn mặt đã biết
        self.known_face_ids = []
        self.trained = False

        # Kiểm tra nếu có file model đã được lưu trước đó
        self.model_file = "face_recognition_model.pkl"
        if os.path.exists(self.model_file):
            self.load_model()

    def load_model(self):
        """Tải mô hình từ file"""
        try:
            self.face_recognizer.read("face_recognizer_model.xml")
            with open(self.model_file, "rb") as f:
                self.known_face_ids = pickle.load(f)
            self.trained = True
            print("Đã tải mô hình nhận diện khuôn mặt")
        except Exception as e:
            print(f"Lỗi khi tải mô hình: {str(e)}")
            self.trained = False

    def save_model(self):
        """Lưu mô hình vào file"""
        try:
            self.face_recognizer.write("face_recognizer_model.xml")
            with open(self.model_file, "wb") as f:
                pickle.dump(self.known_face_ids, f)
            print("Đã lưu mô hình nhận diện khuôn mặt")
        except Exception as e:
            print(f"Lỗi khi lưu mô hình: {str(e)}")

    def preprocess_face(self, image):
        """Tiền xử lý ảnh: chuyển sang ảnh xám để nhận diện tốt hơn"""
        if len(image.shape) == 3:  # Ảnh màu
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:  # Ảnh đã là ảnh xám
            gray = image

        # Cân bằng histogram để cải thiện độ tương phản
        gray = cv2.equalizeHist(gray)
        return gray

    def add_known_face(self, user_id, image_path):
        """Thêm khuôn mặt vào hệ thống"""
        try:
            # Kiểm tra nếu user_id đã tồn tại
            if user_id in self.known_face_ids:
                print(f"Người dùng {user_id} đã tồn tại trong hệ thống. Cập nhật ảnh thay vì thêm mới.")
                # Xác định vị trí của user_id trong danh sách
                label = self.known_face_ids.index(user_id)
                # Đường dẫn để lưu ảnh mới (nếu cần)
                user_folder = f"known_faces/{user_id}"
                os.makedirs(user_folder, exist_ok=True)
                # Chỉ tiếp tục với việc xử lý ảnh, không thêm ID vào danh sách
            else:
                print(f"Thêm người dùng mới: {user_id}")

            # Đọc ảnh
            image = cv2.imread(image_path)
            if image is None:
                print(f"Không thể đọc ảnh: {image_path}")
                return False

            # Tiền xử lý ảnh
            gray = self.preprocess_face(image)

            # Phát hiện khuôn mặt
            faces = self.face_cascade.detectMultiScale(
                gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30)
            )

            if len(faces) == 0:
                print(f"Không tìm thấy khuôn mặt trong ảnh: {image_path}")
                return False

            # Lấy khuôn mặt đầu tiên (giả sử ảnh đăng ký chỉ có 1 khuôn mặt)
            x, y, w, h = faces[0]
            face_img = gray[y : y + h, x : x + w]

            # Chỉ thêm ID vào danh sách nếu là người dùng mới
            if user_id not in self.known_face_ids:
                self.known_face_ids.append(user_id)

            # Huấn luyện bộ nhận diện
            if not self.trained:
                # Nếu chưa có dữ liệu, khởi tạo bộ nhận diện với khuôn mặt đầu tiên
                self.face_recognizer.train([face_img], np.array([0]))
                self.trained = True
            else:
                # Nếu đã có dữ liệu, train lại với tất cả dữ liệu
                self._retrain_model()

            # Lưu mô hình
            self.save_model()

            return True
        except Exception as e:
            print(f"Lỗi khi thêm khuôn mặt: {str(e)}")
            return False

    def _retrain_model(self):
        """Huấn luyện lại mô hình với tất cả dữ liệu"""
        faces = []
        labels = []

        # Đọc lại tất cả ảnh từ thư mục known_faces
        for i, user_id in enumerate(self.known_face_ids):
            # Tìm file ảnh tương ứng
            user_folder = f"known_faces/{user_id}"
            if os.path.exists(user_folder) and os.path.isdir(user_folder):
                for file in os.listdir(user_folder):
                    if file.endswith(".jpg") or file.endswith(".png"):
                        image_path = os.path.join(user_folder, file)
                        self._process_training_image(image_path, i, faces, labels)
            else:
                # Cách cũ - nếu không có thư mục người dùng
                image_path = f"known_faces/{user_id}.jpg"
                if os.path.exists(image_path):
                    self._process_training_image(image_path, i, faces, labels)

        if faces:
            # Huấn luyện bộ nhận diện
            self.face_recognizer.train(faces, np.array(labels))

    def _process_training_image(self, image_path, label, faces, labels):
        """Xử lý ảnh huấn luyện và thêm vào danh sách faces và labels"""
        # Đọc và xử lý ảnh
        image = cv2.imread(image_path)
        if image is None:
            return

        gray = self.preprocess_face(image)

        # Phát hiện khuôn mặt
        detected_faces = self.face_cascade.detectMultiScale(
            gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30)
        )

        if len(detected_faces) == 0:
            return

        # Lấy khuôn mặt đầu tiên
        x, y, w, h = detected_faces[0]
        face_img = gray[y : y + h, x : x + w]

        # Thêm vào danh sách để huấn luyện
        faces.append(face_img)
        labels.append(label)

    def detect_faces(self, frame):
        """Phát hiện các khuôn mặt trong frame và trả về danh sách vị trí"""
        # Tiền xử lý ảnh
        gray = self.preprocess_face(frame)

        # Phát hiện khuôn mặt
        faces = self.face_cascade.detectMultiScale(
            gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30)
        )

        # Chuyển đổi sang định dạng JSON để trả về
        face_list = []
        for x, y, w, h in faces:
            face_list.append(
                {"x": int(x), "y": int(y), "width": int(w), "height": int(h)}
            )

        return face_list

    def recognize_faces(self, frame, confidence_threshold=50):
        """Nhận diện khuôn mặt trong frame và trả về danh sách thông tin"""
        if not self.trained or not self.known_face_ids:
            print("Chưa có mô hình nhận diện khuôn mặt nào được train.")
            return self.detect_faces(frame)  # Nếu chưa train, chỉ phát hiện khuôn mặt
        else:
            print(f"Đã train mô hình nhận diện khuôn mặt. Số lượng khuôn mặt đã biết: {len(self.known_face_ids)}")
            print(f"Danh sách khuôn mặt đã biết: {self.known_face_ids}")
        # Tiền xử lý ảnh
        gray = self.preprocess_face(frame)

        # Phát hiện khuôn mặt
        faces = self.face_cascade.detectMultiScale(
            gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30)
        )

        # Kết quả nhận diện
        recognized_faces = []

        # Kiểm tra từng khuôn mặt phát hiện được
        for x, y, w, h in faces:
            face_img = gray[y : y + h, x : x + w]

            face_info = {
                "x": int(x),
                "y": int(y),
                "width": int(w),
                "height": int(h),
                "name": None,
                "user_id": None,
                "confidence": 0,
            }

            # Nhận diện khuôn mặt nếu đã train
            try:
                label, confidence = self.face_recognizer.predict(face_img)

                # LBPH trả về khoảng cách, chuyển thành % tin cậy
                confidence_score = 100 - min(100, confidence)

                if confidence_score > confidence_threshold and label < len(
                    self.known_face_ids
                ):
                    user_id = self.known_face_ids[label]
                    face_info["user_id"] = user_id
                    face_info["confidence"] = confidence_score

                recognized_faces.append(face_info)
            except Exception as e:
                print(f"Lỗi khi nhận diện khuôn mặt: {str(e)}")
                recognized_faces.append(face_info)

        return recognized_faces

    def recognize_face(self, frame, confidence_threshold=50):
        """Nhận diện một khuôn mặt, trả về user_id của khuôn mặt được nhận diện tốt nhất"""
        faces = self.recognize_faces(frame, confidence_threshold)

        best_match = None
        best_confidence = 0

        for face in faces:
            if face.get("user_id") and face.get("confidence", 0) > best_confidence:
                best_match = face.get("user_id")
                best_confidence = face.get("confidence", 0)

        return best_match

    def detect_and_draw_faces(self, frame):
        """Phát hiện và vẽ khung quanh khuôn mặt"""
        # Phát hiện khuôn mặt
        faces = self.detect_faces(frame)

        # Vẽ khung quanh khuôn mặt
        for face in faces:
            x, y, w, h = face["x"], face["y"], face["width"], face["height"]
            cv2.rectangle(frame, (x, y), (x + w, y + h), (0, 255, 0), 2)

        return frame