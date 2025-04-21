// static/js/attendance.js - Refactored version
document.addEventListener("DOMContentLoaded", function () {
  // DOM elements
  const cameraStream = document.getElementById("cameraStream");
  const canvas = document.getElementById("canvas");
  const facePreview = document.getElementById("facePreview");
  const startCameraBtn = document.getElementById("startCamera");
  const attendanceList = document.getElementById("attendanceList");
  const dateTimeDisplay = document.getElementById("dateTimeDisplay");
  const cameraIpInput = document.getElementById("cameraIpInput");
  const connectCameraBtn = document.getElementById("connectCamera");
  const photoStatus = document.getElementById("photoStatus");
  
  // State variables
  let cameraIp = "";
  let streamActive = false;
  let frameCapturingInterval = null;
  let faceDetectionInterval = null;
  let connectionAttempts = 0;
  const MAX_CONNECTION_ATTEMPTS = 3;
  let recognitionActive = false;
  let lastRecognizedFaces = [];

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
    
    // Hide camera stream element if it exists
    if (cameraStream) {
      cameraStream.style.display = "none";
    }
    
    // Update UI to show success
    streamActive = true;
    startCameraBtn.disabled = false;
    connectCameraBtn.disabled = false;
    connectCameraBtn.textContent = "Đã kết nối";
    connectCameraBtn.classList.remove("btn-outline-primary");
    connectCameraBtn.classList.add("btn-success");
    
    photoStatus.textContent = 'Camera ESP32 đã sẵn sàng. Nhấn "Bắt đầu nhận diện" để ghi nhận khuôn mặt.';
    photoStatus.classList.remove("alert-danger");
    photoStatus.classList.add("alert-success");

    // Initialize face preview
    facePreview.classList.remove("d-none");
    facePreview.width = 480; // Default width
    facePreview.height = 360; // Default height
    
    // Start detecting faces
    startFaceDetection(recognitionActive);
    
    // Save the camera IP for future use
    saveCameraIpToLocalStorage();
  }

  function startFaceDetection(isReconition = false) {
    // Clear any existing interval
    if (faceDetectionInterval) {
      clearInterval(faceDetectionInterval);
    }
    
    facePreview.classList.remove("d-none");

    // Start capturing frames at regular intervals
    // Use a faster rate for preview (like in register.js)
    faceDetectionInterval = setInterval(() => {
      captureFrameFromESP32(isReconition); // false = no recognition, just preview
    }, 500); // Capture frame every 200ms for smoother preview
  }

  // Start camera button event handler
  if (startCameraBtn) {
    startCameraBtn.addEventListener("click", function () {
      if (!streamActive) {
        photoStatus.textContent = "Vui lòng kết nối ESP32-CAM trước khi bắt đầu nhận diện";
        photoStatus.classList.remove("alert-info", "alert-success");
        photoStatus.classList.add("alert-warning");
        return;
      }
      
      // Update UI
      if (recognitionActive) {
        // Stop recognition
        stopFaceRecognition();
        startCameraBtn.textContent = "Bắt đầu nhận diện";
        photoStatus.textContent = "Đã dừng nhận diện khuôn mặt";
        photoStatus.classList.remove("alert-success");
        photoStatus.classList.add("alert-info");
      } else {
        // Start recognition
        startCameraBtn.textContent = "Dừng nhận diện";
        photoStatus.textContent = "Đang nhận diện khuôn mặt...";
        photoStatus.classList.remove("alert-info");
        photoStatus.classList.add("alert-success");
        startFaceRecognition();
      }
      
      // Toggle recognition state
      recognitionActive = !recognitionActive;
    });
  }

  async function captureFrameFromESP32(performRecognition = true) {
    if (!streamActive) return;
    
    try {
      // Add timestamp to prevent browser caching
      const timestamp = new Date().getTime();
      const proxyUrl = `/api/proxy/esp32cam/capture?ip=${encodeURIComponent(cameraIp)}&t=${timestamp}`;
      
      const response = await fetch(proxyUrl, {
        method: 'GET',
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
        
        // Only perform recognition if it's active and recognition is requested
        // This allows us to separate the faster preview updates from the slower recognition
        console.log("Rec active: " + recognitionActive + " - " + "Perform active: " + performRecognition);
        if (performRecognition) {
          console.log("Recognizing faces...");
          recognizeFaces(frameData);
        } else if (!performRecognition) {
          console.log("Detecting faces for preview...");
          detectFaces(frameData);
        }
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

  function startFaceRecognition() {
    // Clear existing recognition interval if it exists
    if (frameCapturingInterval) {
      clearInterval(frameCapturingInterval);
    }
    
    recognitionActive = true;
    
    // Create a separate interval for recognition at a slower rate
    // This allows the preview to remain smooth while not overloading the server
    frameCapturingInterval = setInterval(() => {
      captureFrameFromESP32(true); // true = perform recognition
    }, 1000); // Recognition every 1 second
  }
  
  function stopFaceRecognition() {
    recognitionActive = false;
    if (frameCapturingInterval) {
      clearInterval(frameCapturingInterval);
      frameCapturingInterval = null;
    }
  }

  // Using detection only for preview (faster)
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
      // Don't show errors for preview-only detection
    }
  }

  // Draw simple face boxes without names (for preview)
  function drawFaceBoxes(faces) {
    if (!facePreview) return;
    
    const context = facePreview.getContext("2d");
    
    // Don't clear the canvas as the drawFrameToCanvas already drew the base image
    
    // Draw the face boxes
    context.strokeStyle = "#00FF00";
    context.lineWidth = 3;

    faces.forEach((face) => {
      context.strokeRect(face.x, face.y, face.width, face.height);
    });
  }

  // Send frame for face recognition (full recognition with names)
  async function recognizeFaces(frameData) {
    try {
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
        // Draw face boxes with names
        drawFaceBoxesWithNames(result.faces, frameData);
        
        // Store the recognized faces
        lastRecognizedFaces = result.faces;
        
        // Update attendance list if new attendance was created
        if (result.attendance) {
          loadAttendanceList();
          photoStatus.textContent = "Điểm danh thành công!";
          photoStatus.classList.remove("alert-info", "alert-warning");
          photoStatus.classList.add("alert-success");
        }
        else {
          photoStatus.textContent = "Không nhận diện được khuôn mặt nào.";
          photoStatus.classList.remove("alert-success", "alert-info");
          photoStatus.classList.add("alert-warning");
        }
      } else {
        photoStatus.textContent = `Lỗi khi nhận diện: ${result.message || "Unknown error"}`;
        photoStatus.classList.remove("alert-success", "alert-info");
        photoStatus.classList.add("alert-warning");
      }
    } catch (error) {
      console.error("Error in face recognition:", error);
      photoStatus.textContent = `Lỗi nhận diện khuôn mặt: ${error.message}`;
      photoStatus.classList.remove("alert-success", "alert-info");
      photoStatus.classList.add("alert-danger");
    }
  }

  // Draw boxes around detected faces with names
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
        
        const textMetrics = context.measureText(displayText);
        const textWidth = textMetrics.width;
        const textHeight = 25;
        
        context.fillStyle = "rgba(0, 0, 0, 0.7)";
        context.fillRect(face.x, face.y - textHeight, textWidth + 10, textHeight);

        // Draw name text
        context.fillStyle = face.name ? "#00FF00" : "#FF0000";
        context.font = "16px Arial";
        context.fillText(displayText, face.x + 5, face.y - 8);
      });
    };
    
    // Load the image
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

      // Clear existing data
      attendanceList.innerHTML = "";

      // Add new data
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
    if (faceDetectionInterval) {
      clearInterval(faceDetectionInterval);
    }
    if (frameCapturingInterval) {
      clearInterval(frameCapturingInterval);
    }
  });
});