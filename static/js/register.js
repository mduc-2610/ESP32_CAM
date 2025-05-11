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
  const registerButtonContainer = document.getElementById("registerButtonContainer");

  let capturedImages = [];
  let streamRef = null;
  let recordingInterval = null;
  let recordingTime = 0;
  const recordingDuration = 5; // 5 giây

  // Khởi động camera tự động khi trang được tải
  startCamera();

  // Hàm khởi động camera - chỉ hiển thị luồng video, không phát hiện khuôn mặt
  async function startCamera() {
    // Hiển thị thông báo khi đang khởi động camera
    photoStatus.textContent = "Đang khởi động camera...";
    photoStatus.classList.remove("d-none");
    photoStatus.classList.remove("alert-danger", "alert-success");
    photoStatus.classList.add("alert-info");
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef = stream;
      video.srcObject = stream;
      capturePhotoBtn.disabled = false;

      // Hiển thị thông báo
      photoStatus.textContent = 'Camera đã sẵn sàng. Nhấn "Bắt đầu ghi" để ghi nhận khuôn mặt.';
      photoStatus.classList.remove("d-none", "alert-danger");
      photoStatus.classList.add("alert-success");
    } catch (error) {
      console.error("Lỗi khi truy cập camera:", error);
      photoStatus.textContent = "Không thể truy cập camera. Vui lòng kiểm tra quyền truy cập.";
      photoStatus.classList.remove("d-none", "alert-success", "alert-info");
      photoStatus.classList.add("alert-danger");
      capturePhotoBtn.disabled = true;
    }
  }

  // Phát hiện khuôn mặt trong frame
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
        return result.faces.length > 0; // Trả về true nếu phát hiện khuôn mặt
      }
      return false;
    } catch (error) {
      console.error("Lỗi khi phát hiện khuôn mặt:", error);
      return false;
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
  capturePhotoBtn.addEventListener("click", async function () {
    // Ẩn container nút đăng ký nếu đang hiển thị
    registerButtonContainer.style.display = "none";
    
    // Đổi giao diện
    capturePhotoBtn.disabled = true;
    capturePhotoBtn.innerHTML = 'Đang chuẩn bị...';
    photoStatus.textContent = "Đang tìm kiếm khuôn mặt...";
    photoStatus.classList.remove("d-none", "alert-success", "alert-danger");
    photoStatus.classList.add("alert-info");

    // Chuẩn bị canvas cho việc phát hiện khuôn mặt
    facePreview.width = video.videoWidth;
    facePreview.height = video.videoHeight;
    facePreview.classList.remove("d-none");
    const context = facePreview.getContext("2d");
    context.drawImage(video, 0, 0, facePreview.width, facePreview.height);
    
    // Lấy frame hiện tại để phát hiện khuôn mặt
    const frameData = facePreview.toDataURL("image/jpeg");
    const hasFace = await detectFaces(frameData);
    
    if (!hasFace) {
      capturePhotoBtn.disabled = false;
      capturePhotoBtn.innerHTML = 'Bắt đầu ghi';
      photoStatus.textContent = "Không phát hiện khuôn mặt nào. Vui lòng điều chỉnh vị trí và thử lại.";
      photoStatus.classList.remove("alert-info");
      photoStatus.classList.add("alert-danger");
      facePreview.classList.add("d-none");
      return;
    }
    
    // Tiếp tục quá trình ghi nếu phát hiện khuôn mặt
    capturePhotoBtn.innerHTML = 'Đang ghi... <span id="countdown">5</span>s';
    photoStatus.textContent = "Đang ghi khuôn mặt, vui lòng giữ nguyên vị trí...";
    photoStatus.classList.remove("alert-danger");
    photoStatus.classList.add("alert-info");

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
        // Tiếp tục phát hiện khuôn mặt trong quá trình ghi
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = video.videoWidth;
        tempCanvas.height = video.videoHeight;
        const context = tempCanvas.getContext("2d");
        context.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
        
        // Lưu ảnh đã chụp
        capturedImages.push(tempCanvas.toDataURL("image/jpeg"));
        
        // Cập nhật khung khuôn mặt
        const frameData = tempCanvas.toDataURL("image/jpeg");
        detectFaces(frameData);
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
    // Dừng các interval
    if (recordingInterval) {
      clearInterval(recordingInterval);
    }
    
    // Cập nhật giao diện
    capturePhotoBtn.innerHTML = "Bắt đầu ghi lại";
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
        video.classList.add("d-none");
        facePreview.classList.add("d-none");

        // Hiển thị và kích hoạt nút đăng ký
        registerButtonContainer.style.display = "block";
        registerBtn.classList.add("btn-pulse");
        
        // Cuộn đến nút đăng ký
        registerButtonContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
      };
      img.src = lastImage;

      // Cập nhật thông báo với hướng dẫn rõ ràng
      photoStatus.textContent = `Đã ghi ${capturedImages.length} ảnh khuôn mặt thành công!`;
      photoStatus.classList.remove("alert-info", "alert-danger", "d-none");
      photoStatus.classList.add("alert-success");
    } else {
      photoStatus.textContent = "Không thể chụp ảnh khuôn mặt. Vui lòng thử lại.";
      photoStatus.classList.remove("alert-info", "alert-success", "d-none");
      photoStatus.classList.add("alert-danger");
    }
  }
  
  // Khởi động lại quá trình chụp ảnh
  function resetCaptureProcess() {
    // Ẩn canvas hiển thị ảnh
    canvas.classList.add("d-none");
    facePreview.classList.add("d-none");
    
    // Hiển thị lại video
    video.classList.remove("d-none");
    
    // Reset mảng ảnh đã chụp
    capturedImages = [];
    
    // Ẩn container nút đăng ký
    registerButtonContainer.style.display = "none";
    registerBtn.classList.remove("btn-pulse");
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
      registerBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Đang xử lý...';

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
      const resultModal = new bootstrap.Modal(document.getElementById("resultModal"));
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
        resetCaptureProcess();
        
        // Thiết lập lại thông báo
        photoStatus.textContent = 'Camera đã sẵn sàng. Nhấn "Bắt đầu ghi" để ghi nhận khuôn mặt.';
        photoStatus.classList.remove("alert-danger");
        photoStatus.classList.add("alert-success");
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
  });
});