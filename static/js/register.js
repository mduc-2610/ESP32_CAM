// static/js/register.js - Updated version
document.addEventListener("DOMContentLoaded", function () {
  const cameraStream = document.getElementById("cameraStream");
  const canvas = document.getElementById("canvas");
  const capturePhotoBtn = document.getElementById("capturePhoto");
  const registerBtn = document.getElementById("registerBtn");
  const registerForm = document.getElementById("registerForm");
  const photoStatus = document.getElementById("photoStatus");
  const facePreview = document.getElementById("facePreview");
  const recordingIndicator = document.getElementById("recordingIndicator");
  const recordingProgress = document.getElementById("recordingProgress");
  const cameraIpInput = document.getElementById("cameraIp");
  const connectCameraBtn = document.getElementById("connectCamera");

  let capturedImages = [];
  let recordingInterval = null;
  let faceDetectionInterval = null;
  let frameCapturingInterval = null;
  let recordingTime = 0;
  const recordingDuration = 5; 
  let cameraIp = "";
  let streamActive = false;
  let connectionAttempts = 0;
  const MAX_CONNECTION_ATTEMPTS = 3;

  // Load camera IP from localStorage if available
  loadCameraIpFromLocalStorage();

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

    // Reset connection attempts
    connectionAttempts = 0;
    
    // Update UI to show connection in progress
    connectCameraBtn.disabled = true;
    connectCameraBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Đang kết nối...';
    
    photoStatus.textContent = 'Đang kết nối đến ESP32-CAM...';
    photoStatus.classList.remove("d-none");
    photoStatus.classList.remove("alert-danger", "alert-success");
    photoStatus.classList.add("alert-info");
    
    // Try to connect using the proxy first
    connectToCameraViaProxy();
  });

  function connectToCameraViaProxy() {
    // Test the connection first using a fetch call to the proxy endpoint
    const timestamp = new Date().getTime();
    const proxyUrl = `/api/proxy/esp32cam/capture?ip=${encodeURIComponent(cameraIp)}&t=${timestamp}`;
    
    // Use a timeout to avoid hanging if the server is not responding
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Connection timed out')), 5000)
    );
    
    Promise.race([
      fetch(proxyUrl, { 
        method: 'GET',
        cache: 'no-store'
      }),
      timeoutPromise
    ])
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      return response.blob();
    })
    .then(blob => {
      if (blob.size < 100) {
        throw new Error("Invalid image received - too small");
      }
      
      // Connection successful, proceed with setup
      setupCameraStream();
    })
    .catch(error => {
      connectionAttempts++;
      console.error(`Connection attempt ${connectionAttempts} failed:`, error);
      
      if (connectionAttempts < MAX_CONNECTION_ATTEMPTS) {
        // Retry after a short delay
        setTimeout(connectToCameraViaProxy, 1000);
        
        photoStatus.textContent = `Đang thử kết nối lần ${connectionAttempts + 1}/${MAX_CONNECTION_ATTEMPTS}...`;
      } else {
        // All attempts failed, update UI
        connectCameraBtn.disabled = false;
        connectCameraBtn.textContent = "Kết nối";
        
        photoStatus.textContent = `Không thể kết nối đến ESP32-CAM: ${error.message}. Vui lòng kiểm tra địa chỉ IP.`;
        photoStatus.classList.remove("alert-info");
        photoStatus.classList.add("alert-danger");
        
        // Offer direct connection as a fallback
        showDirectConnectionFallback();
      }
    });
  }

  function setupCameraStream() {
    // Set up a placeholder image first
    const placeholderImg = document.createElement('img');
    placeholderImg.src = "/static/images/camera-placeholder.png";
    if (!placeholderImg.src.includes('camera-placeholder.png')) {
      placeholderImg.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='480' height='360' viewBox='0 0 480 360'%3E%3Crect width='480' height='360' fill='%23f0f0f0'/%3E%3Ctext x='240' y='180' text-anchor='middle' fill='%23999999' font-family='Arial' font-size='18'%3ECamera Stream Loading...%3C/text%3E%3C/svg%3E";
    }
    
    // Create an image element for ESP32-CAM stream
    cameraStream.style.display = "none";
    
    // Update UI to show success
    streamActive = true;
    capturePhotoBtn.disabled = false;
    connectCameraBtn.disabled = false;
    connectCameraBtn.textContent = "Đã kết nối";
    connectCameraBtn.classList.remove("btn-outline-primary");
    connectCameraBtn.classList.add("btn-success");
    
    photoStatus.textContent = 'Camera ESP32 đã sẵn sàng. Nhấn "Bắt đầu ghi" để ghi nhận khuôn mặt.';
    photoStatus.classList.remove("alert-danger");
    photoStatus.classList.add("alert-success");

    // Initialize face preview
    facePreview.classList.remove("d-none");
    facePreview.width = cameraStream.width || 480;
    facePreview.height = cameraStream.height || 360;
    
    // Start detecting faces
    startFaceDetection();
    
    // Save the camera IP for future use
    saveCameraIpToLocalStorage();
  }

  function startFaceDetection() {
    // Clear any existing interval
    if (faceDetectionInterval) {
      clearInterval(faceDetectionInterval);
    }
    
    facePreview.classList.remove("d-none");

    // Start capturing frames at regular intervals
    faceDetectionInterval = setInterval(() => {
      captureFrameFromESP32();
    }, 500); // Capture frame every 500ms
  }

  async function captureFrameFromESP32() {
    if (!streamActive) return;
    
    try {
      // Add timestamp to prevent browser caching
      const timestamp = new Date().getTime();
      const proxyUrl = `/api/proxy/esp32cam/capture?ip=${encodeURIComponent(cameraIp)}&t=${timestamp}`;
      
      const response = await fetch(proxyUrl, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      const blob = await response.blob();
      
      if (blob.size < 100) {
        throw new Error("Invalid image received");
      }
      
      const reader = new FileReader();
      reader.onloadend = function() {
        const frameData = reader.result;
        drawFrameToCanvas(frameData);
        detectFaces(frameData);
      };
      reader.readAsDataURL(blob);
    } catch (error) {
      console.error("Lỗi khi chụp frame từ ESP32-CAM:", error);
      
      // If we lose connection during operation
      if (streamActive) {
        photoStatus.textContent = `Lỗi kết nối: ${error.message}`;
        photoStatus.classList.remove("alert-info", "alert-success");
        photoStatus.classList.add("alert-warning");
      }
    }
  }
  
  function drawFrameToCanvas(frameData) {
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
        drawFaceBoxes(result.faces);
      }
    } catch (error) {
      console.error("Lỗi khi phát hiện khuôn mặt:", error);
    }
  }

  function drawFaceBoxes(faces) {
    if (!facePreview) return;
    
    const context = facePreview.getContext("2d");
    
    // Redraw the latest frame first
    const lastFrame = new Image();
    lastFrame.onload = function() {
      context.drawImage(lastFrame, 0, 0, facePreview.width, facePreview.height);

      // Then draw the face boxes
      context.strokeStyle = "#00FF00";
      context.lineWidth = 3;

      faces.forEach((face) => {
        context.strokeRect(face.x, face.y, face.width, face.height);
      });
    };
    
    // Use the captured frame or current stream
    if (capturedImages.length > 0) {
      lastFrame.src = capturedImages[capturedImages.length - 1];
    } else {
      // Create a new frame capture
      captureFrameFromESP32().then(() => {
        if (capturedImages.length > 0) {
          lastFrame.src = capturedImages[capturedImages.length - 1];
        }
      });
    }
  }

  // function showDirectConnectionFallback() {
  //   // Create a direct connection fallback button
  //   const fallbackDiv = document.createElement('div');
  //   fallbackDiv.className = 'mt-3 alert alert-warning';
  //   fallbackDiv.innerHTML = `
  //     <p><strong>Không thể kết nối qua proxy!</strong></p>
  //     <p>Bạn có thể thử kết nối trực tiếp đến ESP32-CAM:</p>
  //     <button class="btn btn-sm btn-primary" id="directConnectBtn">
  //       Thử kết nối trực tiếp
  //     </button>
  //   `;
    
  //   // Add fallback div after the camera IP input group
  //   const inputGroup = cameraIpInput.closest('.input-group');
  //   if (inputGroup && inputGroup.parentNode) {
  //     inputGroup.parentNode.appendChild(fallbackDiv);
      
  //     // Add event listener to the direct connect button
  //     document.getElementById('directConnectBtn').addEventListener('click', function() {
  //       window.open(`http://${cameraIp}/`, '_blank');
  //     });
  //   }
  // }

  capturePhotoBtn.addEventListener("click", function () {
    if (!streamActive) {
      alert("Vui lòng kết nối ESP32-CAM trước khi bắt đầu ghi");
      return;
    }

    capturePhotoBtn.disabled = true;
    capturePhotoBtn.innerHTML = 'Đang ghi... <span id="countdown">5</span>s';

    recordingIndicator.classList.remove("d-none");
    recordingProgress.style.width = "0%";

    capturedImages = [];
    recordingTime = 0;

    recordingInterval = setInterval(() => {
      recordingTime += 0.1;
      const progressPercent = (recordingTime / recordingDuration) * 100;

      recordingProgress.style.width = `${progressPercent}%`;

      const remainingTime = Math.ceil(recordingDuration - recordingTime);
      document.getElementById("countdown").textContent = remainingTime;

      if (recordingTime % 0.5 < 0.1) {
        capturePhoto();
      }

      if (recordingTime >= recordingDuration) {
        clearInterval(recordingInterval);
        finishRecording();
      }
    }, 100);
  });

  async function capturePhoto() {
    try {
      // Add timestamp to prevent browser caching
      const timestamp = new Date().getTime();
      const proxyUrl = `/api/proxy/esp32cam/capture?ip=${encodeURIComponent(cameraIp)}&t=${timestamp}`;
      
      const response = await fetch(proxyUrl, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      const blob = await response.blob();
      
      if (blob.size < 100) {
        throw new Error("Invalid image received");
      }
      
      const reader = new FileReader();
      reader.onloadend = function() {
        capturedImages.push(reader.result);
        console.log("Image captured successfully");  
      };
      reader.readAsDataURL(blob);
    } catch (error) {
      console.error("Error capturing image:", error);
    }
  }

  function finishRecording() {
    // Don't clear the face detection interval, we want to keep showing the video feed
    // clearInterval(faceDetectionInterval);

    capturePhotoBtn.innerHTML = "Bắt đầu ghi";
    capturePhotoBtn.disabled = false;
    recordingIndicator.classList.add("d-none");

    if (capturedImages.length > 0) {
      const lastImage = capturedImages[capturedImages.length - 1];
      const context = canvas.getContext("2d");

      const img = new Image();
      img.onload = function () {
        canvas.width = img.width;
        canvas.height = img.height;
        context.drawImage(img, 0, 0);

        canvas.classList.remove("d-none");
        facePreview.classList.add("d-none");

        registerBtn.disabled = false;
      };
      img.src = lastImage;

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

  registerForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    const name = document.getElementById("name").value.trim();
    const userId = document.getElementById("userId").value.trim();

    if (!name || !userId || capturedImages.length === 0) {
      photoStatus.textContent = "Vui lòng điền đầy đủ thông tin và chụp ảnh";
      photoStatus.classList.remove("alert-info", "alert-success");
      photoStatus.classList.add("alert-danger");
      return;
    }

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

        registerForm.reset();
        canvas.classList.add("d-none");
        capturedImages = [];

        // Restart face detection after successful registration
        facePreview.classList.remove("d-none");
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

  function saveCameraIpToLocalStorage() {
    if (cameraIp) {
      localStorage.setItem('esp32CamIp', cameraIp);
    }
  }

  function loadCameraIpFromLocalStorage() {
    const savedIp = localStorage.getItem('esp32CamIp');
    if (savedIp) {
      cameraIpInput.value = savedIp;
    }
  }

  window.addEventListener("beforeunload", function () {
    if (streamActive) {
      saveCameraIpToLocalStorage();
    }
    if (recordingInterval) {
      clearInterval(recordingInterval);
    }
    if (faceDetectionInterval) {
      clearInterval(faceDetectionInterval);
    }
    if (frameCapturingInterval) {
      clearInterval(frameCapturingInterval);
    }
  });
});