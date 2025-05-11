// static/js/attendance.js - Capture version
document.addEventListener("DOMContentLoaded", function () {
  // DOM elements
  const cameraStream = document.getElementById("cameraStream");
  const canvas = document.getElementById("canvas");
  const facePreview = document.getElementById("facePreview");
  const startCameraBtn = document.getElementById("startCamera");
  const capturePhotoBtn = document.getElementById("capturePhoto");
  const refreshCaptureBtn = document.getElementById("refreshCapture");
  const attendanceList = document.getElementById("attendanceList");
  const dateTimeDisplay = document.getElementById("dateTimeDisplay");
  const cameraIpInput = document.getElementById("cameraIpInput");
  const connectCameraBtn = document.getElementById("connectCamera");
  const photoStatus = document.getElementById("photoStatus");
  
  // State variables
  let cameraIp = "";
  let streamActive = false;
  let isProcessingImage = false;
  let capturedFrame = null;
  
  // Load camera IP from localStorage if available
  loadCameraIpFromLocalStorage();
  
  // Update date and time display
  function updateDateTime() {
    const now = new Date();
    const options = {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    };
    if (dateTimeDisplay) {
      dateTimeDisplay.textContent = now.toLocaleDateString("vi-VN", options);
    }
  }
  
  // Update date/time if the display element exists
  if (dateTimeDisplay) {
    updateDateTime();
  }
  
  // Connect camera button event handler
  connectCameraBtn.addEventListener("click", function() {
    cameraIp = cameraIpInput.value.trim();
    
    if (!cameraIp) {
      alert("Vui lòng nhập địa chỉ IP của ESP32-CAM");
      return;
    }

    const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipPattern.test(cameraIp)) {
      alert("Địa chỉ IP không hợp lệ. Vui lòng kiểm tra lại.");
      return;
    }

    connectCameraBtn.disabled = true;
    connectCameraBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Đang kết nối...';
    
    photoStatus.textContent = 'Đang kết nối đến ESP32-CAM...';
    photoStatus.classList.remove("d-none");
    photoStatus.classList.remove("alert-danger", "alert-success");
    photoStatus.classList.add("alert-info");
    
    testCameraConnection();
  });

  function testCameraConnection() {
    // Test connection by fetching a capture
    const testUrl = `http://${cameraIp}/capture`;
    
    fetch(testUrl, { 
      method: 'GET',
      cache: 'no-store'
    })
    .then(response => {
      if (response.ok) {
        enableCameraControls();
      } else {
        throw new Error('Connection failed');
      }
    })
    .catch(error => {
      connectCameraBtn.disabled = false;
      connectCameraBtn.textContent = "Kết nối";
      photoStatus.textContent = `Không thể kết nối đến ESP32-CAM. Vui lòng kiểm tra địa chỉ IP.`;
      photoStatus.classList.remove("alert-info");
      photoStatus.classList.add("alert-danger");
    });
  }

  function enableCameraControls() {
    startCameraBtn.disabled = false;
    connectCameraBtn.disabled = false;
    connectCameraBtn.textContent = "Đã kết nối";
    connectCameraBtn.classList.remove("btn-outline-primary");
    connectCameraBtn.classList.add("btn-success");
    
    photoStatus.textContent = 'Camera ESP32 đã sẵn sàng. Nhấn "Bắt đầu stream" để xem hình ảnh từ camera.';
    photoStatus.classList.remove("alert-danger");
    photoStatus.classList.add("alert-success");

    facePreview.classList.remove("d-none");
    facePreview.width = 480;
    facePreview.height = 360;
    
    saveCameraIpToLocalStorage();
  }

  // Start camera button event handler
  if (startCameraBtn) {
    startCameraBtn.addEventListener("click", function () {
      if (streamActive) {
        stopCameraStream();
        startCameraBtn.textContent = "Bắt đầu stream";
        capturePhotoBtn.disabled = true;
        photoStatus.textContent = "Stream đã dừng";
        photoStatus.classList.remove("alert-success");
        photoStatus.classList.add("alert-info");
      } else {
        startCameraStream();
        startCameraBtn.textContent = "Dừng stream";
        capturePhotoBtn.disabled = false;
        photoStatus.textContent = "Stream đã bắt đầu. Nhấn 'Chụp ảnh' để nhận diện khuôn mặt.";
        photoStatus.classList.remove("alert-info");
        photoStatus.classList.add("alert-success");
      }
    });
  }
  
  // Capture photo button event handler
  if (capturePhotoBtn) {
    capturePhotoBtn.addEventListener("click", function () {
      if (!streamActive || isProcessingImage) {
        return;
      }
      
      // Dừng stream trước khi chụp ảnh
      stopCameraStream();
      
      // Vô hiệu hóa nút bắt đầu stream sau khi chụp ảnh
      startCameraBtn.disabled = true;
      
      // Tiến hành chụp ảnh
      captureCurrentFrame();
    });
  }
  
  // Refresh capture button event handler
  if (refreshCaptureBtn) {
    refreshCaptureBtn.addEventListener("click", function () {
      if (isProcessingImage) {
        cancelRecognition();
      } else {
        // Kích hoạt lại nút "Bắt đầu stream"
        startCameraBtn.disabled = false;
        startCameraBtn.textContent = "Bắt đầu stream";
        
        // Reset trạng thái để cho phép bắt đầu stream lại
        streamActive = false;
        capturedFrame = null;
        
        photoStatus.textContent = "Sẵn sàng bắt đầu stream lại.";
        photoStatus.classList.remove("alert-success", "alert-danger", "alert-warning");
        photoStatus.classList.add("alert-info");
        
        // Xóa hình ảnh hiển thị trên preview
        if (facePreview) {
          const context = facePreview.getContext("2d");
          context.clearRect(0, 0, facePreview.width, facePreview.height);
        }
      }
    });
  }
  
  // Start camera stream
  function startCameraStream() {
    if (!cameraIp) {
      photoStatus.textContent = "Vui lòng kết nối ESP32-CAM trước";
      return;
    }
    
    streamActive = true;
    capturePhotoBtn.disabled = false;
    refreshCaptureBtn.disabled = true;
    
    if (cameraStream) {
      cameraStream.style.display = "block";
      cameraStream.src = `http://${cameraIp}/stream`;
    }
  }
  
  // Stop camera stream
  function stopCameraStream() {
    streamActive = false;
    capturePhotoBtn.disabled = true;
    
    if (cameraStream) {
      cameraStream.src = "";
      cameraStream.style.display = "none";
    }
    
    // Clear the preview canvas
    if (facePreview) {
      const context = facePreview.getContext("2d");
      context.clearRect(0, 0, facePreview.width, facePreview.height);
    }
  }

  // Capture the current frame for recognition
  async function captureCurrentFrame() {
    isProcessingImage = true;
    
    photoStatus.textContent = "Đang chụp và xử lý hình ảnh...";
    photoStatus.classList.remove("alert-success", "alert-danger");
    photoStatus.classList.add("alert-info");
    
    capturePhotoBtn.disabled = true;
    refreshCaptureBtn.disabled = false;
    
    // Hide stream and show only the captured image
    if (cameraStream) {
      cameraStream.style.display = "none";
    }
    
    try {
      const timestamp = new Date().getTime();
      const captureUrl = `http://${cameraIp}/capture?t=${timestamp}`;
      
      const response = await fetch(captureUrl, {
        method: 'GET',
        cache: 'no-store'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }
      
      const blob = await response.blob();
      const reader = new FileReader();
      
      reader.onloadend = function() {
        const frameData = reader.result;
        
        // Draw the frame to canvas
        drawFrameToPreview(frameData);
        
        // Save and recognize
        capturedFrame = frameData;
        recognizeFaces(frameData);
      };
      
      reader.readAsDataURL(blob);
    } catch (error) {
      handleCaptureError(error);
    }
  }
  
  // Cancel current recognition and restart stream
  function cancelRecognition() {
    isProcessingImage = false;
    capturedFrame = null;
    
    photoStatus.textContent = "Đã hủy nhận diện. Nhấn 'Bắt đầu stream' để tiếp tục.";
    photoStatus.classList.remove("alert-info", "alert-danger");
    photoStatus.classList.add("alert-warning");
    
    // Kích hoạt lại nút bắt đầu stream
    startCameraBtn.disabled = false;
    refreshCaptureBtn.disabled = true;
    capturePhotoBtn.disabled = true;
  }

  // Draw frame to preview canvas
  function drawFrameToPreview(frameData) {
    const img = new Image();
    img.onload = function() {
      if (!facePreview) return;
      
      if (facePreview.width !== img.width || facePreview.height !== img.height) {
        facePreview.width = img.width || 480;
        facePreview.height = img.height || 360;
      }
      
      const context = facePreview.getContext("2d");
      context.drawImage(img, 0, 0, facePreview.width, facePreview.height);
    };
    img.src = frameData;
  }

  // Handle capture error
  function handleCaptureError(error) {
    photoStatus.textContent = `Lỗi khi chụp ảnh: ${error.message}`;
    photoStatus.classList.remove("alert-info");
    photoStatus.classList.add("alert-danger");
    
    isProcessingImage = false;
    
    // Kích hoạt lại nút bắt đầu stream trong trường hợp lỗi
    startCameraBtn.disabled = false;
    refreshCaptureBtn.disabled = false;
    capturePhotoBtn.disabled = true;
  }

  // Recognize faces in the captured frame
  async function recognizeFaces(frameData) {
    try {
      photoStatus.textContent = "Đang nhận diện khuôn mặt...";
      photoStatus.classList.remove("alert-danger", "alert-warning");
      photoStatus.classList.add("alert-info");

      const response = await fetch("/api/recognize_faces", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ frame: frameData }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        drawFaceBoxesWithNames(result.faces, frameData);
        
        if (result.attendance) {
          loadAttendanceList();
          photoStatus.textContent = "Điểm danh thành công! Nhấn 'Làm mới' để quay lại stream.";
          photoStatus.classList.remove("alert-info", "alert-warning");
          photoStatus.classList.add("alert-success");
        } else {
          photoStatus.textContent = "Nhận diện hoàn tất nhưng không đủ điều kiện để điểm danh. Nhấn 'Làm mới' để quay lại stream.";
          photoStatus.classList.remove("alert-success", "alert-info");
          photoStatus.classList.add("alert-warning");
        }
      } else {
        photoStatus.textContent = `Lỗi khi nhận diện: ${result.message || "Unknown error"}. Nhấn 'Làm mới' để quay lại stream.`;
        photoStatus.classList.remove("alert-success", "alert-info");
        photoStatus.classList.add("alert-warning");
      }
    } catch (error) {
      console.error("Error in face recognition:", error);
      photoStatus.textContent = `Lỗi nhận diện khuôn mặt: ${error.message}. Nhấn 'Làm mới' để quay lại stream.`;
      photoStatus.classList.remove("alert-success", "alert-info");
      photoStatus.classList.add("alert-danger");
    } finally {
      isProcessingImage = false;
      refreshCaptureBtn.disabled = false;
      
      // Stream vẫn ẩn, không tự động khởi động lại stream
      // Người dùng phải nhấn 'Làm mới' để trở lại stream
    }
  }

  // Draw face boxes with names for recognition results
  function drawFaceBoxesWithNames(faces, frameData) {
    if (!facePreview) return;
    
    const img = new Image();
    img.onload = function() {
      const context = facePreview.getContext("2d");
      
      // Clear and redraw the base image
      context.drawImage(img, 0, 0, facePreview.width, facePreview.height);

      // Draw face boxes and names
      faces.forEach((face) => {
        // Box color: green for recognized, red for unknown
        context.strokeStyle = face.name ? "#00FF00" : "#FF0000";
        context.lineWidth = 3;
        context.strokeRect(face.x, face.y, face.width, face.height);

        // Background for name label
        const nameText = face.name || "Unknown";
        const confidence = face.confidence ? ` (${Math.round(face.confidence * 100)}%)` : '';
        const displayText = nameText + confidence;
        
        context.font = "16px Arial";
        const textMetrics = context.measureText(displayText);
        const textWidth = textMetrics.width;
        const textHeight = 25;
        
        context.fillStyle = "rgba(0, 0, 0, 0.7)";
        context.fillRect(face.x, face.y - textHeight, textWidth + 10, textHeight);

        // Draw name text
        context.fillStyle = face.name ? "#00FF00" : "#FF0000";
        context.fillText(displayText, face.x + 5, face.y - 8);
      });
    };
    
    img.src = frameData;
  }

  // Load attendance list from server
  async function loadAttendanceList() {
    if (!attendanceList) return;
    
    try {
      const response = await fetch("/api/attendance");
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }
      
      const attendanceData = await response.json();

      attendanceList.innerHTML = "";

      if (attendanceData.length === 0) {
        attendanceList.innerHTML = '<tr><td colspan="3" class="text-center">Chưa có điểm danh hôm nay</td></tr>';
      } else {
        attendanceData.forEach((record) => {
          const row = document.createElement("tr");
          row.innerHTML = `
            <td>${record.name}</td>
            <td>${record.userId || record.user_id}</td>
            <td>${record.time}</td>
          `;
          attendanceList.appendChild(row);
        });
      }
    } catch (error) {
      console.error("Error loading attendance list:", error);
      photoStatus.textContent = "Lỗi khi tải danh sách điểm danh";
      photoStatus.classList.remove("alert-info", "alert-success");
      photoStatus.classList.add("alert-danger");
    }
  }

  function saveCameraIpToLocalStorage() {
    if (cameraIp) {
      localStorage.setItem('esp32CamIp', cameraIp);
    }
  }

  function loadCameraIpFromLocalStorage() {
    const savedIp = localStorage.getItem('esp32CamIp');
    if (savedIp && cameraIpInput) {
      cameraIpInput.value = savedIp;
    }
  }

  // Load attendance list when page loads
  loadAttendanceList();

  // Clean up when user leaves page
  window.addEventListener("beforeunload", function () {
    if (streamActive) {
      saveCameraIpToLocalStorage();
    }
  });
});