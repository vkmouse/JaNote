# 開發用 Dockerfile - 支援熱重載
FROM node:lts

WORKDIR /app

# 複製 package.json 和 package-lock.json
COPY package*.json ./

# 安裝依賴
RUN npm install
RUN npm install -g wrangler
RUN npm install -g wait-on

# 複製整個專案
COPY . .

EXPOSE 8888
EXPOSE 5173

# 使用 Wrangler Pages 開發伺服器，代理到 Vite
CMD ["sh", "-c", "npm run dev -- --host 0.0.0.0 & wait-on tcp:5173 && wrangler pages dev --proxy 5173 --port 8888 --local --ip 0.0.0.0"]
