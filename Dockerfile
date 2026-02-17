# 開發用 Dockerfile - 支援熱重載
FROM node:lts

WORKDIR /app

# 複製 package.json 和 package-lock.json
COPY package*.json ./

# 安裝依賴
RUN npm install

# 複製整個專案
COPY . .

EXPOSE 5173

# 使用 Vite 開發伺服器，支援熱重載
CMD ["npm", "run", "dev"]
