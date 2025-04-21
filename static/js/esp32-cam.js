// static/js/esp32cam-integration.js
document.addEventListener("DOMContentLoaded", function () {
    // DOM Elements
    const videoElement = document.getElementById("video");
    const facePreview = document.getElementById("facePreview");
    const canvas = document.getElementById("canvas");
    const capturePhotoBtn = document.getElementById("capturePhoto");
    const registerBtn = document.getElementById("registerBtn");
    const registerForm = document.getElementById("registerForm");
    const photoStatus = document.getElementById("photoStatus");
    const recordingIndicator = document.getElementById("recordingIndicator");
    const recordingProgress = document.getElementById("recordingProgress");
    const esp32IpInput = document.getElementById("esp32IpInput");
    const connectESP32Btn = document.getElementById("connectESP32Btn");
    const esp32Status = document.getElementById("esp32Status");
    
    let capturedImages = [];
    let streamRef = null;
    let recordingInterval = null;
    let faceDetectionInterval = null;
    let recordingTime = 0;
    const recordingDuration = 5; // 5 seconds
    let esp32Stream = null;
    let isUsingESP32 = false;
    
    // Connect to ESP32-CAM
    connectESP32Btn.addEventListener("click", function() {
      const esp32Ip = esp32IpInput.value.trim();
      
      if (!esp32Ip) {
        esp32Status.textContent = "Vui lòng nhập địa chỉ IP của ESP32-CAM";
        esp32Status.classList.remove("alert-success", "alert-info");
        esp32Status.classList.add("alert-danger");
        esp32Status.classList.remove("d-none");
        return;
      }
      
      // Validate IP format
      const ipRegex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
      if (!ipRegex.test(esp32Ip)) {
        esp32Status.textContent = "Địa chỉ IP không hợp lệ";
        esp32Status.classList.remove("alert-success", "alert-info");
        esp32Status.classList.add("alert-danger");
        esp32Status.classList.remove("d-none");
        return;
      }
      
      // Update status
      esp32Status.textContent = "Đang kết nối đến ESP32-CAM...";
      esp32Status.classList.remove("alert-danger", "alert-success");
      esp32Status.classList.add("alert-info");
      esp32Status.classList.remove("d-none");
      
      // Create img element for testing connection
      const testImg = new Image();
      testImg.onload = function() {
        // Connection successful
        esp32Status.textContent = "Đã kết nối thành công đến ESP32-CAM";
        esp32Status.classList.remove("alert-danger", "alert-info");
        esp32Status.classList.add("alert-success");
        
        // Switch to ESP32 camera
        switchToESP32Cam(esp32Ip);
      };
      testImg.onerror = function() {
        // Connection failed
        esp32Status.textContent = "Không thể kết nối đến ESP32-CAM. Vui lòng kiểm tra IP và thử lại.";
        esp32Status.classList.remove("alert-success", "alert-info");
        esp32Status.classList.add("alert-danger");
      };
      
      // Test connection
      testImg.src = `http://${esp32Ip}/capture`;
    });
    
    // Function to switch from webcam to ESP32-CAM
    function switchToESP32Cam(esp32Ip) {
      // Stop existing camera if it's running
      if (streamRef) {
        const tracks = streamRef.getTracks();
        tracks.forEach(track => track.stop());
        streamRef = null;
      }
      
      // Clear any existing intervals
      if (faceDetectionInterval) {
        clearInterval(faceDetectionInterval);
      }
      
      // Set up ESP32 stream
      isUsingESP32 = true;
      
      // Create an img element for the ESP32 stream
      esp32Stream = document.createElement("img");
      esp32Stream.style.width = "100%";
      esp32Stream.style.height = "auto";
      esp32Stream.style.display = "block";
      
      // Replace video element content with ESP32 stream
      videoElement.style.display = "none";
      videoElement.parentNode.insertBefore(esp32Stream, videoElement);
      
      // Function to continuously update the image from ESP32
      function updateESP32Stream() {
        esp32Stream.src = `http://${esp32Ip}?t=${new Date().getTime()}`; // Add timestamp to prevent caching
        
        // Process the current frame for face detection
        setTimeout(() => {
          if (isUsingESP32) {
            const context = facePreview.getContext("2d");
            // Make sure canvas dimensions match the image
            if (esp32Stream.naturalWidth) {
              facePreview.width = esp32Stream.naturalWidth;
              facePreview.height = esp32Stream.naturalHeight;
            }
            context.drawImage(esp32Stream, 0, 0, facePreview.width, facePreview.height);
            
            // Send frame for face detection
            const frameData = facePreview.toDataURL("image/jpeg");
            detectFaces(frameData);
          }
        }, 100); // Small delay to ensure image is loaded
      }
      
      // Initial update
      esp32Stream.onload = function() {
        updateESP32Stream();
      };
      
      // Start stream
      esp32Stream.src = `http://${esp32Ip}`;
      
      // Set up interval for frame updates
      faceDetectionInterval = setInterval(() => {
        updateESP32Stream();
      }, 200);
      
      // Enable capture button
      capturePhotoBtn.disabled = false;
      
      // Update status
      photoStatus.textContent = 'Camera ESP32 đã sẵn sàng. Nhấn "Bắt đầu ghi" để ghi nhận khuôn mặt.';
      photoStatus.classList.remove("d-none", "alert-danger");
      photoStatus.classList.add("alert-info");
    }
    
    // Function to switch back to webcam
    function switchToWebcam() {
      if (isUsingESP32) {
        // Remove ESP32 stream
        if (esp32Stream && esp32Stream.parentNode) {
          esp32Stream.parentNode.removeChild(esp32Stream);
        }
        
        // Show video element again
        videoElement.style.display = "block";
        
        // Reset flag
        isUsingESP32 = false;
        
        // Start webcam
        startCamera();
      }
    }
    
    // Add a button to switch between ESP32 and webcam
    const switchCameraBtn = document.createElement("button");
    switchCameraBtn.className = "btn btn-secondary mt-2";
    switchCameraBtn.textContent = "Chuyển về Webcam";
    switchCameraBtn.onclick = switchToWebcam;
    connectESP32Btn.parentNode.appendChild(switchCameraBtn);
    
    // Original webcam startup function
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        streamRef = stream;
        videoElement.srcObject = stream;
        capturePhotoBtn.disabled = false;
  
        // Display notification
        photoStatus.textContent = 'Camera đã sẵn sàng. Nhấn "Bắt đầu ghi" để ghi nhận khuôn mặt.';
        photoStatus.classList.remove("d-none");
        photoStatus.classList.remove("alert-danger");
        photoStatus.classList.add("alert-info");
  
        // Setup face detection canvas
        videoElement.onloadedmetadata = function () {
          facePreview.width = videoElement.videoWidth;
          facePreview.height = videoElement.videoHeight;
          // Start face detection after video has loaded
          startFaceDetection();
        };
      } catch (error) {
        console.error("Lỗi khi truy cập camera:", error);
        photoStatus.textContent = "Không thể truy cập camera. Vui lòng kiểm tra quyền truy cập.";
        photoStatus.classList.remove("d-none");
        photoStatus.classList.add("alert-danger");
        capturePhotoBtn.disabled = true;
      }
    }
  
    // Face detection function - works with both webcam and ESP32
    function startFaceDetection() {
      // Create canvas for face detection
      facePreview.classList.remove("d-none");
  
      // Send video frames for face detection
      faceDetectionInterval = setInterval(() => {
        // Update canvas size if video has loaded
        if (!isUsingESP32 && videoElement.videoWidth && facePreview.width !== videoElement.videoWidth) {
          facePreview.width = videoElement.videoWidth;
          facePreview.height = videoElement.videoHeight;
        }
  
        const context = facePreview.getContext("2d");
        if (isUsingESP32) {
          if (esp32Stream && esp32Stream.complete) {
            context.drawImage(esp32Stream, 0, 0, facePreview.width, facePreview.height);
          }
        } else {
          context.drawImage(videoElement, 0, 0, facePreview.width, facePreview.height);
        }
  
        // Send frame to server for face detection
        const frameData = facePreview.toDataURL("image/jpeg");
        detectFaces(frameData);
      }, 200); // Update every 200ms
    }
  
    // Function to send frame for face detection
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
          // Draw boxes around detected faces
          drawFaceBoxes(result.faces);
        }
      } catch (error) {
        console.error("Lỗi khi phát hiện khuôn mặt:", error);
      }
    }
  
    // Function to draw boxes around faces
    function drawFaceBoxes(faces) {
      const context = facePreview.getContext("2d");
  
      // Clear old boxes
      if (isUsingESP32) {
        if (esp32Stream && esp32Stream.complete) {
          context.drawImage(esp32Stream, 0, 0, facePreview.width, facePreview.height);
        }
      } else {
        context.drawImage(videoElement, 0, 0, facePreview.width, facePreview.height);
      }
  
      // Draw new boxes
      context.strokeStyle = "#00FF00";
      context.lineWidth = 3;
  
      faces.forEach((face) => {
        context.strokeRect(face.x, face.y, face.width, face.height);
      });
    }
  
    // Handle "Start recording" button event
    capturePhotoBtn.addEventListener("click", function () {
      if (!isUsingESP32) {
        startCamera(); // Start camera if not already started
      }
      
      // Update UI
      capturePhotoBtn.disabled = true;
      capturePhotoBtn.innerHTML = 'Đang ghi... <span id="countdown">5</span>s';
  
      // Show progress bar
      recordingIndicator.classList.remove("d-none");
      recordingProgress.style.width = "0%";
  
      // Reset captured images array
      capturedImages = [];
      recordingTime = 0;
  
      // Start recording for 5 seconds
      recordingInterval = setInterval(() => {
        recordingTime += 0.1;
        const progressPercent = (recordingTime / recordingDuration) * 100;
  
        // Update progress bar
        recordingProgress.style.width = `${progressPercent}%`;
  
        // Update countdown
        const remainingTime = Math.ceil(recordingDuration - recordingTime);
        document.getElementById("countdown").textContent = remainingTime;
  
        // Capture photo every 0.5 seconds
        if (recordingTime % 0.5 < 0.1) {
          const tempCanvas = document.createElement("canvas");
          if (isUsingESP32) {
            if (esp32Stream && esp32Stream.complete) {
              tempCanvas.width = esp32Stream.naturalWidth || 640;
              tempCanvas.height = esp32Stream.naturalHeight || 480;
              const context = tempCanvas.getContext("2d");
              context.drawImage(esp32Stream, 0, 0, tempCanvas.width, tempCanvas.height);
              capturedImages.push(tempCanvas.toDataURL("image/jpeg"));
            }
          } else {
            tempCanvas.width = videoElement.videoWidth;
            tempCanvas.height = videoElement.videoHeight;
            const context = tempCanvas.getContext("2d");
            context.drawImage(videoElement, 0, 0, tempCanvas.width, tempCanvas.height);
            capturedImages.push(tempCanvas.toDataURL("image/jpeg"));
          }
        }
  
        // End after 5 seconds
        if (recordingTime >= recordingDuration) {
          clearInterval(recordingInterval);
          finishRecording();
        }
      }, 100);
    });
  
    // Function to finish recording
    function finishRecording() {
      // Update UI
      capturePhotoBtn.innerHTML = "Bắt đầu ghi";
      capturePhotoBtn.disabled = false;
      recordingIndicator.classList.add("d-none");
  
      // Display the last captured image
      if (capturedImages.length > 0) {
        const lastImage = capturedImages[capturedImages.length - 1];
        const context = canvas.getContext("2d");
  
        const img = new Image();
        img.onload = function () {
          canvas.width = img.width;
          canvas.height = img.height;
          context.drawImage(img, 0, 0);
  
          // Show captured image
          canvas.classList.remove("d-none");
          facePreview.classList.add("d-none");
  
          // Enable register button
          registerBtn.disabled = false;
        };
        img.src = lastImage;
  
        // Update status message
        photoStatus.textContent = `Đã ghi ${capturedImages.length} ảnh khuôn mặt thành công!`;
        photoStatus.classList.remove("alert-info", "alert-danger");
        photoStatus.classList.add("alert-success");
      } else {
        photoStatus.textContent = "Không thể chụp ảnh khuôn mặt. Vui lòng thử lại.";
        photoStatus.classList.remove("alert-info", "alert-success");
        photoStatus.classList.add("alert-danger");
      }
    }
  
    // Handle form submission
    registerForm.addEventListener("submit", async function (e) {
      e.preventDefault();
  
      // Check input information
      const name = document.getElementById("name").value.trim();
      const userId = document.getElementById("userId").value.trim();
  
      if (!name || !userId || capturedImages.length === 0) {
        photoStatus.textContent = "Vui lòng điền đầy đủ thông tin và chụp ảnh";
        photoStatus.classList.remove("alert-info", "alert-success");
        photoStatus.classList.add("alert-danger");
        return;
      }
  
      // Send registration data to server
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
  
        // Show results in modal
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
          canvas.classList.add("d-none");
          capturedImages = [];
  
          // Restart face detection
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
  
    // Clean up when user leaves the page
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