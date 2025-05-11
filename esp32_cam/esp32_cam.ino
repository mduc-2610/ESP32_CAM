#include "esp_camera.h"
#include <WiFi.h>
#include "esp_timer.h"
#include "img_converters.h"
#include "Arduino.h"
#include "fb_gfx.h"
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"
#include "esp_http_server.h"

// Replace with your Wi-Fi credentials
const char* ssid = "LTH";
const char* password = "lthishere";

#define PART_BOUNDARY "123456789000000000000987654321"

#define CAMERA_MODEL_AI_THINKER
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27
#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

static const char* _STREAM_CONTENT_TYPE = "multipart/x-mixed-replace;boundary=" PART_BOUNDARY;
static const char* _STREAM_BOUNDARY = "\r\n--" PART_BOUNDARY "\r\n";
static const char* _STREAM_PART = "Content-Type: image/jpeg\r\nContent-Length: %u\r\n\r\n";

httpd_handle_t stream_httpd = NULL;

// Hàm cấu hình camera cho chất lượng cao
void configure_camera_for_quality(sensor_t * s, bool high_quality) {
  if (s) {
    if (high_quality) {
      // Cài đặt cho chất lượng cao khi chụp ảnh
      s->set_framesize(s, FRAMESIZE_UXGA);  // 1600x1200
      s->set_quality(s, 8);                 // Chất lượng JPEG cao hơn (4-63, thấp = tốt)
      s->set_brightness(s, 1);              // Độ sáng (-2 đến 2)
      s->set_contrast(s, 1);                // Độ tương phản (-2 đến 2)
      s->set_saturation(s, 0);              // Độ bão hòa (-2 đến 2)
      s->set_sharpness(s, 1);               // Độ sắc nét (-2 đến 2)
      s->set_denoise(s, 1);                 // Giảm nhiễu
      s->set_gainceiling(s, GAINCEILING_4X); // Tăng độ nhạy sáng
      s->set_whitebal(s, 1);                // Cân bằng trắng tự động
      s->set_awb_gain(s, 1);                // Tăng ích cân bằng trắng
      s->set_wb_mode(s, 0);                 // 0-4, auto white balance
      s->set_exposure_ctrl(s, 1);           // Điều khiển phơi sáng tự động
      s->set_aec2(s, 1);                    // AEC tự động
      s->set_ae_level(s, 0);                // Mức phơi sáng (-2 đến 2)
      s->set_aec_value(s, 300);             // Giá trị phơi sáng (0-1200)
      s->set_gain_ctrl(s, 1);               // Điều khiển gain tự động
      s->set_agc_gain(s, 0);                // Mức AGC (0-30)
      s->set_bpc(s, 1);                     // Black pixel correction
      s->set_wpc(s, 1);                     // White pixel correction
      s->set_raw_gma(s, 1);                 // Raw gamma
      s->set_lenc(s, 1);                    // Lens correction
      s->set_hmirror(s, 0);                 // Lật ngang (0 hoặc 1)
      s->set_vflip(s, 0);                   // Lật dọc (0 hoặc 1)
      s->set_dcw(s, 1);                     // Downsize EN
    } else {
      // Cài đặt cho streaming mượt
      s->set_framesize(s, FRAMESIZE_VGA);   // 640x480 cho streaming
      s->set_quality(s, 10);                // Cân bằng giữa chất lượng và tốc độ
      s->set_brightness(s, 0);
      s->set_contrast(s, 0);
      s->set_saturation(s, 0);  
      s->set_sharpness(s, 0);
      s->set_denoise(s, 0);
      s->set_gainceiling(s, GAINCEILING_2X);
    }
  }
}

static esp_err_t stream_handler(httpd_req_t *req){
  camera_fb_t * fb = NULL;
  esp_err_t res = ESP_OK;
  size_t _jpg_buf_len = 0;
  uint8_t * _jpg_buf = NULL;
  char * part_buf[128];

  res = httpd_resp_set_type(req, _STREAM_CONTENT_TYPE);
  if(res != ESP_OK) return res;

  // CORS headers đầy đủ cho stream
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Methods", "GET, OPTIONS");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Headers", "Content-Type");
  httpd_resp_set_hdr(req, "Cross-Origin-Resource-Policy", "cross-origin");
  httpd_resp_set_hdr(req, "Cross-Origin-Embedder-Policy", "require-corp");
  httpd_resp_set_hdr(req, "Cache-Control", "no-cache, no-store, must-revalidate");
  httpd_resp_set_hdr(req, "Pragma", "no-cache");
  httpd_resp_set_hdr(req, "Expires", "0");

  // Cấu hình camera cho streaming
  sensor_t * s = esp_camera_sensor_get();
  configure_camera_for_quality(s, false);

  while(true){
    fb = esp_camera_fb_get();
    if (!fb) {
      res = ESP_FAIL;
      break;
    }

    if(fb->format != PIXFORMAT_JPEG){
      bool jpeg_converted = frame2jpg(fb, 85, &_jpg_buf, &_jpg_buf_len); // Chất lượng JPEG cao hơn
      esp_camera_fb_return(fb);
      fb = NULL;
      if(!jpeg_converted){
        res = ESP_FAIL;
        break;
      }
    } else {
      _jpg_buf_len = fb->len;
      _jpg_buf = fb->buf;
    }

    size_t hlen = snprintf((char *)part_buf, 128, _STREAM_PART, _jpg_buf_len);
    res = httpd_resp_send_chunk(req, (const char *)part_buf, hlen);
    if(res == ESP_OK) res = httpd_resp_send_chunk(req, (const char *)_jpg_buf, _jpg_buf_len);
    if(res == ESP_OK) res = httpd_resp_send_chunk(req, _STREAM_BOUNDARY, strlen(_STREAM_BOUNDARY));

    if(fb) esp_camera_fb_return(fb);
    if(_jpg_buf && fb == NULL) free(_jpg_buf);

    if(res != ESP_OK) break;

    // Giảm delay để stream mượt hơn
    vTaskDelay(5 / portTICK_PERIOD_MS);
  }

  return res;
}

static esp_err_t capture_handler(httpd_req_t *req) {
  // Đổi sang độ phân giải SVGA để đảm bảo ổn định
  sensor_t * s = esp_camera_sensor_get();
  s->set_framesize(s, FRAMESIZE_SVGA);  // 800x600 - ổn định hơn UXGA
  s->set_quality(s, 10);                // Chất lượng JPEG tốt
  
  // Đợi camera ổn định
  delay(200);  // Tăng thời gian chờ
  
  // Thử chụp nhiều lần
  camera_fb_t * fb = NULL;
  for(int i = 0; i < 3; i++) {
    fb = esp_camera_fb_get();
    if(fb) break;
    delay(100);
  }
  
  if (!fb) {
    // Khôi phục về VGA cho streaming
    s->set_framesize(s, FRAMESIZE_VGA);
    s->set_quality(s, 10);
    
    httpd_resp_set_status(req, "500 Internal Server Error");
    httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
    httpd_resp_set_hdr(req, "Access-Control-Allow-Methods", "GET, OPTIONS");
    httpd_resp_set_hdr(req, "Cross-Origin-Resource-Policy", "cross-origin");
    httpd_resp_send(req, "Camera capture failed", HTTPD_RESP_USE_STRLEN);
    return ESP_FAIL;
  }

  httpd_resp_set_status(req, "200 OK");
  httpd_resp_set_type(req, "image/jpeg");
  
  // CORS headers đầy đủ cho capture
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Methods", "GET, OPTIONS");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Headers", "Content-Type");
  httpd_resp_set_hdr(req, "Cross-Origin-Resource-Policy", "cross-origin"); 
  httpd_resp_set_hdr(req, "Cross-Origin-Embedder-Policy", "require-corp");
  httpd_resp_set_hdr(req, "Content-Disposition", "inline; filename=capture.jpg");
  httpd_resp_set_hdr(req, "Cache-Control", "no-cache, no-store, must-revalidate");
  
  esp_err_t res = httpd_resp_send(req, (const char *)fb->buf, fb->len);
  esp_camera_fb_return(fb);
  
  // Khôi phục về VGA cho streaming
  s->set_framesize(s, FRAMESIZE_VGA);
  s->set_quality(s, 10);
  
  return res;
}

static esp_err_t options_handler(httpd_req_t *req){
  // CORS headers đầy đủ cho OPTIONS requests
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Headers", "Content-Type, Accept, Origin");
  httpd_resp_set_hdr(req, "Access-Control-Max-Age", "86400");
  httpd_resp_set_hdr(req, "Cross-Origin-Resource-Policy", "cross-origin");
  httpd_resp_set_hdr(req, "Cross-Origin-Embedder-Policy", "require-corp");
  httpd_resp_send(req, NULL, 0);
  return ESP_OK;
}

// Thêm handler cho CORS preflight riêng cho stream
static esp_err_t stream_options_handler(httpd_req_t *req){
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Methods", "GET, OPTIONS");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Headers", "Content-Type, Accept, Origin");
  httpd_resp_set_hdr(req, "Access-Control-Max-Age", "86400");
  httpd_resp_set_hdr(req, "Cross-Origin-Resource-Policy", "cross-origin");
  httpd_resp_set_hdr(req, "Cross-Origin-Embedder-Policy", "require-corp");
  httpd_resp_send(req, NULL, 0);
  return ESP_OK;
}

void startCameraServer(){
  httpd_config_t config = HTTPD_DEFAULT_CONFIG();
  config.server_port = 80;
  config.max_uri_handlers = 10;
  config.max_open_sockets = 7;  // Tăng số lượng socket
  config.stack_size = 8192;     // Tăng stack size

  httpd_uri_t index_uri = {
    .uri       = "/stream",
    .method    = HTTP_GET,
    .handler   = stream_handler,
    .user_ctx  = NULL
  };

  httpd_uri_t capture_uri = {
    .uri       = "/capture",
    .method    = HTTP_GET,
    .handler   = capture_handler,
    .user_ctx  = NULL
  };
  
  // OPTIONS handler riêng cho stream
  httpd_uri_t stream_options_uri = {
    .uri       = "/stream",
    .method    = HTTP_OPTIONS,
    .handler   = stream_options_handler,
    .user_ctx  = NULL
  };
  
  // OPTIONS handler chung
  httpd_uri_t options_uri = {
    .uri       = "/*",
    .method    = HTTP_OPTIONS,
    .handler   = options_handler,
    .user_ctx  = NULL
  };
  
  if (httpd_start(&stream_httpd, &config) == ESP_OK) {
    httpd_register_uri_handler(stream_httpd, &index_uri);
    httpd_register_uri_handler(stream_httpd, &capture_uri);
    httpd_register_uri_handler(stream_httpd, &stream_options_uri);
    httpd_register_uri_handler(stream_httpd, &options_uri);
  }
}

void setup() {
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0); // disable brownout detector
  Serial.begin(115200);

  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;
  config.grab_mode = CAMERA_GRAB_LATEST;  // Lấy frame mới nhất

  // Cấu hình ban đầu cho PSRAM
  if(psramFound()){
    config.frame_size = FRAMESIZE_VGA;  // Khởi đầu với VGA cho streaming
    config.jpeg_quality = 10;
    config.fb_count = 2;  // Tăng buffer count
    config.fb_location = CAMERA_FB_IN_PSRAM;
  } else {
    config.frame_size = FRAMESIZE_QVGA;
    config.jpeg_quality = 12;
    config.fb_count = 1;
    config.fb_location = CAMERA_FB_IN_DRAM;
  }

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed with error 0x%x", err);
    return;
  }

  // Cấu hình ban đầu cho camera
  sensor_t * s = esp_camera_sensor_get();
  configure_camera_for_quality(s, false);  // Bắt đầu với cấu hình streaming

  WiFi.begin(ssid, password);
  WiFi.setSleep(false); // disable Wi-Fi sleep for performance
  int attempts = 0;

  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("");
    Serial.println("WiFi connected");
    Serial.print("Camera Stream Ready! Go to: http://");
    Serial.println(WiFi.localIP());
    startCameraServer();
  } else {
    Serial.println("WiFi connection failed.");
  }
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    WiFi.begin(ssid, password);
    delay(5000);
  }
  delay(10000);
}