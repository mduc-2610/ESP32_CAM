import cv2
import numpy as np
import os
import pickle


class FaceRecognitionSystem:
    def __init__(self):
        # Khởi tạo face detector
        self.face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        )

        # Khởi tạo face recognizer
        self.face_recognizer = cv2.face.LBPHFaceRecognizer_create()

        # Các biến để lưu trữ thông tin khuôn mặt đã biết
        self.known_face_ids = []  # Danh sách ID người dùng
        self.label_to_user_map = {}  # Ánh xạ từ nhãn (label) sang ID người dùng
        self.trained = False

        # Đường dẫn đến thư mục lưu trữ khuôn mặt
        self.faces_dir = "known_faces"
        os.makedirs(self.faces_dir, exist_ok=True)

        # Kiểm tra nếu có file model đã được lưu trước đó
        self.model_file = "face_recognition_model.pkl"
        if os.path.exists(self.model_file):
            self.load_model()

    def load_model(self):
        """Tải mô hình từ file"""
        try:
            self.face_recognizer.read("face_recognizer_model.xml")
            with open(self.model_file, "rb") as f:
                data = pickle.load(f)
                # Cấu trúc dữ liệu mới sẽ có cả known_face_ids và label_to_user_map
                # Kiểm tra tương thích với cả phiên bản cũ và mới của dữ liệu
                if isinstance(data, dict):
                    self.known_face_ids = data.get("known_face_ids", [])
                    self.label_to_user_map = data.get("label_to_user_map", {})
                else:
                    # Tương thích với phiên bản cũ - chỉ có list user_ids
                    self.known_face_ids = data
                    # Tạo lại label_to_user_map
                    self.label_to_user_map = {
                        i: user_id for i, user_id in enumerate(self.known_face_ids)
                    }

            self.trained = True
            print("Đã tải mô hình nhận diện khuôn mặt")
            print(f"Số lượng khuôn mặt đã biết: {len(self.known_face_ids)}")
            print(f"Ánh xạ nhãn: {self.label_to_user_map}")
        except Exception as e:
            print(f"Lỗi khi tải mô hình: {str(e)}")
            self.trained = False
            self.known_face_ids = []
            self.label_to_user_map = {}

    def save_model(self):
        """Lưu mô hình vào file"""
        try:
            self.face_recognizer.write("face_recognizer_model.xml")
            # Lưu cả known_face_ids và label_to_user_map
            data = {
                "known_face_ids": self.known_face_ids,
                "label_to_user_map": self.label_to_user_map,
            }
            with open(self.model_file, "wb") as f:
                pickle.dump(data, f)
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

            # Tạo thư mục cho người dùng nếu chưa tồn tại
            user_folder = os.path.join(self.faces_dir, str(user_id))
            os.makedirs(user_folder, exist_ok=True)

            # Lưu khuôn mặt đã cắt
            timestamp = (
                int(os.path.getctime(image_path)) if os.path.exists(image_path) else 0
            )
            face_filename = os.path.join(user_folder, f"face_{timestamp}.jpg")
            cv2.imwrite(face_filename, face_img)

            # Thêm vào danh sách khuôn mặt đã biết nếu chưa có
            if user_id not in self.known_face_ids:
                self.known_face_ids.append(user_id)
                # Cập nhật ánh xạ nhãn
                next_label = len(self.label_to_user_map)
                self.label_to_user_map[next_label] = user_id
                print(f"Đã thêm người dùng mới, ID: {user_id}, Label: {next_label}")

            # Huấn luyện bộ nhận diện
            self._retrain_model()

            # Lưu mô hình
            self.save_model()

            return True
        except Exception as e:
            print(f"Lỗi khi thêm khuôn mặt: {str(e)}")
            return False

    def _retrain_model(self):
        """Huấn luyện lại mô hình với tất cả dữ liệu"""
        try:
            faces = []
            labels = []

            print("Bắt đầu huấn luyện lại mô hình...")

            # Tạo map đảo ngược từ user_id sang label
            user_to_label_map = {
                user_id: label for label, user_id in self.label_to_user_map.items()
            }

            # Kiểm tra thư mục chứa khuôn mặt
            if not os.path.exists(self.faces_dir):
                print(f"Thư mục {self.faces_dir} không tồn tại, tạo mới.")
                os.makedirs(self.faces_dir)
                return

            # Duyệt qua các thư mục người dùng
            user_count = 0
            for user_id in os.listdir(self.faces_dir):
                user_dir = os.path.join(self.faces_dir, user_id)

                # Bỏ qua nếu không phải thư mục
                if not os.path.isdir(user_dir):
                    continue

                # Tìm nhãn tương ứng với user_id
                if user_id not in user_to_label_map:
                    # Nếu chưa có, tạo nhãn mới
                    next_label = len(user_to_label_map)
                    user_to_label_map[user_id] = next_label
                    self.label_to_user_map[next_label] = user_id
                    print(f"Thêm ánh xạ mới - User ID: {user_id}, Label: {next_label}")

                label = user_to_label_map[user_id]

                # Đọc các ảnh khuôn mặt trong thư mục người dùng
                face_images = [
                    f
                    for f in os.listdir(user_dir)
                    if f.endswith((".jpg", ".jpeg", ".png"))
                ]

                if not face_images:
                    print(f"Không tìm thấy ảnh khuôn mặt cho người dùng {user_id}")
                    continue

                user_count += 1
                face_count = 0

                for face_file in face_images:
                    face_path = os.path.join(user_dir, face_file)
                    face_img = cv2.imread(face_path, cv2.IMREAD_GRAYSCALE)

                    if face_img is None:
                        print(f"Không thể đọc ảnh: {face_path}")
                        continue

                    # Resize nếu cần
                    if face_img.shape[0] < 30 or face_img.shape[1] < 30:
                        print(f"Ảnh quá nhỏ, bỏ qua: {face_path}")
                        continue

                    # Thêm vào tập huấn luyện
                    faces.append(face_img)
                    labels.append(label)
                    face_count += 1

                print(
                    f"Đã đọc {face_count} ảnh khuôn mặt cho người dùng {user_id} (Label: {label})"
                )

            # Cập nhật known_face_ids từ các thư mục đã quét
            for user_id in user_to_label_map:
                if user_id not in self.known_face_ids:
                    self.known_face_ids.append(user_id)

            print(f"Tổng cộng: {user_count} người dùng, {len(faces)} khuôn mặt")

            # Huấn luyện bộ nhận diện nếu có đủ dữ liệu
            if len(faces) > 0 and len(np.unique(labels)) > 0:
                self.face_recognizer.train(faces, np.array(labels))
                self.trained = True
                print("Đã huấn luyện lại mô hình thành công")
            else:
                print("Không đủ dữ liệu để huấn luyện mô hình")
                self.trained = False

        except Exception as e:
            print(f"Lỗi khi huấn luyện lại mô hình: {str(e)}")
            import traceback

            traceback.print_exc()

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

    def recognize_faces(self, frame, confidence_threshold=25):
        """Nhận diện khuôn mặt trong frame và trả về danh sách thông tin"""
        if not self.trained or not self.known_face_ids:
            print("Mô hình chưa được huấn luyện hoặc không có khuôn mặt đã biết")
            return self.detect_faces(frame)  # Nếu chưa train, chỉ phát hiện khuôn mặt

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

                print(
                    f"Nhận diện khuôn mặt: Label={label}, Độ tin cậy: {confidence_score:.2f}%"
                )

                if (
                    confidence_score > confidence_threshold
                    and label in self.label_to_user_map
                ):
                    user_id = self.label_to_user_map[label]
                    face_info["user_id"] = user_id
                    face_info["confidence"] = confidence_score
                    print(f"Đã nhận diện: User ID={user_id}")

                recognized_faces.append(face_info)
            except Exception as e:
                print(f"Lỗi khi nhận diện khuôn mặt: {str(e)}")
                recognized_faces.append(face_info)

        return recognized_faces

    def detect_and_draw_faces(self, frame):
        """Phát hiện và vẽ khung quanh khuôn mặt"""
        # Phát hiện khuôn mặt
        faces = self.detect_faces(frame)

        # Vẽ khung quanh khuôn mặt
        for face in faces:
            x, y, w, h = face["x"], face["y"], face["width"], face["height"]
            cv2.rectangle(frame, (x, y), (x + w, y + h), (0, 255, 0), 2)

        return frame
