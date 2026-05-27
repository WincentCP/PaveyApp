# Menggunakan base image Python yang stabil dan ringan (slim)
FROM python:3.10-slim

# Set working directory di dalam container
WORKDIR /app

# Install dependensi sistem Linux yang diperlukan untuk build roda (wheel) C++
# Beberapa library seperti Tiktoken atau Uvicorn kadang butuh GCC saat dicompile
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements.txt duluan agar bisa memanfaatkan Docker layer caching
COPY requirements.txt .

# Upgrade pip dan install semua library Python tanpa menyimpan cache installan
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy seluruh source code proyek dari laptop ke dalam container
COPY . .

# Buka jalur port 8000 (port default FastAPI)
EXPOSE 8000

# Jalankan server Uvicorn untuk mengangkat aplikasi web API kita
# Menggunakan host 0.0.0.0 agar bisa diakses dari luar container oleh PWA/Frontend
CMD ["uvicorn", "src.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
