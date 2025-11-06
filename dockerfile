# Node.js LTS 이미지 사용
FROM node:18

# 작업 디렉토리 생성
WORKDIR /usr/src/app

# package.json과 lock 파일 복사
COPY package*.json ./

# 의존성 설치
RUN npm install --production

# 나머지 파일 복사
COPY . .

# 포트 개방
EXPOSE 3002

# 앱 실행
CMD ["npm", "start"]
