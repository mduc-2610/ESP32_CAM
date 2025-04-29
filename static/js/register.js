// static/js/register.js
document.addEventListener("DOMContentLoaded", function () {
  // Các phần tử DOM
  const video = document.getElementById("video");
  const canvas = document.getElementById("canvas");
  const capturePhotoBtn = document.getElementById("capturePhoto");
  const registerBtn = document.getElementById("registerBtn");
  const registerForm = document.getElementById("registerForm");
  const photoStatus = document.getElementById("photoStatus");
  const facePreview = document.getElementById("facePreview");
  const recordingIndicator = document.getElementById("recordingIndicator");
  const recordingProgress = document.getElementById("recordingProgress");

  let capturedImages = [];
  let streamRef = null;
  let recordingInterval = null;
  let faceDetectionInterval = null;
  let recordingTime = 0;
  const recordingDuration = 5; // 5 giây

  // Khởi động camera tự động khi trang được tải

  // Hàm khởi động camera
  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef = stream;
      video.srcObject = stream;
      capturePhotoBtn.disabled = false;

      // Hiển thị thông báo
      photoStatus.textContent =
        'Camera đã sẵn sàng. Nhấn "Bắt đầu ghi" để ghi nhận khuôn mặt.';
      photoStatus.classList.remove("d-none");
      photoStatus.classList.remove("alert-danger");
      photoStatus.classList.add("alert-info");

      // Thiết lập canvas face detection
      video.onloadedmetadata = function () {
        facePreview.width = video.videoWidth;
        facePreview.height = video.videoHeight;
        // Bắt đầu phát hiện khuôn mặt sau khi video đã load
        startFaceDetection();
      };
    } catch (error) {
      console.error("Lỗi khi truy cập camera:", error);
      photoStatus.textContent =
        "Không thể truy cập camera. Vui lòng kiểm tra quyền truy cập.";
      photoStatus.classList.remove("d-none");
      photoStatus.classList.add("alert-danger");
      capturePhotoBtn.disabled = true;
    }
  }

  // Phát hiện khuôn mặt
  function startFaceDetection() {
    // Tạo canvas để phát hiện khuôn mặt
    facePreview.classList.remove("d-none");

    // Gửi các frame video để phát hiện khuôn mặt
    faceDetectionInterval = setInterval(() => {
      // Cập nhật kích thước canvas nếu video đã load
      if (video.videoWidth && facePreview.width !== video.videoWidth) {
        facePreview.width = video.videoWidth;
        facePreview.height = video.videoHeight;
      }

      const context = facePreview.getContext("2d");
      context.drawImage(video, 0, 0, facePreview.width, facePreview.height);

      // Gửi frame đến server để phát hiện khuôn mặt
      const frameData = facePreview.toDataURL("image/jpeg");
      detectFaces(frameData);
    }, 200); // Cập nhật mỗi 200ms
  }

  // Gửi frame để phát hiện khuôn mặt
  async function detectFaces(frameData) {
    try {
      const response = await fetch("/api/detect_faces", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ frame: frameData }),
      });

      const result = await response.json();

      if (result.success) {
        // Vẽ hình vuông quanh các khuôn mặt phát hiện được
        drawFaceBoxes(result.faces);
      }
    } catch (error) {
      console.error("Lỗi khi phát hiện khuôn mặt:", error);
    }
  }

  // Vẽ hình vuông quanh khuôn mặt
  function drawFaceBoxes(faces) {
    const context = facePreview.getContext("2d");

    // Xóa các hình vuông cũ
    context.drawImage(video, 0, 0, facePreview.width, facePreview.height);

    // Vẽ hình vuông mới
    context.strokeStyle = "#00FF00";
    context.lineWidth = 3;

    faces.forEach((face) => {
      context.strokeRect(face.x, face.y, face.width, face.height);
    });
  }

  // Xử lý sự kiện khi nhấn nút "Bắt đầu ghi"
  capturePhotoBtn.addEventListener("click", function () {
    startCamera(); // Khởi động camera nếu chưa khởi động
    // Đổi giao diện
    capturePhotoBtn.disabled = true;
    capturePhotoBtn.innerHTML = 'Đang ghi... <span id="countdown">5</span>s';

    // Hiển thị thanh tiến trình
    recordingIndicator.classList.remove("d-none");
    recordingProgress.style.width = "0%";

    // Reset mảng ảnh đã chụp
    capturedImages = [];
    recordingTime = 0;

    // Bắt đầu ghi hình trong 5 giây
    recordingInterval = setInterval(() => {
      recordingTime += 0.1;
      const progressPercent = (recordingTime / recordingDuration) * 100;

      // Cập nhật thanh tiến trình
      recordingProgress.style.width = `${progressPercent}%`;

      // Cập nhật đếm ngược
      const remainingTime = Math.ceil(recordingDuration - recordingTime);
      document.getElementById("countdown").textContent = remainingTime;

      // Chụp ảnh mỗi 0.5 giây
      if (recordingTime % 0.5 < 0.1) {
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = video.videoWidth;
        tempCanvas.height = video.videoHeight;
        const context = tempCanvas.getContext("2d");
        context.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
        capturedImages.push(tempCanvas.toDataURL("image/jpeg"));
      }

      // Kết thúc sau 5 giây
      if (recordingTime >= recordingDuration) {
        clearInterval(recordingInterval);
        finishRecording();
      }
    }, 100);
  });

  // Kết thúc quá trình ghi hình
  function finishRecording() {
    // Dừng phát hiện khuôn mặt
    clearInterval(faceDetectionInterval);

    // Cập nhật giao diện
    capturePhotoBtn.innerHTML = "Bắt đầu ghi";
    capturePhotoBtn.disabled = false;
    recordingIndicator.classList.add("d-none");

    // Hiển thị ảnh đã chụp cuối cùng
    if (capturedImages.length > 0) {
      const lastImage = capturedImages[capturedImages.length - 1];
      const context = canvas.getContext("2d");

      const img = new Image();
      img.onload = function () {
        canvas.width = img.width;
        canvas.height = img.height;
        context.drawImage(img, 0, 0);

        // Hiển thị ảnh đã chụp
        canvas.classList.remove("d-none");
        facePreview.classList.add("d-none");

        // Kích hoạt nút đăng ký
        registerBtn.disabled = false;
      };
      img.src = lastImage;

      // Cập nhật thông báo
      photoStatus.textContent = `Đã ghi ${capturedImages.length} ảnh khuôn mặt thành công!`;
      photoStatus.classList.remove("alert-info", "alert-danger");
      photoStatus.classList.add("alert-success");
    } else {
      photoStatus.textContent =
        "Không thể chụp ảnh khuôn mặt. Vui lòng thử lại.";
      photoStatus.classList.remove("alert-info", "alert-success");
      photoStatus.classList.add("alert-danger");
    }
  }

  // Xử lý sự kiện khi submit form đăng ký
  registerForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    // Kiểm tra thông tin đầu vào
    const name = document.getElementById("name").value.trim();
    const userId = document.getElementById("userId").value.trim();

    if (!name || !userId || capturedImages.length === 0) {
      photoStatus.textContent = "Vui lòng điền đầy đủ thông tin và chụp ảnh";
      photoStatus.classList.remove("alert-info", "alert-success");
      photoStatus.classList.add("alert-danger");
      return;
    }

    // Gửi dữ liệu đăng ký lên server
    try {
      registerBtn.disabled = true;
      registerBtn.innerHTML =
        '<span class="spinner-border spinner-border-sm"></span> Đang xử lý...';

      const response = await fetch("/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name,
          userId: userId,
          faceImages: capturedImages,
        }),
      });

      const result = await response.json();

      // Hiển thị kết quả qua modal
      const resultModal = new bootstrap.Modal(
        document.getElementById("resultModal")
      );
      const modalTitle = document.getElementById("modalTitle");
      const modalBody = document.getElementById("modalBody");

      if (result.success) {
        modalTitle.textContent = "Đăng ký thành công";
        modalBody.innerHTML = `
                    <div class="alert alert-success">
                        ${result.message}
                    </div>
                    <p>Thông tin đăng ký:</p>
                    <ul>
                        <li><strong>Họ tên:</strong> ${name}</li>
                        <li><strong>ID:</strong> ${userId}</li>
                    </ul>
                `;

        // Reset form
        registerForm.reset();
        canvas.classList.add("d-none");
        capturedImages = [];

        // Khởi động lại nhận diện khuôn mặt
        startFaceDetection();

        registerBtn.disabled = true;
      } else {
        modalTitle.textContent = "Đăng ký thất bại";
        modalBody.innerHTML = `
                    <div class="alert alert-danger">
                        ${result.message}
                    </div>
                `;
      }

      resultModal.show();
    } catch (error) {
      console.error("Lỗi khi đăng ký:", error);
      photoStatus.textContent = "Có lỗi xảy ra. Vui lòng thử lại sau.";
      photoStatus.classList.remove("alert-info", "alert-success");
      photoStatus.classList.add("alert-danger");
    } finally {
      registerBtn.disabled = false;
      registerBtn.textContent = "Đăng ký";
    }
  });

  // Dọn dẹp khi người dùng rời trang
  window.addEventListener("beforeunload", function () {
    if (streamRef) {
      const tracks = streamRef.getTracks();
      tracks.forEach((track) => track.stop());
    }
    if (recordingInterval) {
      clearInterval(recordingInterval);
    }
    if (faceDetectionInterval) {
      clearInterval(faceDetectionInterval);
    }
  });
});
