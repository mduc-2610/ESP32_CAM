// static/js/reports.js
document.addEventListener("DOMContentLoaded", function () {
  // Các phần tử DOM
  const datePicker = document.getElementById("datePicker");
  const viewBtn = document.getElementById("viewBtn");
  const exportBtn = document.getElementById("exportBtn");
  const reportData = document.getElementById("reportData");
  const userData = document.getElementById("userData");
  const noDataMessage = document.getElementById("noDataMessage");

  // Thiết lập ngày mặc định cho date picker là hôm nay
  const today = new Date().toISOString().split("T")[0];
  datePicker.value = today;

  // Xử lý sự kiện khi nhấn nút "Xem"
  viewBtn.addEventListener("click", function () {
    loadAttendanceReport(datePicker.value);
  });

  // Xử lý sự kiện khi nhấn nút "Xuất Excel"
  exportBtn.addEventListener("click", function () {
    exportToExcel(datePicker.value);
  });

  // Hàm tải báo cáo điểm danh từ server
  async function loadAttendanceReport(date) {
    try {
      const response = await fetch(`/api/attendance?date=${date}`);
      const attendanceData = await response.json();

      // Xóa dữ liệu cũ
      reportData.innerHTML = "";

      // Thêm dữ liệu mới
      if (attendanceData.length === 0) {
        noDataMessage.classList.remove("d-none");
      } else {
        noDataMessage.classList.add("d-none");

        attendanceData.forEach((record, index) => {
          const row = document.createElement("tr");

          // Xác định trạng thái điểm danh (đúng giờ, trễ,...)
          const time = new Date(`${date}T${record.time}`);
          const hours = time.getHours();
          let status = "";
          let statusClass = "";

          if (hours < 8) {
            status = "Đúng giờ";
            statusClass = "badge-success";
          } else if (hours < 9) {
            status = "Trễ";
            statusClass = "badge-warning";
          } else {
            status = "Muộn";
            statusClass = "badge-danger";
          }

          row.innerHTML = `
                        <td>${index + 1}</td>
                        <td>${record.name}</td>
                        <td>${record.userId}</td>
                        <td>${record.time}</td>
                        <td><span class="badge ${statusClass}">${status}</span></td>
                    `;
          reportData.appendChild(row);
        });
      }
    } catch (error) {
      console.error("Lỗi khi tải báo cáo điểm danh:", error);
    }
  }

  // Hàm xuất báo cáo ra Excel
  async function exportToExcel(date) {
    try {
      // Tạo URL download
      const downloadUrl = `/api/export?date=${date}`;

      // Tạo và kích hoạt link download
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `attendance_report_${date}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (error) {
      console.error("Lỗi khi xuất Excel:", error);
    }
  }

  // Hàm tải danh sách người dùng
  async function loadUserList() {
    try {
      const response = await fetch("/api/users");
      const userData = await response.json();

      // Thêm dữ liệu người dùng
      const userTableBody = document.getElementById("userData");

      userData.forEach((user, index) => {
        const row = document.createElement("tr");
        row.innerHTML = `
                    <td>${index + 1}</td>
                    <td>${user.name}</td>
                    <td>${user.userId}</td>
                    <td><img src="${user.imagePath}" alt="${
          user.name
        }" class="user-img"></td>
                    <td>${new Date(user.createdAt).toLocaleDateString(
                      "vi-VN"
                    )}</td>
                `;
        userTableBody.appendChild(row);
      });
    } catch (error) {
      console.error("Lỗi khi tải danh sách người dùng:", error);
    }
  }

  // Tải báo cáo và danh sách người dùng khi trang được tải
  loadAttendanceReport(today);
  loadUserList();
});
