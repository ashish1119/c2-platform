# FROM python:3.11-slim

# WORKDIR /app

# RUN apt-get update && apt-get install -y \
#     gcc \
#     libpq-dev \
#     build-essential \
#     && rm -rf /var/lib/apt/lists/*

# COPY requirements.txt .

# RUN pip install --no-cache-dir -r requirements.txt

# COPY ./app ./app
# COPY ./tools ./tools

# EXPOSE 8000

# CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    gcc \
    build-essential \
    libpq-dev \
    libproj-dev \
    proj-bin \
    proj-data \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --upgrade pip

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY ./app ./app
COPY ./tools ./tools

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]